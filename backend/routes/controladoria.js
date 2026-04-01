const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// ─── Default categories with pre-classified cost centers ─────────────────────
const DEFAULT_CATEGORIES = [
  // Receitas
  { type: 'receita', category_key: 'anestesias', category_label: 'Anestesias', cost_center: 'receita', is_auto: true, sort_order: 1 },
  { type: 'receita', category_key: 'outras_receitas', category_label: 'Outras receitas', cost_center: 'receita', is_auto: false, sort_order: 2 },
  // Despesas - Operacional
  { type: 'despesa', category_key: 'medicamentos_insumos', category_label: 'Medicamentos e insumos', cost_center: 'operacional', is_auto: true, sort_order: 10 },
  { type: 'despesa', category_key: 'equipamentos', category_label: 'Equipamentos', cost_center: 'operacional', is_auto: false, sort_order: 11 },
  { type: 'despesa', category_key: 'manutencao_equip', category_label: 'Manutenção de equipamentos', cost_center: 'operacional', is_auto: false, sort_order: 12 },
  // Despesas - Administrativo
  { type: 'despesa', category_key: 'impostos', category_label: 'Impostos e tributos', cost_center: 'administrativo', is_auto: false, sort_order: 20 },
  { type: 'despesa', category_key: 'contabilidade', category_label: 'Contabilidade', cost_center: 'administrativo', is_auto: false, sort_order: 21 },
  { type: 'despesa', category_key: 'crmv_associacoes', category_label: 'CRMV e associações', cost_center: 'administrativo', is_auto: false, sort_order: 22 },
  { type: 'despesa', category_key: 'material_escritorio', category_label: 'Material de escritório', cost_center: 'administrativo', is_auto: false, sort_order: 23 },
  { type: 'despesa', category_key: 'aluguel', category_label: 'Aluguel / Coworking', cost_center: 'administrativo', is_auto: false, sort_order: 24 },
  // Despesas - Comercial
  { type: 'despesa', category_key: 'marketing', category_label: 'Marketing e divulgação', cost_center: 'comercial', is_auto: false, sort_order: 30 },
  { type: 'despesa', category_key: 'telefone_internet', category_label: 'Telefone e internet', cost_center: 'comercial', is_auto: false, sort_order: 31 },
  // Despesas - Transporte
  { type: 'despesa', category_key: 'transporte', category_label: 'Transporte e combustível', cost_center: 'transporte', is_auto: false, sort_order: 40 },
  { type: 'despesa', category_key: 'seguro_veiculo', category_label: 'Seguro do veículo', cost_center: 'transporte', is_auto: false, sort_order: 41 },
  // Despesas - Desenvolvimento
  { type: 'despesa', category_key: 'educacao', category_label: 'Educação e congressos', cost_center: 'desenvolvimento', is_auto: false, sort_order: 50 },
  // Despesas - Pessoal
  { type: 'despesa', category_key: 'seguros', category_label: 'Seguros (RC profissional)', cost_center: 'pessoal', is_auto: false, sort_order: 60 },
  { type: 'despesa', category_key: 'alimentacao', category_label: 'Alimentação em trabalho', cost_center: 'pessoal', is_auto: false, sort_order: 61 },
  { type: 'despesa', category_key: 'outros', category_label: 'Outros custos', cost_center: 'pessoal', is_auto: false, sort_order: 99 },
];

const COST_CENTERS = [
  { key: 'receita', label: 'Receita' },
  { key: 'operacional', label: 'Operacional' },
  { key: 'administrativo', label: 'Administrativo' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'desenvolvimento', label: 'Desenvolvimento' },
  { key: 'pessoal', label: 'Pessoal' },
];

// ─── Ensure user has config (seed defaults on first access) ──────────────────
async function getUserConfig(userId) {
  const sb = getSupabase();
  const { data: existing } = await sb
    .from('controladoria_config')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (existing && existing.length > 0) return existing;

  // Seed defaults
  const rows = DEFAULT_CATEGORIES.map(c => ({ user_id: userId, ...c }));
  await sb.from('controladoria_config').insert(rows);

  const { data: seeded } = await sb
    .from('controladoria_config')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  return seeded || [];
}

