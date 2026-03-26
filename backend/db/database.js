const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'vet_anesthesia.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);

    // Enable WAL mode and foreign keys via pragma (must use db.pragma, not prepare)
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  // Create all tables inline using db.exec for multi-statement DDL
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'veterinario',
      profit_margin_percent REAL DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS referral_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      created_by INTEGER REFERENCES users(id),
      expires_at DATETIME NOT NULL,
      max_uses INTEGER DEFAULT 1,
      uses INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      active_principle TEXT,
      concentration TEXT,
      bottle_volume TEXT,
      unit TEXT NOT NULL,
      current_stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      batch_number TEXT,
      expiry_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS surgeries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      patient_name TEXT NOT NULL,
      patient_species TEXT NOT NULL,
      patient_breed TEXT,
      patient_weight REAL,
      patient_age TEXT,
      patient_sex TEXT,
      owner_name TEXT,
      owner_phone TEXT,
      procedure_name TEXT NOT NULL,
      asa_classification TEXT,
      fasting_solid_hours REAL,
      fasting_liquid_hours REAL,
      start_time DATETIME,
      end_time DATETIME,
      duration_minutes INTEGER,
      pre_anesthesia TEXT,
      induction TEXT,
      maintenance TEXT,
      anesthesia_protocol TEXT,
      monitoring_notes TEXT,
      complications TEXT,
      outcome TEXT DEFAULT 'success',
      clinic_name TEXT,
      surgeon_name TEXT,
      revenue REAL DEFAULT 0,
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monitoring_vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surgery_id INTEGER REFERENCES surgeries(id),
      recorded_at DATETIME NOT NULL,
      fc INTEGER,
      fr INTEGER,
      spo2 REAL,
      etco2 REAL,
      pam REAL,
      pas REAL,
      pad REAL,
      temperature REAL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER REFERENCES medicines(id),
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('purchase', 'usage', 'adjustment', 'expired')),
      quantity REAL NOT NULL,
      unit_cost REAL,
      total_cost REAL,
      surgery_id INTEGER REFERENCES surgeries(id),
      supplier TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS surgery_medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surgery_id INTEGER REFERENCES surgeries(id),
      medicine_id INTEGER REFERENCES medicines(id),
      dose REAL NOT NULL,
      dose_unit TEXT NOT NULL,
      dose_mg_kg REAL,
      administered_at DATETIME,
      route TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS price_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      procedure_name TEXT NOT NULL,
      price_without_drugs REAL DEFAULT 0,
      price_with_drugs REAL DEFAULT 0,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicine_bottles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER REFERENCES medicines(id),
      user_id INTEGER REFERENCES users(id),
      volume_ml REAL NOT NULL,
      remaining_ml REAL NOT NULL,
      purchase_cost REAL DEFAULT 0,
      cost_per_ml REAL DEFAULT 0,
      status TEXT DEFAULT 'sealed' CHECK(status IN ('sealed', 'opened', 'empty', 'expired', 'discarded')),
      purchased_at DATE,
      opened_at DATETIME,
      expires_at DATETIME,
      batch_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bottle_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bottle_id INTEGER REFERENCES medicine_bottles(id),
      surgery_id INTEGER REFERENCES surgeries(id),
      user_id INTEGER REFERENCES users(id),
      ml_used REAL NOT NULL,
      cost REAL NOT NULL,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      surgery_id INTEGER REFERENCES surgeries(id),
      clinic_name TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')),
      due_date DATE,
      paid_at DATETIME,
      paid_amount REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      date DATE NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'geral',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add columns if they don't exist (for existing databases)
  const cols = db.prepare("PRAGMA table_info(surgeries)").all().map(c => c.name);
  const addSurgeryCol = (name, type) => {
    if (!cols.includes(name)) {
      try { db.exec(`ALTER TABLE surgeries ADD COLUMN ${name} ${type}`); } catch {}
    }
  };
  addSurgeryCol('patient_sex', 'TEXT');
  addSurgeryCol('fasting_solid_hours', 'REAL');
  addSurgeryCol('fasting_liquid_hours', 'REAL');
  addSurgeryCol('pre_anesthesia', 'TEXT');
  addSurgeryCol('induction', 'TEXT');
  addSurgeryCol('maintenance', 'TEXT');
  // Ficha anestésica - novos campos
  addSurgeryCol('pathology', 'TEXT');
  addSurgeryCol('fasting_solid', 'INTEGER DEFAULT 0');
  addSurgeryCol('fasting_liquid', 'INTEGER DEFAULT 0');
  addSurgeryCol('pre_existing_diseases', 'TEXT');
  addSurgeryCol('temperament', 'TEXT');
  addSurgeryCol('prior_medications', 'TEXT');
  addSurgeryCol('anamnesis_notes', 'TEXT');
  // Exame pré-anestésico
  addSurgeryCol('pre_acp', 'TEXT');
  addSurgeryCol('pre_fc', 'INTEGER');
  addSurgeryCol('pre_fr', 'INTEGER');
  addSurgeryCol('pre_mucosas', 'TEXT');
  addSurgeryCol('pre_tpc', 'TEXT');
  addSurgeryCol('pre_temperature', 'REAL');
  addSurgeryCol('pre_hydration', 'TEXT');
  addSurgeryCol('pre_pas', 'REAL');
  addSurgeryCol('pre_pulse', 'TEXT');
  addSurgeryCol('pre_other_alterations', 'TEXT');
  addSurgeryCol('general_state', 'TEXT');
  addSurgeryCol('nutritional_state', 'TEXT');
  // Exames complementares
  addSurgeryCol('exam_ht', 'TEXT');
  addSurgeryCol('exam_hb', 'TEXT');
  addSurgeryCol('exam_eritr', 'TEXT');
  addSurgeryCol('exam_ppt', 'TEXT');
  addSurgeryCol('exam_plaquetas', 'TEXT');
  addSurgeryCol('exam_leuc', 'TEXT');
  addSurgeryCol('exam_creat', 'TEXT');
  addSurgeryCol('exam_alt', 'TEXT');
  addSurgeryCol('exam_fa', 'TEXT');
  addSurgeryCol('exam_ureia', 'TEXT');
  addSurgeryCol('exam_alb', 'TEXT');
  addSurgeryCol('exam_glic', 'TEXT');
  addSurgeryCol('exam_raiox', 'TEXT');
  addSurgeryCol('exam_ultrassom', 'TEXT');
  addSurgeryCol('exam_eco_ecg', 'TEXT');
  addSurgeryCol('exam_outros', 'TEXT');
  // Vias aéreas
  addSurgeryCol('airway_type', 'TEXT');
  addSurgeryCol('tube_number', 'TEXT');
  addSurgeryCol('breathing_mode', 'TEXT');
  addSurgeryCol('breathing_system', 'TEXT');
  addSurgeryCol('peep', 'INTEGER DEFAULT 0');
  // Bloqueios
  addSurgeryCol('block_type', 'TEXT');
  addSurgeryCol('block_drug', 'TEXT');
  addSurgeryCol('block_dose_volume', 'TEXT');
  // Tempos separados
  addSurgeryCol('anesthesia_start', 'DATETIME');
  addSurgeryCol('procedure_start', 'DATETIME');
  addSurgeryCol('procedure_end', 'DATETIME');
  addSurgeryCol('anesthesia_end', 'DATETIME');
  // Pós-operatório
  addSurgeryCol('post_operative', 'TEXT');
  // Extubação
  addSurgeryCol('extubation_time', 'DATETIME');

  const medCols = db.prepare("PRAGMA table_info(medicines)").all().map(c => c.name);
  if (!medCols.includes('bottle_volume')) {
    try { db.exec('ALTER TABLE medicines ADD COLUMN bottle_volume TEXT'); } catch {}
  }
  if (!medCols.includes('units_per_box')) {
    try { db.exec('ALTER TABLE medicines ADD COLUMN units_per_box INTEGER DEFAULT 1'); } catch {}
  }
  if (!medCols.includes('volume_per_unit_ml')) {
    try { db.exec('ALTER TABLE medicines ADD COLUMN volume_per_unit_ml REAL'); } catch {}
  }
  if (!medCols.includes('medicine_type')) {
    try { db.exec("ALTER TABLE medicines ADD COLUMN medicine_type TEXT DEFAULT 'farmaco'"); } catch {}
  }

  const smCols = db.prepare("PRAGMA table_info(surgery_medicines)").all().map(c => c.name);
  if (!smCols.includes('dose_mg_kg')) {
    try { db.exec('ALTER TABLE surgery_medicines ADD COLUMN dose_mg_kg REAL'); } catch {}
  }
  if (!smCols.includes('drug_source')) {
    try { db.exec("ALTER TABLE surgery_medicines ADD COLUMN drug_source TEXT DEFAULT 'proprio'"); } catch {}
  }
  if (!smCols.includes('phase')) {
    try { db.exec("ALTER TABLE surgery_medicines ADD COLUMN phase TEXT DEFAULT 'mpa'"); } catch {}
  }

  const mvCols = db.prepare("PRAGMA table_info(stock_movements)").all().map(c => c.name);
  if (!mvCols.includes('supplier')) {
    try { db.exec('ALTER TABLE stock_movements ADD COLUMN supplier TEXT'); } catch {}
  }

  const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userCols.includes('profit_margin_percent')) {
    try { db.exec('ALTER TABLE users ADD COLUMN profit_margin_percent REAL DEFAULT 30'); } catch {}
  }

  // Add fluid, anesthetic, o2 to monitoring_vitals
  const vitalCols = db.prepare("PRAGMA table_info(monitoring_vitals)").all().map(c => c.name);
  if (!vitalCols.includes('fluid_ml_kg_h')) {
    try { db.exec('ALTER TABLE monitoring_vitals ADD COLUMN fluid_ml_kg_h REAL'); } catch {}
  }
  if (!vitalCols.includes('anesthetic')) {
    try { db.exec('ALTER TABLE monitoring_vitals ADD COLUMN anesthetic TEXT'); } catch {}
  }
  if (!vitalCols.includes('o2_l_min')) {
    try { db.exec('ALTER TABLE monitoring_vitals ADD COLUMN o2_l_min REAL'); } catch {}
  }

  // Ensure permanent admin account exists (Camila)
  ensurePermanentAdmin();
}

function ensurePermanentAdmin() {
  const email = 'camilacadibe@gmail.com';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!existing) {
    const hashedPassword = bcrypt.hashSync('Mimi12345!', 12);
    db.prepare(`
      INSERT INTO users (name, email, password, role, is_active)
      VALUES (?, ?, ?, 'admin', 1)
    `).run('Camila Cadibe', email, hashedPassword);
    console.log('Permanent admin created: ' + email);
  } else {
    db.prepare('UPDATE users SET role = ?, is_active = 1 WHERE email = ?').run('admin', email);
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
