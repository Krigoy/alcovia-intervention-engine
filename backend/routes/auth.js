// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

// Environment-backed config
const JWT_SECRET = process.env.JWT_SECRET || 'please_set_a_strong_jwt_secret';
const COOKIE_NAME = process.env.COOKIE_NAME || 'alcovia_session';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

// Helper: safe JSON user object to return (no password_hash)
function publicUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/**
 * POST /auth/signup
 * Body: { name, email, password }
 * Creates a user, sets session cookie (JWT) and csrf cookie, returns user obj.
 */
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const db = req.db;
    // check existing
    const exist = await db.query('SELECT id, name, email, role FROM users WHERE email = $1', [email]);
    if (exist.rowCount > 0) {
      return res.status(409).json({ error: 'email already registered' });
    }

    // hash
    const password_hash = await bcrypt.hash(password, 10);

    const insert = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, role`,
      [name, email, password_hash, 'mentor']
    );

    const user = insert.rows[0];

    // create JWT
    const payload = { id: user.id, email: user.email, role: user.role || 'mentor' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // set cookies
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE
    });

    // csrf cookie (not httpOnly so frontend can read/send)
    const csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE
    });

    return res.json({ user: publicUser(user) });
  } catch (e) {
    console.error('signup error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 * Creates a session cookie on success.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const db = req.db;
    const r = await db.query('SELECT id, name, email, password_hash, role FROM users WHERE email=$1', [email]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });

    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const payload = { id: user.id, email: user.email, role: user.role || 'mentor' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE
    });

    const csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE
    });

    return res.json({ user: publicUser(user) });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

/**
 * POST /auth/logout
 * Clears auth cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
  res.clearCookie('csrf_token', { sameSite: 'lax' });
  return res.json({ ok: true });
});

/**
 * GET /auth/csrf-token
 * Returns the csrf token (or creates one)
 */
router.get('/csrf-token', (req, res) => {
  try {
    let token = req.cookies && req.cookies.csrf_token;
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      res.cookie('csrf_token', token, { httpOnly: false, sameSite: 'lax' });
    }
    return res.json({ csrfToken: token });
  } catch (e) {
    console.error('csrf-token error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
