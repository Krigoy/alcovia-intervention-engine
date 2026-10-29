import http from "http";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import pkg from "pg";
import { Server as SocketServer } from "socket.io";
import {
  isUUID,
  validateDailyCheckinPayload,
  validateAssignInterventionPayload,
  validateCompleteInterventionPayload,
} from "./utils/validate.js";

dotenv.config();
const { Pool } = pkg;

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "";
const N8N_SECRET = process.env.N8N_SECRET || "";
const MENTOR_EMAIL = process.env.MENTOR_EMAIL || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.ALLOW_DEV_AUTH_BYPASS === "true";

// CORS: comma-separated FRONTEND_ORIGIN, or any origin when unset.
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const corsOrigin = allowedOrigins.length ? allowedOrigins : "*";
const corsOptions = {
  origin: corsOrigin,
  credentials: corsOrigin !== "*",
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
});

const studentRoom = (id) => `student:${id}`;
const mentorRoom = (email) => `mentor:${String(email).trim().toLowerCase()}`;

// ----------------------------
// STUDENTS
// ----------------------------
// Accepts either a students.id UUID or a Clerk user ID. Clerk IDs are
// upserted into students.clerk_user_id when `create` is true.
async function resolveStudent(ref, { create = false } = {}) {
  if (!ref || typeof ref !== "string") return null;

  if (isUUID(ref)) {
    const { rows } = await pool.query(
      `SELECT * FROM students WHERE id = $1 LIMIT 1`,
      [ref]
    );
    return rows[0] || null;
  }

  if (!create) {
    const { rows } = await pool.query(
      `SELECT * FROM students WHERE clerk_user_id = $1 LIMIT 1`,
      [ref]
    );
    return rows[0] || null;
  }

  const { rows } = await pool.query(
    `INSERT INTO students (clerk_user_id, status)
     VALUES ($1, 'On Track')
     ON CONFLICT (clerk_user_id) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [ref]
  );
  return rows[0];
}

// ----------------------------
// AUTH
// ----------------------------
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Clerk verification is loaded lazily so the server still starts (with
// Bearer auth disabled) if CLERK_SECRET_KEY is unset or the SDK API differs.
let clerkVerifierPromise = null;
function getClerkVerifier() {
  if (!clerkVerifierPromise) {
    clerkVerifierPromise = (async () => {
      if (!CLERK_SECRET_KEY) return null;
      try {
        const mod = await import("@clerk/clerk-sdk-node");
        const fn = mod.verifyToken || mod.default?.verifyToken;
        if (typeof fn === "function") return fn;
        const client = mod.clerkClient || mod.default?.clerkClient;
        if (typeof client?.verifyToken === "function") {
          return (token, options) => client.verifyToken(token, options);
        }
        console.warn("Clerk SDK has no verifyToken export; Bearer auth disabled");
        return null;
      } catch (err) {
        console.warn("Unable to load @clerk/clerk-sdk-node; Bearer auth disabled:", err.message);
        return null;
      }
    })();
  }
  return clerkVerifierPromise;
}

async function verifyClerkBearer(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const verify = await getClerkVerifier();
  if (!verify) return null;

  try {
    const options = { secretKey: CLERK_SECRET_KEY };
    if (process.env.CLERK_JWT_KEY) options.jwtKey = process.env.CLERK_JWT_KEY;
    const result = await verify(token, options);
    // @clerk/backend v1 returns the payload; newer versions return { data, errors }.
    if (result?.errors?.length) return null;
    const payload = result?.data ?? result;
    return payload?.sub ? { userId: payload.sub } : null;
  } catch (err) {
    console.warn("Clerk token verification failed:", err.message);
    return null;
  }
}

// Allows n8n (x-n8n-secret) or a signed-in Clerk user (Authorization: Bearer).
async function requireAuth(req, res, next) {
  try {
    const secret = req.headers["x-n8n-secret"];
    if (N8N_SECRET && secret && safeEqual(secret, N8N_SECRET)) {
      req.auth = { via: "n8n" };
      return next();
    }

    const clerk = await verifyClerkBearer(req);
    if (clerk) {
      req.auth = { via: "clerk", userId: clerk.userId };
      return next();
    }

    if (DEV_AUTH_BYPASS) {
      console.warn(`DEV AUTH BYPASS: allowing unauthenticated ${req.method} ${req.path}`);
      req.auth = { via: "dev-bypass" };
      return next();
    }

    return res.status(401).json({ ok: false, error: "unauthorized" });
  } catch (err) {
    console.error("auth ERROR:", err);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}

// ----------------------------
// N8N
// ----------------------------
// Fire-and-forget: a slow or missing n8n must never fail the check-in.
function notifyMentor(payload) {
  if (!N8N_WEBHOOK_URL) {
    console.warn("N8N_WEBHOOK_URL not set — skipping mentor notification");
    return;
  }

  axios
    .post(N8N_WEBHOOK_URL, payload, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "x-n8n-secret": N8N_SECRET,
      },
    })
    .then(() => console.log("N8N webhook triggered for attempt", payload.attempt_id))
    .catch((err) => console.error("N8N webhook failed:", err.message));
}

// ----------------------------
// DAILY CHECK-IN
// ----------------------------
app.post("/daily-checkin", async (req, res) => {
  try {
    const { student_id, mentor_email } = req.body || {};

    const v = validateDailyCheckinPayload(req.body);
    if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });
    const { quiz_score, focus_minutes } = v.sanitized;

    const student = await resolveStudent(student_id, { create: true });
    if (!student) return res.status(404).json({ ok: false, error: "student not found" });

    const status =
      quiz_score >= 5 && focus_minutes >= 25
        ? "On Track"
        : "Needs Intervention";

    const result = await pool.query(
      `INSERT INTO daily_logs (attempt_id, student_id, quiz_score, focus_minutes, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING attempt_id`,
      [student.id, quiz_score, focus_minutes, status]
    );
    const attempt_id = result.rows[0].attempt_id;

    // While a remedial task is open the student stays in Remedial until it is
    // completed; the log is still recorded but no new lock or email is sent.
    if (student.status === "Remedial") {
      return res.json({ status, attempt_id, student_id: student.id, student_status: "Remedial" });
    }

    await pool.query(
      `UPDATE students SET status = $2, updated_at = now() WHERE id = $1`,
      [student.id, status]
    );

    if (status === "On Track") {
      return res.json({ status, attempt_id, student_id: student.id });
    }

    io.to(studentRoom(student.id)).emit("student_locked", {
      student_id: student.id,
      attempt_id,
      status,
    });

    notifyMentor({
      student_id: student.id,
      attempt_id,
      quiz_score,
      focus_minutes,
      mentor_email: mentor_email || MENTOR_EMAIL || undefined,
      app_url: APP_URL || undefined,
    });

    res.json({ status, attempt_id, student_id: student.id });
  } catch (err) {
    console.error("daily-checkin ERROR:", err);
    res.status(500).json({ ok: false, error: "server error" });
  }
});

// ----------------------------
// ASSIGN INTERVENTION
// ----------------------------
app.post("/assign-intervention", requireAuth, async (req, res) => {
  const v = validateAssignInterventionPayload(req.body);
  if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });

  const { student_id, attempt_id, mentor_id } = req.body;
  let client;
  try {
    const student = await resolveStudent(student_id);
    if (!student) return res.status(404).json({ ok: false, error: "student not found" });

    client = await pool.connect();
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO interventions (student_id, attempt_id, task, mentor_id, status)
       VALUES ($1, $2, $3, $4, 'Pending')
       RETURNING *`,
      [student.id, attempt_id || null, v.sanitized.task, mentor_id || null]
    );
    const intervention = rows[0];

    await client.query(
      `UPDATE students
       SET status = 'Remedial', current_intervention_id = $1, updated_at = now()
       WHERE id = $2`,
      [intervention.id, student.id]
    );
    await client.query("COMMIT");

    io.to(studentRoom(student.id)).emit("intervention_assigned", intervention);
    if (intervention.mentor_id) {
      io.to(mentorRoom(intervention.mentor_id)).emit("intervention_assigned", intervention);
    }

    res.json({ ok: true, intervention });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("assign-intervention ERROR:", err);
    res.status(500).json({ ok: false, error: "server error" });
  } finally {
    if (client) client.release();
  }
});

