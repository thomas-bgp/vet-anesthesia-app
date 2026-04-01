const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// ─── Pre-defined categories and cost centers ──────────────────────────────────
const CATEGORIES = {
  receita: [
    { key: 'anestesias', label: 'Anestesias', auto: true },
    { key: 'outras_receitas', label: 'Outras receitas', auto: false },
  ],
  despesa: [
    { key: 'medicamentos_insumos', label: 'Medicamentos e insumos', auto: true },
    { key: 'impostos', label: 'Impostos e tributos' },
    { key: 'contabilidade', label: 'Contabilidade' },
    { key: 'transporte', label: 'Transporte e combustível' },
    { key: 'equipamentos', label: 'Equipamentos' },
    { key: 'manutencao_equip', label: 'Manutenção de equipamentos' },
    { key: 'seguros', label: 'Seguros' },
    { key: 'educacao', label: 'Educação e congressos' },
    { key: 'marketing', label: 'Marketing e divulgação' },
    { key: 'telefone_internet', label: 'Telefone e internet' },
    { key: 'aluguel', label: 'Aluguel / Coworking' },
    { key: 'crmv_associacoes', label: 'CRMV e associações' },
    { key: 'material_escritorio', label: 'Material de escritório' },
    { key: 'alimentacao', label: 'Alimentação em trabalho' },
    { key: 'outros', label: 'Outros custos' },
  ],
};

const COST_CENTERS = [
  { key: 'operacional', label: 'Operacional' },
  { key: 'administrativo', label: 'Administrativo' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'desenvolvimento', label: 'Desenvolvimento' },
  { key: 'pessoal', label: 'Pessoal' },
];

// Valid category keys for validation
const ALL_CATEGORY_KEYS = [
  ...CATEGORIES.receita.map(c => c.key),
  ...CATEGORIES.despesa.map(c => c.key),
];
const COST_CENTER_KEYS = COST_CENTERS.map(c => c.key);

// ─── GET /categories ──────────────────────────────────────────────────────────
router.get('/categories', authenticateToken, async (req, res) => {
  res.json({ categories: CATEGORIES, cost_centers: COST_CENTERS });
});

