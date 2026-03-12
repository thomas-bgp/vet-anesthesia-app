const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { validateEmail } = require('../middleware/validate');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referral_code, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check if there are any users (first user becomes admin without referral)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

    let referralLink = null;
    if (userCount.count > 0) {
      // Referral code required for non-first users
      if (!referral_code) {
        return res.status(400).json({ error: 'Referral code required for registration' });
      }

      // Validate referral code
      referralLink = db
        .prepare(`
          SELECT * FROM referral_links
          WHERE code = ?
            AND is_active = 1
            AND expires_at > datetime('now')
            AND uses < max_uses
        `)
        .get(referral_code);

      if (!referralLink) {
        return res.status(400).json({ error: 'Invalid, expired or fully used referral code' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRole = userCount.count === 0 ? 'admin' : (role || 'veterinario');

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `);

    const result = insertUser.run(name, email.toLowerCase(), hashedPassword, userRole);
    const userId = result.lastInsertRowid;

    // Increment referral uses if applicable
    if (referralLink) {
      db.prepare('UPDATE referral_links SET uses = uses + 1 WHERE id = ?').run(referralLink.id);

      // Deactivate if max uses reached
      if (referralLink.uses + 1 >= referralLink.max_uses) {
        db.prepare('UPDATE referral_links SET is_active = 0 WHERE id = ?').run(referralLink.id);
      }
    }

    const token = generateToken(userId);
    const user = db
      .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
      .get(userId);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const user = db
      .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
      .get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const user = db
      .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    const passwordMatch = await bcrypt.compare(current_password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
