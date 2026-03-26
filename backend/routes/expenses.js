const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const VALID_CATEGORIES = ['equipamento', 'material', 'administrativo', 'seguro', 'transporte', 'geral'];

// GET /api/expenses - List expenses
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { category, start_date, end_date, month } = req.query;

    let sql = 'SELECT * FROM expenses WHERE user_id = ?';
    const params = [userId];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (month) {
      sql += " AND strftime('%Y-%m', date) = ?";
      params.push(month);
    }
    if (start_date) {
      sql += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const expenses = db.prepare(sql).all(...params);
    res.json({ expenses });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/expenses/summary - Totals by category
router.get('/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { start_date, end_date, month } = req.query;

    let sql = `
      SELECT
        category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE user_id = ?
    `;
    const params = [userId];

    if (month) {
      sql += " AND strftime('%Y-%m', date) = ?";
      params.push(month);
    }
    if (start_date) {
      sql += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date <= ?';
      params.push(end_date);
    }

    sql += ' GROUP BY category ORDER BY total DESC';

    const byCategory = db.prepare(sql).all(...params);

    const grandTotal = byCategory.reduce((sum, row) => sum + row.total, 0);

    res.json({ by_category: byCategory, total: grandTotal });
  } catch (err) {
    console.error('Expenses summary error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/expenses - Create expense
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { date, description, amount, category, notes } = req.body;

    if (!date || !description || amount === undefined) {
      return res.status(400).json({ error: 'date, description e amount são obrigatórios' });
    }

    const finalCategory = category && VALID_CATEGORIES.includes(category) ? category : 'geral';

    const result = db.prepare(`
      INSERT INTO expenses (user_id, date, description, amount, category, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, date, description, amount, finalCategory, notes || null);

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ expense });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const id = req.params.id;
    const { date, description, amount, category, notes } = req.body;

    const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }

    const finalCategory = category && VALID_CATEGORIES.includes(category) ? category : existing.category;

    db.prepare(`
      UPDATE expenses
      SET date = ?, description = ?, amount = ?, category = ?, notes = ?
      WHERE id = ? AND user_id = ?
    `).run(
      date || existing.date,
      description || existing.description,
      amount !== undefined ? amount : existing.amount,
      finalCategory,
      notes !== undefined ? notes : existing.notes,
      id, userId
    );

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json({ expense: updated });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const id = req.params.id;

    const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }

    db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ message: 'Despesa excluída com sucesso' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
