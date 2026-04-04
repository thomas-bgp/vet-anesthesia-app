const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// POST /api/referrals - create a new referral link
router.post('/', authenticateToken, async (req, res) => {
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

    const supabase = getSupabase();

    // Determine grant_plan: only Camila can grant max_legacy
    const isCamila = req.user.email === 'camilacadibe@gmail.com';
    const grantPlan = isCamila ? (req.body.grant_plan || 'max_legacy') : 'free';

    // Generate unique code
    const code = 'ANS-' + uuidv4().toUpperCase().replace(/-/g, '').substring(0, 10);
    const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from('referral_links')
      .insert({
        code,
        created_by: req.user.id,
        expires_at: expiresAt,
        max_uses: maxUses,
        grant_plan: grantPlan,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert referral error:', insertError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Fetch with creator name
    const { data: referral } = await supabase
      .from('referral_links')
      .select('*, users!referral_links_created_by_fkey(name)')
      .eq('id', inserted.id)
      .single();

    const result = {
      ...referral,
      creator_name: referral.users?.name || null,
    };
    delete result.users;

    res.status(201).json({
      message: 'Referral link created successfully',
      referral: result,
    });
  } catch (err) {
    console.error('Create referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/referrals - list my referral links
router.get('/', authenticateToken, async (req, res) => {
  try {
    const referrals = await queryRows(`
      SELECT
        rl.*,
        u.name as creator_name,
        CASE
          WHEN rl.is_active = false THEN 'inactive'
          WHEN rl.expires_at <= NOW() THEN 'expired'
          WHEN rl.uses >= rl.max_uses THEN 'exhausted'
          ELSE 'active'
        END as current_status
      FROM referral_links rl
      LEFT JOIN users u ON rl.created_by = u.id
      WHERE rl.created_by = $1
      ORDER BY rl.created_at DESC
    `, [req.user.id]);

    res.json({ referrals });
  } catch (err) {
    console.error('List referrals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/referrals/validate/:code - validate a referral code (public)
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const rows = await queryRows(`
      SELECT
        rl.code,
        rl.expires_at,
        rl.max_uses,
        rl.uses,
        rl.is_active,
        rl.grant_plan,
        u.name as created_by_name,
        CASE
          WHEN rl.is_active = false THEN 'inactive'
          WHEN rl.expires_at <= NOW() THEN 'expired'
          WHEN rl.uses >= rl.max_uses THEN 'exhausted'
          ELSE 'valid'
        END as status
      FROM referral_links rl
      LEFT JOIN users u ON rl.created_by = u.id
      WHERE rl.code = $1
    `, [code]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Referral code not found', valid: false });
    }

    const referral = rows[0];
    const isValid = referral.status === 'valid';

    res.json({
      valid: isValid,
      status: referral.status,
      code: referral.code,
      created_by: referral.created_by_name,
      expires_at: referral.expires_at,
      uses_remaining: referral.max_uses - referral.uses,
      grant_plan: referral.grant_plan || 'free',
    });
  } catch (err) {
    console.error('Validate referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/referrals/:id - deactivate a referral link
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    const { data: referral } = await supabase
      .from('referral_links')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!referral) {
      return res.status(404).json({ error: 'Referral link not found' });
    }

    // Only creator or admin can deactivate
    if (referral.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to deactivate this referral link' });
    }

    await supabase
      .from('referral_links')
      .update({ is_active: false })
      .eq('id', id);

    res.json({ message: 'Referral link deactivated successfully' });
  } catch (err) {
    console.error('Delete referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
