// Convert a dose to milliliters of liquid drawn from a bottle.
//
// This is intentionally conservative: it returns null when there is any ambiguity instead of
// guessing. The caller treats null as "do not auto-decrement" so the user can still register
// the usage manually from /estoque. Wrong auto-decrement is worse than no auto-decrement.

// Parses things like "10 mg/mL", "0.5%", "20 mcg/mL", "100 UI/mL" into mg/mL when possible.
// Returns null when the unit can't be expressed in mg/mL (UI, mg/g, etc.).
function parseConcentrationToMgPerMl(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(value) || value <= 0) return null;
  const unit = (m[2] || '').trim().toLowerCase();
  switch (unit) {
    case 'mg/ml':
      return value;
    case 'mcg/ml':
    case 'µg/ml':
      return value / 1000;
    case '%':
      // 1% w/v = 10 mg/mL (USP convention used in vet anesthesia: lidocaine 2% = 20 mg/mL)
      return value * 10;
    default:
      return null;
  }
}

// Returns ml drawn from a bottle for a given dose, or null if the unit chain can't be resolved.
// infusion_minutes is required for any rate-based unit (mg/kg/h etc.).
function computeMlUsed({ dose, dose_unit, concentration_str, patient_weight, infusion_minutes }) {
  const doseNum = parseFloat(dose);
  if (!isFinite(doseNum) || doseNum <= 0) return null;
  const unit = (dose_unit || '').trim();
  const weight = parseFloat(patient_weight);
  const minutes = parseFloat(infusion_minutes);
  const mgPerMl = parseConcentrationToMgPerMl(concentration_str);

  // Direct volume — concentration is irrelevant.
  if (unit === 'mL') return doseNum;
  if (unit === 'mL/kg') {
    if (!isFinite(weight) || weight <= 0) return null;
    return doseNum * weight;
  }

  // Mass and mass-rate units all need a concentration we can convert to mg/mL.
  if (!isFinite(mgPerMl) || mgPerMl <= 0) return null;

  if (unit === 'mg') return doseNum / mgPerMl;
  if (unit === 'mcg') return (doseNum / 1000) / mgPerMl;

  // Per-kg variants need weight.
  if (!isFinite(weight) || weight <= 0) return null;
  if (unit === 'mg/kg') return (doseNum * weight) / mgPerMl;
  if (unit === 'mcg/kg') return (doseNum * weight / 1000) / mgPerMl;

  // Rate-based variants need infusion duration.
  if (!isFinite(minutes) || minutes <= 0) return null;
  if (unit === 'mg/kg/h') return (doseNum * weight * minutes / 60) / mgPerMl;
  if (unit === 'mg/kg/min') return (doseNum * weight * minutes) / mgPerMl;
  if (unit === 'mcg/kg/h') return (doseNum * weight * minutes / 60 / 1000) / mgPerMl;
  if (unit === 'mcg/kg/min') return (doseNum * weight * minutes / 1000) / mgPerMl;

  return null;
}

module.exports = { computeMlUsed, parseConcentrationToMgPerMl };
