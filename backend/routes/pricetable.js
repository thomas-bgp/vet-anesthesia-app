const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/price-table - list procedures with prices
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const items = db
      .prepare(`
        SELECT * FROM price_table
        WHERE user_id = ? AND is_active = 1
        ORDER BY procedure_name ASC
      `)
      .all(req.user.id);

    const margin = db
      .prepare('SELECT profit_margin_percent FROM users WHERE id = ?')
      .get(req.user.id);

    res.json({
      items,
      profit_margin_percent: margin?.profit_margin_percent ?? 30,
    });
  } catch (err) {
    console.error('List price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/price-table - add procedure to price table
router.post('/', authenticateToken, (req, res) => {
  try {
    const { procedure_name, price_without_drugs, price_with_drugs, notes } = req.body;

    if (!procedure_name) {
      return res.status(400).json({ error: 'procedure_name is required' });
    }

    const db = getDb();

    const result = db
      .prepare(`
        INSERT INTO price_table (user_id, procedure_name, price_without_drugs, price_with_drugs, notes)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        req.user.id,
        procedure_name,
        parseFloat(price_without_drugs) || 0,
        parseFloat(price_with_drugs) || 0,
        notes || null
      );

    const item = db.prepare('SELECT * FROM price_table WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ message: 'Price table entry created', item });
  } catch (err) {
    console.error('Create price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/price-table/:id
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM price_table WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Price table entry not found' });
    }

    const {
      procedure_name = existing.procedure_name,
      price_without_drugs = existing.price_without_drugs,
      price_with_drugs = existing.price_with_drugs,
      notes = existing.notes,
    } = req.body;

    db.prepare(`
      UPDATE price_table SET
        procedure_name = ?,
        price_without_drugs = ?,
        price_with_drugs = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      procedure_name,
      parseFloat(price_without_drugs) || 0,
      parseFloat(price_with_drugs) || 0,
      notes || null,
      id,
      req.user.id
    );

    const item = db.prepare('SELECT * FROM price_table WHERE id = ?').get(id);

    res.json({ message: 'Price table entry updated', item });
  } catch (err) {
    console.error('Update price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/price-table/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const existing = db
      .prepare('SELECT * FROM price_table WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Price table entry not found' });
    }

    db.prepare('UPDATE price_table SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(req.params.id);

    res.json({ message: 'Price table entry deleted' });
  } catch (err) {
    console.error('Delete price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/price-table/margin - update profit margin
router.put('/margin', authenticateToken, (req, res) => {
  try {
    const { profit_margin_percent } = req.body;

    if (profit_margin_percent === undefined || profit_margin_percent < 0) {
      return res.status(400).json({ error: 'profit_margin_percent must be >= 0' });
    }

    const db = getDb();

    db.prepare('UPDATE users SET profit_margin_percent = ? WHERE id = ?')
      .run(parseFloat(profit_margin_percent), req.user.id);

    res.json({ message: 'Margin updated', profit_margin_percent: parseFloat(profit_margin_percent) });
  } catch (err) {
    console.error('Update margin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
