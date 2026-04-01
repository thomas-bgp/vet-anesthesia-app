const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const VALID_CATEGORIES = ['equipamento', 'material', 'administrativo', 'seguro', 'transporte', 'geral'];

// GET /api/expenses - List expenses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { category, start_date, end_date, month } = req.query;

    let query = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId);

    if (category) {
      query = query.eq('category', category);
    }
    if (month) {
      // month format: YYYY-MM
      const startOfMonth = month + '-01';
      const [y, m] = month.split('-').map(Number);
      const endOfMonth = new Date(y, m, 0).toISOString().split('T')[0]; // last day of month
      query = query.gte('date', startOfMonth).lte('date', endOfMonth);
    }
    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
    }

    query = query.order('date', { ascending: false }).order('created_at', { ascending: false });

    const { data: expenses, error } = await query;
    if (error) throw error;

    res.json({ expenses: expenses || [] });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/expenses/summary - Totals by category
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date, month } = req.query;

    let sql = `
      SELECT
        category,
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramIdx = 2;

    if (month) {
      sql += ` AND to_char(date, 'YYYY-MM') = $${paramIdx}`;
      params.push(month);
      paramIdx++;
    }
    if (start_date) {
      sql += ` AND date >= $${paramIdx}`;
      params.push(start_date);
      paramIdx++;
    }
    if (end_date) {
      sql += ` AND date <= $${paramIdx}`;
      params.push(end_date);
      paramIdx++;
    }

    sql += ' GROUP BY category ORDER BY total DESC';

    const byCategory = await queryRows(sql, params);

    const grandTotal = byCategory.reduce((sum, row) => sum + parseFloat(row.total), 0);

    res.json({ by_category: byCategory, total: grandTotal });
  } catch (err) {
    console.error('Expenses summary error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/expenses - Create expense
router.post('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { date, description, amount, category, notes } = req.body;

    if (!date || !description || amount === undefined) {
      return res.status(400).json({ error: 'date, description e amount são obrigatórios' });
    }

    const finalCategory = category && VALID_CATEGORIES.includes(category) ? category : 'geral';

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        date,
        description,
        amount,
        category: finalCategory,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ expense });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;
    const { date, description, amount, category, notes } = req.body;

    const { data: existing } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }

    const finalCategory = category && VALID_CATEGORIES.includes(category) ? category : existing.category;

    await supabase
      .from('expenses')
      .update({
        date: date || existing.date,
        description: description || existing.description,
        amount: amount !== undefined ? amount : existing.amount,
        category: finalCategory,
        notes: notes !== undefined ? notes : existing.notes,
      })
      .eq('id', id)
      .eq('user_id', userId);

    const { data: updated } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ expense: updated });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;

    const { data: existing } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }

    await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    res.json({ message: 'Despesa excluída com sucesso' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
