const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/bottles - List bottles for user
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { status, medicine_id, medicine_type } = req.query;

    // Auto-mark expired bottles
    db.prepare(`
      UPDATE medicine_bottles
      SET status = 'expired'
      WHERE user_id = ? AND status = 'opened' AND expires_at < datetime('now')
    `).run(userId);

    let sql = `
      SELECT mb.*, m.name as medicine_name, m.active_principle, m.concentration,
             COALESCE(m.medicine_type, 'farmaco') as medicine_type
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.user_id = ?
    `;
    const params = [userId];

    if (status && status !== 'all') {
      sql += ' AND mb.status = ?';
      params.push(status);
    }

    if (medicine_id) {
      sql += ' AND mb.medicine_id = ?';
      params.push(medicine_id);
    }

    if (medicine_type && medicine_type !== 'todos') {
      sql += " AND COALESCE(m.medicine_type, 'farmaco') = ?";
      params.push(medicine_type);
    }

    sql += `
      ORDER BY
        CASE mb.status WHEN 'opened' THEN 0 WHEN 'sealed' THEN 1 ELSE 2 END,
        CASE WHEN mb.status = 'opened' THEN mb.expires_at END ASC,
        mb.created_at DESC
    `;

    const bottles = db.prepare(sql).all(...params);
    res.json({ bottles });
  } catch (err) {
    console.error('List bottles error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/bottles/expiring-soon - Bottles expiring within 2 days
router.get('/expiring-soon', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    const bottles = db.prepare(`
      SELECT mb.*, m.name as medicine_name, m.active_principle
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.user_id = ?
        AND mb.status = 'opened'
        AND mb.expires_at <= datetime('now', '+2 days')
        AND mb.expires_at >= datetime('now')
      ORDER BY mb.expires_at ASC
    `).all(userId);

    res.json({ bottles });
  } catch (err) {
    console.error('Expiring soon error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/bottles/stats - Bottle statistics
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_bottles,
        SUM(CASE WHEN status = 'sealed' THEN 1 ELSE 0 END) as sealed_count,
        SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened_count,
        SUM(CASE WHEN status IN ('sealed', 'opened') THEN purchase_cost ELSE 0 END) as total_stock_value,
        SUM(CASE WHEN status = 'opened' AND expires_at <= datetime('now', '+2 days') AND expires_at >= datetime('now') THEN 1 ELSE 0 END) as expiring_soon_count
      FROM medicine_bottles
      WHERE user_id = ?
    `).get(userId);

    res.json(stats);
  } catch (err) {
    console.error('Bottle stats error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/bottles - Create bottle(s) from a purchase
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
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

    const totalUnits = quantity * units_per_box;
    const costPerMl = purchase_cost_per_unit > 0 ? purchase_cost_per_unit / volume_ml : 0;

    const insertBottle = db.prepare(`
      INSERT INTO medicine_bottles (medicine_id, user_id, volume_ml, remaining_ml, purchase_cost, cost_per_ml, status, purchased_at, batch_number)
      VALUES (?, ?, ?, ?, ?, ?, 'sealed', ?, ?)
    `);

    const insertMany = db.transaction(() => {
      const created = [];
      for (let i = 0; i < totalUnits; i++) {
        const result = insertBottle.run(
          medicine_id, userId, volume_ml, volume_ml,
          purchase_cost_per_unit, costPerMl,
          purchased_at || new Date().toISOString().split('T')[0],
          batch_number || null
        );
        created.push(result.lastInsertRowid);
      }

      // Create stock_movement record
      db.prepare(`
        INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, notes, created_at)
        VALUES (?, ?, 'purchase', ?, ?, ?, ?, datetime('now'))
      `).run(
        medicine_id, userId, totalUnits,
        purchase_cost_per_unit,
        purchase_cost_per_unit * totalUnits,
        `Compra de ${totalUnits} frasco(s)`
      );

      return created;
    });

    const createdIds = insertMany();
    const bottles = db.prepare(`
      SELECT mb.*, m.name as medicine_name
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.id IN (${createdIds.map(() => '?').join(',')})
    `).all(...createdIds);

    res.status(201).json({ bottles, count: bottles.length });
  } catch (err) {
    console.error('Create bottles error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/bottles/:id/open - Mark bottle as opened
router.put('/:id/open', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const bottleId = req.params.id;

    const bottle = db.prepare('SELECT * FROM medicine_bottles WHERE id = ? AND user_id = ?').get(bottleId, userId);
    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }
    if (bottle.status !== 'sealed') {
      return res.status(400).json({ error: 'Apenas frascos lacrados podem ser abertos' });
    }

    db.prepare(`
      UPDATE medicine_bottles
      SET status = 'opened', opened_at = datetime('now'), expires_at = datetime('now', '+14 days')
      WHERE id = ? AND user_id = ?
    `).run(bottleId, userId);

    const updated = db.prepare(`
      SELECT mb.*, m.name as medicine_name
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.id = ?
    `).get(bottleId);

    res.json({ bottle: updated });
  } catch (err) {
    console.error('Open bottle error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/bottles/:id/use - Record usage
router.post('/:id/use', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const bottleId = req.params.id;
    const { ml_used, surgery_id, notes } = req.body;

    if (!ml_used || ml_used <= 0) {
      return res.status(400).json({ error: 'ml_used deve ser maior que zero' });
    }

    const bottle = db.prepare('SELECT * FROM medicine_bottles WHERE id = ? AND user_id = ?').get(bottleId, userId);
    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }
    if (bottle.status !== 'opened') {
      return res.status(400).json({ error: 'Frasco precisa estar aberto para uso' });
    }

    const cost = ml_used * (bottle.cost_per_ml || 0);
    const newRemaining = Math.max(0, bottle.remaining_ml - ml_used);
    const newStatus = newRemaining <= 0 ? 'empty' : 'opened';

    const doUse = db.transaction(() => {
      db.prepare(`
        UPDATE medicine_bottles
        SET remaining_ml = ?, status = ?
        WHERE id = ?
      `).run(newRemaining, newStatus, bottleId);

      db.prepare(`
        INSERT INTO bottle_usages (bottle_id, surgery_id, user_id, ml_used, cost, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(bottleId, surgery_id || null, userId, ml_used, cost, notes || null);
    });

    doUse();

    const updated = db.prepare(`
      SELECT mb.*, m.name as medicine_name
      FROM medicine_bottles mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.id = ?
    `).get(bottleId);

    res.json({ bottle: updated, cost });
  } catch (err) {
    console.error('Use bottle error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/bottles/:id/discard - Discard bottle
router.put('/:id/discard', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const bottleId = req.params.id;

    const bottle = db.prepare('SELECT * FROM medicine_bottles WHERE id = ? AND user_id = ?').get(bottleId, userId);
    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }

    db.prepare(`
      UPDATE medicine_bottles SET status = 'discarded' WHERE id = ? AND user_id = ?
    `).run(bottleId, userId);

    res.json({ message: 'Frasco descartado com sucesso' });
  } catch (err) {
    console.error('Discard bottle error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/bottles/:id/history - Usage history for a bottle
router.get('/:id/history', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const bottleId = req.params.id;

    const bottle = db.prepare('SELECT * FROM medicine_bottles WHERE id = ? AND user_id = ?').get(bottleId, userId);
    if (!bottle) {
      return res.status(404).json({ error: 'Frasco não encontrado' });
    }

    const usages = db.prepare(`
      SELECT bu.*, s.patient_name, s.procedure_name
      FROM bottle_usages bu
      LEFT JOIN surgeries s ON bu.surgery_id = s.id
      WHERE bu.bottle_id = ? AND bu.user_id = ?
      ORDER BY bu.used_at DESC
    `).all(bottleId, userId);

    res.json({ bottle, usages });
  } catch (err) {
    console.error('Bottle history error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
