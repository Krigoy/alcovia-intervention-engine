const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const COOKIE_NAME = process.env.COOKIE_NAME || 'alcovia_session';

function authMiddleware(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
      const cookieToken = req.cookies['csrf_token'];
      if (!headerToken || !cookieToken || headerToken !== cookieToken) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
      }
    }
    next();
  } catch (e) {
    console.error('authMiddleware error', e);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = function(req, res, next) {
    const secret = req.headers['x-n8n-secret'];
    if (!secret || secret !== process.env.N8N_SECRET) {
      return res.status(401).json({ ok:false, error: 'unauthorized' });
    }
    next();
  };

module.exports = { authMiddleware };