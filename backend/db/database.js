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
      owner_name TEXT,
      owner_phone TEXT,
      procedure_name TEXT NOT NULL,
      asa_classification TEXT,
      start_time DATETIME,
      end_time DATETIME,
      duration_minutes INTEGER,
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

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER REFERENCES medicines(id),
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('purchase', 'usage', 'adjustment', 'expired')),
      quantity REAL NOT NULL,
      unit_cost REAL,
      total_cost REAL,
      surgery_id INTEGER REFERENCES surgeries(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS surgery_medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surgery_id INTEGER REFERENCES surgeries(id),
      medicine_id INTEGER REFERENCES medicines(id),
      dose REAL NOT NULL,
      dose_unit TEXT NOT NULL,
      administered_at DATETIME,
      route TEXT,
      notes TEXT
    );
  `);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
