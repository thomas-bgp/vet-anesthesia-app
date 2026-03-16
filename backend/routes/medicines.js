const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/medicines - list all medicines with optional filters
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const {
      search,
      low_stock,
      expiring_soon,
      page = 1,
      limit = 50,
    } = req.query;

    // Build WHERE conditions separately for clean COUNT and SELECT queries
    let whereClause = 'WHERE m.user_id = ? AND m.is_active = 1';
    const params = [req.user.id];

    if (search) {
      whereClause += ` AND (m.name LIKE ? OR m.active_principle LIKE ? OR m.supplier LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    // Handle generic 'filter' param from frontend
    if (low_stock === 'true' || req.query.filter === 'low_stock') {
      whereClause += ` AND m.current_stock <= m.min_stock`;
    }

    if (expiring_soon === 'true' || req.query.filter === 'expiring') {
      whereClause += ` AND m.expiry_date <= date('now', '+30 days') AND m.expiry_date >= date('now')`;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const total = db.prepare(`SELECT COUNT(*) as total FROM medicines m ${whereClause}`).get(...params);

    const selectQuery = `
      SELECT
        m.*,
        CASE WHEN m.current_stock <= m.min_stock THEN 1 ELSE 0 END as is_low_stock,
        CASE WHEN m.expiry_date <= date('now', '+30 days') AND m.expiry_date >= date('now') THEN 1 ELSE 0 END as is_expiring_soon,
        CASE WHEN m.expiry_date < date('now') THEN 1 ELSE 0 END as is_expired,
        (m.current_stock * m.cost_per_unit) as stock_value
      FROM medicines m
      ${whereClause}
      ORDER BY m.name ASC
      LIMIT ? OFFSET ?
    `;

    const medicines = db.prepare(selectQuery).all(...params, parseInt(limit), offset);

    // Calculate total stock value
    const stockValueQuery = db
      .prepare(`
        SELECT
          SUM(current_stock * cost_per_unit) as total_value,
          COUNT(*) as total_count,
          SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) as low_stock_count,
          SUM(CASE WHEN expiry_date <= date('now', '+30 days') AND expiry_date >= date('now') THEN 1 ELSE 0 END) as expiring_count
        FROM medicines
        WHERE user_id = ? AND is_active = 1
      `)
      .get(req.user.id);

    res.json({
      medicines,
      pagination: {
        total: total?.total || medicines.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((total?.total || medicines.length) / parseInt(limit)),
      },
      summary: stockValueQuery,
    });
  } catch (err) {
    console.error('List medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/medicines/low-stock
router.get('/low-stock', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const medicines = db
      .prepare(`
        SELECT
          m.*,
          (m.min_stock - m.current_stock) as deficit,
          (m.current_stock * m.cost_per_unit) as stock_value
        FROM medicines m
        WHERE m.user_id = ?
          AND m.is_active = 1
          AND m.current_stock <= m.min_stock
        ORDER BY (m.current_stock / CASE WHEN m.min_stock = 0 THEN 1 ELSE m.min_stock END) ASC
      `)
      .all(req.user.id);

    res.json({ medicines, count: medicines.length });
  } catch (err) {
    console.error('Low stock error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/medicines/expiring
router.get('/expiring', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days) || 30;

    const medicines = db
      .prepare(`
        SELECT
          m.*,
          CAST(julianday(m.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry,
          (m.current_stock * m.cost_per_unit) as stock_value
        FROM medicines m
        WHERE m.user_id = ?
          AND m.is_active = 1
          AND m.expiry_date IS NOT NULL
          AND m.expiry_date <= date('now', '+' || ? || ' days')
        ORDER BY m.expiry_date ASC
      `)
      .all(req.user.id, days);

    res.json({ medicines, count: medicines.length, days_threshold: days });
  } catch (err) {
    console.error('Expiring medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/medicines/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const medicine = db
      .prepare(`
        SELECT
          m.*,
          CASE WHEN m.current_stock <= m.min_stock THEN 1 ELSE 0 END as is_low_stock,
          CASE WHEN m.expiry_date <= date('now', '+30 days') AND m.expiry_date >= date('now') THEN 1 ELSE 0 END as is_expiring_soon,
          (m.current_stock * m.cost_per_unit) as stock_value
        FROM medicines m
        WHERE m.id = ? AND m.user_id = ? AND m.is_active = 1
      `)
      .get(req.params.id, req.user.id);

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // Get recent movements
    const movements = db
      .prepare(`
        SELECT sm.*, s.patient_name, s.procedure_name
        FROM stock_movements sm
        LEFT JOIN surgeries s ON sm.surgery_id = s.id
        WHERE sm.medicine_id = ?
        ORDER BY sm.created_at DESC
        LIMIT 10
      `)
      .all(req.params.id);

    res.json({ medicine, recent_movements: movements });
  } catch (err) {
    console.error('Get medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/medicines - add medicine
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      name,
      active_principle,
      concentration,
      bottle_volume,
      unit,
      current_stock = 0,
      min_stock = 0,
      cost_per_unit = 0,
      supplier,
      batch_number,
      expiry_date,
    } = req.body;

    if (!name || !unit) {
      return res.status(400).json({ error: 'Name and unit are required' });
    }

    if (parseFloat(current_stock) < 0) {
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }

    if (parseFloat(min_stock) < 0) {
      return res.status(400).json({ error: 'Minimum stock cannot be negative' });
    }

    const db = getDb();

    const result = db
      .prepare(`
        INSERT INTO medicines
          (user_id, name, active_principle, concentration, bottle_volume, unit, current_stock, min_stock,
           cost_per_unit, supplier, batch_number, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        req.user.id,
        name,
        active_principle || null,
        concentration || null,
        bottle_volume || null,
        unit,
        parseFloat(current_stock),
        parseFloat(min_stock),
        parseFloat(cost_per_unit),
        supplier || null,
        batch_number || null,
        expiry_date || null
      );

    // Register initial stock as purchase if > 0
    if (parseFloat(current_stock) > 0) {
      db.prepare(`
        INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, notes)
        VALUES (?, ?, 'purchase', ?, ?, ?, 'Estoque inicial')
      `).run(
        result.lastInsertRowid,
        req.user.id,
        parseFloat(current_stock),
        parseFloat(cost_per_unit),
        parseFloat(current_stock) * parseFloat(cost_per_unit)
      );
    }

    const medicine = db
      .prepare('SELECT * FROM medicines WHERE id = ?')
      .get(result.lastInsertRowid);

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
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(id, req.user.id);

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
    } = req.body;

    if (!name || !unit) {
      return res.status(400).json({ error: 'Name and unit are required' });
    }

    db.prepare(`
      UPDATE medicines SET
        name = ?,
        active_principle = ?,
        concentration = ?,
        bottle_volume = ?,
        unit = ?,
        min_stock = ?,
        cost_per_unit = ?,
        supplier = ?,
        batch_number = ?,
        expiry_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      name,
      active_principle || null,
      concentration || null,
      bottle_volume || null,
      unit,
      parseFloat(min_stock),
      parseFloat(cost_per_unit),
      supplier || null,
      batch_number || null,
      expiry_date || null,
      id,
      req.user.id
    );

    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);

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
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    db.prepare('UPDATE medicines SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    console.error('Delete medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
