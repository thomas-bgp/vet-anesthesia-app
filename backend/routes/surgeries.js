const express = require('express');
const router = express.Router();
const { getSupabase, queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/surgeries - list with filters
router.get('/', authenticateToken, async (req, res) => {
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

    let whereClause = 'WHERE s.user_id = $1';
    const params = [req.user.id];
    let paramIdx = 2;

    if (status) {
      whereClause += ` AND s.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (start_date) {
      whereClause += ` AND COALESCE(s.start_time, s.created_at)::date >= $${paramIdx}::date`;
      params.push(start_date);
      paramIdx++;
    }

    if (end_date) {
      whereClause += ` AND COALESCE(s.start_time, s.created_at)::date <= $${paramIdx}::date`;
      params.push(end_date);
      paramIdx++;
    }

    if (species) {
      whereClause += ` AND s.patient_species = $${paramIdx}`;
      params.push(species);
      paramIdx++;
    }

    if (clinic) {
      whereClause += ` AND s.clinic_name ILIKE $${paramIdx}`;
      params.push(`%${clinic}%`);
      paramIdx++;
    }

    if (search) {
      whereClause += ` AND (s.patient_name ILIKE $${paramIdx} OR s.procedure_name ILIKE $${paramIdx + 1} OR s.owner_name ILIKE $${paramIdx + 2} OR s.clinic_name ILIKE $${paramIdx + 3})`;
      const sp = `%${search}%`;
      params.push(sp, sp, sp, sp);
      paramIdx += 4;
    }

    const countRows = await queryRows(
      `SELECT COUNT(*)::int as total FROM surgeries s ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const selectQuery = `
      SELECT
        s.*,
        (
          SELECT COUNT(*)::int FROM surgery_medicines sm WHERE sm.surgery_id = s.id
        ) as medicine_count,
        (
          SELECT COALESCE(SUM(sm2.unit_cost * sm2.quantity), 0)
          FROM stock_movements sm2
          WHERE sm2.surgery_id = s.id AND sm2.type = 'usage'
        ) as medicines_cost
      FROM surgeries s
      ${whereClause}
      ORDER BY COALESCE(s.start_time, s.created_at) DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const surgeries = await queryRows(selectQuery, [...params, parseInt(limit), offset]);

    res.json({
      surgeries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List surgeries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/surgeries/unpaid - list unpaid surgeries grouped by clinic
router.get('/unpaid', authenticateToken, async (req, res) => {
  try {
    const surgeries = await queryRows(`
      SELECT id, patient_name, procedure_name, clinic_name, surgeon_name,
             revenue, start_time, created_at, status, paid, paid_at,
             (CURRENT_DATE - COALESCE(start_time, created_at)::date)::int as days_ago
      FROM surgeries
      WHERE user_id = $1 AND COALESCE(paid, false) = false AND status != 'cancelled' AND revenue > 0
      ORDER BY clinic_name ASC, start_time DESC
    `, [req.user.id]);

    const byClinic = {};
    let totalPending = 0;
    for (const s of surgeries) {
      const clinic = s.clinic_name || 'Sem clínica';
      if (!byClinic[clinic]) byClinic[clinic] = { clinic, surgeries: [], total: 0 };
      byClinic[clinic].surgeries.push(s);
      byClinic[clinic].total += parseFloat(s.revenue) || 0;
      totalPending += parseFloat(s.revenue) || 0;
    }

    res.json({
      clinics: Object.values(byClinic),
      totalPending,
      count: surgeries.length,
    });
  } catch (err) {
    console.error('Unpaid surgeries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/surgeries/:id - single surgery (alias for details)
router.get('/:id', authenticateToken, async (req, res, next) => {
  // Skip if it matches a named sub-route
  if (['details'].includes(req.params.id)) return next();

  try {
    const surgeryRows = await queryRows(
      `SELECT s.* FROM surgeries s WHERE s.id = $1 AND s.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (surgeryRows.length === 0) {
      return res.status(404).json({ error: 'Surgery not found' });
    }
    const surgery = surgeryRows[0];

    const medicines = await queryRows(`
      SELECT
        sm.*,
        COALESCE(m.name, sm.custom_name) as medicine_name,
        m.active_principle,
        m.concentration,
        m.unit as medicine_unit,
        m.cost_per_unit,
        m.presentation,
        m.volume_per_unit_ml,
        COALESCE(m.medicine_type, 'farmaco') as medicine_type,
        CASE
          WHEN sm.drug_source != 'proprio' THEN 0
          WHEN COALESCE(m.presentation, '') = 'ampola' THEN m.cost_per_unit
          WHEN COALESCE(m.presentation, '') = 'frasco' AND m.volume_per_unit_ml > 0 THEN (sm.dose / m.volume_per_unit_ml) * m.cost_per_unit
          ELSE (m.cost_per_unit * sm.dose)
        END as total_cost
      FROM surgery_medicines sm
      LEFT JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.surgery_id = $1
      ORDER BY sm.administered_at ASC
    `, [req.params.id]);

    const vitals = await queryRows(`
      SELECT * FROM monitoring_vitals
      WHERE surgery_id = $1
      ORDER BY recorded_at ASC
    `, [req.params.id]);

    const disposables = await queryRows(`
      SELECT sd.*, m.name as medicine_name, m.cost_per_unit
      FROM surgery_disposables sd
      JOIN medicines m ON sd.medicine_id = m.id
      WHERE sd.surgery_id = $1
      ORDER BY sd.created_at ASC
    `, [req.params.id]);

    const totalMedicineCost = medicines.reduce((sum, m) => sum + (parseFloat(m.total_cost) || 0), 0);
    const totalDisposableCost = disposables.reduce((sum, d) => sum + (parseFloat(d.total_cost) || 0), 0);

    res.json({
      surgery,
      medicines,
      vitals,
      disposables,
      summary: {
        medicine_count: medicines.length,
        total_medicine_cost: totalMedicineCost,
        disposable_count: disposables.length,
        total_disposable_cost: totalDisposableCost,
        total_cost: totalMedicineCost + totalDisposableCost,
        revenue: parseFloat(surgery.revenue) || 0,
        margin: (parseFloat(surgery.revenue) || 0) - totalMedicineCost - totalDisposableCost,
      },
    });
  } catch (err) {
    console.error('Surgery details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/surgeries/:id/details - full surgery details with medicines
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    const surgeryRows = await queryRows(
      `SELECT s.* FROM surgeries s WHERE s.id = $1 AND s.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (surgeryRows.length === 0) {
      return res.status(404).json({ error: 'Surgery not found' });
    }
    const surgery = surgeryRows[0];

    const medicines = await queryRows(`
      SELECT
        sm.*,
        COALESCE(m.name, sm.custom_name) as medicine_name,
        m.active_principle,
        m.concentration,
        m.unit as medicine_unit,
        m.cost_per_unit,
        m.presentation,
        m.volume_per_unit_ml,
        COALESCE(m.medicine_type, 'farmaco') as medicine_type,
        CASE
          WHEN sm.drug_source != 'proprio' THEN 0
          WHEN COALESCE(m.presentation, '') = 'ampola' THEN m.cost_per_unit
          WHEN COALESCE(m.presentation, '') = 'frasco' AND m.volume_per_unit_ml > 0 THEN (sm.dose / m.volume_per_unit_ml) * m.cost_per_unit
          ELSE (m.cost_per_unit * sm.dose)
        END as total_cost
      FROM surgery_medicines sm
      LEFT JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.surgery_id = $1
      ORDER BY sm.administered_at ASC
    `, [req.params.id]);

    const vitals = await queryRows(`
      SELECT * FROM monitoring_vitals
      WHERE surgery_id = $1
      ORDER BY recorded_at ASC
    `, [req.params.id]);

    const disposables = await queryRows(`
      SELECT sd.*, m.name as medicine_name, m.cost_per_unit
      FROM surgery_disposables sd
      JOIN medicines m ON sd.medicine_id = m.id
      WHERE sd.surgery_id = $1
      ORDER BY sd.created_at ASC
    `, [req.params.id]);

    const totalMedicineCost = medicines.reduce((sum, m) => sum + (parseFloat(m.total_cost) || 0), 0);
    const totalDisposableCost = disposables.reduce((sum, d) => sum + (parseFloat(d.total_cost) || 0), 0);

    res.json({
      surgery,
      medicines,
      vitals,
      disposables,
      summary: {
        medicine_count: medicines.length,
        total_medicine_cost: totalMedicineCost,
        disposable_count: disposables.length,
        total_disposable_cost: totalDisposableCost,
        total_cost: totalMedicineCost + totalDisposableCost,
        revenue: parseFloat(surgery.revenue) || 0,
        margin: (parseFloat(surgery.revenue) || 0) - totalMedicineCost - totalDisposableCost,
      },
    });
  } catch (err) {
    console.error('Surgery details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/surgeries/:id/medicines - list medicines for a surgery
router.get('/:id/medicines', authenticateToken, async (req, res) => {
  try {
    const surgeryCheck = await queryRows(
      'SELECT id FROM surgeries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (surgeryCheck.length === 0) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    const medicines = await queryRows(`
      SELECT
        sm.*,
        COALESCE(m.name, sm.custom_name) as medicine_name,
        m.active_principle,
        m.concentration,
        m.unit as medicine_unit,
        m.cost_per_unit,
        CASE WHEN sm.drug_source = 'proprio' THEN (m.cost_per_unit * sm.dose) ELSE 0 END as total_cost
      FROM surgery_medicines sm
      LEFT JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.surgery_id = $1
      ORDER BY sm.administered_at ASC
    `, [req.params.id]);

    res.json({ medicines });
  } catch (err) {
    console.error('Surgery medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/surgeries/:id/vitals - add vital signs record
router.post('/:id/vitals', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    const {
      recorded_at,
      fc, fr, spo2, etco2, pam, pas, pad, temperature, notes,
      fluid_ml_kg_h, anesthetic, o2_l_min,
      custom_params,
    } = req.body;

    const { data: vital, error } = await supabase
      .from('monitoring_vitals')
      .insert({
        surgery_id: id,
        recorded_at: recorded_at || new Date().toISOString(),
        fc: fc || null,
        fr: fr || null,
        spo2: spo2 || null,
        etco2: etco2 || null,
        pam: pam || null,
        pas: pas || null,
        pad: pad || null,
        temperature: temperature || null,
        notes: notes || null,
        fluid_ml_kg_h: fluid_ml_kg_h || null,
        anesthetic: anesthetic || null,
        o2_l_min: o2_l_min || null,
        custom_params: custom_params ? (typeof custom_params === 'string' ? custom_params : JSON.stringify(custom_params)) : null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Vital signs recorded', vital });
  } catch (err) {
    console.error('Add vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/surgeries/:id/vitals/:vitalId
router.delete('/:id/vitals/:vitalId', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    await supabase
      .from('monitoring_vitals')
      .delete()
      .eq('id', req.params.vitalId)
      .eq('surgery_id', req.params.id);

    res.json({ message: 'Vital signs record deleted' });
  } catch (err) {
    console.error('Delete vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/surgeries - create surgery
router.post('/', authenticateToken, async (req, res) => {
  try {
    const b = req.body;

    if (!b.patient_name || !b.patient_species || !b.procedure_name) {
      return res.status(400).json({
        error: 'patient_name, patient_species and procedure_name are required',
      });
    }

    const status = b.status || 'scheduled';
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const supabase = getSupabase();

    const fields = [
      'user_id', 'patient_name', 'patient_species', 'patient_breed', 'patient_weight', 'patient_age',
      'patient_sex', 'owner_name', 'owner_phone', 'procedure_name', 'asa_classification',
      'fasting_solid_hours', 'fasting_liquid_hours', 'start_time',
      'pre_anesthesia', 'induction', 'maintenance', 'anesthesia_protocol',
      'clinic_name', 'surgeon_name', 'revenue', 'status',
      'pathology', 'fasting_solid', 'fasting_liquid',
      'pre_existing_diseases', 'temperament', 'prior_medications', 'anamnesis_notes',
      'pre_acp', 'pre_fc', 'pre_fr', 'pre_mucosas', 'pre_tpc', 'pre_temperature',
      'pre_hydration', 'pre_pas', 'pre_pulse', 'pre_other_alterations',
      'general_state', 'nutritional_state',
      'exam_ht', 'exam_hb', 'exam_eritr', 'exam_ppt', 'exam_plaquetas', 'exam_leuc',
      'exam_creat', 'exam_alt', 'exam_fa', 'exam_ureia', 'exam_alb', 'exam_glic',
      'exam_raiox', 'exam_ultrassom', 'exam_eco_ecg', 'exam_outros',
      'airway_type', 'tube_number', 'breathing_mode', 'breathing_system', 'peep',
      'block_type', 'block_drug', 'block_dose_volume',
      'anesthesia_start', 'procedure_start', 'procedure_end', 'anesthesia_end',
      'extubation_time',
      'post_operative', 'recovery_quality',
      'airway_other', 'ventilation_type', 'custom_vitals_params',
    ];

    const numericFields = new Set([
      'patient_weight', 'fasting_solid_hours', 'fasting_liquid_hours', 'revenue',
      'fasting_solid', 'fasting_liquid', 'pre_fc', 'pre_fr', 'pre_temperature', 'pre_pas', 'peep',
    ]);

    const insertObj = {};
    for (const f of fields) {
      if (f === 'user_id') {
        insertObj[f] = req.user.id;
      } else if (f === 'status') {
        insertObj[f] = status;
      } else if (f === 'revenue') {
        insertObj[f] = parseFloat(b.revenue) || 0;
      } else {
        const v = b[f];
        if (v === undefined || v === null || v === '') {
          insertObj[f] = null;
        } else if (numericFields.has(f)) {
          insertObj[f] = parseFloat(v);
        } else {
          insertObj[f] = v;
        }
      }
    }

    const { data: surgery, error } = await supabase
      .from('surgeries')
      .insert(insertObj)
      .select()
      .single();

    if (error) throw error;

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
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot update a cancelled surgery' });
    }

    const b = req.body;

    const updatableFields = [
      'patient_name', 'patient_species', 'patient_breed', 'patient_weight', 'patient_age',
      'patient_sex', 'owner_name', 'owner_phone', 'procedure_name', 'asa_classification',
      'fasting_solid_hours', 'fasting_liquid_hours', 'start_time',
      'pre_anesthesia', 'induction', 'maintenance', 'anesthesia_protocol',
      'monitoring_notes', 'complications', 'outcome',
      'clinic_name', 'surgeon_name', 'revenue', 'status',
      'pathology', 'fasting_solid', 'fasting_liquid',
      'pre_existing_diseases', 'temperament', 'prior_medications', 'anamnesis_notes',
      'pre_acp', 'pre_fc', 'pre_fr', 'pre_mucosas', 'pre_tpc', 'pre_temperature',
      'pre_hydration', 'pre_pas', 'pre_pulse', 'pre_other_alterations',
      'general_state', 'nutritional_state',
      'exam_ht', 'exam_hb', 'exam_eritr', 'exam_ppt', 'exam_plaquetas', 'exam_leuc',
      'exam_creat', 'exam_alt', 'exam_fa', 'exam_ureia', 'exam_alb', 'exam_glic',
      'exam_raiox', 'exam_ultrassom', 'exam_eco_ecg', 'exam_outros',
      'airway_type', 'tube_number', 'breathing_mode', 'breathing_system', 'peep',
      'block_type', 'block_drug', 'block_dose_volume',
      'anesthesia_start', 'procedure_start', 'procedure_end', 'anesthesia_end',
      'extubation_time',
      'post_operative', 'recovery_quality',
      'airway_other', 'ventilation_type', 'custom_vitals_params',
    ];

    const numericFields = new Set([
      'patient_weight', 'fasting_solid_hours', 'fasting_liquid_hours', 'revenue',
      'fasting_solid', 'fasting_liquid', 'pre_fc', 'pre_fr', 'pre_temperature', 'pre_pas', 'peep',
    ]);

    const updateObj = {};
    for (const f of updatableFields) {
      const v = b[f] !== undefined ? b[f] : existing[f];
      if (v === undefined || v === null || v === '') {
        updateObj[f] = null;
      } else if (numericFields.has(f)) {
        updateObj[f] = parseFloat(v);
      } else {
        updateObj[f] = v;
      }
    }
    updateObj.updated_at = new Date().toISOString();

    await supabase
      .from('surgeries')
      .update(updateObj)
      .eq('id', id)
      .eq('user_id', req.user.id);

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ message: 'Surgery updated successfully', surgery });
  } catch (err) {
    console.error('Update surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/surgeries/:id/start - start surgery
router.put('/:id/start', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (surgery.status !== 'scheduled') {
      return res.status(400).json({
        error: `Cannot start surgery with status '${surgery.status}'. Surgery must be 'scheduled'.`,
      });
    }

    const startTime = req.body.start_time || new Date().toISOString().replace('T', ' ').substring(0, 19);

    await supabase
      .from('surgeries')
      .update({
        status: 'in_progress',
        start_time: startTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    const { data: updated } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ message: 'Surgery started', surgery: updated });
  } catch (err) {
    console.error('Start surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/surgeries/:id/end - end surgery
router.put('/:id/end', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

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

    const updateData = {
      status: 'completed',
      end_time: endTime,
      duration_minutes: durationMinutes,
      outcome,
      updated_at: new Date().toISOString(),
    };
    if (monitoring_notes) updateData.monitoring_notes = monitoring_notes;
    if (complications) updateData.complications = complications;

    await supabase
      .from('surgeries')
      .update(updateData)
      .eq('id', id);

    const { data: updated } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .single();

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
router.post('/:id/medicines', authenticateToken, async (req, res) => {
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
      custom_name,
      drug_source = 'proprio',
      phase = 'mpa',
      decrement_stock = true,
    } = req.body;

    const isAE = dose_unit === 'AE';
    const isCustomDrug = !medicine_id && custom_name;

    if (!medicine_id && !custom_name) {
      return res.status(400).json({ error: 'medicine_id or custom_name is required' });
    }
    if (!isAE && (!dose || !dose_unit)) {
      return res.status(400).json({ error: 'dose and dose_unit are required (unless AE)' });
    }

    const doseNum = isAE ? 0 : parseFloat(dose);
    if (!isAE && (isNaN(doseNum) || doseNum <= 0)) {
      return res.status(400).json({ error: 'dose must be a positive number' });
    }

    const supabase = getSupabase();

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (surgery.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot add medicines to a cancelled surgery' });
    }

    let medicine = null;
    if (medicine_id) {
      const { data: med } = await supabase
        .from('medicines')
        .select('*')
        .eq('id', medicine_id)
        .eq('user_id', req.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!med) {
        return res.status(404).json({ error: 'Medicine not found' });
      }
      medicine = med;
    }

    const adminTime = administered_at || new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Insert surgery medicine
    const { data: surgeryMedInserted, error: smError } = await supabase
      .from('surgery_medicines')
      .insert({
        surgery_id: id,
        medicine_id: medicine_id || null,
        custom_name: custom_name || null,
        dose: doseNum,
        dose_unit,
        dose_mg_kg: dose_mg_kg ? parseFloat(dose_mg_kg) : null,
        administered_at: adminTime,
        route: route || null,
        notes: notes || null,
        drug_source,
        phase,
      })
      .select()
      .single();

    if (smError) throw smError;

    // Decrement stock if applicable
    if (medicine && decrement_stock && drug_source === 'proprio' && !isAE) {
      if (medicine.current_stock < doseNum) {
        // Rollback the surgery_medicine insert
        await supabase.from('surgery_medicines').delete().eq('id', surgeryMedInserted.id);
        return res.status(400).json({
          error: 'Insufficient stock',
          available: medicine.current_stock,
          requested: doseNum,
        });
      }

      const unitCost = medicine.cost_per_unit;
      const totalCost = doseNum * unitCost;

      await supabase.from('stock_movements').insert({
        medicine_id,
        user_id: req.user.id,
        type: 'usage',
        quantity: doseNum,
        unit_cost: unitCost,
        total_cost: totalCost,
        surgery_id: id,
        notes: `Usado em cirurgia: ${surgery.procedure_name} - ${surgery.patient_name}`,
      });

      await supabase
        .from('medicines')
        .update({
          current_stock: medicine.current_stock - doseNum,
          updated_at: new Date().toISOString(),
        })
        .eq('id', medicine_id);
    }

    // Fetch the full surgery medicine record with joins
    const surgMedRows = await queryRows(`
      SELECT sm.*, COALESCE(m.name, sm.custom_name) as medicine_name, m.active_principle, m.concentration
      FROM surgery_medicines sm
      LEFT JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.id = $1
    `, [surgeryMedInserted.id]);

    const { data: updatedMedicine } = medicine_id
      ? await supabase.from('medicines').select('*').eq('id', medicine_id).single()
      : { data: null };

    res.status(201).json({
      message: 'Medicine added to surgery successfully',
      surgery_medicine: surgMedRows[0] || surgeryMedInserted,
      updated_medicine: updatedMedicine,
    });
  } catch (err) {
    console.error('Add surgery medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/surgeries/:id/medicines/:medId - remove medicine from surgery
router.delete('/:id/medicines/:medId', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id, medId } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    const { data: sm } = await supabase
      .from('surgery_medicines')
      .select('*')
      .eq('id', medId)
      .eq('surgery_id', id)
      .maybeSingle();

    if (!sm) {
      return res.status(404).json({ error: 'Surgery medicine record not found' });
    }

    // Restore stock if there was a usage movement
    if (sm.medicine_id) {
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('surgery_id', id)
        .eq('medicine_id', sm.medicine_id)
        .eq('type', 'usage')
        .order('created_at', { ascending: false })
        .limit(1);

      if (movements && movements.length > 0) {
        const movement = movements[0];

        // Get current medicine stock
        const { data: med } = await supabase
          .from('medicines')
          .select('current_stock')
          .eq('id', sm.medicine_id)
          .single();

        if (med) {
          await supabase
            .from('medicines')
            .update({
              current_stock: med.current_stock + movement.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sm.medicine_id);
        }

        await supabase
          .from('stock_movements')
          .delete()
          .eq('id', movement.id);
      }
    }

    await supabase
      .from('surgery_medicines')
      .delete()
      .eq('id', medId);

    res.json({ message: 'Medicine removed from surgery' });
  } catch (err) {
    console.error('Remove surgery medicine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/surgeries/:id/disposables - list disposables for a surgery
router.get('/:id/disposables', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) return res.status(404).json({ error: 'Surgery not found' });

    const disposables = await queryRows(`
      SELECT sd.*, m.name as medicine_name, m.cost_per_unit
      FROM surgery_disposables sd
      JOIN medicines m ON sd.medicine_id = m.id
      WHERE sd.surgery_id = $1
      ORDER BY sd.created_at ASC
    `, [req.params.id]);

    res.json({ disposables });
  } catch (err) {
    console.error('Surgery disposables error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/surgeries/:id/disposables - add disposable to surgery
router.post('/:id/disposables', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { medicine_id, quantity = 1 } = req.body;

    if (!medicine_id) return res.status(400).json({ error: 'medicine_id is required' });

    const supabase = getSupabase();

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) return res.status(404).json({ error: 'Surgery not found' });

    const { data: medicine } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', medicine_id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!medicine) return res.status(404).json({ error: 'Disposable not found' });

    const qty = parseFloat(quantity) || 1;
    const unitCost = medicine.cost_per_unit || 0;
    const totalCost = qty * unitCost;

    // Insert disposable
    const { data: inserted, error: insError } = await supabase
      .from('surgery_disposables')
      .insert({
        surgery_id: id,
        medicine_id,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
      })
      .select()
      .single();

    if (insError) throw insError;

    // Decrement stock
    if (medicine.current_stock >= qty) {
      await supabase
        .from('medicines')
        .update({
          current_stock: medicine.current_stock - qty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', medicine_id);

      await supabase.from('stock_movements').insert({
        medicine_id,
        user_id: req.user.id,
        type: 'usage',
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        surgery_id: id,
        notes: `Descartável usado em: ${surgery.procedure_name} - ${surgery.patient_name}`,
      });
    }

    const rows = await queryRows(`
      SELECT sd.*, m.name as medicine_name
      FROM surgery_disposables sd
      JOIN medicines m ON sd.medicine_id = m.id
      WHERE sd.id = $1
    `, [inserted.id]);

    res.status(201).json({ message: 'Disposable added', disposable: rows[0] || inserted });
  } catch (err) {
    console.error('Add surgery disposable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/surgeries/:id/disposables/:dispId - remove disposable from surgery
router.delete('/:id/disposables/:dispId', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id, dispId } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) return res.status(404).json({ error: 'Surgery not found' });

    const { data: sd } = await supabase
      .from('surgery_disposables')
      .select('*')
      .eq('id', dispId)
      .eq('surgery_id', id)
      .maybeSingle();

    if (!sd) return res.status(404).json({ error: 'Disposable record not found' });

    // Restore stock
    const { data: med } = await supabase
      .from('medicines')
      .select('current_stock')
      .eq('id', sd.medicine_id)
      .single();

    if (med) {
      await supabase
        .from('medicines')
        .update({
          current_stock: med.current_stock + sd.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sd.medicine_id);
    }

    // Remove usage movement
    const { data: movements } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('surgery_id', id)
      .eq('medicine_id', sd.medicine_id)
      .eq('type', 'usage')
      .order('created_at', { ascending: false })
      .limit(1);

    if (movements && movements.length > 0) {
      await supabase
        .from('stock_movements')
        .delete()
        .eq('id', movements[0].id);
    }

    await supabase
      .from('surgery_disposables')
      .delete()
      .eq('id', dispId);

    res.json({ message: 'Disposable removed' });
  } catch (err) {
    console.error('Remove surgery disposable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/surgeries/:id - cancel surgery
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) {
      return res.status(404).json({ error: 'Surgery not found' });
    }

    if (surgery.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed surgery' });
    }

    await supabase
      .from('surgeries')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ message: 'Surgery cancelled successfully' });
  } catch (err) {
    console.error('Cancel surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/surgeries/:id/pay - mark surgery as paid
router.put('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) return res.status(404).json({ error: 'Surgery not found' });

    await supabase
      .from('surgeries')
      .update({
        paid: 1,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    res.json({ message: 'Marcado como pago' });
  } catch (err) {
    console.error('Pay surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/surgeries/:id/unpay - unmark payment
router.put('/:id/unpay', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!surgery) return res.status(404).json({ error: 'Surgery not found' });

    await supabase
      .from('surgeries')
      .update({
        paid: 0,
        paid_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    res.json({ message: 'Pagamento desmarcado' });
  } catch (err) {
    console.error('Unpay surgery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
