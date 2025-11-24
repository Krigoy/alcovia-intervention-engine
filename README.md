# **README.md — Intervention Engine Prototype**

# Intervention Engine Prototype

A full-stack system that evaluates student focus performance, locks the app on failure, notifies a mentor automatically, waits for human approval, assigns remedial tasks, and unlocks the student once the task is completed.

This project implements all 3 problem statements from the assignment:

- **Backend:** State engine + logic gate + intervention assignment
- **n8n Automation:** Mentor dispatcher with human-in-the-loop
- **Frontend (Focus Mode App):** Real-time lock, remedial tasks, and cheater detection

---

# **Tech Stack**

### **Frontend (Web App)**

- Expo + React Native Web
- Clerk Authentication
- Socket.IO Client
- Focus Timer + Quiz Input
- Tab-switch & minimize detection ("Cheater check")

### **Backend (Node + Express)**

- PostgreSQL (Supabase)
- Clerk Express middleware
- Daily Check-In API
- Logic Gate for student state transitions
- Webhooks to n8n
- Intervention management
- Socket.IO real-time updates

### **Automation (n8n Cloud)**

- Email notification
- Wait for mentor approval
- Callback to backend `/assign-intervention`
- Full workflow exported in `/n8n` folder

---

# **System Architecture Overview**

```
Student → App (Focus Mode)
     → /daily-checkin
          → Backend Logic Gate
               → If FAIL: status="Needs Intervention"
               → Send webhook → n8n
                         → Email Mentor
                         → Wait for Response
                         → Mentor Clicks Link
                         → /assign-intervention
               → Student switches to Remedial mode
```

---

# **Problem Statement 1 — The State Engine**

The backend manages 3 student states:

### **1. NORMAL**

- Student can start focus timer
- Student can take the daily quiz

### **2. LOCKED ("Needs Intervention")**

Triggered when:

```
quiz_score ≤ 7 OR focus_minutes ≤ 60
```

Backend workflow:

1. Insert daily log
2. Update student.status → "Needs Intervention"
3. Fire webhook to n8n
4. Emit socket event to lock the student's app

### **3. REMEDIAL**

When mentor assigns a task via n8n → `/assign-intervention`

Student sees:

```
Task: <mentor assigned task>
[Mark Complete]
```

Backend unlocks on `/complete-intervention`.

---

# **Problem Statement 2 — n8n Human-in-the-Loop Automation**

The n8n workflow implements:

### ✔ **Trigger**

Webhook receives payload from backend:

```json
{
  "student_id": "...",
  "quiz_score": 4,
  "focus_minutes": 20,
  "attempt_id": "UUID"
}
```

### ✔ **Action: Send Email to Mentor**

Email includes:

- Student ID
- Quiz Score
- Focus Minutes
- A button: **Assign Remedial Task**

### ✔ **Wait Node**

The workflow pauses until the mentor clicks the button.

### ✔ **Loop Back to Backend**

HTTP Request → `/assign-intervention`:

```json
{
  "student_id": "...",
  "attempt_id": "...",
  "task": "<mentor's remedial task>"
}
```

### 📁 Workflows Included

The JSON exports of both workflows are stored in:

```
/n8n/mentor-dispatch-workflow.json
```

---

# **Problem Statement 3 — Focus Mode App**

The frontend shows different UI depending on realtime state:

### **1. NORMAL MODE**

Student sees:

- Focus Timer
- Daily Quiz
- Submit Check-In

### **2. LOCKED MODE**

After failure:

```
Analysis in progress. Waiting for mentor…
```

All features disabled.

### **3. REMEDIAL MODE**

Only remedial task is visible.

```
Task: Read Chapter 4
[Mark Complete]
```

### **Cheater Detection (Web-Only)**

If student:

- switches tab
- minimizes
- blurs window
- hides page

The timer auto-fails and `/report-cheat` → logic gate is triggered.

---

# **Chaos Component — Fail-Safe Mechanism**

The system includes a scenario where:

> Mentor does NOT respond within 12 hours.

Without a fail-safe, the student stays locked forever.

### ✔ Proposed Fail-Safe Strategy

1. When the student is locked:

   ```
   locked_at = now()
   ```

2. A background cron (or Supabase scheduled job) checks:

   ```
   IF NOW() - locked_at > 12 hours:
       auto-unlock student
       assign "Default remedial micro-task"
       notify head mentor
   ```

3. Student moves into **Remedial Mode** automatically.

### Why this matters

The system must remain usable even if humans delay intervention.

---

# Setup Instructions

## 1️⃣ Clone Project

```bash
git clone https://github.com/Krigoy/alcovia-app.git
cd alcovia-app
```

---

## 2️⃣ Backend Setup

### Install dependencies:

```bash
cd backend
npm install
```

### Create `.env`:

```
DATABASE_URL=...
CLERK_SECRET_KEY=...
N8N_WEBHOOK_URL=https://your-n8n-webhook/
```

### Start server:

```bash
npm run dev
```

---

## 3️⃣ Frontend Setup

```bash
cd alcovia-app
npm install
npx expo start
```

Visit:

```
http://localhost:8081
```

---

## 4️⃣ n8n Setup

To import workflows:

- Go to **n8n → Workflows → Import**
- Select files in `/n8n/`

---

# Testing the Flow

### Trigger check-in fail:

```bash
curl -X POST http://localhost:3000/daily-checkin \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "UUID",
    "quiz_score": 3,
    "focus_minutes": 10,
    "mentor_email": "mentor@example.com"
  }'
```

Expected:

- Student app locks
- Email sent to mentor
- Mentor clicks link → assigns task
- Student enters remedial mode

---

# API Endpoints

### `POST /daily-checkin`

Evaluates quiz & focus minutes → triggers logic gate.

### `POST /assign-intervention`

Called by n8n after mentor approves task.

### `POST /complete-intervention`

Student marks task complete → back to normal.

### `GET /student-status`

Returns: `status` + optional `task`

---

# Future Improvements

- Dashboard for mentors
- AI assistance for task suggestions
- Real focus-time camera verification
- Browser extension for strict lockdown
