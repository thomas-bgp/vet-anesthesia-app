/**
 * Seed Camila's real stock data from her spreadsheet.
 * Run once: node db/seed-camila.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getDb } = require('./database');

const db = getDb();

// Get Camila's user ID
const camila = db.prepare("SELECT id FROM users WHERE email = 'camilacadibe@gmail.com'").get();
if (!camila) {
  console.error('Camila user not found!');
  process.exit(1);
}
const userId = camila.id;
console.log(`Camila user_id = ${userId}`);

// Clean test data (only if it's test data from the dev session)
db.exec(`DELETE FROM bottle_usages WHERE user_id = ${userId}`);
db.exec(`DELETE FROM medicine_bottles WHERE user_id = ${userId}`);
db.exec(`DELETE FROM stock_movements WHERE user_id = ${userId}`);
db.exec(`DELETE FROM medicines WHERE user_id = ${userId}`);
db.exec(`DELETE FROM receivables WHERE user_id = ${userId}`);
db.exec(`DELETE FROM expenses WHERE user_id = ${userId}`);
console.log('Cleaned existing test data for Camila');

// ─── MEDICINES ────────────────────────────────────────────────────────────────
// Each entry: [name, active_principle, concentration, unit, volume_per_unit_ml, units_per_box, cost_per_unit]
const medicines = [
  ['Dopamina 10ml',           'Dopamina',          null,       'mL', 10,   1,  5.60],
  ['Efedrina 1ml',            'Efedrina',          null,       'mL', 1,    1,  8.46],
  ['Norepinefrina 4ml',       'Norepinefrina',     null,       'mL', 4,    1,  1.82],
  ['Lidocaína 20ml',          'Lidocaína',         '2%',       'mL', 20,   1,  6.90],
  ['Bupivacaína 20ml',        'Bupivacaína',       '0,5%',     'mL', 20,   1,  8.40],
  ['Ropivacaína 20ml',        'Ropivacaína',       '0,75%',    'mL', 20,   1,  18.30],
  ['Midazolam 3ml',           'Midazolam',         '5mg/mL',   'mL', 3,    5,  15.80],  // cx 5 amp
  ['Flumazenil 5ml',          'Flumazenil',        '0,1mg/mL', 'mL', 5,    1,  56.90],
  ['Neostigmina 1ml',         'Neostigmina',       '0,5mg/mL', 'mL', 1,    1,  2.20],
  ['Dexmedetomidina 2ml',     'Dexmedetomidina',   '0,5mg/mL', 'mL', 2,    5,  58.53],  // cx 5 fr
  ['Propofol 20ml',           'Propofol',          '1%',       'mL', 20,   10, 69.90],  // cx 10 fr
  ['Metadona 1ml',            'Metadona',          '10mg/mL',  'mL', 1,    25, 189.90], // cx 25 amp
  ['Dipirona 2ml',            'Dipirona',          '500mg/mL', 'mL', 2,    1,  0.81],
  ['Ampicilina 10ml',         'Ampicilina',        null,       'mL', 10,   1,  6.55],
  ['Dexametasona 2,5ml',      'Dexametasona',      '4mg/mL',   'mL', 2.5,  1,  1.14],
  ['Isoflurano 100ml',        'Isoflurano',        '100%',     'mL', 100,  1,  100.00],
  ['Fentanil 10ml',           'Fentanil',          '50mcg/mL', 'mL', 10,   1,  10.00],
  ['Acepromazina 20ml',       'Acepromazina',      '0,2%',     'mL', 20,   1,  50.00],
  ['Cetamina 50ml',           'Cetamina',          '10%',      'mL', 50,   1,  150.00],
];

const insertMed = db.prepare(`
  INSERT INTO medicines (user_id, name, active_principle, concentration, unit, volume_per_unit_ml, units_per_box, cost_per_unit, current_stock, min_stock, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)
`);

const medMap = {}; // name -> id
for (const [name, principle, conc, unit, vol, upb, cpu] of medicines) {
  const r = insertMed.run(userId, name, principle, conc, unit, vol, upb, cpu);
  medMap[name] = r.lastInsertRowid;
}
console.log(`Created ${Object.keys(medMap).length} medicines`);

// ─── PURCHASES (bottles) ──────────────────────────────────────────────────────
// Each: [medicine_name, date, qty_purchased, cost_per_unit_or_box, is_box]
// For boxes: qty is number of BOXES, we create qty * units_per_box individual bottles
// cost_per_bottle = cost_per_box / units_per_box

const purchases = [
  // Feb 2026
  ['Dopamina 10ml',         '2026-02-01', 2,   5.60,   false],
  ['Efedrina 1ml',          '2026-02-01', 10,  8.46,   false],
  ['Norepinefrina 4ml',     '2026-02-01', 5,   1.82,   false],
  ['Lidocaína 20ml',        '2026-02-01', 10,  6.90,   false],
  ['Bupivacaína 20ml',      '2026-02-01', 3,   8.40,   false],
  ['Ropivacaína 20ml',      '2026-02-01', 2,   18.30,  false],
  ['Midazolam 3ml',         '2026-02-01', 2,   15.80,  true],   // 2 caixas × 5 amp = 10 ampolas, custo/amp = 15.80/5 = 3.16
  ['Flumazenil 5ml',        '2026-02-01', 2,   56.90,  false],
  ['Neostigmina 1ml',       '2026-02-01', 2,   2.20,   false],
  ['Dexmedetomidina 2ml',   '2026-02-01', 1,   58.53,  true],   // 1 caixa × 5 fr = 5 frascos, custo/fr = 58.53/5 = 11.71
  ['Propofol 20ml',         '2026-02-01', 2,   69.90,  true],   // 2 caixas × 10 fr = 20 frascos, custo/fr = 69.90/10 = 6.99
  ['Metadona 1ml',          '2026-02-01', 0.5, 189.90, true],   // 0.5 caixa × 25 amp ≈ 12 ampolas
  ['Dipirona 2ml',          '2026-02-01', 5,   0.81,   false],
  ['Ampicilina 10ml',       '2026-02-01', 2,   6.55,   false],
  ['Dexametasona 2,5ml',    '2026-02-01', 5,   1.14,   false],
  // Mar 2026
  ['Isoflurano 100ml',      '2026-03-01', 1,   100.00, false],
  ['Fentanil 10ml',         '2026-03-01', 5,   10.00,  false],
  ['Acepromazina 20ml',     '2026-03-01', 1,   50.00,  false],
  ['Cetamina 50ml',         '2026-03-01', 1,   150.00, false],
];

const insertBottle = db.prepare(`
  INSERT INTO medicine_bottles (medicine_id, user_id, volume_ml, remaining_ml, purchase_cost, cost_per_ml, status, purchased_at)
  VALUES (?, ?, ?, ?, ?, ?, 'sealed', ?)
`);

const insertMovement = db.prepare(`
  INSERT INTO stock_movements (medicine_id, user_id, type, quantity, unit_cost, total_cost, notes, created_at)
  VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?)
`);

let totalBottles = 0;

for (const [medName, date, qty, costPerUnit, isBox] of purchases) {
  const medId = medMap[medName];
  const med = medicines.find(m => m[0] === medName);
  const volumePerUnit = med[4]; // volume_per_unit_ml
  const unitsPerBox = med[5];   // units_per_box

  let numBottles, costPerBottle;

  if (isBox) {
    // qty = number of boxes, each box has unitsPerBox individual bottles
    numBottles = Math.round(qty * unitsPerBox);
    costPerBottle = costPerUnit / unitsPerBox;
  } else {
    // qty = number of individual bottles/ampoules
    numBottles = qty;
    costPerBottle = costPerUnit;
  }

  const costPerMl = costPerBottle / volumePerUnit;
  const totalCost = costPerBottle * numBottles;

  // Create individual bottles
  for (let i = 0; i < numBottles; i++) {
    insertBottle.run(medId, userId, volumePerUnit, volumePerUnit, costPerBottle, Math.round(costPerMl * 100) / 100, date);
  }

  // Create stock movement record
  insertMovement.run(medId, userId, numBottles, costPerBottle, totalCost, `Compra ${date.substring(0, 7)} - ${numBottles} un`, date + ' 10:00:00');

  // Update current_stock on medicine
  db.prepare('UPDATE medicines SET current_stock = current_stock + ? WHERE id = ?').run(numBottles * volumePerUnit, medId);

  totalBottles += numBottles;
  console.log(`  ${medName}: ${numBottles} frascos × ${volumePerUnit}ml @ R$${costPerBottle.toFixed(2)}/un (R$${costPerMl.toFixed(2)}/ml)`);
}

console.log(`\nTotal bottles created: ${totalBottles}`);

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
const expensesData = [
  // Feb 2026
  ['2026-02-01', 'Mala',                100,    'equipamento'],
  ['2026-02-01', 'Junta comercial',     196,    'administrativo'],
  // Mar 2026
  ['2026-03-01', 'Laringoscópio',       390,    'equipamento'],
  ['2026-03-01', 'Máscaras',            439,    'material'],
  ['2026-03-01', 'Certificado digital', 199,    'administrativo'],
  ['2026-03-01', 'Contador',            250,    'administrativo'],
  ['2026-03-01', 'Caixas fármacos',     81,     'material'],
  ['2026-03-01', 'Seringas 20ml',       56,     'material'],
  ['2026-03-01', 'Cânula de Klein',     111,    'equipamento'],
  // seguro equipamentos - sem valor na planilha, pulando
];

const insertExpense = db.prepare(`
  INSERT INTO expenses (user_id, date, description, amount, category)
  VALUES (?, ?, ?, ?, ?)
`);

for (const [date, desc, amount, cat] of expensesData) {
  insertExpense.run(userId, date, desc, amount, cat);
}
console.log(`Created ${expensesData.length} expenses`);

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
const stats = db.prepare(`
  SELECT
    COUNT(*) as bottles,
    SUM(purchase_cost) as total_value,
    COUNT(CASE WHEN status='sealed' THEN 1 END) as sealed
  FROM medicine_bottles WHERE user_id = ?
`).get(userId);

const expTotal = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ?').get(userId);

console.log(`\n════════════════════════════════════`);
console.log(`  Estoque da Camila populado!`);
console.log(`  ${stats.bottles} frascos (todos selados)`);
console.log(`  Valor total estoque: R$ ${stats.total_value.toFixed(2)}`);
console.log(`  Despesas registradas: R$ ${expTotal.total.toFixed(2)}`);
console.log(`════════════════════════════════════\n`);

process.exit(0);
