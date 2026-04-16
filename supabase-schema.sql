-- ============================================================
-- VetAnesthesia Schema for Supabase (PostgreSQL 17)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'veterinario',
  profit_margin_percent REAL DEFAULT 30,
  full_name TEXT,
  professional_title TEXT DEFAULT 'Médica Veterinária',
  crmv_number TEXT,
  signature_image TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_links (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER DEFAULT 1,
  uses INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicines (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  active_principle TEXT,
  concentration TEXT,
  bottle_volume TEXT,
  unit TEXT NOT NULL DEFAULT 'unidade',
  current_stock REAL DEFAULT 0,
  min_stock REAL DEFAULT 0,
  cost_per_unit REAL DEFAULT 0,
  supplier TEXT,
  batch_number TEXT,
  expiry_date DATE,
  units_per_box INTEGER DEFAULT 1,
  volume_per_unit_ml REAL,
  medicine_type TEXT DEFAULT 'farmaco',
  presentation TEXT,
  presentation_type TEXT DEFAULT 'frasco',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surgeries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  patient_name TEXT NOT NULL,
  patient_species TEXT NOT NULL DEFAULT 'Canino',
  patient_breed TEXT,
  patient_weight REAL,
  patient_age TEXT,
  patient_sex TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  procedure_name TEXT NOT NULL,
  asa_classification TEXT,
  fasting_solid INTEGER DEFAULT 0,
  fasting_liquid INTEGER DEFAULT 0,
  fasting_solid_hours REAL,
  fasting_liquid_hours REAL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
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
  status TEXT DEFAULT 'scheduled',
  paid INTEGER DEFAULT 0,
  paid_at TIMESTAMPTZ,
  pathology TEXT,
  pre_existing_diseases TEXT,
  temperament TEXT,
  prior_medications TEXT,
  anamnesis_notes TEXT,
  pre_acp TEXT,
  pre_fc INTEGER,
  pre_fr INTEGER,
  pre_mucosas TEXT,
  pre_tpc TEXT,
  pre_temperature REAL,
  pre_hydration TEXT,
  pre_pas REAL,
  pre_pulse TEXT,
  pre_other_alterations TEXT,
  general_state TEXT,
  nutritional_state TEXT,
  exam_ht TEXT, exam_hb TEXT, exam_eritr TEXT, exam_ppt TEXT,
  exam_plaquetas TEXT, exam_leuc TEXT, exam_creat TEXT, exam_alt TEXT,
  exam_fa TEXT, exam_ureia TEXT, exam_alb TEXT, exam_glic TEXT,
  exam_raiox TEXT, exam_ultrassom TEXT, exam_eco_ecg TEXT, exam_outros TEXT,
  airway_type TEXT, airway_other TEXT, tube_number TEXT,
  breathing_mode TEXT, ventilation_type TEXT, breathing_system TEXT,
  peep INTEGER DEFAULT 0,
  block_type TEXT, block_drug TEXT, block_dose_volume TEXT,
  anesthesia_start TIMESTAMPTZ, procedure_start TIMESTAMPTZ,
  procedure_end TIMESTAMPTZ, anesthesia_end TIMESTAMPTZ,
  extubation_time TIMESTAMPTZ,
  post_operative TEXT, recovery_quality TEXT,
  custom_vitals_params TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring_vitals (
  id SERIAL PRIMARY KEY,
  surgery_id INTEGER REFERENCES surgeries(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  fc INTEGER, fr INTEGER, spo2 REAL, etco2 REAL,
  pam REAL, pas REAL, pad REAL, temperature REAL,
  fluid_ml_kg_h REAL, anesthetic TEXT, o2_l_min REAL,
  custom_params TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS surgery_medicines (
  id SERIAL PRIMARY KEY,
  surgery_id INTEGER REFERENCES surgeries(id) ON DELETE CASCADE,
  medicine_id INTEGER REFERENCES medicines(id),
  custom_name TEXT,
  dose REAL NOT NULL,
  dose_unit TEXT NOT NULL,
  dose_mg_kg REAL,
  administered_at TIMESTAMPTZ,
  route TEXT,
  notes TEXT,
  drug_source TEXT DEFAULT 'proprio',
  phase TEXT DEFAULT 'mpa'
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER REFERENCES medicines(id),
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL,
  total_cost REAL,
  surgery_id INTEGER REFERENCES surgeries(id),
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_bottles (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER REFERENCES medicines(id),
  user_id INTEGER REFERENCES users(id),
  volume_ml REAL NOT NULL,
  remaining_ml REAL NOT NULL,
  purchase_cost REAL DEFAULT 0,
  cost_per_ml REAL DEFAULT 0,
  status TEXT DEFAULT 'sealed',
  purchased_at DATE,
  opened_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  batch_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bottle_usages (
  id SERIAL PRIMARY KEY,
  bottle_id INTEGER REFERENCES medicine_bottles(id),
  surgery_id INTEGER REFERENCES surgeries(id),
  user_id INTEGER REFERENCES users(id),
  ml_used REAL NOT NULL,
  cost REAL NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS receivables (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  surgery_id INTEGER REFERENCES surgeries(id),
  clinic_name TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  paid_amount REAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT DEFAULT 'geral',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surgery_disposables (
  id SERIAL PRIMARY KEY,
  surgery_id INTEGER REFERENCES surgeries(id) ON DELETE CASCADE,
  medicine_id INTEGER REFERENCES medicines(id),
  quantity REAL NOT NULL DEFAULT 1,
  unit_cost REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_table (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  procedure_name TEXT NOT NULL,
  price_without_drugs REAL DEFAULT 0,
  price_with_drugs REAL DEFAULT 0,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_signatures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  surgery_id INTEGER REFERENCES surgeries(id),
  hash_sha256 TEXT NOT NULL,
  verification_code TEXT UNIQUE NOT NULL,
  signer_name TEXT NOT NULL,
  signer_crmv TEXT,
  signer_ip TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_user ON surgeries(user_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_status ON surgeries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_surgeries_paid ON surgeries(user_id, paid);
CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON stock_movements(medicine_id);
CREATE INDEX IF NOT EXISTS idx_surgery_medicines_surgery ON surgery_medicines(surgery_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_vitals_surgery ON monitoring_vitals(surgery_id);
CREATE INDEX IF NOT EXISTS idx_bottles_user ON medicine_bottles(user_id);
CREATE INDEX IF NOT EXISTS idx_bottles_medicine ON medicine_bottles(medicine_id);
CREATE INDEX IF NOT EXISTS idx_receivables_user ON receivables(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_surgery ON document_signatures(surgery_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_code ON document_signatures(verification_code);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottle_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_disposables ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies: each user sees only their own data
-- service_role bypasses RLS, so backend has full access

CREATE POLICY users_self_read ON users FOR SELECT USING (id = current_setting('app.user_id', true)::int);
CREATE POLICY users_self_update ON users FOR UPDATE USING (id = current_setting('app.user_id', true)::int);

CREATE POLICY medicines_user_all ON medicines FOR ALL USING (user_id = current_setting('app.user_id', true)::int);
CREATE POLICY surgeries_user_all ON surgeries FOR ALL USING (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY vitals_user_all ON monitoring_vitals FOR ALL
  USING (surgery_id IN (SELECT id FROM surgeries WHERE user_id = current_setting('app.user_id', true)::int));

CREATE POLICY surgery_meds_user_all ON surgery_medicines FOR ALL
  USING (surgery_id IN (SELECT id FROM surgeries WHERE user_id = current_setting('app.user_id', true)::int));

CREATE POLICY stock_movements_user_all ON stock_movements FOR ALL USING (user_id = current_setting('app.user_id', true)::int);
CREATE POLICY bottles_user_all ON medicine_bottles FOR ALL USING (user_id = current_setting('app.user_id', true)::int);
CREATE POLICY bottle_usages_user_all ON bottle_usages FOR ALL USING (user_id = current_setting('app.user_id', true)::int);
CREATE POLICY receivables_user_all ON receivables FOR ALL USING (user_id = current_setting('app.user_id', true)::int);
CREATE POLICY expenses_user_all ON expenses FOR ALL USING (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY disposables_user_all ON surgery_disposables FOR ALL
  USING (surgery_id IN (SELECT id FROM surgeries WHERE user_id = current_setting('app.user_id', true)::int));

CREATE POLICY price_table_user_all ON price_table FOR ALL USING (user_id = current_setting('app.user_id', true)::int);
CREATE POLICY referrals_user_all ON referral_links FOR ALL USING (created_by = current_setting('app.user_id', true)::int);

ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY signatures_user_all ON document_signatures FOR ALL USING (user_id = current_setting('app.user_id', true)::int);

-- ─── Personal Finance ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS personal_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  pro_labore REAL DEFAULT 0,
  pro_labore_auto INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'BRL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personal_settings_user ON personal_settings(user_id);

CREATE TABLE IF NOT EXISTS personal_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('receita', 'despesa')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date DATE NOT NULL,
  is_recurring INTEGER DEFAULT 0,
  recurring_day INTEGER,
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personal_tx_user ON personal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_tx_date ON personal_transactions(user_id, date);

CREATE TABLE IF NOT EXISTS personal_budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  category TEXT NOT NULL,
  monthly_limit REAL NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, month)
);
CREATE INDEX IF NOT EXISTS idx_personal_budgets_user ON personal_budgets(user_id);

CREATE TABLE IF NOT EXISTS personal_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0,
  deadline DATE,
  icon TEXT DEFAULT 'piggy-bank',
  color TEXT DEFAULT '#14b8a6',
  is_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personal_goals_user ON personal_goals(user_id);

ALTER TABLE personal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_settings_user_all ON personal_settings FOR ALL
  USING (user_id = current_setting('app.user_id', true)::int);

ALTER TABLE personal_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_tx_user_all ON personal_transactions FOR ALL
  USING (user_id = current_setting('app.user_id', true)::int);

ALTER TABLE personal_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_budgets_user_all ON personal_budgets FOR ALL
  USING (user_id = current_setting('app.user_id', true)::int);

ALTER TABLE personal_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_goals_user_all ON personal_goals FOR ALL
  USING (user_id = current_setting('app.user_id', true)::int);
