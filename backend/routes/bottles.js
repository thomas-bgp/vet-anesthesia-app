const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/bottles - List bottles for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { status, medicine_id, medicine_type } = req.query;

    // Auto-mark expired bottles
    await supabase
      .from('medicine_bottles')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'opened')
      .lt('expires_at', new Date().toISOString());

    let sql = `
      SELECT mb.*, m.name as medicine_name, m.active_principle, m.concentration,
             COALESCE(m.medicine_type, 'farmaco') as medicine_type
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.user_id = $1
    `;
    const params = [userId];
    let paramIdx = 2;

    if (status && status !== 'all') {
      sql += ` AND mb.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (medicine_id) {
      sql += ` AND mb.medicine_id = $${paramIdx}`;
      params.push(medicine_id);
      paramIdx++;
    }

    if (medicine_type && medicine_type !== 'todos') {
      sql += ` AND COALESCE(m.medicine_type, 'farmaco') = $${paramIdx}`;
      params.push(medicine_type);
      paramIdx++;
    }

    sql += `
      ORDER BY
        CASE mb.status WHEN 'opened' THEN 0 WHEN 'sealed' THEN 1 ELSE 2 END,
        CASE WHEN mb.status = 'opened' THEN mb.expires_at END ASC,
        mb.created_at DESC
    `;

    const bottles = await queryRows(sql, params);
    res.json({ bottles });
  } catch (err) {
    console.error('List bottles error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/bottles/expiring-soon - Bottles expiring within 2 days
router.get('/expiring-soon', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();
    const in2days = new Date(Date.now() + 2 * 86400000).toISOString();

    const bottles = await queryRows(`
      SELECT mb.*, m.name as medicine_name, m.active_principle
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.user_id = $1
        AND mb.status = 'opened'
        AND mb.expires_at <= $2
        AND mb.expires_at >= $3
      ORDER BY mb.expires_at ASC
    `, [userId, in2days, now]);

    res.json({ bottles });
  } catch (err) {
    console.error('Expiring soon error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/bottles/stats - Bottle statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();
    const in2days = new Date(Date.now() + 2 * 86400000).toISOString();

    const rows = await queryRows(`
      SELECT
        COUNT(*)::int as total_bottles,
        SUM(CASE WHEN status = 'sealed' THEN 1 ELSE 0 END)::int as sealed_count,
        SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END)::int as opened_count,
        SUM(CASE WHEN status IN ('sealed', 'opened') THEN purchase_cost ELSE 0 END) as total_stock_value,
        SUM(CASE WHEN status = 'opened' AND expires_at <= $2 AND expires_at >= $3 THEN 1 ELSE 0 END)::int as expiring_soon_count
      FROM medicine_bottles
      WHERE user_id = $1
    `, [userId, in2days, now]);

    res.json(rows[0]);
  } catch (err) {
    console.error('Bottle stats error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/bottles - Create bottle(s) from a purchase
router.post('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const {
      medicine_id,
      quantity = 1,
      volume_ml,
      purchase_cost_per_unit = 0,
      units_per_box = 1,
      purchased_at,
      batch_number
    } = req.body;

    if (!medicine_id || !volume_ml) {
      return res.status(400).json({ error: 'medicine_id e volume_ml são obrigatórios' });
    }

    if (parseInt(quantity) > 200) {
      return res.status(400).json({ error: 'Máximo de 200 unidades por compra' });
    }

    const totalUnits = parseInt(quantity) || 1;
    const costPerMl = purchase_cost_per_unit > 0 ? purchase_cost_per_unit / volume_ml : 0;

    // Insert bottles
    const bottleRows = [];
    for (let i = 0; i < totalUnits; i++) {
      bottleRows.push({
        medicine_id,
        user_id: userId,
        volume_ml,
        remaining_ml: volume_ml,
        purchase_cost: purchase_cost_per_unit,
        cost_per_ml: costPerMl,
        status: 'sealed',
        purchased_at: purchased_at || new Date().toISOString().split('T')[0],
        batch_number: batch_number || null,
      });
    }

    const { data: createdBottles, error: bottleError } = await supabase
      .from('medicine_bottles')
      .insert(bottleRows)
      .select();

    if (bottleError) throw bottleError;

    // Create stock_movement record
    await supabase.from('stock_movements').insert({
      medicine_id,
      user_id: userId,
      type: 'purchase',
      quantity: totalUnits,
      unit_cost: purchase_cost_per_unit,
      total_cost: purchase_cost_per_unit * totalUnits,
      notes: `Compra de ${totalUnits} unidade(s)`,
    });

    // Update medicine stock count and cost
    await queryRows(
      `UPDATE medicines SET current_stock = current_stock + $1, cost_per_unit = $2, updated_at = NOW() WHERE id = $3`,
      [totalUnits, purchase_cost_per_unit, medicine_id]
    ).catch(() => {});

    // Fetch bottles with medicine name using Supabase client
    const createdIds = createdBottles.map(b => b.id);
    let bottles = createdBottles;
    if (createdIds.length > 0) {
      const idList = createdIds.join(',');
      bottles = await queryRows(`
        SELECT mb.*, m.name as medicine_name
        FROM medicine_bottles mb
        JOIN medicines m ON mb.medicine_id = m.id
        WHERE mb.id IN (${idList})
      `, []);
    }

    res.status(201).json({ bottles, count: bottles.length });
  } catch (err) {
    console.error('Create bottles error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/bottles/:id - Edit bottle details
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: bottle } = await supabase
      .from('medicine_bottles')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!bottle) return res.status(404).json({ error: 'Frasco não encontrado' });

    const { volume_ml, remaining_ml, purchase_cost, batch_number } = req.body;
    const updateData = {};

    if (volume_ml !== undefined) {
      updateData.volume_ml = parseFloat(volume_ml);
      updateData.cost_per_ml = purchase_cost !== undefined
        ? (parseFloat(purchase_cost) / parseFloat(volume_ml)) || 0
        : (bottle.purchase_cost / parseFloat(volume_ml)) || 0;
    }
    if (remaining_ml !== undefined) updateData.remaining_ml = parseFloat(remaining_ml);
    if (purchase_cost !== undefined) {
      updateData.purchase_cost = parseFloat(purchase_cost);
      const vol = volume_ml !== undefined ? parseFloat(volume_ml) : bottle.volume_ml;
      updateData.cost_per_ml = vol > 0 ? parseFloat(purchase_cost) / vol : 0;
    }
    if (batch_number !== undefined) updateData.batch_number = batch_number || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    await supabase
      .from('medicine_bottles')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id);

    const { data: updated } = await supabase
      .from('medicine_bottles')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ bottle: updated });
  } catch (err) {
    console.error('Update bottle error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/bottles/:id/open - Mark bottle as opened
router.put('/:id/open', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const bottleId = req.params.id;

    const { data: bottle } = await supabase
      .from('medicine_bottles')
      .select('*')
      .eq('id', bottleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }
    if (bottle.status !== 'sealed') {
      return res.status(400).json({ error: 'Apenas frascos lacrados podem ser abertos' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 86400000).toISOString();

    await supabase
      .from('medicine_bottles')
      .update({
        status: 'opened',
        opened_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .eq('id', bottleId)
      .eq('user_id', userId);

    const rows = await queryRows(`
      SELECT mb.*, m.name as medicine_name
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.id = $1
    `, [bottleId]);

    res.json({ bottle: rows[0] });
  } catch (err) {
    console.error('Open bottle error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/bottles/:id/use - Record usage
router.post('/:id/use', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const bottleId = req.params.id;
    const { ml_used, surgery_id, notes } = req.body;

    if (!ml_used || ml_used <= 0) {
      return res.status(400).json({ error: 'ml_used deve ser maior que zero' });
    }

    const { data: bottle } = await supabase
      .from('medicine_bottles')
      .select('*')
      .eq('id', bottleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }
    if (bottle.status !== 'opened') {
      return res.status(400).json({ error: 'Frasco precisa estar aberto para uso' });
    }

    const cost = ml_used * (bottle.cost_per_ml || 0);
    const newRemaining = Math.max(0, bottle.remaining_ml - ml_used);
    const newStatus = newRemaining <= 0 ? 'empty' : 'opened';

    // Update bottle
    await supabase
      .from('medicine_bottles')
      .update({ remaining_ml: newRemaining, status: newStatus })
      .eq('id', bottleId);

    // Insert usage
    await supabase.from('bottle_usages').insert({
      bottle_id: bottleId,
      surgery_id: surgery_id || null,
      user_id: userId,
      ml_used,
      cost,
      notes: notes || null,
    });

    const rows = await queryRows(`
      SELECT mb.*, m.name as medicine_name
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.id = $1
    `, [bottleId]);

    res.json({ bottle: rows[0], cost });
  } catch (err) {
    console.error('Use bottle error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/bottles/:id/discard - Discard bottle
router.put('/:id/discard', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const bottleId = req.params.id;

    const { data: bottle } = await supabase
      .from('medicine_bottles')
      .select('*')
      .eq('id', bottleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }

    await supabase
      .from('medicine_bottles')
      .update({ status: 'discarded' })
      .eq('id', bottleId)
      .eq('user_id', userId);

    res.json({ message: 'Frasco descartado com sucesso' });
  } catch (err) {
    console.error('Discard bottle error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/bottles/:id/history - Usage history for a bottle
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const bottleId = req.params.id;

    const { data: bottle } = await supabase
      .from('medicine_bottles')
      .select('*')
      .eq('id', bottleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }

    const usages = await queryRows(`
      SELECT bu.*, s.patient_name, s.procedure_name
      FROM bottle_usages bu
      LEFT JOIN surgeries s ON bu.surgery_id = s.id
      WHERE bu.bottle_id = $1 AND bu.user_id = $2
      ORDER BY bu.used_at DESC
    `, [bottleId, userId]);

    res.json({ bottle, usages });
  } catch (err) {
    console.error('Bottle history error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
