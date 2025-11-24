// backend/src/index.js
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // or global fetch on newer node
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // must be kept secret (server only)
const N8N_WEBHOOK_ACK = process.env.N8N_WEBHOOK_ACK || ''; // e.g., https://<n8n-host>/webhook/ack

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.post('/daily-checkin', async (req, res) => {
  try {
    const { student_id, quiz_score = 0, focus_minutes = 0, attempt_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });

    const id = attempt_id || (new Date().toISOString() + '-' + Math.random().toString(36).slice(2,8));

    // Idempotency: check existing daily_logs by attempt_id
    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('attempt_id, status')
      .eq('attempt_id', id)
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      return res.json({ status: 'already_received', attempt_id: id });
    }

    // Decide whether intervention required
    const needsIntervention = (quiz_score < 7) || (focus_minutes < 30);
    const status = needsIntervention ? 'Needs Intervention' : 'On Track';

    // Insert log
    const { error: insertErr } = await supabase
      .from('daily_logs')
      .insert([{
        attempt_id: id,
        student_id,
        quiz_score,
        focus_minutes,
        status
      }]);

    if (insertErr) {
      console.error('insert daily_logs err', insertErr);
      return res.status(500).json({ error: 'db insert failed' });
    }

    // Optionally update / upsert student status
    const { error: upsertErr } = await supabase
      .from('students')
      .upsert([{ id: student_id }], { onConflict: 'id' }); // keep minimal; update fields as needed

    if (upsertErr) console.warn('student upsert warning', upsertErr);

    // If intervention required, trigger n8n ack webhook asynchronously
    if (needsIntervention && N8N_WEBHOOK_ACK) {
      // Fire & forget
      (async () => {
        try {
          await fetch(N8N_WEBHOOK_ACK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, quiz_score, focus_minutes, attempt_id: id })
          });
        } catch (e) {
          console.error('n8n notify failed', e);
        }
      })();
    }

    return res.json({ status: needsIntervention ? 'Pending Mentor Review' : 'On Track', attempt_id: id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/assign-intervention', async (req, res) => {
  try {
    const { student_id, attempt_id, task = 'Remedial reading', mentor_id } = req.body;
    if (!attempt_id) return res.status(400).json({ error: 'attempt_id required' });

    // Idempotency check: interventions unique by attempt_id
    const { data: existing } = await supabase
      .from('interventions')
      .select('id, attempt_id')
      .eq('attempt_id', attempt_id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return res.json({ ok: true, message: 'already_assigned' });
    }

    // Insert intervention
    const { error: insertErr } = await supabase
      .from('interventions')
      .insert([{
        attempt_id,
        student_id,
        task,
        mentor_id
      }]);

    if (insertErr) {
      console.error('insert intervention err', insertErr);
      return res.status(500).json({ error: 'db insert failed' });
    }

    // Update daily_logs and students status
    await supabase
      .from('daily_logs')
      .update({ status: 'Remedial' })
      .eq('attempt_id', attempt_id);
    await supabase
      .from('students')
      .update({ status: 'Remedial', current_task: task })
      .eq('id', student_id);

    return res.json({ ok: true, assigned: { attempt_id, task } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.listen(PORT, () => console.log('Backend listening on', PORT));
