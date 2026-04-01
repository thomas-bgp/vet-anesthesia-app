const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/receivables - List receivables
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, start_date, end_date } = req.query;

    let sql = `
      SELECT r.*, s.patient_name, s.procedure_name
      FROM receivables r
      LEFT JOIN surgeries s ON r.surgery_id = s.id
      WHERE r.user_id = $1
    `;
    const params = [userId];
    let paramIdx = 2;

    if (status) {
      sql += ` AND r.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (start_date) {
      sql += ` AND r.created_at >= $${paramIdx}`;
      params.push(start_date);
      paramIdx++;
    }
    if (end_date) {
      sql += ` AND r.created_at <= $${paramIdx}`;
      params.push(end_date + ' 23:59:59');
      paramIdx++;
    }

    sql += ' ORDER BY r.created_at DESC';

    const receivables = await queryRows(sql, params);
    res.json({ receivables });
  } catch (err) {
    console.error('List receivables error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/receivables/summary - Summary totals
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await queryRows(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_total,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as overdue_total,
        COALESCE(SUM(CASE WHEN status = 'paid' AND to_char(paid_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM') THEN paid_amount ELSE 0 END), 0) as paid_this_month,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END), 0) as paid_total
      FROM receivables
      WHERE user_id = $1
    `, [userId]);

    res.json(rows[0]);
  } catch (err) {
    console.error('Receivables summary error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/receivables - Create receivable
router.post('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { surgery_id, clinic_name, description, amount, due_date, notes } = req.body;

    if (!description || !amount) {
      return res.status(400).json({ error: 'description e amount são obrigatórios' });
    }

    const { data: receivable, error } = await supabase
      .from('receivables')
      .insert({
        user_id: userId,
        surgery_id: surgery_id || null,
        clinic_name: clinic_name || null,
        description,
        amount,
        due_date: due_date || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ receivable });
  } catch (err) {
    console.error('Create receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/receivables/:id - Update receivable
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;
    const { clinic_name, description, amount, due_date, notes, status } = req.body;

    const { data: existing } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }

    await supabase
      .from('receivables')
      .update({
        clinic_name: clinic_name !== undefined ? clinic_name : existing.clinic_name,
        description: description || existing.description,
        amount: amount !== undefined ? amount : existing.amount,
        due_date: due_date !== undefined ? due_date : existing.due_date,
        notes: notes !== undefined ? notes : existing.notes,
        status: status || existing.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId);

    const { data: updated } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ receivable: updated });
  } catch (err) {
    console.error('Update receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/receivables/:id/pay - Mark as paid
router.put('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;
    const { paid_amount, paid_at } = req.body;

    const { data: existing } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }

    const finalAmount = paid_amount !== undefined ? paid_amount : existing.amount;
    const finalDate = paid_at || new Date().toISOString();

    await supabase
      .from('receivables')
      .update({
        status: 'paid',
        paid_amount: finalAmount,
        paid_at: finalDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId);

    const { data: updated } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ receivable: updated });
  } catch (err) {
    console.error('Pay receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/receivables/:id - Cancel receivable
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;

    const { data: existing } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }

    await supabase
      .from('receivables')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    res.json({ message: 'Conta a receber cancelada com sucesso' });
  } catch (err) {
    console.error('Cancel receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
