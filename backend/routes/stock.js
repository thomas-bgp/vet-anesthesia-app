const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/stock/purchases - list all purchases
router.get('/purchases', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, page = 1, limit = 50 } = req.query;

    let whereClause = "WHERE sm.user_id = $1 AND sm.type = 'purchase'";
    const params = [req.user.id];
    let paramIdx = 2;

    if (start_date) {
      whereClause += ` AND sm.created_at::date >= $${paramIdx}::date`;
      params.push(start_date);
      paramIdx++;
    }
    if (end_date) {
      whereClause += ` AND sm.created_at::date <= $${paramIdx}::date`;
      params.push(end_date);
      paramIdx++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const purchases = await queryRows(`
      SELECT
        sm.*,
        m.name as medicine_name,
        m.active_principle,
        m.unit as medicine_unit
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, parseInt(limit), offset]);

    const countRows = await queryRows(
      `SELECT COUNT(*)::int as total FROM stock_movements sm ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    res.json({
      purchases,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List purchases error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stock/movements - list all movements
router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const { type, start_date, end_date, page = 1, limit = 50 } = req.query;

    let whereClause = 'WHERE sm.user_id = $1';
    const params = [req.user.id];
    let paramIdx = 2;

    if (type && ['purchase', 'usage', 'adjustment', 'expired'].includes(type)) {
      whereClause += ` AND sm.type = $${paramIdx}`;
      params.push(type);
      paramIdx++;
    }
    if (start_date) {
      whereClause += ` AND sm.created_at::date >= $${paramIdx}::date`;
      params.push(start_date);
      paramIdx++;
    }
    if (end_date) {
      whereClause += ` AND sm.created_at::date <= $${paramIdx}::date`;
      params.push(end_date);
      paramIdx++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const movements = await queryRows(`
      SELECT
        sm.*,
        m.name as medicine_name,
        m.active_principle,
        m.unit as medicine_unit,
        s.patient_name,
        s.procedure_name
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      LEFT JOIN surgeries s ON sm.surgery_id = s.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, parseInt(limit), offset]);

    const countRows = await queryRows(
      `SELECT COUNT(*)::int as total FROM stock_movements sm ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    res.json({
      movements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List movements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stock/purchase - register a purchase (increments stock)
// Also accept POST /api/stock/purchases for frontend compatibility
router.post('/purchase', authenticateToken, handlePurchase);
router.post('/purchases', authenticateToken, handlePurchase);

async function handlePurchase(req, res) {
  try {
    const {
      medicine_id,
      quantity,
      unit_cost,
      batch_number,
      expiry_date,
      supplier,
      notes,
    } = req.body;

    if (!medicine_id || !quantity) {
      return res.status(400).json({ error: 'medicine_id and quantity are required' });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const supabase = getSupabase();

    const { data: medicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', medicine_id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const unitCost = parseFloat(unit_cost) || medicine.cost_per_unit;
    const totalCost = qty * unitCost;

    // Insert movement
    const { data: movement, error: movError } = await supabase
      .from('stock_movements')
      .insert({
        medicine_id,
        user_id: req.user.id,
        type: 'purchase',
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        supplier: supplier || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (movError) throw movError;

    // Update medicine stock and related fields
    const updateData = {
      current_stock: medicine.current_stock + qty,
      updated_at: new Date().toISOString(),
    };
    if (unit_cost) updateData.cost_per_unit = unitCost;
    if (batch_number) updateData.batch_number = batch_number;
    if (expiry_date) updateData.expiry_date = expiry_date;
    if (supplier) updateData.supplier = supplier;

    await supabase
      .from('medicines')
      .update(updateData)
      .eq('id', medicine_id);

    const { data: updatedMedicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', medicine_id)
      .single();

    res.status(201).json({
      message: 'Purchase registered successfully',
      medicine: updatedMedicine,
      movement,
    });
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/stock/usage - register usage (decrements stock)
router.post('/usage', authenticateToken, async (req, res) => {
  try {
    const {
      medicine_id,
      quantity,
      surgery_id,
      notes,
    } = req.body;

    if (!medicine_id || !quantity) {
      return res.status(400).json({ error: 'medicine_id and quantity are required' });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const supabase = getSupabase();

    const { data: medicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', medicine_id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    if (medicine.current_stock < qty) {
      return res.status(400).json({
        error: 'Insufficient stock',
        available: medicine.current_stock,
        requested: qty,
      });
    }

    if (surgery_id) {
      const { data: surgery } = await supabase
        .from('surgeries')
        .select('id')
        .eq('id', surgery_id)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (!surgery) {
        return res.status(404).json({ error: 'Surgery not found' });
      }
    }

    const unitCost = medicine.cost_per_unit;
    const totalCost = qty * unitCost;

    // Insert movement
    const { data: movement, error: movError } = await supabase
      .from('stock_movements')
      .insert({
        medicine_id,
        user_id: req.user.id,
        type: 'usage',
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        surgery_id: surgery_id || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (movError) throw movError;

    // Update stock
    await supabase
      .from('medicines')
      .update({
        current_stock: medicine.current_stock - qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', medicine_id);

    const { data: updatedMedicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', medicine_id)
      .single();

    res.status(201).json({
      message: 'Usage registered successfully',
      medicine: updatedMedicine,
      movement,
    });
  } catch (err) {
    console.error('Usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stock/history/:medicineId - movement history for a medicine
router.get('/history/:medicineId', authenticateToken, async (req, res) => {
  try {
    const { medicineId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    const supabase = getSupabase();

    const { data: medicine } = await supabase
      .from('medicines')
      .select('id, name, unit')
      .eq('id', medicineId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    let whereClause = 'WHERE sm.medicine_id = $1 AND sm.user_id = $2';
    const params = [medicineId, req.user.id];
    let paramIdx = 3;

    if (type && ['purchase', 'usage', 'adjustment', 'expired'].includes(type)) {
      whereClause += ` AND sm.type = $${paramIdx}`;
      params.push(type);
      paramIdx++;
    }

    const countRows = await queryRows(
      `SELECT COUNT(*)::int as total FROM stock_movements sm ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const movements = await queryRows(`
      SELECT
        sm.*,
        s.patient_name,
        s.procedure_name,
        s.patient_species
      FROM stock_movements sm
      LEFT JOIN surgeries s ON sm.surgery_id = s.id
      ${whereClause}
      ORDER BY sm.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, parseInt(limit), offset]);

    const summaryRows = await queryRows(`
      SELECT
        SUM(CASE WHEN type = 'purchase' THEN quantity ELSE 0 END) as total_purchased,
        SUM(CASE WHEN type = 'usage' THEN quantity ELSE 0 END) as total_used,
        SUM(CASE WHEN type = 'purchase' THEN total_cost ELSE 0 END) as total_spent,
        COUNT(*)::int as total_movements
      FROM stock_movements
      WHERE medicine_id = $1 AND user_id = $2
    `, [medicineId, req.user.id]);

    res.json({
      medicine,
      movements,
      summary: summaryRows[0] || {},
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Stock history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stock/report - financial report with date range
router.get('/report', authenticateToken, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      type,
    } = req.query;

    let movQuery = `
      SELECT
        sm.*,
        m.name as medicine_name,
        m.unit as medicine_unit,
        m.active_principle,
        s.patient_name,
        s.procedure_name
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      LEFT JOIN surgeries s ON sm.surgery_id = s.id
      WHERE sm.user_id = $1
    `;
    const movParams = [req.user.id];
    let movIdx = 2;

    if (start_date) {
      movQuery += ` AND sm.created_at::date >= $${movIdx}::date`;
      movParams.push(start_date);
      movIdx++;
    }
    if (end_date) {
      movQuery += ` AND sm.created_at::date <= $${movIdx}::date`;
      movParams.push(end_date);
      movIdx++;
    }
    if (type && ['purchase', 'usage', 'adjustment', 'expired'].includes(type)) {
      movQuery += ` AND sm.type = $${movIdx}`;
      movParams.push(type);
      movIdx++;
    }
    movQuery += ' ORDER BY sm.created_at DESC';

    const movements = await queryRows(movQuery, movParams);

    // Financial summary
    let summaryQuery = `
      SELECT
        SUM(CASE WHEN sm.type = 'purchase' THEN sm.total_cost ELSE 0 END) as total_purchases,
        SUM(CASE WHEN sm.type = 'usage' THEN sm.total_cost ELSE 0 END) as total_usage_cost,
        SUM(CASE WHEN sm.type = 'purchase' THEN sm.quantity ELSE 0 END) as total_quantity_purchased,
        SUM(CASE WHEN sm.type = 'usage' THEN sm.quantity ELSE 0 END) as total_quantity_used,
        COUNT(DISTINCT sm.medicine_id)::int as unique_medicines,
        COUNT(*)::int as total_transactions
      FROM stock_movements sm
      WHERE sm.user_id = $1
    `;
    const summaryParams = [req.user.id];
    let sumIdx = 2;

    if (start_date) {
      summaryQuery += ` AND sm.created_at::date >= $${sumIdx}::date`;
      summaryParams.push(start_date);
      sumIdx++;
    }
    if (end_date) {
      summaryQuery += ` AND sm.created_at::date <= $${sumIdx}::date`;
      summaryParams.push(end_date);
      sumIdx++;
    }

    const summaryRows = await queryRows(summaryQuery, summaryParams);

    // By medicine breakdown
    let byMedQuery = `
      SELECT
        m.id,
        m.name,
        m.unit,
        SUM(CASE WHEN sm.type = 'purchase' THEN sm.quantity ELSE 0 END) as purchased,
        SUM(CASE WHEN sm.type = 'usage' THEN sm.quantity ELSE 0 END) as used,
        SUM(CASE WHEN sm.type = 'purchase' THEN sm.total_cost ELSE 0 END) as purchase_cost,
        SUM(CASE WHEN sm.type = 'usage' THEN sm.total_cost ELSE 0 END) as usage_cost
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.user_id = $1
    `;
    const byMedParams = [req.user.id];
    let bmIdx = 2;

    if (start_date) {
      byMedQuery += ` AND sm.created_at::date >= $${bmIdx}::date`;
      byMedParams.push(start_date);
      bmIdx++;
    }
    if (end_date) {
      byMedQuery += ` AND sm.created_at::date <= $${bmIdx}::date`;
      byMedParams.push(end_date);
      bmIdx++;
    }
    byMedQuery += ' GROUP BY m.id, m.name, m.unit ORDER BY usage_cost DESC';

    const byMedicine = await queryRows(byMedQuery, byMedParams);

    res.json({
      movements,
      summary: summaryRows[0] || {},
      by_medicine: byMedicine,
      filters: { start_date, end_date, type },
    });
  } catch (err) {
    console.error('Stock report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stock/adjustment - manual stock adjustment
router.post('/adjustment', authenticateToken, async (req, res) => {
  try {
    const { medicine_id, new_quantity, notes } = req.body;

    if (!medicine_id || new_quantity === undefined) {
      return res.status(400).json({ error: 'medicine_id and new_quantity are required' });
    }

    const newQty = parseFloat(new_quantity);
    if (isNaN(newQty) || newQty < 0) {
      return res.status(400).json({ error: 'new_quantity must be a non-negative number' });
    }

    const supabase = getSupabase();

    const { data: medicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', medicine_id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const diff = newQty - medicine.current_stock;

    // Insert adjustment movement
    await supabase.from('stock_movements').insert({
      medicine_id,
      user_id: req.user.id,
      type: 'adjustment',
      quantity: diff,
      unit_cost: medicine.cost_per_unit,
      total_cost: diff * medicine.cost_per_unit,
      notes: notes || `Ajuste manual: ${medicine.current_stock} -> ${newQty}`,
    });

    // Update medicine stock
    await supabase
      .from('medicines')
      .update({
        current_stock: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', medicine_id);

    const { data: updatedMedicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', medicine_id)
      .single();

    res.json({
      message: 'Stock adjusted successfully',
      medicine: updatedMedicine,
      previous_stock: medicine.current_stock,
      new_stock: newQty,
      difference: diff,
    });
  } catch (err) {
    console.error('Adjustment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
