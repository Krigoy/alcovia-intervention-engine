const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(id) {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id);
}

function isIntegerInRange(n, min, max) {
  if (typeof n === 'string' && n.trim() !== '') n = Number(n);
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) return false;
  return n >= min && n <= max;
}

function sanitizeText(s, maxLen = 2000) {
  if (s == null) return '';
  const t = String(s).trim();
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function validateDailyCheckinPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const { student_id, quiz_score, focus_minutes } = payload;

  if (!isUUID(student_id)) errors.push('student_id is required and must be a UUID');

  if (quiz_score == null || !isIntegerInRange(Number(quiz_score), 0, 10)) {
    errors.push('quiz_score must be an integer between 0 and 10');
  }

  if (focus_minutes == null || !isIntegerInRange(Number(focus_minutes), 0, 1440)) {
    errors.push('focus_minutes must be a non-negative integer (0..1440)');
  }

  return { ok: errors.length === 0, errors };
}

function validateAssignInterventionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return { ok: false, errors: ['payload must be an object'] };

  const { student_id, task } = payload;
  if (!isUUID(student_id)) errors.push('student_id is required and must be a UUID');

  const t = sanitizeText(task || '');
  if (!t) errors.push('task is required and must be a non-empty string');
  if (t.length > 2000) errors.push('task is too long');

  return { ok: errors.length === 0, errors, sanitized: { task: t } };
}

function validateCompleteInterventionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return { ok: false, errors: ['payload must be an object'] };
  const { student_id } = payload;
  if (!isUUID(student_id)) errors.push('student_id is required and must be a UUID');
  return { ok: errors.length === 0, errors };
}

module.exports = {
  isUUID,
  isIntegerInRange,
  sanitizeText,
  validateDailyCheckinPayload,
  validateAssignInterventionPayload,
  validateCompleteInterventionPayload
};
