const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// ─── Default personal categories ────────────────────────────────────────────
const RECEITA_CATEGORIES = ['Pro-labore', 'Renda extra', 'Rendimentos'];
const DESPESA_CATEGORIES = [
  'Moradia', 'Alimentacao', 'Transporte', 'Saude', 'Educacao',
  'Lazer', 'Vestuario', 'Assinaturas', 'Pets', 'Outros',
];
const ALL_CATEGORIES = [...RECEITA_CATEGORIES, ...DESPESA_CATEGORIES];

// ─── GET /settings ──────────────────────────────────────────────────────────
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;

    let { data: settings } = await supabase
      .from('personal_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!settings) {
      const { data: created } = await supabase
        .from('personal_settings')
        .insert({ user_id: userId })
        .select()
        .single();
      settings = created;
    }

    res.json({ settings });
  } catch (err) {
    console.error('Personal settings GET error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── PUT /settings ──────────────────────────────────────────────────────────
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { pro_labore, pro_labore_auto, currency } = req.body;

    // Ensure row exists
    let { data: existing } = await supabase
      .from('personal_settings')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('personal_settings').insert({ user_id: userId });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (pro_labore !== undefined) updateData.pro_labore = pro_labore;
    if (pro_labore_auto !== undefined) updateData.pro_labore_auto = pro_labore_auto;
    if (currency !== undefined) updateData.currency = currency;

    await supabase
      .from('personal_settings')
      .update(updateData)
      .eq('user_id', userId);

    const { data: settings } = await supabase
      .from('personal_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    res.json({ settings });
  } catch (err) {
    console.error('Personal settings PUT error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── GET /summary?month=YYYY-MM ─────────────────────────────────────────────
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parametro month obrigatorio (YYYY-MM)' });
    }

    // Settings
    const supabase = getSupabase();
    let { data: settings } = await supabase
      .from('personal_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!settings) settings = { pro_labore: 0, pro_labore_auto: 1 };

    // Personal transactions totals
    const txTotals = await queryRows(
      `SELECT type, COALESCE(SUM(amount), 0)::numeric as total
       FROM personal_transactions
       WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
       GROUP BY type`,
      [userId, month]
    );
    let receita = 0, despesa = 0;
    for (const r of txTotals) {
      if (r.type === 'receita') receita = parseFloat(r.total);
      if (r.type === 'despesa') despesa = parseFloat(r.total);
    }

    // Budget usage
    const budgetRows = await queryRows(
      `SELECT b.category, b.monthly_limit,
              COALESCE((SELECT SUM(t.amount) FROM personal_transactions t
                WHERE t.user_id = $1 AND t.type = 'despesa'
                AND t.category = b.category
                AND to_char(t.date, 'YYYY-MM') = $2), 0)::numeric as spent
       FROM personal_budgets b
       WHERE b.user_id = $1 AND b.month = $2`,
      [userId, month]
    );
    const totalBudgetLimit = budgetRows.reduce((s, r) => s + parseFloat(r.monthly_limit), 0);
    const totalBudgetSpent = budgetRows.reduce((s, r) => s + parseFloat(r.spent), 0);
    const budgetPct = totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0;

    // Goals
    const goals = await queryRows(
      `SELECT id, name, target_amount, current_amount, deadline, icon, color, is_completed
       FROM personal_goals
       WHERE user_id = $1
       ORDER BY is_completed ASC, deadline ASC NULLS LAST
       LIMIT 3`,
      [userId]
    );

    // DRE business profit for pro-labore context
    let businessProfit = null;
    try {
      const manualRows = await queryRows(
        `SELECT type, COALESCE(SUM(amount), 0)::numeric as total
         FROM controladoria WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2 GROUP BY type`,
        [userId, month]
      );
      let mr = 0, md = 0;
      for (const r of manualRows) {
        if (r.type === 'receita') mr = parseFloat(r.total);
        if (r.type === 'despesa') md = parseFloat(r.total);
      }
      const sr = await queryRows(
        `SELECT COALESCE(SUM(revenue), 0)::numeric as total FROM surgeries
         WHERE user_id = $1 AND paid = true AND to_char(paid_at, 'YYYY-MM') = $2`,
        [userId, month]
      );
      const autoReceita = parseFloat(sr[0]?.total) || 0;
      const sp = await queryRows(
        `SELECT COALESCE(SUM(purchase_cost), 0)::numeric as total FROM medicine_bottles
         WHERE user_id = $1 AND to_char(purchased_at, 'YYYY-MM') = $2`,
        [userId, month]
      );
      const autoDespesa = parseFloat(sp[0]?.total) || 0;
      businessProfit = (mr + autoReceita) - (md + autoDespesa);
    } catch { /* controladoria table may not exist */ }

    // Last 6 months personal trend
    const trend = [];
    const [year, mon] = month.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, mon - 1 - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rows = await queryRows(
        `SELECT type, COALESCE(SUM(amount), 0)::numeric as total
         FROM personal_transactions
         WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
         GROUP BY type`,
        [userId, m]
      );
      let r = 0, dp = 0;
      for (const row of rows) {
        if (row.type === 'receita') r = parseFloat(row.total);
        if (row.type === 'despesa') dp = parseFloat(row.total);
      }
      trend.push({ month: m, receita: r, despesa: dp });
    }

    res.json({
      month,
      pro_labore: settings.pro_labore || 0,
      business_profit: businessProfit,
      receita,
      despesa,
      saldo: receita - despesa,
      budget: { limit: totalBudgetLimit, spent: totalBudgetSpent, pct: budgetPct },
      goals: goals.map(g => ({ ...g, target_amount: parseFloat(g.target_amount), current_amount: parseFloat(g.current_amount) })),
      trend,
    });
  } catch (err) {
    console.error('Personal summary error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── GET /transactions?month=&category= ─────────────────────────────────────
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { month, category, type } = req.query;

    let query = supabase
      .from('personal_transactions')
      .select('*')
      .eq('user_id', userId);

    if (month) {
      const startOfMonth = month + '-01';
      const [y, m] = month.split('-').map(Number);
      const endOfMonth = new Date(y, m, 0).toISOString().split('T')[0];
      query = query.gte('date', startOfMonth).lte('date', endOfMonth);
    }
    if (category) query = query.eq('category', category);
    if (type) query = query.eq('type', type);

    query = query.order('date', { ascending: false }).order('created_at', { ascending: false });

    const { data: transactions, error } = await query;
    if (error) throw error;

    res.json({ transactions: transactions || [], categories: { receita: RECEITA_CATEGORIES, despesa: DESPESA_CATEGORIES } });
  } catch (err) {
    console.error('List personal transactions error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── POST /transactions ─────────────────────────────────────────────────────
router.post('/transactions', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { type, category, description, amount, date, is_recurring, recurring_day, source, notes } = req.body;

    if (!type || !category || !description || amount === undefined || !date) {
      return res.status(400).json({ error: 'type, category, description, amount e date sao obrigatorios' });
    }
    if (!['receita', 'despesa'].includes(type)) {
      return res.status(400).json({ error: 'type deve ser receita ou despesa' });
    }

    const { data: transaction, error } = await supabase
      .from('personal_transactions')
      .insert({
        user_id: userId,
        type,
        category,
        description,
        amount: parseFloat(amount),
        date,
        is_recurring: is_recurring ? 1 : 0,
        recurring_day: recurring_day || null,
        source: source || 'manual',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ transaction });
  } catch (err) {
    console.error('Create personal transaction error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── PUT /transactions/:id ──────────────────────────────────────────────────
router.put('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;
    const { type, category, description, amount, date, is_recurring, recurring_day, notes } = req.body;

    const { data: existing } = await supabase
      .from('personal_transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Transacao nao encontrada' });

    const updateData = {};
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (date !== undefined) updateData.date = date;
    if (is_recurring !== undefined) updateData.is_recurring = is_recurring ? 1 : 0;
    if (recurring_day !== undefined) updateData.recurring_day = recurring_day;
    if (notes !== undefined) updateData.notes = notes;

    await supabase
      .from('personal_transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    const { data: updated } = await supabase
      .from('personal_transactions')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ transaction: updated });
  } catch (err) {
    console.error('Update personal transaction error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── DELETE /transactions/:id ───────────────────────────────────────────────
router.delete('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;

    const { data: existing } = await supabase
      .from('personal_transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Transacao nao encontrada' });

    await supabase
      .from('personal_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    res.json({ message: 'Transacao excluida com sucesso' });
  } catch (err) {
    console.error('Delete personal transaction error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── GET /budgets?month=YYYY-MM ─────────────────────────────────────────────
router.get('/budgets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parametro month obrigatorio (YYYY-MM)' });
    }

    const budgets = await queryRows(
      `SELECT b.id, b.category, b.monthly_limit, b.month,
              COALESCE((SELECT SUM(t.amount) FROM personal_transactions t
                WHERE t.user_id = $1 AND t.type = 'despesa'
                AND t.category = b.category
                AND to_char(t.date, 'YYYY-MM') = $2), 0)::numeric as spent
       FROM personal_budgets b
       WHERE b.user_id = $1 AND b.month = $2
       ORDER BY b.category`,
      [userId, month]
    );

    res.json({
      budgets: budgets.map(b => ({
        ...b,
        monthly_limit: parseFloat(b.monthly_limit),
        spent: parseFloat(b.spent),
        pct: parseFloat(b.monthly_limit) > 0 ? Math.round((parseFloat(b.spent) / parseFloat(b.monthly_limit)) * 100) : 0,
      })),
      categories: DESPESA_CATEGORIES,
    });
  } catch (err) {
    console.error('List personal budgets error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── POST /budgets ──────────────────────────────────────────────────────────
router.post('/budgets', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { category, monthly_limit, month } = req.body;

    if (!category || monthly_limit === undefined || !month) {
      return res.status(400).json({ error: 'category, monthly_limit e month sao obrigatorios' });
    }

    // Upsert: update if exists, insert if not
    const { data: existing } = await supabase
      .from('personal_budgets')
      .select('id')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('month', month)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('personal_budgets')
        .update({ monthly_limit: parseFloat(monthly_limit) })
        .eq('id', existing.id);
      res.json({ message: 'Orcamento atualizado' });
    } else {
      const { error } = await supabase
        .from('personal_budgets')
        .insert({
          user_id: userId,
          category,
          monthly_limit: parseFloat(monthly_limit),
          month,
        });
      if (error) throw error;
      res.status(201).json({ message: 'Orcamento criado' });
    }
  } catch (err) {
    console.error('Create/update personal budget error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── POST /budgets/copy ─────────────────────────────────────────────────────
router.post('/budgets/copy', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { from_month, to_month } = req.body;

    if (!from_month || !to_month) {
      return res.status(400).json({ error: 'from_month e to_month sao obrigatorios' });
    }

    const { data: source } = await supabase
      .from('personal_budgets')
      .select('category, monthly_limit')
      .eq('user_id', userId)
      .eq('month', from_month);

    if (!source || source.length === 0) {
      return res.status(404).json({ error: 'Nenhum orcamento encontrado no mes de origem' });
    }

    for (const row of source) {
      const { data: existing } = await supabase
        .from('personal_budgets')
        .select('id')
        .eq('user_id', userId)
        .eq('category', row.category)
        .eq('month', to_month)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('personal_budgets')
          .update({ monthly_limit: row.monthly_limit })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('personal_budgets')
          .insert({ user_id: userId, category: row.category, monthly_limit: row.monthly_limit, month: to_month });
      }
    }

    res.json({ message: `${source.length} orcamentos copiados` });
  } catch (err) {
    console.error('Copy budgets error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── DELETE /budgets/:id ────────────────────────────────────────────────────
router.delete('/budgets/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;

    const { data: existing } = await supabase
      .from('personal_budgets')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Orcamento nao encontrado' });

    await supabase.from('personal_budgets').delete().eq('id', id).eq('user_id', userId);
    res.json({ message: 'Orcamento excluido' });
  } catch (err) {
    console.error('Delete personal budget error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── GET /goals ─────────────────────────────────────────────────────────────
router.get('/goals', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;

    const { data: goals, error } = await supabase
      .from('personal_goals')
      .select('*')
      .eq('user_id', userId)
      .order('is_completed', { ascending: true })
      .order('deadline', { ascending: true, nullsFirst: false });

    if (error) throw error;
    res.json({ goals: goals || [] });
  } catch (err) {
    console.error('List personal goals error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── POST /goals ────────────────────────────────────────────────────────────
router.post('/goals', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { name, target_amount, deadline, icon, color } = req.body;

    if (!name || target_amount === undefined) {
      return res.status(400).json({ error: 'name e target_amount sao obrigatorios' });
    }

    const { data: goal, error } = await supabase
      .from('personal_goals')
      .insert({
        user_id: userId,
        name,
        target_amount: parseFloat(target_amount),
        deadline: deadline || null,
        icon: icon || 'piggy-bank',
        color: color || '#14b8a6',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ goal });
  } catch (err) {
    console.error('Create personal goal error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── PUT /goals/:id ────────────────────────────────────────────────────────
router.put('/goals/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;
    const { name, target_amount, current_amount, add_amount, deadline, icon, color, is_completed } = req.body;

    const { data: existing } = await supabase
      .from('personal_goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Meta nao encontrada' });

    const updateData = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (target_amount !== undefined) updateData.target_amount = parseFloat(target_amount);
    if (current_amount !== undefined) updateData.current_amount = parseFloat(current_amount);
    if (add_amount !== undefined) updateData.current_amount = parseFloat(existing.current_amount) + parseFloat(add_amount);
    if (deadline !== undefined) updateData.deadline = deadline;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (is_completed !== undefined) updateData.is_completed = is_completed;

    // Auto-complete if reached target
    if (updateData.current_amount !== undefined && updateData.current_amount >= (updateData.target_amount || existing.target_amount)) {
      updateData.is_completed = 1;
    }

    await supabase
      .from('personal_goals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    const { data: updated } = await supabase
      .from('personal_goals')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ goal: updated });
  } catch (err) {
    console.error('Update personal goal error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── DELETE /goals/:id ──────────────────────────────────────────────────────
router.delete('/goals/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;

    const { data: existing } = await supabase
      .from('personal_goals')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Meta nao encontrada' });

    await supabase.from('personal_goals').delete().eq('id', id).eq('user_id', userId);
    res.json({ message: 'Meta excluida com sucesso' });
  } catch (err) {
    console.error('Delete personal goal error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
