// backend/middleware/clerk.js
'use strict';

/**
 * Dev-friendly clerkAuth middleware.
 * - Accepts requests with header `x-n8n-secret` matching process.env.N8N_SECRET
 * - In development, bypasses auth for convenience
 * - In production, recommends using @clerk/express requireAuth instead
 */

const N8N_SECRET = process.env.N8N_SECRET || null;

function clerkAuth(req, res, next) {
  // Accept machine calls from n8n via shared secret
  const incomingSecret = req.headers['x-n8n-secret'];
  if (N8N_SECRET && incomingSecret && incomingSecret === N8N_SECRET) {
    return next();
  }

  // Convenient dev bypass (ONLY for development)
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[clerkAuth] DEV MODE: bypassing Clerk auth for local testing');
    return next();
  }

  // In production, require Clerk properly (this code does not attempt Clerk verification)
  return res.status(401).json({ ok: false, error: 'Unauthorized - Clerk verification required' });
}

module.exports = { clerkAuth };
