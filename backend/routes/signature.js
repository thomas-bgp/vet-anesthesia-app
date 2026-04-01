const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// ─── POST /api/signatures/sign/:surgeryId ─────────────────────────────────────
// Creates an electronic signature for a surgery record
router.post('/sign/:surgeryId', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const surgeryId = req.params.surgeryId;
    const userId = req.user.id;

    // Check if already signed by this user
    const { data: existing } = await supabase
      .from('document_signatures')
      .select('id')
      .eq('surgery_id', surgeryId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Return existing signature
      const { data: sig } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('id', existing.id)
        .single();
      return res.json({ signature: sig });
    }

    // Load full surgery data
    const surgeryRows = await queryRows(
      `SELECT * FROM surgeries WHERE id = $1 AND user_id = $2`,
      [surgeryId, userId]
    );
    if (!surgeryRows.length) {
      return res.status(404).json({ error: 'Ficha não encontrada.' });
    }
    const surgery = surgeryRows[0];

    // Load medicines
    const medicines = await queryRows(
      `SELECT * FROM surgery_medicines WHERE surgery_id = $1 ORDER BY administered_at`,
      [surgeryId]
    );

    // Load vitals
    const vitals = await queryRows(
      `SELECT * FROM monitoring_vitals WHERE surgery_id = $1 ORDER BY recorded_at`,
      [surgeryId]
    );

    // Load disposables
    const disposables = await queryRows(
      `SELECT * FROM surgery_disposables WHERE surgery_id = $1 ORDER BY id`,
      [surgeryId]
    );

    // Build canonical data for hashing (sorted keys for determinism)
    const canonicalObj = { disposables, medicines, surgery, vitals };
    const canonicalData = JSON.stringify(canonicalObj);
    const hash = crypto.createHash('sha256').update(canonicalData).digest('hex');

    // Generate verification code: timestamp + 4 random digits
    const verificationCode = String(Date.now()) + String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    // Get signer profile info
    const { data: profile } = await supabase
      .from('users')
      .select('name, crmv_number, full_name')
      .eq('id', userId)
      .single();

    const signerName = profile?.full_name || profile?.name || req.user.name || 'N/A';
    const signerCrmv = profile?.crmv_number || null;
    const signerIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';

    // Store signature
    const { data: newSig, error: insertErr } = await supabase
      .from('document_signatures')
      .insert({
        user_id: userId,
        surgery_id: surgeryId,
        hash_sha256: hash,
        verification_code: verificationCode,
        signer_name: signerName,
        signer_crmv: signerCrmv,
        signer_ip: typeof signerIp === 'string' ? signerIp.split(',')[0].trim() : String(signerIp),
        signed_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('Signature insert error:', insertErr);
      return res.status(500).json({ error: 'Erro ao salvar assinatura.' });
    }

    res.json({ signature: newSig });
  } catch (err) {
    console.error('Sign error:', err);
    res.status(500).json({ error: 'Erro interno ao assinar documento.' });
  }
});

// ─── GET /api/signatures/surgery/:surgeryId ────────────────────────────────────
// Returns existing signature for a surgery
router.get('/surgery/:surgeryId', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: sig } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('surgery_id', req.params.surgeryId)
      .eq('user_id', req.user.id)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({ signature: sig || null });
  } catch (err) {
    console.error('Get signature error:', err);
    res.status(500).json({ error: 'Erro ao buscar assinatura.' });
  }
});

// ─── GET /api/signatures/validate/:code ────────────────────────────────────────
// PUBLIC endpoint — validates a document signature by verification code
router.get('/validate/:code', async (req, res) => {
  try {
    const supabase = getSupabase();
    const code = req.params.code;

    const { data: sig } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('verification_code', code)
      .maybeSingle();

    if (!sig) {
      return res.json({ valid: false, signature: null, surgery: null });
    }

    // Load basic surgery info (no auth check — public validation)
    const surgeryRows = await queryRows(
      `SELECT id, patient_name, procedure_name, clinic_name, start_time, created_at
       FROM surgeries WHERE id = $1`,
      [sig.surgery_id]
    );
    const surgery = surgeryRows[0] || null;

    res.json({
      valid: true,
      signature: {
        signer_name: sig.signer_name,
        signer_crmv: sig.signer_crmv,
        hash_sha256: sig.hash_sha256,
        signed_at: sig.signed_at,
        verification_code: sig.verification_code,
      },
      surgery: surgery ? {
        patient_name: surgery.patient_name,
        procedure_name: surgery.procedure_name,
        clinic_name: surgery.clinic_name,
        date: surgery.start_time || surgery.created_at,
      } : null,
    });
  } catch (err) {
    console.error('Validate signature error:', err);
    res.status(500).json({ error: 'Erro ao validar assinatura.' });
  }
});

module.exports = router;
