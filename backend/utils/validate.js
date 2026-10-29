// Accepts any canonical UUID (Postgres gen_random_uuid() produces v4).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Clerk user IDs look like "user_2abc..."; keep this permissive but bounded.
const EXTERNAL_ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

export function isUUID(id) {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id);
}

// A student reference is either a students.id UUID or a Clerk user ID.
export function isStudentRef(id) {
  if (!id || typeof id !== 'string') return false;
  return isUUID(id) || EXTERNAL_ID_REGEX.test(id);
}

export function isIntegerInRange(n, min, max) {
  if (typeof n === 'string' && n.trim() !== '') n = Number(n);
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) return false;
  return n >= min && n <= max;
}

export function sanitizeText(s, maxLen = 2000) {
  if (s == null) return '';
  const t = String(s).trim();
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

export function validateDailyCheckinPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const { student_id, quiz_score, focus_minutes } = payload;

  if (!isStudentRef(student_id)) errors.push('student_id is required (UUID or Clerk user ID)');

  if (quiz_score == null || !isIntegerInRange(quiz_score, 0, 10)) {
    errors.push('quiz_score must be an integer between 0 and 10');
  }

  if (focus_minutes == null || !isIntegerInRange(focus_minutes, 0, 1440)) {
    errors.push('focus_minutes must be a non-negative integer (0..1440)');
  }

  return {
    ok: errors.length === 0,
    errors,
    sanitized: { quiz_score: Number(quiz_score), focus_minutes: Number(focus_minutes) },
  };
}

export function validateAssignInterventionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return { ok: false, errors: ['payload must be an object'] };

  const { student_id, attempt_id, task } = payload;
  if (!isStudentRef(student_id)) errors.push('student_id is required (UUID or Clerk user ID)');
  if (attempt_id && !isUUID(attempt_id)) errors.push('attempt_id must be a UUID when provided');

  const raw = task == null ? '' : String(task).trim();
  if (!raw) errors.push('task is required and must be a non-empty string');
  if (raw.length > 2000) errors.push('task is too long (max 2000 characters)');

  return { ok: errors.length === 0, errors, sanitized: { task: sanitizeText(raw) } };
}

export function validateCompleteInterventionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return { ok: false, errors: ['payload must be an object'] };
  const { student_id, intervention_id } = payload;
  if (!isStudentRef(student_id)) errors.push('student_id is required (UUID or Clerk user ID)');
  if (intervention_id && !isUUID(intervention_id)) errors.push('intervention_id must be a UUID when provided');
  return { ok: errors.length === 0, errors };
}
