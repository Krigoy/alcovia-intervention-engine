const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'please_set_a_strong_jwt_secret';
const COOKIE_NAME = process.env.COOKIE_NAME || 'alcovia_session';

function authMiddleware(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: missing session' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.warn('Invalid JWT:', e.message || e);
      return res.status(401).json({ ok: false, error: 'Unauthorized: invalid session' });
    }

    req.user = payload;

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
      const cookieToken = req.cookies && req.cookies['csrf_token'];
      if (!headerToken || !cookieToken || headerToken !== cookieToken) {
        return res.status(403).json({ ok: false, error: 'CSRF token mismatch' });
      }
    }

    return next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(500).json({ ok: false, error: 'auth middleware error' });
  }
}

function n8nSecretMiddleware(req, res, next) {
  const incoming = req.headers['x-n8n-secret'];
  const expected = process.env.N8N_SECRET || null;

  if (!expected) {
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_N8N_BYPASS === 'true') {
      console.warn('[n8nSecretMiddleware] DEV BYPASS enabled (ALLOW_N8N_BYPASS=true).');
      return next();
    }
    return res.status(401).json({ ok: false, error: 'n8n secret not configured' });
  }

  if (incoming && incoming === expected) return next();

  return res.status(401).json({ ok: false, error: 'unauthorized: invalid n8n secret' });
}

module.exports = { authMiddleware, n8nSecretMiddleware };