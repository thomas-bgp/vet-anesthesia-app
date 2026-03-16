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
      clinic,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const db = getDb();

    let whereClause = 'WHERE s.user_id = ?';
    const params = [req.user.id];

    if (status) {
      whereClause += ` AND s.status = ?`;
      params.push(status);
    }

    if (start_date) {
      whereClause += ` AND date(COALESCE(s.start_time, s.created_at)) >= date(?)`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND date(COALESCE(s.start_time, s.created_at)) <= date(?)`;
      params.push(end_date);
    }

    if (species) {
      whereClause += ` AND s.patient_species = ?`;
      params.push(species);
    }

    if (clinic) {
      whereClause += ` AND s.clinic_name LIKE ?`;
      params.push(`%${clinic}%`);
    }

    if (search) {
      whereClause += ` AND (s.patient_name LIKE ? OR s.procedure_name LIKE ? OR s.owner_name LIKE ? OR s.clinic_name LIKE ?)`;
      const sp = `%${search}%`;
      params.push(sp, sp, sp, sp);
    }

    const countResult = db
      .prepare(`SELECT COUNT(*) as total FROM surgeries s ${whereClause}`)
      .get(...params);

    const selectQuery = `
      SELECT
        s.*,
        (
          SELECT COUNT(*) FROM surgery_medicines sm WHERE sm.surgery_id = s.id
        ) as medicine_count,
        (
          SELECT COALESCE(SUM(sm2.unit_cost * sm2.quantity), 0)
          FROM stock_movements sm2
          WHERE sm2.surgery_id = s.id AND sm2.type = 'usage'
        ) as medicines_cost
      FROM surgeries s
      ${whereClause}
      ORDER BY COALESCE(s.start_time, s.created_at) DESC
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

// GET /api/surgeries/:id - single surgery (alias for details)
router.get('/:id', authenticateToken, (req, res, next) => {
  // Skip if it matches a named sub-route
  if (['details'].includes(req.params.id)) return next();

  try {
    const db = getDb();

    const surgery = db
      .prepare(`SELECT s.* FROM surgeries s WHERE s.id = ? AND s.user_id = ?`)
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

    const vitals = db
      .prepare(`
        SELECT * FROM monitoring_vitals
        WHERE surgery_id = ?
        ORDER BY recorded_at ASC
      `)
      .all(req.params.id);

    const totalMedicineCost = medicines.reduce((sum, m) => sum + (m.total_cost || 0), 0);

    res.json({
      surgery,
      medicines,
      vitals,
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

// GET /api/surgeries/:id/details - full surgery details with medicines
router.get('/:id/details', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const surgery = db
      .prepare(`SELECT s.* FROM surgeries s WHERE s.id = ? AND s.user_id = ?`)
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

    const vitals = db
      .prepare(`
        SELECT * FROM monitoring_vitals
        WHERE surgery_id = ?
        ORDER BY recorded_at ASC
      `)
      .all(req.params.id);

    const totalMedicineCost = medicines.reduce((sum, m) => sum + (m.total_cost || 0), 0);

    res.json({
      surgery,
      medicines,
      vitals,
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

// GET /api/surgeries/:id/medicines - list medicines for a surgery
router.get('/:id/medicines', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const surgery = db
      .prepare('SELECT id FROM surgeries WHERE id = ? AND user_id = ?')
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

    res.json({ medicines });
  } catch (err) {
    console.error('Surgery medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/surgeries/:id/vitals - add vital signs record
router.post('/:id/vitals', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const surgery = db
      .prepare('SELECT id FROM surgeries WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    const {
      recorded_at,
      fc, fr, spo2, etco2, pam, pas, pad, temperature, notes,
    } = req.body;

    const result = db
      .prepare(`
        INSERT INTO monitoring_vitals (surgery_id, recorded_at, fc, fr, spo2, etco2, pam, pas, pad, temperature, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        recorded_at || new Date().toISOString(),
        fc || null, fr || null, spo2 || null, etco2 || null,
        pam || null, pas || null, pad || null, temperature || null,
        notes || null
      );

    const vital = db.prepare('SELECT * FROM monitoring_vitals WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ message: 'Vital signs recorded', vital });
  } catch (err) {
    console.error('Add vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/surgeries/:id/vitals/:vitalId
router.delete('/:id/vitals/:vitalId', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const surgery = db
      .prepare('SELECT id FROM surgeries WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    db.prepare('DELETE FROM monitoring_vitals WHERE id = ? AND surgery_id = ?')
      .run(req.params.vitalId, req.params.id);

    res.json({ message: 'Vital signs record deleted' });
  } catch (err) {
    console.error('Delete vitals error:', err);
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
      patient_sex,
      owner_name,
      owner_phone,
      procedure_name,
      asa_classification,
      fasting_solid_hours,
      fasting_liquid_hours,
      start_time,
      pre_anesthesia,
      induction,
      maintenance,
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
           patient_sex, owner_name, owner_phone, procedure_name, asa_classification,
           fasting_solid_hours, fasting_liquid_hours, start_time,
           pre_anesthesia, induction, maintenance, anesthesia_protocol,
           clinic_name, surgeon_name, revenue, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        req.user.id,
        patient_name,
        patient_species,
        patient_breed || null,
        patient_weight ? parseFloat(patient_weight) : null,
        patient_age || null,
        patient_sex || null,
        owner_name || null,
        owner_phone || null,
        procedure_name,
        asa_classification || null,
        fasting_solid_hours ? parseFloat(fasting_solid_hours) : null,
        fasting_liquid_hours ? parseFloat(fasting_liquid_hours) : null,
        start_time || null,
        pre_anesthesia || null,
        induction || null,
        maintenance || null,
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
      patient_sex = existing.patient_sex,
      owner_name = existing.owner_name,
      owner_phone = existing.owner_phone,
      procedure_name = existing.procedure_name,
      asa_classification = existing.asa_classification,
      fasting_solid_hours = existing.fasting_solid_hours,
      fasting_liquid_hours = existing.fasting_liquid_hours,
      pre_anesthesia = existing.pre_anesthesia,
      induction = existing.induction,
      maintenance = existing.maintenance,
      anesthesia_protocol = existing.anesthesia_protocol,
      monitoring_notes = existing.monitoring_notes,
      complications = existing.complications,
      outcome = existing.outcome,
      clinic_name = existing.clinic_name,
      surgeon_name = existing.surgeon_name,
      revenue = existing.revenue,
      status = existing.status,
      start_time = existing.start_time,
    } = req.body;

    db.prepare(`
      UPDATE surgeries SET
        patient_name = ?,
        patient_species = ?,
        patient_breed = ?,
        patient_weight = ?,
        patient_age = ?,
        patient_sex = ?,
        owner_name = ?,
        owner_phone = ?,
        procedure_name = ?,
        asa_classification = ?,
        fasting_solid_hours = ?,
        fasting_liquid_hours = ?,
        start_time = ?,
        pre_anesthesia = ?,
        induction = ?,
        maintenance = ?,
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
      patient_sex || null,
      owner_name || null,
      owner_phone || null,
      procedure_name,
      asa_classification || null,
      fasting_solid_hours ? parseFloat(fasting_solid_hours) : null,
      fasting_liquid_hours ? parseFloat(fasting_liquid_hours) : null,
      start_time || null,
      pre_anesthesia || null,
      induction || null,
      maintenance || null,
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
      dose_mg_kg,
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

    const medicine = db
      .prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ? AND is_active = 1')
      .get(medicine_id, req.user.id);

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const adminTime = administered_at || new Date().toISOString().replace('T', ' ').substring(0, 19);

    const addMedicine = db.transaction(() => {
      const smResult = db
        .prepare(`
          INSERT INTO surgery_medicines (surgery_id, medicine_id, dose, dose_unit, dose_mg_kg, administered_at, route, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(id, medicine_id, doseNum, dose_unit, dose_mg_kg ? parseFloat(dose_mg_kg) : null, adminTime, route || null, notes || null);

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

// DELETE /api/surgeries/:id/medicines/:medId - remove medicine from surgery
router.delete('/:id/medicines/:medId', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { id, medId } = req.params;

    const surgery = db
      .prepare('SELECT * FROM surgeries WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    const sm = db
      .prepare('SELECT * FROM surgery_medicines WHERE id = ? AND surgery_id = ?')
      .get(medId, id);

    if (!sm) {
      return res.status(404).json({ error: 'Surgery medicine record not found' });
    }

    const removeMedicine = db.transaction(() => {
      // Restore stock if there was a usage movement for this
      const movement = db
        .prepare(`
          SELECT * FROM stock_movements
          WHERE surgery_id = ? AND medicine_id = ? AND type = 'usage'
          ORDER BY created_at DESC LIMIT 1
        `)
        .get(id, sm.medicine_id);

      if (movement) {
        db.prepare('UPDATE medicines SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(movement.quantity, sm.medicine_id);

        db.prepare('DELETE FROM stock_movements WHERE id = ?').run(movement.id);
      }

      db.prepare('DELETE FROM surgery_medicines WHERE id = ?').run(medId);
    });

    removeMedicine();

    res.json({ message: 'Medicine removed from surgery' });
  } catch (err) {
    console.error('Remove surgery medicine error:', err);
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
