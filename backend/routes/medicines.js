const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/medicines - list all medicines with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      search,
      low_stock,
      expiring_soon,
      medicine_type,
      page = 1,
      limit = 50,
    } = req.query;

    let whereClause = 'WHERE m.user_id = $1 AND m.is_active = true';
    const params = [req.user.id];
    let paramIdx = 2;

    if (medicine_type && medicine_type !== 'todos') {
      whereClause += ` AND COALESCE(m.medicine_type, 'farmaco') = $${paramIdx}`;
      params.push(medicine_type);
      paramIdx++;
    }

    if (search) {
      whereClause += ` AND (m.name ILIKE $${paramIdx} OR m.active_principle ILIKE $${paramIdx + 1} OR m.supplier ILIKE $${paramIdx + 2})`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
      paramIdx += 3;
    }

    if (low_stock === 'true' || req.query.filter === 'low_stock') {
      whereClause += ` AND m.min_stock > 0 AND m.current_stock <= m.min_stock`;
    }

    const now = new Date().toISOString().split('T')[0];
    const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    if (expiring_soon === 'true' || req.query.filter === 'expiring') {
      whereClause += ` AND m.expiry_date <= $${paramIdx} AND m.expiry_date >= $${paramIdx + 1}`;
      params.push(in30days, now);
      paramIdx += 2;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Count
    const countRows = await queryRows(
      `SELECT COUNT(*)::int as total FROM medicines m ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Select
    const selectParams = [...params, parseInt(limit), offset];
    const medicines = await queryRows(`
      SELECT
        m.*,
        CASE WHEN m.min_stock > 0 AND m.current_stock <= m.min_stock THEN true ELSE false END as is_low_stock,
        CASE WHEN m.expiry_date <= '${in30days}' AND m.expiry_date >= '${now}' THEN true ELSE false END as is_expiring_soon,
        CASE WHEN m.expiry_date < '${now}' THEN true ELSE false END as is_expired,
        (m.current_stock * m.cost_per_unit) as stock_value
      FROM medicines m
      ${whereClause}
      ORDER BY m.name ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, selectParams);

    // Summary
    const summaryRows = await queryRows(`
      SELECT
        SUM(m.current_stock * m.cost_per_unit) as total_value,
        COUNT(*)::int as total_count,
        SUM(CASE WHEN (m.min_stock > 0 AND m.current_stock <= m.min_stock)
                   OR (m.current_stock = 0 AND EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.medicine_id = m.id AND sm.type = 'purchase'))
             THEN 1 ELSE 0 END)::int as low_stock_count,
        SUM(CASE WHEN m.expiry_date <= $2 AND m.expiry_date >= $3 THEN 1 ELSE 0 END)::int as expiring_count
      FROM medicines m
      WHERE m.user_id = $1 AND m.is_active = true
    `, [req.user.id, in30days, now]);

    res.json({
      medicines,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
      summary: summaryRows[0] || {},
    });
  } catch (err) {
    console.error('List medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/medicines/low-stock
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const medicines = await queryRows(`
      SELECT
        m.*,
        (m.min_stock - m.current_stock) as deficit,
        (m.current_stock * m.cost_per_unit) as stock_value
      FROM medicines m
      WHERE m.user_id = $1
        AND m.is_active = true
        AND m.min_stock > 0 AND m.current_stock <= m.min_stock
      ORDER BY (m.current_stock / CASE WHEN m.min_stock = 0 THEN 1 ELSE m.min_stock END) ASC
    `, [req.user.id]);

    res.json({ medicines, count: medicines.length });
  } catch (err) {
    console.error('Low stock error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/medicines/expiring
router.get('/expiring', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const thresholdDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    const medicines = await queryRows(`
      SELECT
        m.*,
        (m.expiry_date::date - CURRENT_DATE)::int as days_until_expiry,
        (m.current_stock * m.cost_per_unit) as stock_value
      FROM medicines m
      WHERE m.user_id = $1
        AND m.is_active = true
        AND m.expiry_date IS NOT NULL
        AND m.expiry_date <= $2
      ORDER BY m.expiry_date ASC
    `, [req.user.id, thresholdDate]);

    res.json({ medicines, count: medicines.length, days_threshold: days });
  } catch (err) {
    console.error('Expiring medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/medicines/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString().split('T')[0];
    const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const medicineRows = await queryRows(`
      SELECT
        m.*,
        CASE WHEN m.min_stock > 0 AND m.current_stock <= m.min_stock THEN true ELSE false END as is_low_stock,
        CASE WHEN m.expiry_date <= $3 AND m.expiry_date >= $4 THEN true ELSE false END as is_expiring_soon,
        (m.current_stock * m.cost_per_unit) as stock_value
      FROM medicines m
      WHERE m.id = $1 AND m.user_id = $2 AND m.is_active = true
    `, [req.params.id, req.user.id, in30days, now]);

    if (medicineRows.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // Get recent movements
    const movements = await queryRows(`
      SELECT sm.*, s.patient_name, s.procedure_name
      FROM stock_movements sm
      LEFT JOIN surgeries s ON sm.surgery_id = s.id
      WHERE sm.medicine_id = $1
      ORDER BY sm.created_at DESC
      LIMIT 10
    `, [req.params.id]);

    res.json({ medicine: medicineRows[0], recent_movements: movements });
  } catch (err) {
    console.error('Get medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/medicines - add medicine
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      active_principle,
      concentration,
      bottle_volume,
      volume_ml,
      unit,
      current_stock = 0,
      min_stock = 0,
      cost_per_unit = 0,
      supplier,
      batch_number,
      expiry_date,
      units_per_box = 1,
      medicine_type = 'farmaco',
      presentation,
      presentation_type = 'frasco',
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!unit && !volume_ml) {
      return res.status(400).json({ error: 'Name and unit are required' });
    }

    if (parseFloat(current_stock) < 0) {
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }

    if (parseFloat(min_stock) < 0) {
      return res.status(400).json({ error: 'Minimum stock cannot be negative' });
    }

    const supabase = getSupabase();

    const effectiveBottleVolume = bottle_volume || (volume_ml ? String(volume_ml) : null);
    const effectiveUnit = unit || 'unidade';

    const { data: medicine, error: insertError } = await supabase
      .from('medicines')
      .insert({
        user_id: req.user.id,
        name,
        active_principle: active_principle || null,
        concentration: concentration || null,
        bottle_volume: effectiveBottleVolume,
        unit: effectiveUnit,
        current_stock: parseFloat(current_stock),
        min_stock: parseFloat(min_stock),
        cost_per_unit: parseFloat(cost_per_unit),
        supplier: supplier || null,
        batch_number: batch_number || null,
        expiry_date: expiry_date || null,
        units_per_box: parseInt(units_per_box) || 1,
        volume_per_unit_ml: volume_ml ? parseFloat(volume_ml) : null,
        medicine_type: medicine_type || 'farmaco',
        presentation: presentation || null,
        presentation_type: presentation_type || 'frasco',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Register initial stock as purchase if > 0
    if (parseFloat(current_stock) > 0) {
      await supabase.from('stock_movements').insert({
        medicine_id: medicine.id,
        user_id: req.user.id,
        type: 'purchase',
        quantity: parseFloat(current_stock),
        unit_cost: parseFloat(cost_per_unit),
        total_cost: parseFloat(current_stock) * parseFloat(cost_per_unit),
        notes: 'Estoque inicial',
      });
    }

    res.status(201).json({
      message: 'Medicine added successfully',
      medicine,
    });
  } catch (err) {
    console.error('Add medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/medicines/:id - update medicine
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const {
      name = existing.name,
      active_principle = existing.active_principle,
      concentration = existing.concentration,
      bottle_volume = existing.bottle_volume,
      unit = existing.unit,
      min_stock = existing.min_stock,
      cost_per_unit = existing.cost_per_unit,
      supplier = existing.supplier,
      batch_number = existing.batch_number,
      expiry_date = existing.expiry_date,
      presentation = existing.presentation,
      presentation_type = existing.presentation_type,
    } = req.body;

    if (!name || !unit) {
      return res.status(400).json({ error: 'Name and unit are required' });
    }

    await supabase
      .from('medicines')
      .update({
        name,
        active_principle: active_principle || null,
        concentration: concentration || null,
        bottle_volume: bottle_volume || null,
        unit,
        min_stock: parseFloat(min_stock),
        cost_per_unit: parseFloat(cost_per_unit),
        supplier: supplier || null,
        batch_number: batch_number || null,
        expiry_date: expiry_date || null,
        presentation: presentation || null,
        presentation_type: presentation_type || 'frasco',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', req.user.id);

    const { data: medicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', id)
      .single();

    res.json({
      message: 'Medicine updated successfully',
      medicine,
    });
  } catch (err) {
    console.error('Update medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/medicines/:id - soft delete
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    await supabase
      .from('medicines')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    console.error('Delete medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
