// backend/server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

// validators (your existing validators file)
const {
  validateDailyCheckinPayload,
  validateAssignInterventionPayload,
  validateCompleteInterventionPayload,
  isUUID,
} = require('./utils/validate');

// routes & middleware
const authRoutes = require('./routes/auth'); // should export an express.Router()
const { authMiddleware } = require('./middleware/auth'); // should export function authMiddleware(req,res,next)
const { clerkAuth } = require('./middleware/clerk'); // expected to export clerkAuth middleware (see notes below)

// --- Config (from .env) ---
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || null; // n8n incoming webhook (mentor-dispatch)
const N8N_SECRET = process.env.N8N_SECRET || null; // shared secret for n8n -> backend calls
const DATABASE_URL = process.env.DATABASE_URL || null;

if (!DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Please add it to .env.');
}

// --- App + server + socket setup ---
const app = express();
const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Postgres pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// --- Middlewares ---
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

// attach db + io to req so handlers can use req.db and req.io
app.use((req, res, next) => {
  req.db = pool;
  req.io = io;
  next();
});

// mount auth routes at /auth
app.use('/auth', authRoutes);

// health
app.get('/', (req, res) => {
  res.json({ ok: true, server: 'Alcovia backend', time: new Date().toISOString() });
});

/**
 * POST /daily-checkin
 * - validates payload
 * - generates attempt_id
 * - inserts daily_log with status
 * - updates student status (On Track / Needs Intervention)
 * - emits socket events
 * - notifies n8n (fire-and-forget) with attempt_id
 */
