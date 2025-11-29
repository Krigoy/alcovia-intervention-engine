CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  status text,
  current_intervention_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  quiz_score integer,
  focus_minutes integer,
  status text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_student_id ON daily_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_attempt_id ON daily_logs(attempt_id);

CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  task text,
  mentor_id text,
  assigned_by uuid,
  status text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_interventions_student_id ON interventions(student_id);
CREATE INDEX IF NOT EXISTS idx_interventions_attempt_id ON interventions(attempt_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'fk_students_current_intervention'
      AND tc.table_name = 'students'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT fk_students_current_intervention
      FOREIGN KEY (current_intervention_id) REFERENCES interventions(id) ON DELETE SET NULL;
  END IF;
END
$$;