CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'mentor',  
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'On Track' CHECK (
    status IN ('On Track', 'Needs Intervention', 'Remedial')
  ),
  current_intervention_id uuid REFERENCES interventions(id),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  quiz_score int NOT NULL,
  focus_minutes int NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_student ON daily_logs(student_id);

CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task text NOT NULL,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_interventions_student ON interventions(student_id);

ALTER TABLE students
  ADD CONSTRAINT fk_students_intervention
  FOREIGN KEY (current_intervention_id)
  REFERENCES interventions(id)
  ON DELETE SET NULL;