app.post('/daily-checkin', async (req, res) => {
  const payload = req.body;
  const validation = validateDailyCheckinPayload(payload);
  if (!validation.ok) {
    return res.status(400).json({ ok: false, errors: validation.errors });
  }

  const { student_id, quiz_score, focus_minutes, mentor_email } = payload;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock student row to avoid race
    const scheck = await client.query(
      `SELECT id FROM students WHERE id = $1 FOR UPDATE`,
      [student_id]
    );
    if (scheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'student not found' });
    }

    // Create an attempt_id for idempotency + correlation
    const attempt_id = randomUUID();

    const pass = quiz_score > 7 && focus_minutes > 60;
    const logStatus = pass ? 'On Track' : 'Needs Intervention';

    // Insert daily log (assumes daily_logs has attempt_id column)
    await client.query(
      `INSERT INTO daily_logs (attempt_id, student_id, quiz_score, focus_minutes, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [attempt_id, student_id, quiz_score, focus_minutes, logStatus]
    );

    if (pass) {
      await client.query(`UPDATE students SET status='On Track', updated_at=NOW() WHERE id=$1`, [student_id]);
      await client.query('COMMIT');

      // emit socket event (best-effort)
      try {
        io.to(`student_${student_id}`).emit('student_on_track', { student_id, attempt_id, quiz_score, focus_minutes });
      } catch (e) {
        console.warn('socket emit failed (student_on_track):', e?.message || e);
      }

      return res.json({ status: 'On Track', attempt_id });
    }

    // FAIL -> Needs Intervention
    await client.query(`UPDATE students SET status='Needs Intervention', updated_at=NOW() WHERE id=$1`, [student_id]);
    await client.query('COMMIT');

    // Socket event to inform UI
    try {
      io.to(`student_${student_id}`).emit('student_locked', {
        student_id,
        attempt_id,
        quiz_score,
        focus_minutes,
        message: 'Locked: waiting for mentor review',
      });
    } catch (emitErr) {
      console.warn('socket emit error (student_locked):', emitErr?.message || emitErr);
    }

    // Fire-and-forget: notify n8n with attempt_id + context
    if (N8N_WEBHOOK_URL) {
      axios
        .post(N8N_WEBHOOK_URL, {
          student_id,
          attempt_id,
          quiz_score,
          focus_minutes,
          mentor_email,
          spec_path: ASSIGNMENT_SPEC_PATH,
        })
        .then(() => console.log('n8n webhook fired for', student_id, 'attempt', attempt_id))
        .catch((err) => console.error('n8n webhook error:', err?.message || err));
    } else {
      console.log('N8N_WEBHOOK_URL not set; skipping n8n notification.');
    }

    return res.json({ status: 'Pending Mentor Review', attempt_id });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.warn('rollback failed', rbErr?.message || rbErr);
    }
    console.error('daily-checkin transaction error:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  } finally {
    client.release();
  }
});

/**
 * POST /assign-intervention
 * - Accepts calls from n8n (x-n8n-secret) OR Clerk-authenticated users
 * - Request body: { student_id, attempt_id, task, mentor_id }
 * - Idempotent: checks existing interventions by attempt_id
 * - Inserts intervention, updates daily_logs and students, emits socket event
 */
app.post('/assign-intervention', async (req, res) => {
  // First: machine auth via x-n8n-secret
  const incomingSecret = req.headers['x-n8n-secret'];
  const expectedSecret = N8N_SECRET;

  if (expectedSecret && incomingSecret === expectedSecret) {
    return assignInterventionHandler(req, res);
  }

  return clerkAuth(req, res, () => assignInterventionHandler(req, res));
});

app.post('/report-cheat', async (req, res) => {
    const { student_id, cheat_reason, focus_minutes = 0 } = req.body;
    if (!student_id) return res.status(400).json({ ok:false, error:'student_id required' });
    try {
      await pool.query('INSERT INTO daily_logs(student_id, quiz_score, focus_minutes, status, meta) VALUES ($1, $2, $3, $4, $5)', [student_id, 0, focus_minutes, 'Cheated', JSON.stringify({ cheat_reason })]);
      await pool.query(`UPDATE students SET status='Needs Intervention', updated_at=NOW() WHERE id=$1`, [student_id]);
      if (N8N_WEBHOOK_URL) axios.post(N8N_WEBHOOK_URL, { student_id, quiz_score: 0, focus_minutes, cheat_reason }).catch(() => {});
      try { io.to(`student_${student_id}`).emit('student_locked', { student_id, message: 'Locked due to cheat detection' }); } catch(e){}
      return res.json({ ok:true });
    } catch(err) {
      console.error(err);
      return res.status(500).json({ ok:false, error:'server error' });
    }
  });
  

async function assignInterventionHandler(req, res) {
  const validation = validateAssignInterventionPayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ ok: false, errors: validation.errors });
  }

  const { student_id, attempt_id, task = 'Remedial task assigned by mentor', mentor_id } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (attempt_id) {
      const check = await client.query(`SELECT id FROM interventions WHERE attempt_id = $1 LIMIT 1`, [attempt_id]);
      if (check.rowCount > 0) {
        await client.query('COMMIT');
        return res.json({ ok: true, message: 'already_assigned' });
      }
    }

    const insertRes = await client.query(
      `INSERT INTO interventions (attempt_id, student_id, task, mentor_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'Pending', NOW())
       RETURNING id`,
      [attempt_id || null, student_id, task, mentor_id || null]
    );
    const interventionId = insertRes.rows[0].id;

    // Update daily_logs status for the attempt (if present)
    if (attempt_id) {
      await client.query(`UPDATE daily_logs SET status='Remedial' WHERE attempt_id = $1`, [attempt_id]);
    } else {
      // If no attempt_id, mark latest daily log as Remedial as fallback
      await client.query(
        `UPDATE daily_logs SET status='Remedial'
         WHERE id = (
           SELECT id FROM daily_logs WHERE student_id=$1 ORDER BY created_at DESC LIMIT 1
         )`,
        [student_id]
      );
    }

    // Update student status and attach current intervention
    await client.query(
      `UPDATE students SET status='Remedial', current_intervention_id = $1, updated_at=NOW() WHERE id=$2`,
      [interventionId, student_id]
    );

    await client.query('COMMIT');

    // emit socket event
    try {
      io.to(`student_${student_id}`).emit('intervention_assigned', {
        student_id,
        interventionId,
        attempt_id,
        task,
        mentor_id,
      });
    } catch (e) {
      console.warn('socket emit failed (intervention_assigned):', e?.message || e);
    }

    return res.json({ ok: true, interventionId, attempt_id, task });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.warn('rollback failed after assign-intervention error', rbErr?.message || rbErr);
    }
    console.error('assign-intervention error:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  } finally {
    client.release();
  }
}

/**
 * POST /complete-intervention
 * - marks intervention(s) complete and unlocks student
 * - protected by authMiddleware (human UI calls)
 */
app.post('/complete-intervention', authMiddleware, async (req, res) => {
  const validation = validateCompleteInterventionPayload(req.body);
  if (!validation.ok) return res.status(400).json({ ok: false, errors: validation.errors });

  const { student_id } = req.body;

  try {
    await pool.query(`UPDATE interventions SET status='Completed', completed_at=NOW() WHERE student_id=$1 AND status='Pending'`, [student_id]);
    await pool.query(`UPDATE students SET status='On Track', current_intervention_id=NULL, updated_at=NOW() WHERE id=$1`, [student_id]);
    try {
      io.to(`student_${student_id}`).emit('intervention_completed', { student_id });
    } catch (e) {
      console.warn('emit intervention_completed failed', e?.message || e);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('complete-intervention error:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

/**
 * GET /student-status
 * - returns the student's status and current intervention task if any
 * - protected by authMiddleware
 */
app.get('/student-status', authMiddleware, async (req, res) => {
  const student_id = req.query.student_id;
  if (!isUUID(student_id)) return res.status(400).json({ ok: false, error: 'student_id must be a valid UUID' });

  try {
    const r = await pool.query(`SELECT status, current_intervention_id FROM students WHERE id=$1`, [student_id]);
    if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'student not found' });

    const row = r.rows[0];
    let task = null;
    if (row.current_intervention_id) {
      const t = await pool.query(`SELECT task FROM interventions WHERE id=$1`, [row.current_intervention_id]);
      if (t.rowCount) task = t.rows[0].task;
    }
    return res.json({ ok: true, status: row.status, task });
  } catch (err) {
    console.error('student-status error:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

// socket.io connection handling
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join_student', (data) => {
    const student_id = data && data.student_id;
    if (!student_id) {
      console.warn('join_student called without student_id');
      return;
    }
    socket.join(`student_${student_id}`);
    console.log(`Socket ${socket.id} joined room student_${student_id}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// start server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!DATABASE_URL) {
    console.warn('DATABASE_URL not configured. DB queries will fail until set.');
  }
});
