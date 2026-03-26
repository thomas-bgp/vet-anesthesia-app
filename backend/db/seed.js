require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

async function seed() {
  const db = getDb();

  console.log('Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const vetPassword = await bcrypt.hash('vet123', 12);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (name, email, password, role)
    VALUES (?, ?, ?, ?)
  `);

  const camilaPassword = await bcrypt.hash('Mimi12345!', 12);

  const adminResult = insertUser.run('Admin Sistema', 'admin@vetanesthesia.com', adminPassword, 'admin');
  insertUser.run('Camila Cadibe', 'camilacadibe@gmail.com', camilaPassword, 'admin');
  const vetResult = insertUser.run('Dr. Carlos Silva', 'carlos@vetanesthesia.com', vetPassword, 'veterinario');
  const vet2Result = insertUser.run('Dra. Ana Lima', 'ana@vetanesthesia.com', vetPassword, 'veterinario');

  // Get user IDs
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@vetanesthesia.com');
  const vet1 = db.prepare('SELECT id FROM users WHERE email = ?').get('carlos@vetanesthesia.com');
  const vet2 = db.prepare('SELECT id FROM users WHERE email = ?').get('ana@vetanesthesia.com');

  console.log('Users created:', { admin: admin.id, vet1: vet1.id, vet2: vet2.id });

  // Create referral links
  const insertReferral = db.prepare(`
    INSERT OR IGNORE INTO referral_links (code, created_by, expires_at, max_uses)
    VALUES (?, ?, datetime('now', '+30 days'), ?)
  `);

  insertReferral.run('DEMO-' + uuidv4().substring(0, 8).toUpperCase(), admin.id, 10);
  insertReferral.run('VET-' + uuidv4().substring(0, 8).toUpperCase(), admin.id, 5);

  // Insert medicines
  const insertMedicine = db.prepare(`
    INSERT OR IGNORE INTO medicines
    (user_id, name, active_principle, concentration, unit, current_stock, min_stock, cost_per_unit, supplier, batch_number, expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const medicines = [
    [vet1.id, 'Propofol 1%', 'Propofol', '10mg/mL', 'mL', 500, 100, 0.85, 'Cristália', 'LOT2024001', '2025-12-31'],
    [vet1.id, 'Ketamina 10%', 'Cetamina', '100mg/mL', 'mL', 200, 50, 1.20, 'Agener União', 'LOT2024002', '2025-06-30'],
    [vet1.id, 'Midazolam 5mg/mL', 'Midazolam', '5mg/mL', 'mL', 300, 60, 2.50, 'União Química', 'LOT2024003', '2025-09-15'],
    [vet1.id, 'Acepromazina 0,2%', 'Acepromazina', '2mg/mL', 'mL', 150, 30, 1.80, 'Syntec', 'LOT2024004', '2025-11-20'],
    [vet1.id, 'Atropina 0,5mg/mL', 'Atropina', '0.5mg/mL', 'mL', 400, 80, 0.45, 'Cristália', 'LOT2024005', '2026-03-10'],
    [vet1.id, 'Morfina 10mg/mL', 'Morfina', '10mg/mL', 'mL', 80, 20, 3.20, 'Cristália', 'LOT2024006', '2025-08-15'],
    [vet1.id, 'Isoflurano', 'Isoflurano', '100%', 'mL', 600, 200, 0.95, 'Baxter', 'LOT2024007', '2026-01-31'],
    [vet1.id, 'Fentanil 0,05mg/mL', 'Fentanil', '50mcg/mL', 'mL', 120, 40, 4.10, 'Cristália', 'LOT2024008', '2025-07-20'],
    [vet2.id, 'Tramadol 50mg/mL', 'Tramadol', '50mg/mL', 'mL', 250, 50, 1.15, 'Halexistar', 'LOT2024009', '2025-10-30'],
    [vet2.id, 'Dexmedetomidina 0,5mg/mL', 'Dexmedetomidina', '500mcg/mL', 'mL', 60, 20, 18.50, 'Pfizer', 'LOT2024010', '2025-05-15'],
    [vet2.id, 'Diazepam 5mg/mL', 'Diazepam', '5mg/mL', 'mL', 20, 30, 0.80, 'Hipolabor', 'LOT2024011', '2025-04-30'],
    [vet2.id, 'Neostigmina 0,5mg/mL', 'Neostigmina', '0.5mg/mL', 'mL', 90, 25, 2.30, 'Cristália', 'LOT2024012', '2025-12-15'],
  ];

  const medicineIds = [];
  for (const m of medicines) {
    const result = insertMedicine.run(...m);
    // Get inserted id
    const inserted = db.prepare('SELECT id FROM medicines WHERE user_id = ? AND name = ?').get(m[0], m[1]);
    if (inserted) medicineIds.push(inserted.id);
  }

  console.log(`Medicines created: ${medicineIds.length}`);

  // Insert surgeries (past 3 months)
  const insertSurgery = db.prepare(`
    INSERT INTO surgeries
    (user_id, patient_name, patient_species, patient_breed, patient_weight, patient_age,
     owner_name, owner_phone, procedure_name, asa_classification, start_time, end_time,
     duration_minutes, anesthesia_protocol, outcome, clinic_name, surgeon_name, revenue, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const surgeriesData = [
    // Completed surgeries - last 3 months
    [vet1.id, 'Rex', 'Canino', 'Labrador', 28.5, '3 anos', 'João Santos', '11999990001',
     'Ovariohisterectomia', 'ASA II', '2024-11-05 09:00', '2024-11-05 11:30', 150,
     'Propofol + Isoflurano + Fentanil', 'success', 'Clínica VetCare', 'Dr. Ricardo Alves', 450.00, 'completed'],
    [vet1.id, 'Mel', 'Canino', 'Golden Retriever', 32.0, '5 anos', 'Maria Silva', '11999990002',
     'Mastectomia', 'ASA II', '2024-11-10 08:00', '2024-11-10 10:45', 165,
     'Ketamina + Midazolam + Isoflurano', 'success', 'Hospital Vet Premium', 'Dr. Paulo Costa', 680.00, 'completed'],
    [vet1.id, 'Thor', 'Canino', 'Rottweiler', 45.0, '4 anos', 'Carlos Oliveira', '11999990003',
     'Artroscopia', 'ASA I', '2024-11-15 10:00', '2024-11-15 12:00', 120,
     'Propofol + Isoflurano', 'success', 'Clínica VetCare', 'Dr. Marcos Lima', 520.00, 'completed'],
    [vet2.id, 'Luna', 'Felino', 'Siamês', 3.8, '2 anos', 'Ana Costa', '11999990004',
     'Orquiectomia', 'ASA I', '2024-11-20 14:00', '2024-11-20 14:45', 45,
     'Ketamina + Acepromazina', 'success', 'Clínica Gatos & Cia', 'Dra. Fernanda Rocha', 280.00, 'completed'],
    [vet2.id, 'Bolinha', 'Felino', 'Persa', 4.2, '7 anos', 'Pedro Alves', '11999990005',
     'Cistotomia', 'ASA III', '2024-11-25 09:00', '2024-11-25 11:00', 120,
     'Propofol + Fentanil + Isoflurano', 'success', 'Clínica Gatos & Cia', 'Dr. Roberto Santos', 580.00, 'completed'],
    [vet1.id, 'Max', 'Canino', 'Boxer', 30.0, '6 anos', 'Lucia Ferreira', '11999990006',
     'Esplenectomia', 'ASA III', '2024-12-02 08:00', '2024-12-02 10:30', 150,
     'Propofol + Midazolam + Isoflurano + Morfina', 'success', 'Hospital Vet Premium', 'Dr. Ricardo Alves', 750.00, 'completed'],
    [vet1.id, 'Bella', 'Canino', 'Poodle', 6.5, '3 anos', 'Sandra Lima', '11999990007',
     'Palatoplastia', 'ASA II', '2024-12-08 10:00', '2024-12-08 11:30', 90,
     'Propofol + Isoflurano', 'success', 'Clínica VetCare', 'Dra. Camila Torres', 420.00, 'completed'],
    [vet2.id, 'Nala', 'Felino', 'Doméstico', 3.5, '1 ano', 'Felipe Souza', '11999990008',
     'Ovariohisterectomia', 'ASA I', '2024-12-12 14:00', '2024-12-12 15:30', 90,
     'Ketamina + Midazolam', 'success', 'Clínica Gatos & Cia', 'Dr. Roberto Santos', 320.00, 'completed'],
    [vet1.id, 'Duke', 'Canino', 'Dobermann', 38.0, '5 anos', 'Roberto Melo', '11999990009',
     'Gastropexia', 'ASA II', '2024-12-18 08:00', '2024-12-18 10:00', 120,
     'Propofol + Isoflurano + Fentanil', 'success', 'Hospital Vet Premium', 'Dr. Paulo Costa', 620.00, 'completed'],
    [vet2.id, 'Mimi', 'Felino', 'Angorá', 3.0, '9 anos', 'Carla Dias', '11999990010',
     'Nefrectomia', 'ASA IV', '2024-12-22 09:00', '2024-12-22 11:30', 150,
     'Propofol + Fentanil + Isoflurano + Midazolam', 'success', 'Hospital Vet Premium', 'Dr. Ricardo Alves', 890.00, 'completed'],
    // January 2025
    [vet1.id, 'Bob', 'Canino', 'Beagle', 14.0, '4 anos', 'Marcos Nunes', '11999990011',
     'Herniorrafia', 'ASA II', '2025-01-05 09:00', '2025-01-05 10:30', 90,
     'Propofol + Isoflurano', 'success', 'Clínica VetCare', 'Dr. Marcos Lima', 380.00, 'completed'],
    [vet1.id, 'Nina', 'Canino', 'Yorkshire', 3.5, '2 anos', 'Juliana Costa', '11999990012',
     'Luxação de Patela', 'ASA I', '2025-01-10 10:00', '2025-01-10 12:00', 120,
     'Propofol + Isoflurano + Fentanil', 'success', 'Clínica VetCare', 'Dra. Camila Torres', 490.00, 'completed'],
    [vet2.id, 'Felix', 'Felino', 'Maine Coon', 7.0, '6 anos', 'Gustavo Lima', '11999990013',
     'Uretrostomia', 'ASA III', '2025-01-15 08:00', '2025-01-15 10:30', 150,
     'Ketamina + Midazolam + Isoflurano', 'success', 'Clínica Gatos & Cia', 'Dra. Fernanda Rocha', 640.00, 'completed'],
    [vet1.id, 'Kira', 'Canino', 'Husky Siberiano', 25.0, '3 anos', 'Bruno Rocha', '11999990014',
     'Ovariohisterectomia', 'ASA I', '2025-01-20 09:00', '2025-01-20 11:00', 120,
     'Propofol + Isoflurano + Morfina', 'success', 'Hospital Vet Premium', 'Dr. Paulo Costa', 440.00, 'completed'],
    [vet2.id, 'Tom', 'Felino', 'Doméstico', 4.5, '5 anos', 'Patricia Santos', '11999990015',
     'Laparotomia Exploratória', 'ASA III', '2025-01-25 10:00', '2025-01-25 12:30', 150,
     'Propofol + Fentanil + Isoflurano', 'success', 'Clínica Gatos & Cia', 'Dr. Roberto Santos', 720.00, 'completed'],
    // February 2025
    [vet1.id, 'Toby', 'Canino', 'Shih Tzu', 7.0, '4 anos', 'Renata Alves', '11999990016',
     'Rinoplastia', 'ASA II', '2025-02-03 09:00', '2025-02-03 10:30', 90,
     'Propofol + Isoflurano', 'success', 'Clínica VetCare', 'Dr. Marcos Lima', 560.00, 'completed'],
    [vet2.id, 'Chico', 'Canino', 'Dachshund', 9.5, '7 anos', 'Eduardo Vieira', '11999990017',
     'Hemilaminectomia', 'ASA III', '2025-02-08 08:00', '2025-02-08 11:00', 180,
     'Propofol + Fentanil + Midazolam + Isoflurano', 'success', 'Hospital Vet Premium', 'Dr. Ricardo Alves', 1200.00, 'completed'],
    [vet1.id, 'Pipoca', 'Felino', 'Ragdoll', 5.5, '3 anos', 'Isabela Moura', '11999990018',
     'Uretrostomia', 'ASA II', '2025-02-14 14:00', '2025-02-14 16:00', 120,
     'Ketamina + Midazolam + Isoflurano', 'success', 'Clínica Gatos & Cia', 'Dra. Fernanda Rocha', 580.00, 'completed'],
    [vet1.id, 'Spike', 'Canino', 'Pit Bull', 22.0, '2 anos', 'Leonardo Santos', '11999990019',
     'Artrodese', 'ASA II', '2025-02-20 09:00', '2025-02-20 12:00', 180,
     'Propofol + Isoflurano + Fentanil', 'success', 'Hospital Vet Premium', 'Dr. Paulo Costa', 980.00, 'completed'],
    [vet2.id, 'Coco', 'Felino', 'Bengala', 4.8, '4 anos', 'Amanda Correia', '11999990020',
     'Toracotomia', 'ASA IV', '2025-02-25 08:00', '2025-02-25 11:30', 210,
     'Propofol + Fentanil + Isoflurano + Dexmedetomidina', 'success', 'Hospital Vet Premium', 'Dra. Camila Torres', 1450.00, 'completed'],
    // Scheduled / in_progress
    [vet1.id, 'Zeus', 'Canino', 'Pastor Alemão', 35.0, '5 anos', 'Thiago Barbosa', '11999990021',
     'Cruciatoplastia', 'ASA II', '2025-03-15 09:00', null, null,
     'Propofol + Isoflurano + Fentanil', 'success', 'Hospital Vet Premium', 'Dr. Ricardo Alves', 850.00, 'scheduled'],
    [vet2.id, 'Lola', 'Felino', 'Doméstico', 3.2, '6 anos', 'Vanessa Pinto', '11999990022',
     'Mastectomia', 'ASA II', '2025-03-16 10:00', null, null,
     'Ketamina + Isoflurano', 'success', 'Clínica Gatos & Cia', 'Dra. Fernanda Rocha', 520.00, 'scheduled'],
  ];

  const surgeryIds = [];
  for (const s of surgeriesData) {
    const result = insertSurgery.run(...s);
    surgeryIds.push(result.lastInsertRowid);
  }

  console.log(`Surgeries created: ${surgeryIds.length}`);

  // Get medicine IDs for surgery medicine associations
  const allMedicines = db.prepare('SELECT id, name FROM medicines WHERE is_active = 1').all();
  const medMap = {};
  allMedicines.forEach((m) => { medMap[m.name] = m.id; });

  // Add medicines to completed surgeries
  const insertSurgMed = db.prepare(`
    INSERT INTO surgery_medicines (surgery_id, medicine_id, dose, dose_unit, administered_at, route, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const surgMedData = [
    [surgeryIds[0], medMap['Propofol 1%'], 5.0, 'mg/kg', '2024-11-05 09:05', 'IV', 'Indução'],
    [surgeryIds[0], medMap['Isoflurano'], 150.0, 'mL', '2024-11-05 09:10', 'Inalatório', 'Manutenção'],
    [surgeryIds[0], medMap['Fentanil 0,05mg/mL'], 8.0, 'mL', '2024-11-05 09:05', 'IV', 'Analgesia'],
    [surgeryIds[0], medMap['Atropina 0,5mg/mL'], 2.0, 'mL', '2024-11-05 09:00', 'IV', 'Pré-medicação'],

    [surgeryIds[1], medMap['Ketamina 10%'], 10.0, 'mg/kg', '2024-11-10 08:05', 'IM', 'Contenção'],
    [surgeryIds[1], medMap['Midazolam 5mg/mL'], 5.0, 'mL', '2024-11-10 08:05', 'IV', 'Sedação'],
    [surgeryIds[1], medMap['Isoflurano'], 180.0, 'mL', '2024-11-10 08:15', 'Inalatório', 'Manutenção'],

    [surgeryIds[2], medMap['Propofol 1%'], 6.0, 'mg/kg', '2024-11-15 10:05', 'IV', 'Indução'],
    [surgeryIds[2], medMap['Isoflurano'], 130.0, 'mL', '2024-11-15 10:10', 'Inalatório', 'Manutenção'],

    [surgeryIds[3], medMap['Ketamina 10%'], 15.0, 'mg/kg', '2024-11-20 14:05', 'IM', 'Contenção'],
    [surgeryIds[3], medMap['Acepromazina 0,2%'], 0.5, 'mL', '2024-11-20 14:00', 'IM', 'Pré-medicação'],

    [surgeryIds[4], medMap['Propofol 1%'], 4.0, 'mg/kg', '2024-11-25 09:05', 'IV', 'Indução'],
    [surgeryIds[4], medMap['Fentanil 0,05mg/mL'], 5.0, 'mL', '2024-11-25 09:05', 'IV', 'Analgesia'],
    [surgeryIds[4], medMap['Isoflurano'], 130.0, 'mL', '2024-11-25 09:10', 'Inalatório', 'Manutenção'],
  ];

  for (const sm of surgMedData) {
    try {
      insertSurgMed.run(...sm);
    } catch (e) {
      // Skip if medicine not found
    }
  }

  // Add stock movements (purchases)
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const movementsData = [
    [medMap['Propofol 1%'], vet1.id, 'purchase', 500, 0.85, 425.00, 'Compra inicial - Cristália'],
    [medMap['Ketamina 10%'], vet1.id, 'purchase', 200, 1.20, 240.00, 'Compra inicial - Agener'],
    [medMap['Midazolam 5mg/mL'], vet1.id, 'purchase', 300, 2.50, 750.00, 'Compra inicial - União Química'],
    [medMap['Acepromazina 0,2%'], vet1.id, 'purchase', 150, 1.80, 270.00, 'Compra inicial - Syntec'],
    [medMap['Atropina 0,5mg/mL'], vet1.id, 'purchase', 400, 0.45, 180.00, 'Compra inicial - Cristália'],
    [medMap['Morfina 10mg/mL'], vet1.id, 'purchase', 80, 3.20, 256.00, 'Compra inicial - Cristália'],
    [medMap['Isoflurano'], vet1.id, 'purchase', 600, 0.95, 570.00, 'Compra inicial - Baxter'],
    [medMap['Fentanil 0,05mg/mL'], vet1.id, 'purchase', 120, 4.10, 492.00, 'Compra inicial - Cristália'],
    [medMap['Tramadol 50mg/mL'], vet2.id, 'purchase', 250, 1.15, 287.50, 'Compra inicial - Halexistar'],
    [medMap['Dexmedetomidina 0,5mg/mL'], vet2.id, 'purchase', 60, 18.50, 1110.00, 'Compra inicial - Pfizer'],
    [medMap['Diazepam 5mg/mL'], vet2.id, 'purchase', 20, 0.80, 16.00, 'Compra inicial - Hipolabor'],
    [medMap['Neostigmina 0,5mg/mL'], vet2.id, 'purchase', 90, 2.30, 207.00, 'Compra inicial - Cristália'],
  ];

  for (const mv of movementsData) {
    try {
      insertMovement.run(...mv);
    } catch (e) {
      // skip
    }
  }

  console.log('Stock movements created');
  console.log('\nSeed completed successfully!');
  console.log('\nDemo accounts:');
  console.log('  Admin: admin@vetanesthesia.com / admin123');
  console.log('  Vet 1: carlos@vetanesthesia.com / vet123');
  console.log('  Vet 2: ana@vetanesthesia.com / vet123');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