// ─── GET /categories ─────────────────────────────────────────────────────────
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const config = await getUserConfig(req.user.id);
    res.json({ categories: config, cost_centers: COST_CENTERS });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── PUT /categories/:id — update category-to-cost-center mapping ────────────
router.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const sb = getSupabase();
    const { cost_center, category_label } = req.body;

    if (cost_center && !COST_CENTERS.find(c => c.key === cost_center)) {
      return res.status(400).json({ error: 'Centro de custo inválido' });
    }

    const updateData = {};
    if (cost_center) updateData.cost_center = cost_center;
    if (category_label) updateData.category_label = category_label;

    await sb.from('controladoria_config')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    const config = await getUserConfig(req.user.id);
    res.json({ categories: config });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST /categories — add custom category ─────────────────────────────────
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const sb = getSupabase();
    const { type, category_key, category_label, cost_center } = req.body;

    if (!type || !category_key || !category_label || !cost_center) {
      return res.status(400).json({ error: 'type, category_key, category_label e cost_center são obrigatórios' });
    }

    const config = await getUserConfig(req.user.id);
    const maxSort = Math.max(0, ...config.map(c => c.sort_order));

    await sb.from('controladoria_config').insert({
      user_id: req.user.id,
      type,
      category_key,
      category_label,
      cost_center,
      is_auto: false,
      sort_order: maxSort + 1,
    });

    const updated = await getUserConfig(req.user.id);
    res.status(201).json({ categories: updated });
  } catch (err) {
    console.error('Add category error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── DELETE /categories/:id — remove custom category ─────────────────────────
router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const sb = getSupabase();
    const { data: cat } = await sb.from('controladoria_config')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
    if (cat.is_auto) return res.status(403).json({ error: 'Categorias automáticas não podem ser removidas' });

    await sb.from('controladoria_config').delete().eq('id', req.params.id).eq('user_id', req.user.id);

    const updated = await getUserConfig(req.user.id);
    res.json({ categories: updated });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /dre?month=2026-04 ──────────────────────────────────────────────────
router.get('/dre', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parâmetro month obrigatório (YYYY-MM)' });
    }

    const config = await getUserConfig(userId);
    const catMap = {};
    for (const c of config) catMap[c.category_key] = c;

    // 1. Manual entries
    const manualEntries = await queryRows(
      `SELECT id, date, type, category, cost_center, amount, description, supplier_name, source
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

    // 3. Stock purchases (auto cost) — grouped by medicine+purchased_at from bottles
    const stockPurchases = await queryRows(
      `SELECT m.id, m.name, mb.purchased_at as date,
              COUNT(*)::int as qty,
              SUM(mb.purchase_cost)::numeric as total_cost
       FROM medicine_bottles mb
       JOIN medicines m ON mb.medicine_id = m.id
       WHERE mb.user_id = $1 AND to_char(mb.purchased_at, 'YYYY-MM') = $2
       GROUP BY m.id, m.name, mb.purchased_at
       ORDER BY mb.purchased_at`,
      [userId, month]
    );

    // Build DRE grouped by cost_center
    const dre = {};
    for (const c of config) {
      if (!dre[c.cost_center]) dre[c.cost_center] = { categories: {} };
      dre[c.cost_center].categories[c.category_key] = { label: c.category_label, type: c.type, is_auto: c.is_auto, total: 0, entries: [] };
    }

    // Auto: anestesias
    if (dre.receita?.categories?.anestesias) {
      for (const s of paidSurgeries) {
        const amt = parseFloat(s.revenue) || 0;
        dre.receita.categories.anestesias.total += amt;
        dre.receita.categories.anestesias.entries.push({
          id: s.id, description: `${s.clinic_name || 'Clínica'} — ${s.patient_name}`, amount: amt, date: s.paid_at, source: 'auto',
        });
      }
    }

    // Auto: medicamentos
    const medCC = catMap.medicamentos_insumos?.cost_center || 'operacional';
    if (dre[medCC]?.categories?.medicamentos_insumos) {
      for (const p of stockPurchases) {
        const amt = parseFloat(p.total_cost) || 0;
        dre[medCC].categories.medicamentos_insumos.total += amt;
        dre[medCC].categories.medicamentos_insumos.entries.push({
          id: p.id, description: `${p.name} (${p.qty}un)`, amount: amt, date: p.date, source: 'auto',
        });
      }
    }

    // Manual entries
    for (const entry of manualEntries) {
      const cc = entry.cost_center || catMap[entry.category]?.cost_center || 'pessoal';
      if (dre[cc]?.categories?.[entry.category]) {
        const amt = parseFloat(entry.amount) || 0;
        dre[cc].categories[entry.category].total += amt;
        dre[cc].categories[entry.category].entries.push({
          id: entry.id, description: entry.description || '', amount: amt, date: entry.date,
          source: 'manual', supplier_name: entry.supplier_name,
        });
      }
    }

    // Calculate totals
    let totalReceita = 0, totalDespesa = 0;
    const byCostCenter = {};
    for (const [ccKey, ccData] of Object.entries(dre)) {
      let ccTotal = 0;
      for (const [, catData] of Object.entries(ccData.categories)) {
        if (catData.type === 'receita') totalReceita += catData.total;
        else { totalDespesa += catData.total; ccTotal += catData.total; }
      }
      byCostCenter[ccKey] = ccTotal;
    }

    res.json({
      month,
      dre,
      cost_centers: COST_CENTERS,
      totals: { total_receita: totalReceita, total_despesa: -totalDespesa, resultado: totalReceita - totalDespesa },
      by_cost_center: byCostCenter,
    });
  } catch (err) {
    console.error('DRE error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /summary ────────────────────────────────────────────────────────────
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const results = [];
    for (const month of months) {
      const manualRows = await queryRows(
        `SELECT type, COALESCE(SUM(amount), 0)::numeric as total FROM controladoria WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2 GROUP BY type`,
        [userId, month]
      );
      let mr = 0, md = 0;
      for (const r of manualRows) { if (r.type === 'receita') mr = parseFloat(r.total); if (r.type === 'despesa') md = parseFloat(r.total); }

      const sr = await queryRows(`SELECT COALESCE(SUM(revenue), 0)::numeric as total FROM surgeries WHERE user_id = $1 AND paid = true AND to_char(paid_at, 'YYYY-MM') = $2`, [userId, month]);
      const ar = parseFloat(sr[0]?.total) || 0;

      const sp = await queryRows(`SELECT COALESCE(SUM(purchase_cost), 0)::numeric as total FROM medicine_bottles WHERE user_id = $1 AND to_char(purchased_at, 'YYYY-MM') = $2`, [userId, month]);
      const ad = parseFloat(sp[0]?.total) || 0;

      const receita = mr + ar, despesa = md + ad;
      results.push({ month, receita, despesa: -despesa, resultado: receita - despesa });
    }
    res.json(results);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST / — create manual entry ────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const sb = getSupabase();
    const userId = req.user.id;
    const { date, type, category, amount, description, supplier_name } = req.body;

    if (!date || !type || !category || amount === undefined) {
      return res.status(400).json({ error: 'date, type, category e amount são obrigatórios' });
    }

    const config = await getUserConfig(userId);
    const cat = config.find(c => c.category_key === category);
    if (!cat) return res.status(400).json({ error: 'Categoria inválida' });
    if (cat.is_auto) return res.status(400).json({ error: 'Categoria automática não aceita lançamentos manuais' });

    const { data: entry, error } = await sb.from('controladoria').insert({
      user_id: userId, date, type, category,
      cost_center: cat.cost_center,
      amount: Math.abs(parseFloat(amount)),
      description: description || null,
      supplier_name: supplier_name || null,
      source: 'manual',
    }).select().single();

    if (error) throw error;
    res.status(201).json({ entry });
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── PUT /:id ────────────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const sb = getSupabase();
    const { data: existing } = await sb.from('controladoria').select('*').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    if (existing.source !== 'manual') return res.status(403).json({ error: 'Lançamento automático' });

    const { date, type, category, amount, description, supplier_name } = req.body;
    const updateData = {};
    if (date) updateData.date = date;
    if (amount !== undefined) updateData.amount = Math.abs(parseFloat(amount));
    if (description !== undefined) updateData.description = description || null;
    if (supplier_name !== undefined) updateData.supplier_name = supplier_name || null;

    if (category) {
      const config = await getUserConfig(req.user.id);
      const cat = config.find(c => c.category_key === category);
      if (!cat) return res.status(400).json({ error: 'Categoria inválida' });
      updateData.category = category;
      updateData.cost_center = cat.cost_center;
      if (type) updateData.type = type;
    }

    await sb.from('controladoria').update(updateData).eq('id', req.params.id).eq('user_id', req.user.id);
    const { data: updated } = await sb.from('controladoria').select('*').eq('id', req.params.id).single();
    res.json({ entry: updated });
  } catch (err) {
    console.error('Update entry error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /analytics ──────────────────────────────────────────────────────────
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // ── a) Resultado Acumulado (last 12 months) ─────────────────────────────
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const acumuladoData = [];
    let acumulado = 0;

    for (const m of months) {
      // Receita: paid surgeries + manual receita entries
      const surgRevenueRows = await queryRows(
        `SELECT COALESCE(SUM(revenue), 0)::numeric AS total FROM surgeries WHERE user_id = $1 AND paid = true AND to_char(paid_at, 'YYYY-MM') = $2`,
        [userId, m]
      );
      const manualReceitaRows = await queryRows(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM controladoria WHERE user_id = $1 AND type = 'receita' AND to_char(date, 'YYYY-MM') = $2`,
        [userId, m]
      );
      const receita = (parseFloat(surgRevenueRows[0]?.total) || 0) + (parseFloat(manualReceitaRows[0]?.total) || 0);

      // Despesa: bottle purchases + manual despesa entries
      const bottleCostRows = await queryRows(
        `SELECT COALESCE(SUM(purchase_cost), 0)::numeric AS total FROM medicine_bottles WHERE user_id = $1 AND to_char(purchased_at, 'YYYY-MM') = $2`,
        [userId, m]
      );
      const manualDespesaRows = await queryRows(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM controladoria WHERE user_id = $1 AND type = 'despesa' AND to_char(date, 'YYYY-MM') = $2`,
        [userId, m]
      );
      const despesa = (parseFloat(bottleCostRows[0]?.total) || 0) + (parseFloat(manualDespesaRows[0]?.total) || 0);

      const resultado = receita - despesa;
      acumulado += resultado;

      acumuladoData.push({
        month: m,
        receita: Math.round(receita * 100) / 100,
        despesa: Math.round(despesa * 100) / 100,
        resultado: Math.round(resultado * 100) / 100,
        acumulado: Math.round(acumulado * 100) / 100,
      });
    }

    // ── b) Break Even ───────────────────────────────────────────────────────
    // Fixed monthly costs: average of last 3 months manual despesa (excluding medicamentos_insumos)
    const threeMonthsAgo = [];
    for (let i = 3; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      threeMonthsAgo.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const fixedCostRows = await queryRows(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM controladoria
       WHERE user_id = $1
         AND type = 'despesa'
         AND category != 'medicamentos_insumos'
         AND to_char(date, 'YYYY-MM') = ANY($2::text[])`,
      [userId, `{${threeMonthsAgo.join(',')}}`]
    );
    const fixedCostsTotal = parseFloat(fixedCostRows[0]?.total) || 0;
    const fixedCostsMonthly = threeMonthsAgo.length > 0 ? fixedCostsTotal / threeMonthsAgo.length : 0;

    // Avg revenue per surgery (last 6 months)
    const sixMonthsAgo = [];
    for (let i = 6; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      sixMonthsAgo.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const surgRevRows = await queryRows(
      `SELECT COALESCE(SUM(revenue), 0)::numeric AS total_rev, COUNT(*)::int AS cnt
       FROM surgeries
       WHERE user_id = $1 AND paid = true AND to_char(paid_at, 'YYYY-MM') = ANY($2::text[])`,
      [userId, `{${sixMonthsAgo.join(',')}}`]
    );
    const totalSurgRevenue = parseFloat(surgRevRows[0]?.total_rev) || 0;
    const totalSurgCount = parseInt(surgRevRows[0]?.cnt) || 0;
    const avgRevenuePerSurgery = totalSurgCount > 0 ? totalSurgRevenue / totalSurgCount : 0;

    // Avg variable cost per surgery: bottle_usages cost / surgery count (last 6 months)
    const usageCostRows = await queryRows(
      `SELECT COALESCE(SUM(bu.cost), 0)::numeric AS total_cost, COUNT(DISTINCT bu.surgery_id)::int AS surg_count
       FROM bottle_usages bu
       JOIN surgeries s ON bu.surgery_id = s.id
       WHERE bu.user_id = $1 AND to_char(bu.used_at, 'YYYY-MM') = ANY($2::text[])`,
      [userId, `{${sixMonthsAgo.join(',')}}`]
    );
    let avgVariableCostPerSurgery = 0;
    const usageCost = parseFloat(usageCostRows[0]?.total_cost) || 0;
    const usageSurgCount = parseInt(usageCostRows[0]?.surg_count) || 0;

    if (usageSurgCount > 0) {
      avgVariableCostPerSurgery = usageCost / usageSurgCount;
    } else if (totalSurgCount > 0) {
      // Fallback: total purchase cost in period / surgery count
      const purchCostRows = await queryRows(
        `SELECT COALESCE(SUM(purchase_cost), 0)::numeric AS total
         FROM medicine_bottles
         WHERE user_id = $1 AND to_char(purchased_at, 'YYYY-MM') = ANY($2::text[])`,
        [userId, `{${sixMonthsAgo.join(',')}}`]
      );
      avgVariableCostPerSurgery = (parseFloat(purchCostRows[0]?.total) || 0) / totalSurgCount;
    }

    // Break even calculations
    let breakEvenSurgeries = null;
    let breakEvenRevenue = null;
    const margin = avgRevenuePerSurgery - avgVariableCostPerSurgery;
    if (margin > 0) {
      breakEvenSurgeries = Math.ceil(fixedCostsMonthly / margin);
      breakEvenRevenue = Math.round(fixedCostsMonthly / (1 - avgVariableCostPerSurgery / avgRevenuePerSurgery));
    }

    // Current month stats
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const curMonthRows = await queryRows(
      `SELECT COALESCE(SUM(revenue), 0)::numeric AS total_rev, COUNT(*)::int AS cnt
       FROM surgeries
       WHERE user_id = $1 AND paid = true AND to_char(paid_at, 'YYYY-MM') = $2`,
      [userId, curMonth]
    );
    const currentMonthSurgeries = parseInt(curMonthRows[0]?.cnt) || 0;
    const currentMonthRevenue = parseFloat(curMonthRows[0]?.total_rev) || 0;

    const breakEven = {
      fixed_costs_monthly: Math.round(fixedCostsMonthly * 100) / 100,
      avg_revenue_per_surgery: Math.round(avgRevenuePerSurgery * 100) / 100,
      avg_variable_cost_per_surgery: Math.round(avgVariableCostPerSurgery * 100) / 100,
      break_even_surgeries: breakEvenSurgeries,
      break_even_revenue: breakEvenRevenue,
      current_month_surgeries: currentMonthSurgeries,
      current_month_revenue: Math.round(currentMonthRevenue * 100) / 100,
      above_break_even: breakEvenSurgeries !== null ? currentMonthSurgeries >= breakEvenSurgeries : null,
    };

    // ── c) Necessidade de Caixa ─────────────────────────────────────────────
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysStr = ninetyDaysAgo.toISOString().slice(0, 10);

    // Get active medicines with stock info
    const medicinesRows = await queryRows(
      `SELECT m.id, m.name, m.concentration, m.cost_per_unit, m.min_stock,
              COUNT(mb.id) FILTER (WHERE mb.status IN ('sealed', 'opened'))::int AS current_units,
              COUNT(mb.id) FILTER (WHERE mb.status IN ('empty', 'discarded') AND mb.created_at >= $2::date)::int AS used_90d
       FROM medicines m
       LEFT JOIN medicine_bottles mb ON mb.medicine_id = m.id AND mb.user_id = $1
       WHERE m.user_id = $1 AND m.is_active = 1
       GROUP BY m.id, m.name, m.concentration, m.cost_per_unit, m.min_stock
       HAVING COUNT(mb.id) > 0
       ORDER BY m.name`,
      [userId, ninetyDaysStr]
    );

    // Fallback: surgery_medicines usage count for medicines with no bottle usage data
    const surgMedUsage = await queryRows(
      `SELECT sm.medicine_id, COUNT(DISTINCT sm.surgery_id)::int AS usage_count
       FROM surgery_medicines sm
       JOIN surgeries s ON sm.surgery_id = s.id
       WHERE s.user_id = $1 AND sm.administered_at >= $2::date
       GROUP BY sm.medicine_id`,
      [userId, ninetyDaysStr]
    );
    const surgUsageMap = {};
    for (const r of surgMedUsage) surgUsageMap[r.medicine_id] = parseInt(r.usage_count) || 0;

    const cashItems = [];
    let minDays = Infinity;
    let minDaysMedicine = null;

    for (const med of medicinesRows) {
      const currentUnits = parseInt(med.current_units) || 0;
      const used90d = parseInt(med.used_90d) || 0;
      const costPerUnit = parseFloat(med.cost_per_unit) || 0;
      const minStock = parseFloat(med.min_stock) || 1;

      // Consumption rate: bottles used in 90 days, or fallback to surgery usage
      let consumptionPer90d = used90d;
      if (consumptionPer90d === 0 && surgUsageMap[med.id]) {
        // Estimate: each surgery usage ~ 1 bottle (rough approximation)
        consumptionPer90d = surgUsageMap[med.id];
      }

      const consumptionPerMonth = consumptionPer90d > 0 ? (consumptionPer90d / 90) * 30 : 0;
      const dailyRate = consumptionPer90d / 90;
      const daysUntilEmpty = dailyRate > 0 ? Math.round(currentUnits / dailyRate) : (currentUnits > 0 ? 999 : 0);
      const restockCost = Math.round(costPerUnit * Math.max(minStock, 1) * 100) / 100;

      let urgency = 'ok';
      if (currentUnits === 0) urgency = 'empty';
      else if (daysUntilEmpty <= 7) urgency = 'critical';
      else if (daysUntilEmpty <= 30) urgency = 'soon';

      if (daysUntilEmpty < minDays && currentUnits > 0) {
        minDays = daysUntilEmpty;
        minDaysMedicine = med.name;
      }

      cashItems.push({
        medicine_id: med.id,
        name: med.name,
        concentration: med.concentration || '',
        current_units: currentUnits,
        consumption_per_month: Math.round(consumptionPerMonth * 10) / 10,
        days_until_empty: daysUntilEmpty > 999 ? null : daysUntilEmpty,
        restock_cost: restockCost,
        urgency,
      });
    }

    // Sort: critical first, then soon, then ok, then empty
    const urgencyOrder = { critical: 0, soon: 1, ok: 2, empty: 3 };
    cashItems.sort((a, b) => (urgencyOrder[a.urgency] ?? 99) - (urgencyOrder[b.urgency] ?? 99));

    const totalRestockCost = cashItems
      .filter(i => i.urgency === 'critical' || i.urgency === 'soon')
      .reduce((s, i) => s + i.restock_cost, 0);

    const cashNeeds = {
      items: cashItems,
      total_restock_cost: Math.round(totalRestockCost * 100) / 100,
      next_restock_days: minDays < Infinity ? minDays : null,
      next_restock_medicine: minDaysMedicine,
    };

    res.json({ acumulado: acumuladoData, break_even: breakEven, cash_needs: cashNeeds });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Erro ao calcular analytics' });
  }
});

// ─── DELETE /:id ─────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const sb = getSupabase();
    const { data: existing } = await sb.from('controladoria').select('*').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    if (existing.source !== 'manual') return res.status(403).json({ error: 'Lançamento automático' });

    await sb.from('controladoria').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ message: 'Excluído' });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
