// Shared concentration units — persisted in localStorage
const DEFAULT_CONC_UNITS = ['mg/mL', 'mcg/mL', 'UI/mL', 'mg/g', 'mL', 'mL/kg', '%']
const CONC_UNITS_KEY = 'anestify_conc_units'

function loadCustomConcUnits() {
  try { return JSON.parse(localStorage.getItem(CONC_UNITS_KEY) || '[]') } catch { return [] }
}

function saveCustomConcUnits(list) {
  localStorage.setItem(CONC_UNITS_KEY, JSON.stringify(list))
}

export function getConcUnits() {
  return [...DEFAULT_CONC_UNITS, ...loadCustomConcUnits()]
}

export function addConcUnit(unit) {
  const trimmed = unit.trim()
  if (!trimmed) return false
  const all = getConcUnits()
  if (all.includes(trimmed)) return false
  const custom = loadCustomConcUnits()
  custom.push(trimmed)
  saveCustomConcUnits(custom)
  return true
}

export function parseConc(str) {
  if (!str) return { value: '', unit: 'mg/mL' }
  const m = str.match(/^([\d.,]+)\s*(.+)$/)
  if (m) {
    const all = getConcUnits()
    return { value: m[1], unit: all.includes(m[2]) ? m[2] : m[2] }
  }
  return { value: '', unit: 'mg/mL' }
}

export function buildConc(value, unit) {
  if (!value) return null
  return `${value} ${unit || ''}`.trim()
}
