import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.post("/daily-checkin", async (req, res) => {
  try {
    const { student_id, quiz_score, focus_minutes, mentor_email } = req.body;

    console.log("DEBUG: /daily-checkin received:", req.body);

    if (!student_id) return res.status(400).json({ error: "student_id missing" });

    const status =
      quiz_score >= 5 && focus_minutes >= 25
        ? "On Track"
        : "Needs Intervention";

    const result = await pool.query(
      `INSERT INTO daily_logs (student_id, quiz_score, focus_minutes, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [student_id, quiz_score, focus_minutes, status]
    );

    const attempt_id = result.rows[0].id;
    console.log("Log saved. attempt_id =", attempt_id);

    if (status === "On Track") {
      console.log("Student on track — no N8N call");
      return res.json({ status });
    }

    console.log("Triggering n8n:", process.env.N8N_WEBHOOK_URL);

    await axios.post(
      process.env.N8N_WEBHOOK_URL,
      {
        student_id,
        attempt_id,
        quiz_score,
        focus_minutes,
        mentor_email: mentor_email || "mentor@local.test",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-n8n-secret": process.env.N8N_SECRET,
        },
      }
    );

    console.log("N8N webhook triggered successfully");

    res.json({ status, attempt_id });
  } catch (err) {
    console.error("daily-checkin ERROR:", err);
    res.status(500).json({ ok: false, error: "server error" });
  }
});

// ----------------------------
// ASSIGN INTERVENTION
// ----------------------------
app.post("/assign-intervention", async (req, res) => {
  try {
    const { student_id, attempt_id, task, mentor_id } = req.body;

    console.log("DEBUG: /assign-intervention received:", req.body);

    if (!student_id || !task)
      return res.status(400).json({ error: "Missing fields" });

    await pool.query(
      `INSERT INTO interventions (student_id, attempt_id, task, mentor_id)
       VALUES ($1, $2, $3, $4)`,
      [student_id, attempt_id, task, mentor_id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("assign-intervention ERROR:", err);
    res.status(500).json({ ok: false, error: "server error" });
  }
});

// ----------------------------
app.get("/", (req, res) => {
  res.send("Backend running.");
});

app.listen(3000, () => {
  console.log("Backend listening on port 3000");
});