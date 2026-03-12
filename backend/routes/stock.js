const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// POST /api/stock/purchase - register a purchase (increments stock)
router.post('/purchase', authenticateToken, (req, res) => {
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

    const db = getDb();

    // Verify medicine belongs to user
    const medicine = db
      .prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(medicine_id, req.user.id);

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const unitCost = parseFloat(unit_cost) || medicine.cost_per_unit;
    const totalCost = qty * unitCost;

    const purchase = db.transaction(() => {
      // Insert movement
      const movResult = db
        .prepare(`
          INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, notes)
          VALUES (?, ?, 'purchase', ?, ?, ?, ?)
        `)
        .run(medicine_id, req.user.id, qty, unitCost, totalCost, notes || null);

      // Update stock and optionally cost_per_unit, batch, expiry
      let updateQuery = `
        UPDATE medicines SET
          current_stock = current_stock + ?,
          updated_at = CURRENT_TIMESTAMP
      `;
      const updateParams = [qty];

      if (unit_cost) {
        updateQuery += ', cost_per_unit = ?';
        updateParams.push(unitCost);
      }
      if (batch_number) {
        updateQuery += ', batch_number = ?';
        updateParams.push(batch_number);
      }
      if (expiry_date) {
        updateQuery += ', expiry_date = ?';
        updateParams.push(expiry_date);
      }
      if (supplier) {
        updateQuery += ', supplier = ?';
        updateParams.push(supplier);
      }

      updateQuery += ' WHERE id = ?';
      updateParams.push(medicine_id);

      db.prepare(updateQuery).run(...updateParams);

      const updatedMedicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicine_id);
      const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(movResult.lastInsertRowid);

      return { medicine: updatedMedicine, movement };
    });

    const result = purchase();

    res.status(201).json({
      message: 'Purchase registered successfully',
      ...result,
    });
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stock/usage - register usage (decrements stock)
router.post('/usage', authenticateToken, (req, res) => {
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

    const db = getDb();

    // Verify medicine belongs to user
    const medicine = db
      .prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(medicine_id, req.user.id);

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

    // Verify surgery belongs to user if provided
    if (surgery_id) {
      const surgery = db
        .prepare('SELECT id FROM surgeries WHERE id = ? AND user_id = ?')
        .get(surgery_id, req.user.id);

      if (!surgery) {
        return res.status(404).json({ error: 'Surgery not found' });
      }
    }

    const unitCost = medicine.cost_per_unit;
    const totalCost = qty * unitCost;

    const usage = db.transaction(() => {
      const movResult = db
        .prepare(`
          INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, surgery_id, notes)
          VALUES (?, ?, 'usage', ?, ?, ?, ?, ?)
        `)
        .run(medicine_id, req.user.id, qty, unitCost, totalCost, surgery_id || null, notes || null);

      db.prepare(`
        UPDATE medicines SET
          current_stock = current_stock - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(qty, medicine_id);

      const updatedMedicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicine_id);
      const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(movResult.lastInsertRowid);

      return { medicine: updatedMedicine, movement };
    });

    const result = usage();

    res.status(201).json({
      message: 'Usage registered successfully',
      ...result,
    });
  } catch (err) {
    console.error('Usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stock/history/:medicineId - movement history for a medicine
router.get('/history/:medicineId', authenticateToken, (req, res) => {
  try {
    const { medicineId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    const db = getDb();

    // Verify medicine belongs to user
    const medicine = db
      .prepare('SELECT id, name, unit FROM medicines WHERE id = ? AND user_id = ?')
      .get(medicineId, req.user.id);

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    let whereClause = 'WHERE sm.medicine_id = ? AND sm.user_id = ?';
    const params = [medicineId, req.user.id];

    if (type && ['purchase', 'usage', 'adjustment', 'expired'].includes(type)) {
      whereClause += ' AND sm.type = ?';
      params.push(type);
    }

    const countResult = db
      .prepare(`SELECT COUNT(*) as total FROM stock_movements sm ${whereClause}`)
      .get(...params);

    const movements = db.prepare(`
      SELECT
        sm.*,
        s.patient_name,
        s.procedure_name,
        s.patient_species
      FROM stock_movements sm
      LEFT JOIN surgeries s ON sm.surgery_id = s.id
      ${whereClause}
      ORDER BY sm.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    // Summary stats
    const summary = db
      .prepare(`
        SELECT
          SUM(CASE WHEN type = 'purchase' THEN quantity ELSE 0 END) as total_purchased,
          SUM(CASE WHEN type = 'usage' THEN quantity ELSE 0 END) as total_used,
          SUM(CASE WHEN type = 'purchase' THEN total_cost ELSE 0 END) as total_spent,
          COUNT(*) as total_movements
        FROM stock_movements
        WHERE medicine_id = ? AND user_id = ?
      `)
      .get(medicineId, req.user.id);

    res.json({
      medicine,
      movements,
      summary,
      pagination: {
        total: countResult?.total || movements.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((countResult?.total || movements.length) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Stock history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stock/report - financial report with date range
router.get('/report', authenticateToken, (req, res) => {
  try {
    const {
      start_date,
      end_date,
      type,
    } = req.query;

    const db = getDb();

    let query = `
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
      WHERE sm.user_id = ?
    `;

    const params = [req.user.id];

    if (start_date) {
      query += ` AND date(sm.created_at) >= date(?)`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND date(sm.created_at) <= date(?)`;
      params.push(end_date);
    }

    if (type && ['purchase', 'usage', 'adjustment', 'expired'].includes(type)) {
      query += ` AND sm.type = ?`;
      params.push(type);
    }

    query += ` ORDER BY sm.created_at DESC`;

    const movements = db.prepare(query).all(...params);

    // Financial summary
    const summaryParams = [req.user.id];
    let summaryWhere = 'WHERE sm.user_id = ?';

    if (start_date) {
      summaryWhere += ` AND date(sm.created_at) >= date(?)`;
      summaryParams.push(start_date);
    }
    if (end_date) {
      summaryWhere += ` AND date(sm.created_at) <= date(?)`;
      summaryParams.push(end_date);
    }

    const summary = db
      .prepare(`
        SELECT
          SUM(CASE WHEN sm.type = 'purchase' THEN sm.total_cost ELSE 0 END) as total_purchases,
          SUM(CASE WHEN sm.type = 'usage' THEN sm.total_cost ELSE 0 END) as total_usage_cost,
          SUM(CASE WHEN sm.type = 'purchase' THEN sm.quantity ELSE 0 END) as total_quantity_purchased,
          SUM(CASE WHEN sm.type = 'usage' THEN sm.quantity ELSE 0 END) as total_quantity_used,
          COUNT(DISTINCT sm.medicine_id) as unique_medicines,
          COUNT(*) as total_transactions
        FROM stock_movements sm
        ${summaryWhere}
      `)
      .get(...summaryParams);

    // By medicine breakdown
    const byMedicine = db
      .prepare(`
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
        ${summaryWhere}
        GROUP BY m.id, m.name, m.unit
        ORDER BY usage_cost DESC
      `)
      .all(...summaryParams);

    res.json({
      movements,
      summary,
      by_medicine: byMedicine,
      filters: { start_date, end_date, type },
    });
  } catch (err) {
    console.error('Stock report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stock/adjustment - manual stock adjustment
router.post('/adjustment', authenticateToken, (req, res) => {
  try {
    const { medicine_id, new_quantity, notes } = req.body;

    if (!medicine_id || new_quantity === undefined) {
      return res.status(400).json({ error: 'medicine_id and new_quantity are required' });
    }

    const newQty = parseFloat(new_quantity);
    if (isNaN(newQty) || newQty < 0) {
      return res.status(400).json({ error: 'new_quantity must be a non-negative number' });
    }

    const db = getDb();

    const medicine = db
      .prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(medicine_id, req.user.id);

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const diff = newQty - medicine.current_stock;

    const adjustment = db.transaction(() => {
      db.prepare(`
        INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, notes)
        VALUES (?, ?, 'adjustment', ?, ?, ?, ?)
      `).run(
        medicine_id,
        req.user.id,
        diff,
        medicine.cost_per_unit,
        diff * medicine.cost_per_unit,
        notes || `Ajuste manual: ${medicine.current_stock} -> ${newQty}`
      );

      db.prepare(`
        UPDATE medicines SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(newQty, medicine_id);

      return db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicine_id);
    });

    const updatedMedicine = adjustment();

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
