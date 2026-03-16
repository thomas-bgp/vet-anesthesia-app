const Database = require('better-sqlite3');
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
  `);

  // Add columns if they don't exist (for existing databases)
  const cols = db.prepare("PRAGMA table_info(surgeries)").all().map(c => c.name);
  if (!cols.includes('patient_sex')) {
    try { db.exec('ALTER TABLE surgeries ADD COLUMN patient_sex TEXT'); } catch {}
  }
  if (!cols.includes('fasting_solid_hours')) {
    try { db.exec('ALTER TABLE surgeries ADD COLUMN fasting_solid_hours REAL'); } catch {}
  }
  if (!cols.includes('fasting_liquid_hours')) {
    try { db.exec('ALTER TABLE surgeries ADD COLUMN fasting_liquid_hours REAL'); } catch {}
  }
  if (!cols.includes('pre_anesthesia')) {
    try { db.exec('ALTER TABLE surgeries ADD COLUMN pre_anesthesia TEXT'); } catch {}
  }
  if (!cols.includes('induction')) {
    try { db.exec('ALTER TABLE surgeries ADD COLUMN induction TEXT'); } catch {}
  }
  if (!cols.includes('maintenance')) {
    try { db.exec('ALTER TABLE surgeries ADD COLUMN maintenance TEXT'); } catch {}
  }

  const medCols = db.prepare("PRAGMA table_info(medicines)").all().map(c => c.name);
  if (!medCols.includes('bottle_volume')) {
    try { db.exec('ALTER TABLE medicines ADD COLUMN bottle_volume TEXT'); } catch {}
  }

  const smCols = db.prepare("PRAGMA table_info(surgery_medicines)").all().map(c => c.name);
  if (!smCols.includes('dose_mg_kg')) {
    try { db.exec('ALTER TABLE surgery_medicines ADD COLUMN dose_mg_kg REAL'); } catch {}
  }

  const mvCols = db.prepare("PRAGMA table_info(stock_movements)").all().map(c => c.name);
  if (!mvCols.includes('supplier')) {
    try { db.exec('ALTER TABLE stock_movements ADD COLUMN supplier TEXT'); } catch {}
  }

  const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userCols.includes('profit_margin_percent')) {
    try { db.exec('ALTER TABLE users ADD COLUMN profit_margin_percent REAL DEFAULT 30'); } catch {}
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
