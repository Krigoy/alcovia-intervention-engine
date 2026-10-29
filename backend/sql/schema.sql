CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text,
  name text,
  status text,
  current_intervention_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- clerk_user_id maps a Clerk user to a student row. The ALTER also migrates
-- databases created before the column existed; safe to re-run.
ALTER TABLE students ADD COLUMN IF NOT EXISTS clerk_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_clerk_user_id ON students(clerk_user_id);

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
CREATE INDEX IF NOT EXISTS idx_interventions_mentor_id ON interventions(lower(mentor_id));

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