const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/receivables - List receivables
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { status, start_date, end_date } = req.query;

    let sql = `
      SELECT r.*, s.patient_name, s.procedure_name
      FROM receivables r
      LEFT JOIN surgeries s ON r.surgery_id = s.id
      WHERE r.user_id = ?
    `;
    const params = [userId];

    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (start_date) {
      sql += ' AND r.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND r.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    sql += ' ORDER BY r.created_at DESC';

    const receivables = db.prepare(sql).all(...params);
    res.json({ receivables });
  } catch (err) {
    console.error('List receivables error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/receivables/summary - Summary totals
router.get('/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_total,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as overdue_total,
        COALESCE(SUM(CASE WHEN status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now') THEN paid_amount ELSE 0 END), 0) as paid_this_month,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END), 0) as paid_total
      FROM receivables
      WHERE user_id = ?
    `).get(userId);

    res.json(summary);
  } catch (err) {
    console.error('Receivables summary error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/receivables - Create receivable
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { surgery_id, clinic_name, description, amount, due_date, notes } = req.body;

    if (!description || !amount) {
      return res.status(400).json({ error: 'description e amount são obrigatórios' });
    }

    const result = db.prepare(`
      INSERT INTO receivables (user_id, surgery_id, clinic_name, description, amount, due_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, surgery_id || null, clinic_name || null, description, amount, due_date || null, notes || null);

    const receivable = db.prepare('SELECT * FROM receivables WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ receivable });
  } catch (err) {
    console.error('Create receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/receivables/:id - Update receivable
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const id = req.params.id;
    const { clinic_name, description, amount, due_date, notes, status } = req.body;

    const existing = db.prepare('SELECT * FROM receivables WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }

    db.prepare(`
      UPDATE receivables
      SET clinic_name = ?, description = ?, amount = ?, due_date = ?, notes = ?, status = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      clinic_name !== undefined ? clinic_name : existing.clinic_name,
      description || existing.description,
      amount !== undefined ? amount : existing.amount,
      due_date !== undefined ? due_date : existing.due_date,
      notes !== undefined ? notes : existing.notes,
      status || existing.status,
      id, userId
    );

    const updated = db.prepare('SELECT * FROM receivables WHERE id = ?').get(id);
    res.json({ receivable: updated });
  } catch (err) {
    console.error('Update receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/receivables/:id/pay - Mark as paid
router.put('/:id/pay', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const id = req.params.id;
    const { paid_amount, paid_at } = req.body;

    const existing = db.prepare('SELECT * FROM receivables WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }

    const finalAmount = paid_amount !== undefined ? paid_amount : existing.amount;
    const finalDate = paid_at || new Date().toISOString();

    db.prepare(`
      UPDATE receivables
      SET status = 'paid', paid_amount = ?, paid_at = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(finalAmount, finalDate, id, userId);

    const updated = db.prepare('SELECT * FROM receivables WHERE id = ?').get(id);
    res.json({ receivable: updated });
  } catch (err) {
    console.error('Pay receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/receivables/:id - Cancel receivable
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const id = req.params.id;

    const existing = db.prepare('SELECT * FROM receivables WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }

    db.prepare(`
      UPDATE receivables SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND user_id = ?
    `).run(id, userId);

    res.json({ message: 'Conta a receber cancelada com sucesso' });
  } catch (err) {
    console.error('Cancel receivable error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
