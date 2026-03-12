const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// POST /api/referrals - create a new referral link
router.post('/', authenticateToken, (req, res) => {
  try {
    const { expires_in_days = 7, max_uses = 1 } = req.body;

    const expiryDays = parseInt(expires_in_days);
    const maxUses = parseInt(max_uses);

    if (isNaN(expiryDays) || expiryDays < 1 || expiryDays > 365) {
      return res.status(400).json({ error: 'expires_in_days must be between 1 and 365' });
    }

    if (isNaN(maxUses) || maxUses < 1 || maxUses > 100) {
      return res.status(400).json({ error: 'max_uses must be between 1 and 100' });
    }

    const db = getDb();

    // Generate unique code
    const code = 'VET-' + uuidv4().toUpperCase().replace(/-/g, '').substring(0, 10);

    const result = db
      .prepare(`
        INSERT INTO referral_links (code, created_by, expires_at, max_uses)
        VALUES (?, ?, datetime('now', '+' || ? || ' days'), ?)
      `)
      .run(code, req.user.id, expiryDays, maxUses);

    const referral = db
      .prepare(`
        SELECT rl.*, u.name as creator_name
        FROM referral_links rl
        LEFT JOIN users u ON rl.created_by = u.id
        WHERE rl.id = ?
      `)
      .get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Referral link created successfully',
      referral,
    });
  } catch (err) {
    console.error('Create referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/referrals - list my referral links
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const referrals = db
      .prepare(`
        SELECT
          rl.*,
          u.name as creator_name,
          CASE
            WHEN rl.is_active = 0 THEN 'inactive'
            WHEN rl.expires_at <= datetime('now') THEN 'expired'
            WHEN rl.uses >= rl.max_uses THEN 'exhausted'
            ELSE 'active'
          END as current_status
        FROM referral_links rl
        LEFT JOIN users u ON rl.created_by = u.id
        WHERE rl.created_by = ?
        ORDER BY rl.created_at DESC
      `)
      .all(req.user.id);

    res.json({ referrals });
  } catch (err) {
    console.error('List referrals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/referrals/validate/:code - validate a referral code (public)
router.get('/validate/:code', (req, res) => {
  try {
    const { code } = req.params;
    const db = getDb();

    const referral = db
      .prepare(`
        SELECT
          rl.code,
          rl.expires_at,
          rl.max_uses,
          rl.uses,
          rl.is_active,
          u.name as created_by_name,
          CASE
            WHEN rl.is_active = 0 THEN 'inactive'
            WHEN rl.expires_at <= datetime('now') THEN 'expired'
            WHEN rl.uses >= rl.max_uses THEN 'exhausted'
            ELSE 'valid'
          END as status
        FROM referral_links rl
        LEFT JOIN users u ON rl.created_by = u.id
        WHERE rl.code = ?
      `)
      .get(code);

    if (!referral) {
      return res.status(404).json({ error: 'Referral code not found', valid: false });
    }

    const isValid = referral.status === 'valid';

    res.json({
      valid: isValid,
      status: referral.status,
      code: referral.code,
      created_by: referral.created_by_name,
      expires_at: referral.expires_at,
      uses_remaining: referral.max_uses - referral.uses,
    });
  } catch (err) {
    console.error('Validate referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/referrals/:id - deactivate a referral link
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const referral = db
      .prepare('SELECT * FROM referral_links WHERE id = ?')
      .get(id);

    if (!referral) {
      return res.status(404).json({ error: 'Referral link not found' });
    }

    // Only creator or admin can deactivate
    if (referral.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to deactivate this referral link' });
    }

    db.prepare('UPDATE referral_links SET is_active = 0 WHERE id = ?').run(id);

    res.json({ message: 'Referral link deactivated successfully' });
  } catch (err) {
    console.error('Delete referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
