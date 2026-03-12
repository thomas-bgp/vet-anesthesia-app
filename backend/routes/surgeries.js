const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/surgeries - list with filters
router.get('/', authenticateToken, (req, res) => {
  try {
    const {
      status,
      start_date,
      end_date,
      species,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const db = getDb();

    // Build WHERE conditions separately so we can reuse for COUNT and SELECT
    let whereClause = 'WHERE s.user_id = ?';
    const params = [req.user.id];

    if (status) {
      whereClause += ` AND s.status = ?`;
      params.push(status);
    }

    if (start_date) {
      whereClause += ` AND date(s.created_at) >= date(?)`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND date(s.created_at) <= date(?)`;
      params.push(end_date);
    }

    if (species) {
      whereClause += ` AND s.patient_species LIKE ?`;
      params.push(`%${species}%`);
    }

    if (search) {
      whereClause += ` AND (s.patient_name LIKE ? OR s.procedure_name LIKE ? OR s.owner_name LIKE ? OR s.clinic_name LIKE ?)`;
      const sp = `%${search}%`;
      params.push(sp, sp, sp, sp);
    }

    // Count query - simple, no subqueries
    const countResult = db
      .prepare(`SELECT COUNT(*) as total FROM surgeries s ${whereClause}`)
      .get(...params);

    // Main query with subqueries for enriched data
    const selectQuery = `
      SELECT
        s.*,
        (
          SELECT COUNT(*) FROM surgery_medicines sm WHERE sm.surgery_id = s.id
        ) as medicine_count,
        (
          SELECT COALESCE(SUM(m.cost_per_unit * sm.dose), 0)
          FROM surgery_medicines sm
          JOIN medicines m ON sm.medicine_id = m.id
          WHERE sm.surgery_id = s.id
        ) as medicines_cost
      FROM surgeries s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)];
    const surgeries = db.prepare(selectQuery).all(...dataParams);

    res.json({
      surgeries,
      pagination: {
        total: countResult?.total || surgeries.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((countResult?.total || surgeries.length) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List surgeries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/surgeries/:id/details - full surgery details with medicines
router.get('/:id/details', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const surgery = db
      .prepare(`
        SELECT s.* FROM surgeries s
        WHERE s.id = ? AND s.user_id = ?
      `)
      .get(req.params.id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    const medicines = db
      .prepare(`
        SELECT
          sm.*,
          m.name as medicine_name,
          m.active_principle,
          m.concentration,
          m.unit as medicine_unit,
          m.cost_per_unit,
          (m.cost_per_unit * sm.dose) as total_cost
        FROM surgery_medicines sm
        JOIN medicines m ON sm.medicine_id = m.id
        WHERE sm.surgery_id = ?
        ORDER BY sm.administered_at ASC
      `)
      .all(req.params.id);

    const totalMedicineCost = medicines.reduce((sum, m) => sum + (m.total_cost || 0), 0);

    res.json({
      surgery,
      medicines,
      summary: {
        medicine_count: medicines.length,
        total_medicine_cost: totalMedicineCost,
        revenue: surgery.revenue,
        margin: surgery.revenue - totalMedicineCost,
      },
    });
  } catch (err) {
    console.error('Surgery details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/surgeries - create surgery
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      patient_name,
      patient_species,
      patient_breed,
      patient_weight,
      patient_age,
      owner_name,
      owner_phone,
      procedure_name,
      asa_classification,
      start_time,
      anesthesia_protocol,
      clinic_name,
      surgeon_name,
      revenue = 0,
      status = 'scheduled',
    } = req.body;

    if (!patient_name || !patient_species || !procedure_name) {
      return res.status(400).json({
        error: 'patient_name, patient_species and procedure_name are required',
      });
    }

    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const db = getDb();

    const result = db
      .prepare(`
        INSERT INTO surgeries
          (user_id, patient_name, patient_species, patient_breed, patient_weight, patient_age,
           owner_name, owner_phone, procedure_name, asa_classification, start_time,
           anesthesia_protocol, clinic_name, surgeon_name, revenue, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        req.user.id,
        patient_name,
        patient_species,
        patient_breed || null,
        patient_weight ? parseFloat(patient_weight) : null,
        patient_age || null,
        owner_name || null,
        owner_phone || null,
        procedure_name,
        asa_classification || null,
        start_time || null,
        anesthesia_protocol || null,
        clinic_name || null,
        surgeon_name || null,
        parseFloat(revenue),
        status
      );

    const surgery = db
      .prepare('SELECT * FROM surgeries WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Surgery created successfully',
      surgery,
    });
  } catch (err) {
    console.error('Create surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/surgeries/:id - update surgery
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM surgeries WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot update a cancelled surgery' });
    }

    const {
      patient_name = existing.patient_name,
      patient_species = existing.patient_species,
      patient_breed = existing.patient_breed,
      patient_weight = existing.patient_weight,
      patient_age = existing.patient_age,
      owner_name = existing.owner_name,
      owner_phone = existing.owner_phone,
      procedure_name = existing.procedure_name,
      asa_classification = existing.asa_classification,
      anesthesia_protocol = existing.anesthesia_protocol,
      monitoring_notes = existing.monitoring_notes,
      complications = existing.complications,
      outcome = existing.outcome,
      clinic_name = existing.clinic_name,
      surgeon_name = existing.surgeon_name,
      revenue = existing.revenue,
      status = existing.status,
    } = req.body;

    db.prepare(`
      UPDATE surgeries SET
        patient_name = ?,
        patient_species = ?,
        patient_breed = ?,
        patient_weight = ?,
        patient_age = ?,
        owner_name = ?,
        owner_phone = ?,
        procedure_name = ?,
        asa_classification = ?,
        anesthesia_protocol = ?,
        monitoring_notes = ?,
        complications = ?,
        outcome = ?,
        clinic_name = ?,
        surgeon_name = ?,
        revenue = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      patient_name,
      patient_species,
      patient_breed || null,
      patient_weight ? parseFloat(patient_weight) : null,
      patient_age || null,
      owner_name || null,
      owner_phone || null,
      procedure_name,
      asa_classification || null,
      anesthesia_protocol || null,
      monitoring_notes || null,
      complications || null,
      outcome || 'success',
      clinic_name || null,
      surgeon_name || null,
      parseFloat(revenue),
      status,
      id,
      req.user.id
    );

    const surgery = db.prepare('SELECT * FROM surgeries WHERE id = ?').get(id);

    res.json({ message: 'Surgery updated successfully', surgery });
  } catch (err) {
    console.error('Update surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/surgeries/:id/start - start surgery
router.put('/:id/start', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const surgery = db
      .prepare('SELECT * FROM surgeries WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (surgery.status !== 'scheduled') {
      return res.status(400).json({
        error: `Cannot start surgery with status '${surgery.status}'. Surgery must be 'scheduled'.`,
      });
    }

    const startTime = req.body.start_time || new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      UPDATE surgeries SET
        status = 'in_progress',
        start_time = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(startTime, id);

    const updated = db.prepare('SELECT * FROM surgeries WHERE id = ?').get(id);

    res.json({ message: 'Surgery started', surgery: updated });
  } catch (err) {
    console.error('Start surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/surgeries/:id/end - end surgery
router.put('/:id/end', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const surgery = db
      .prepare('SELECT * FROM surgeries WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (surgery.status !== 'in_progress') {
      return res.status(400).json({
        error: `Cannot end surgery with status '${surgery.status}'. Surgery must be 'in_progress'.`,
      });
    }

    const endTime = req.body.end_time || new Date().toISOString().replace('T', ' ').substring(0, 19);
    const { outcome = 'success', monitoring_notes, complications } = req.body;

    // Calculate duration in minutes
    let durationMinutes = null;
    if (surgery.start_time) {
      const start = new Date(surgery.start_time);
      const end = new Date(endTime);
      durationMinutes = Math.round((end - start) / 60000);
    }

    db.prepare(`
      UPDATE surgeries SET
        status = 'completed',
        end_time = ?,
        duration_minutes = ?,
        outcome = ?,
        monitoring_notes = COALESCE(?, monitoring_notes),
        complications = COALESCE(?, complications),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(endTime, durationMinutes, outcome, monitoring_notes || null, complications || null, id);

    const updated = db.prepare('SELECT * FROM surgeries WHERE id = ?').get(id);

    res.json({
      message: 'Surgery completed',
      surgery: updated,
      duration_minutes: durationMinutes,
    });
  } catch (err) {
    console.error('End surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/surgeries/:id/medicines - add medicine to surgery
router.post('/:id/medicines', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const {
      medicine_id,
      dose,
      dose_unit,
      administered_at,
      route,
      notes,
      decrement_stock = true,
    } = req.body;

    if (!medicine_id || !dose || !dose_unit) {
      return res.status(400).json({ error: 'medicine_id, dose and dose_unit are required' });
    }

    const doseNum = parseFloat(dose);
    if (isNaN(doseNum) || doseNum <= 0) {
      return res.status(400).json({ error: 'dose must be a positive number' });
    }

    const db = getDb();

    // Verify surgery belongs to user
    const surgery = db
      .prepare('SELECT * FROM surgeries WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (surgery.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot add medicines to a cancelled surgery' });
    }

    if (surgery.status === 'completed') {
      return res.status(400).json({ error: 'Cannot add medicines to a completed surgery' });
    }

    // Verify medicine belongs to user
    const medicine = db
      .prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(medicine_id, req.user.id);

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const adminTime = administered_at || new Date().toISOString().replace('T', ' ').substring(0, 19);

    const addMedicine = db.transaction(() => {
      // Insert surgery medicine record
      const smResult = db
        .prepare(`
          INSERT INTO surgery_medicines (surgery_id, medicine_id, dose, dose_unit, administered_at, route, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(id, medicine_id, doseNum, dose_unit, adminTime, route || null, notes || null);

      // Decrement stock and register movement if requested
      if (decrement_stock) {
        if (medicine.current_stock < doseNum) {
          throw new Error(`INSUFFICIENT_STOCK:${medicine.current_stock}:${doseNum}`);
        }

        const unitCost = medicine.cost_per_unit;
        const totalCost = doseNum * unitCost;

        db.prepare(`
          INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, surgery_id, notes)
          VALUES (?, ?, 'usage', ?, ?, ?, ?, ?)
        `).run(
          medicine_id,
          req.user.id,
          doseNum,
          unitCost,
          totalCost,
          id,
          `Usado em cirurgia: ${surgery.procedure_name} - ${surgery.patient_name}`
        );

        db.prepare(`
          UPDATE medicines SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(doseNum, medicine_id);
      }

      const surgeryMed = db
        .prepare(`
          SELECT sm.*, m.name as medicine_name, m.active_principle, m.concentration
          FROM surgery_medicines sm
          JOIN medicines m ON sm.medicine_id = m.id
          WHERE sm.id = ?
        `)
        .get(smResult.lastInsertRowid);

      const updatedMedicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicine_id);

      return { surgery_medicine: surgeryMed, updated_medicine: updatedMedicine };
    });

    try {
      const result = addMedicine();
      res.status(201).json({
        message: 'Medicine added to surgery successfully',
        ...result,
      });
    } catch (txErr) {
      if (txErr.message.startsWith('INSUFFICIENT_STOCK')) {
        const [, available, requested] = txErr.message.split(':');
        return res.status(400).json({
          error: 'Insufficient stock',
          available: parseFloat(available),
          requested: parseFloat(requested),
        });
      }
      throw txErr;
    }
  } catch (err) {
    console.error('Add surgery medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/surgeries/:id - cancel surgery
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const surgery = db
      .prepare('SELECT * FROM surgeries WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (surgery.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed surgery' });
    }

    db.prepare(`
      UPDATE surgeries SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);

    res.json({ message: 'Surgery cancelled successfully' });
  } catch (err) {
    console.error('Cancel surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
