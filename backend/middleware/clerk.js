'use strict';

const N8N_SECRET = process.env.N8N_SECRET || null;

function clerkAuth(req, res, next) {
  const incomingSecret = req.headers['x-n8n-secret'];
  if (N8N_SECRET && incomingSecret && incomingSecret === N8N_SECRET) {
    return next();
  }

  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_BYPASS === 'true') {
    console.warn('[clerkAuth] DEV BYPASS: allowing request without Clerk verification');
    return next();
  }

  return res.status(401).json({ ok: false, error: 'Unauthorized - Clerk verification required' });
}

module.exports = { clerkAuth };