// ----------------------------
// COMPLETE INTERVENTION
// ----------------------------
app.post("/complete-intervention", requireAuth, async (req, res) => {
  const v = validateCompleteInterventionPayload(req.body);
  if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });

  let client;
  try {
    const student = await resolveStudent(req.body.student_id);
    if (!student) return res.status(404).json({ ok: false, error: "student not found" });

    const interventionId = req.body.intervention_id || student.current_intervention_id;
    if (!interventionId) {
      return res.status(404).json({ ok: false, error: "no open intervention" });
    }

    client = await pool.connect();
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE interventions
       SET status = 'Completed', completed_at = COALESCE(completed_at, now())
       WHERE id = $1 AND student_id = $2
       RETURNING *`,
      [interventionId, student.id]
    );
    const intervention = rows[0];
    if (!intervention) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "intervention not found" });
    }

    // Only the student's current intervention puts them back on track.
    const updated = await client.query(
      `UPDATE students
       SET status = 'On Track', current_intervention_id = NULL, updated_at = now()
       WHERE id = $1 AND current_intervention_id = $2`,
      [student.id, intervention.id]
    );
    await client.query("COMMIT");

    const backOnTrack = updated.rowCount > 0;
    if (backOnTrack) {
      io.to(studentRoom(student.id)).emit("intervention_completed", intervention);
    }
    if (intervention.mentor_id) {
      io.to(mentorRoom(intervention.mentor_id)).emit("intervention_updated", intervention);
    }

    res.json({
      ok: true,
      intervention,
      student_status: backOnTrack ? "On Track" : student.status,
    });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("complete-intervention ERROR:", err);
    res.status(500).json({ ok: false, error: "server error" });
  } finally {
    if (client) client.release();
  }
});

// ----------------------------
// LIST INTERVENTIONS (mentor task list)
// ----------------------------
app.get("/api/interventions", requireAuth, async (req, res) => {
  try {
    const mentorEmail = req.query.mentor_email ? String(req.query.mentor_email) : null;
    const { rows } = await pool.query(
      `SELECT i.*, s.clerk_user_id, s.name AS student_name, s.status AS student_status
       FROM interventions i
       LEFT JOIN students s ON s.id = i.student_id
       WHERE $1::text IS NULL OR lower(i.mentor_id) = lower($1::text) OR i.mentor_id IS NULL
       ORDER BY i.created_at DESC
       LIMIT 200`,
      [mentorEmail]
    );
    res.json(rows);
  } catch (err) {
    console.error("list interventions ERROR:", err);
    res.status(500).json({ ok: false, error: "server error" });
  }
});

// ----------------------------
// SOCKET.IO
// ----------------------------
io.on("connection", (socket) => {
  socket.on("join_student", async (data) => {
    try {
      const student = await resolveStudent(data?.student_id, { create: true });
      if (!student) return;
      socket.join(studentRoom(student.id));

      // Re-sync: a reconnecting client picks up its current state.
      if (student.status === "Remedial" && student.current_intervention_id) {
        const { rows } = await pool.query(
          `SELECT * FROM interventions WHERE id = $1`,
          [student.current_intervention_id]
        );
        if (rows[0]) socket.emit("intervention_assigned", rows[0]);
      } else if (student.status === "Needs Intervention") {
        socket.emit("student_locked", {
          student_id: student.id,
          status: student.status,
        });
      }
    } catch (err) {
      console.error("join_student ERROR:", err);
    }
  });

  socket.on("join_mentor", (data) => {
    const email = data?.mentor_email;
    if (!email || typeof email !== "string") return;
    socket.join(mentorRoom(email));
  });
});

// ----------------------------
app.get("/", (req, res) => {
  res.send("Backend running.");
});

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  if (!N8N_SECRET) console.warn("N8N_SECRET not set — n8n cannot authenticate to /assign-intervention");
  if (!CLERK_SECRET_KEY) console.warn("CLERK_SECRET_KEY not set — app requests to protected endpoints will be rejected");
  if (DEV_AUTH_BYPASS) console.warn("ALLOW_DEV_AUTH_BYPASS is on — protected endpoints accept unauthenticated requests");
});