// ─── GET /dre?month=2026-04 ───────────────────────────────────────────────────
router.get('/dre', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parâmetro month é obrigatório (YYYY-MM)' });
    }

    // 1. Manual entries from controladoria table
    const manualEntries = await queryRows(
      `SELECT id, date, type, category, cost_center, amount, description, supplier_name, source, created_at
       FROM controladoria
       WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
       ORDER BY date DESC, created_at DESC`,
      [userId, month]
    );

    // 2. Paid surgeries (auto revenue)
    const paidSurgeries = await queryRows(
      `SELECT id, patient_name, clinic_name, revenue, paid_at
       FROM surgeries
       WHERE user_id = $1 AND paid = true AND to_char(paid_at, 'YYYY-MM') = $2`,
      [userId, month]
    );

    // 3. Stock purchases (auto cost)
    const stockPurchases = await queryRows(
      `SELECT sm.id, m.name, sm.total_cost, sm.created_at
       FROM stock_movements sm
       JOIN medicines m ON sm.medicine_id = m.id
       WHERE sm.user_id = $1 AND sm.type = 'purchase' AND to_char(sm.created_at, 'YYYY-MM') = $2`,
      [userId, month]
    );

    // ── Build DRE structure ──
    // Initialize receitas
    const receitas = {};
    for (const cat of CATEGORIES.receita) {
      receitas[cat.key] = { total: 0, entries: [] };
    }

    // Initialize despesas
    const despesas = {};
    for (const cat of CATEGORIES.despesa) {
      despesas[cat.key] = { total: 0, entries: [] };
    }

    // Add auto surgery revenue
    for (const s of paidSurgeries) {
      const amount = parseFloat(s.revenue) || 0;
      receitas.anestesias.total += amount;
      receitas.anestesias.entries.push({
        id: s.id,
        description: `${s.clinic_name || 'Clínica'} - ${s.patient_name || 'Paciente'}`,
        amount,
        date: s.paid_at,
        source: 'auto',
      });
    }

    // Add auto stock purchases
    for (const p of stockPurchases) {
      const amount = parseFloat(p.total_cost) || 0;
      despesas.medicamentos_insumos.total += amount;
      despesas.medicamentos_insumos.entries.push({
        id: p.id,
        description: p.name,
        amount,
        date: p.created_at,
        source: 'auto',
      });
    }

    // Add manual entries
    for (const entry of manualEntries) {
      const amount = parseFloat(entry.amount) || 0;
      const item = {
        id: entry.id,
        description: entry.description || '',
        amount,
        date: entry.date,
        source: 'manual',
        supplier_name: entry.supplier_name,
        cost_center: entry.cost_center,
        category: entry.category,
        type: entry.type,
      };

      if (entry.type === 'receita') {
        const cat = entry.category || 'outras_receitas';
        if (receitas[cat]) {
          receitas[cat].total += amount;
          receitas[cat].entries.push(item);
        }
      } else if (entry.type === 'despesa') {
        const cat = entry.category || 'outros';
        if (despesas[cat]) {
          despesas[cat].total += amount;
          despesas[cat].entries.push(item);
        }
      }
    }

    // Calculate totals
    const totalReceita = Object.values(receitas).reduce((sum, c) => sum + c.total, 0);
    const totalDespesa = Object.values(despesas).reduce((sum, c) => sum + c.total, 0);

    // By cost center
    const byCostCenter = {};
    for (const cc of COST_CENTERS) {
      byCostCenter[cc.key] = 0;
    }
    for (const entry of manualEntries) {
      if (entry.type === 'despesa' && entry.cost_center && byCostCenter[entry.cost_center] !== undefined) {
        byCostCenter[entry.cost_center] += parseFloat(entry.amount) || 0;
      }
    }
    // Stock purchases go to operacional
    for (const p of stockPurchases) {
      byCostCenter.operacional += parseFloat(p.total_cost) || 0;
    }

    res.json({
      month,
      receitas,
      despesas,
      totals: {
        total_receita: totalReceita,
        total_despesa: -totalDespesa,
        resultado: totalReceita - totalDespesa,
      },
      by_cost_center: byCostCenter,
    });
  } catch (err) {
    console.error('DRE error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── GET /summary ─────────────────────────────────────────────────────────────
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Build last 6 months
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(m);
    }

    const results = [];

    for (const month of months) {
      // Manual entries
      const manualRows = await queryRows(
        `SELECT type, COALESCE(SUM(amount), 0) as total
         FROM controladoria
         WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
         GROUP BY type`,
        [userId, month]
      );

      let manualReceita = 0;
      let manualDespesa = 0;
      for (const row of manualRows) {
        if (row.type === 'receita') manualReceita = parseFloat(row.total) || 0;
        if (row.type === 'despesa') manualDespesa = parseFloat(row.total) || 0;
      }

      // Auto revenue (paid surgeries)
      const surgeryRows = await queryRows(
        `SELECT COALESCE(SUM(revenue), 0) as total
         FROM surgeries
         WHERE user_id = $1 AND paid = true AND to_char(paid_at, 'YYYY-MM') = $2`,
        [userId, month]
      );
      const autoReceita = parseFloat(surgeryRows[0]?.total) || 0;

      // Auto cost (stock purchases)
      const stockRows = await queryRows(
        `SELECT COALESCE(SUM(sm.total_cost), 0) as total
         FROM stock_movements sm
         WHERE sm.user_id = $1 AND sm.type = 'purchase' AND to_char(sm.created_at, 'YYYY-MM') = $2`,
        [userId, month]
      );
      const autoDespesa = parseFloat(stockRows[0]?.total) || 0;

      const receita = manualReceita + autoReceita;
      const despesa = manualDespesa + autoDespesa;

      results.push({
        month,
        receita,
        despesa: -despesa,
        resultado: receita - despesa,
      });
    }

    res.json(results);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { date, type, category, cost_center, amount, description, supplier_name } = req.body;

    if (!date || !type || !category || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'date, type, category e amount são obrigatórios' });
    }

    if (!['receita', 'despesa'].includes(type)) {
      return res.status(400).json({ error: 'type deve ser receita ou despesa' });
    }

    if (!ALL_CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    // Don't allow manual entries in auto categories
    const autoCats = ['anestesias', 'medicamentos_insumos'];
    if (autoCats.includes(category)) {
      return res.status(400).json({ error: 'Categoria automática não aceita lançamentos manuais' });
    }

    if (cost_center && !COST_CENTER_KEYS.includes(cost_center)) {
      return res.status(400).json({ error: 'Centro de custo inválido' });
    }

    const { data: entry, error } = await supabase
      .from('controladoria')
      .insert({
        user_id: userId,
        date,
        type,
        category,
        cost_center: cost_center || null,
        amount: Math.abs(parseFloat(amount)),
        description: description || null,
        supplier_name: supplier_name || null,
        source: 'manual',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ entry });
  } catch (err) {
    console.error('Create controladoria entry error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;

    const { data: existing } = await supabase
      .from('controladoria')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    if (existing.source !== 'manual') {
      return res.status(403).json({ error: 'Lançamentos automáticos não podem ser editados' });
    }

    const { date, type, category, cost_center, amount, description, supplier_name } = req.body;

    const updateData = {};
    if (date !== undefined) updateData.date = date;
    if (type !== undefined) {
      if (!['receita', 'despesa'].includes(type)) {
        return res.status(400).json({ error: 'type deve ser receita ou despesa' });
      }
      updateData.type = type;
    }
    if (category !== undefined) {
      if (!ALL_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: 'Categoria inválida' });
      }
      updateData.category = category;
    }
    if (cost_center !== undefined) updateData.cost_center = cost_center || null;
    if (amount !== undefined) updateData.amount = Math.abs(parseFloat(amount));
    if (description !== undefined) updateData.description = description || null;
    if (supplier_name !== undefined) updateData.supplier_name = supplier_name || null;

    await supabase
      .from('controladoria')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    const { data: updated } = await supabase
      .from('controladoria')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ entry: updated });
  } catch (err) {
    console.error('Update controladoria entry error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const id = req.params.id;

    const { data: existing } = await supabase
      .from('controladoria')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    if (existing.source !== 'manual') {
      return res.status(403).json({ error: 'Lançamentos automáticos não podem ser excluídos' });
    }

    await supabase
      .from('controladoria')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    res.json({ message: 'Lançamento excluído com sucesso' });
  } catch (err) {
    console.error('Delete controladoria entry error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
