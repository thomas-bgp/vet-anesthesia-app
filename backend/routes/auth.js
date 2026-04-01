const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getSupabase } = require('../db/database');
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

    const supabase = getSupabase();

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check if there are any users (first user becomes admin without referral)
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    let referralLink = null;
    if (userCount > 0) {
      // Referral code required for non-first users
      if (!referral_code) {
        return res.status(400).json({ error: 'Referral code required for registration' });
      }

      // Validate referral code
      const now = new Date().toISOString();
      const { data: rl } = await supabase
        .from('referral_links')
        .select('*')
        .eq('code', referral_code)
        .eq('is_active', true)
        .gt('expires_at', now)
        .single();

      if (!rl || rl.uses >= rl.max_uses) {
        return res.status(400).json({ error: 'Invalid, expired or fully used referral code' });
      }
      referralLink = rl;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRole = userCount === 0 ? 'admin' : (role || 'veterinario');

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: userRole,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert user error:', insertError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const userId = newUser.id;

    // Increment referral uses if applicable
    if (referralLink) {
      const newUses = referralLink.uses + 1;
      const updateData = { uses: newUses };
      if (newUses >= referralLink.max_uses) {
        updateData.is_active = false;
      }
      await supabase
        .from('referral_links')
        .update(updateData)
        .eq('id', referralLink.id);
    }

    const token = generateToken(userId);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at,
      },
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

    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

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
        full_name: user.full_name,
        professional_title: user.professional_title,
        crmv_number: user.crmv_number,
        signature_image: user.signature_image,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role, full_name, professional_title, crmv_number, signature_image, created_at')
      .eq('id', req.user.id)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, professional_title, crmv_number, signature_image } = req.body;
    const supabase = getSupabase();

    await supabase
      .from('users')
      .update({
        full_name: full_name || null,
        professional_title: professional_title || 'Médica Veterinária',
        crmv_number: crmv_number || null,
        signature_image: signature_image || null,
      })
      .eq('id', req.user.id);

    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role, full_name, professional_title, crmv_number, signature_image, created_at')
      .eq('id', req.user.id)
      .single();

    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh - Renew token before expiry
router.post('/refresh', authenticateToken, (req, res) => {
  try {
    const token = generateToken(req.user.id);
    res.json({ token });
  } catch (err) {
    console.error('Token refresh error:', err);
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

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    const passwordMatch = await bcrypt.compare(current_password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', req.user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
