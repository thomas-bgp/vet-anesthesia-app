import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useBlocker } from 'react-router-dom'
import { ArrowLeft, Save, ChevronDown, ChevronUp, Plus, Trash2, X, Wifi, WifiOff, Check, CloudOff, AlertTriangle } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import EmergencyModal from '../components/EmergencyModal'

// --- Auto-save helpers ---
const DRAFT_KEY_PREFIX = 'vetanestesia_draft_'
const DRAFT_LIST_KEY = 'vetanestesia_drafts'

function getDraftKey(id) {
  return `${DRAFT_KEY_PREFIX}${id || 'new'}`
}

function saveDraftToStorage(id, data) {
  try {
    const key = getDraftKey(id)
    const draft = {
      ...data,
      _savedAt: new Date().toISOString(),
      _surgeryId: id || null,
    }
    localStorage.setItem(key, JSON.stringify(draft))
    const list = JSON.parse(localStorage.getItem(DRAFT_LIST_KEY) || '[]')
    const entry = { key, id: id || null, savedAt: draft._savedAt, patientName: data.form?.patient_name || '' }
    const idx = list.findIndex(d => d.key === key)
    if (idx >= 0) list[idx] = entry; else list.push(entry)
    localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list))
  } catch { /* storage full or unavailable */ }
}

function loadDraftFromStorage(id) {
  try {
    const raw = localStorage.getItem(getDraftKey(id))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearDraftFromStorage(id) {
  try {
    const key = getDraftKey(id)
    localStorage.removeItem(key)
    const list = JSON.parse(localStorage.getItem(DRAFT_LIST_KEY) || '[]')
    localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list.filter(d => d.key !== key)))
  } catch { /* storage unavailable */ }
}

// --- Constants ---
const SPECIES = ['Canino', 'Felino', 'Equino', 'Bovino', 'Suíno', 'Silvestre', 'Outro']
const SEX_OPTIONS = ['Macho', 'Fêmea', 'Macho castrado', 'Fêmea castrada']
const ASA_OPTIONS = ['I', 'II', 'III', 'IV', 'V']
const BOLUS_UNITS = ['mg/kg', 'mcg/kg', 'UI/kg', 'mL', 'mL/kg', '+ Nova unidade']
const INFUSION_UNITS = ['mg/kg/h', 'mg/kg/min', 'mcg/kg/h', 'mcg/kg/min', '+ Nova unidade']
const DOSE_UNITS = ['mL', 'mg', 'mg/kg', 'mcg/kg', 'UI'] // legacy fallback
const ROUTES = ['IV', 'IM', 'SC', 'VO', 'Inalatório', 'Epidural', 'Tópico', 'Retal', '+ Nova via']

const CUSTOM_UNITS_KEY = 'anestify_custom_units'
const CUSTOM_ROUTES_KEY = 'anestify_custom_routes'

function loadCustomList(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function saveCustomList(key, list) {
  localStorage.setItem(key, JSON.stringify(list))
}
const PRIOR_MED_ROUTES = ['IV', 'IM', 'SC', 'VO', 'Tópico', 'Outro']
const PHASES = [
  { value: 'mpa', label: 'MPA' },
  { value: 'inducao', label: 'Indução' },
  { value: 'manutencao_inalatoria', label: 'Manutenção - Inalatória' },
  { value: 'manutencao_tiva', label: 'Manutenção - TIVA' },
  { value: 'infusao', label: 'Infusão Contínua' },
  { value: 'bloqueio', label: 'Bloqueio' },
  { value: 'transoperatorio', label: 'Trans-op' },
]

const STANDARD_PARAMS = {
  fc: { label: 'FC', unit: 'bpm', type: 'number' },
  pas: { label: 'PAS', unit: 'mmHg', type: 'number', hasNote: true },
  pam: { label: 'PAM', unit: 'mmHg', type: 'number' },
  pad: { label: 'PAD', unit: 'mmHg', type: 'number' },
  spo2: { label: 'SpO\u2082', unit: '%', type: 'number' },
  fr: { label: 'FR', unit: 'mpm', type: 'number', hasNote: true },
  etco2: { label: 'ETCO\u2082', unit: '%', type: 'number' },
  temperature: { label: 'T\u00b0C', unit: '\u00b0C', type: 'number', hasNote: true },
  fluid_ml_kg_h: { label: 'Fluido', unit: 'ml/kg/h', type: 'number' },
  o2_l_min: { label: 'O\u2082', unit: 'L/min', type: 'number', hasNote: true, noteKey: 'o2' },
  anesthetic: { label: 'Anest.', unit: '', type: 'text', placeholder: 'ISO 1.5%' },
}
const DEFAULT_PARAM_ORDER = Object.keys(STANDARD_PARAMS)

const AIRWAY_TYPES = ['Intubação orotraqueal', 'Máscara', 'Outro']
const BREATHING_MODES = ['Espontânea', 'Assistida', 'Controlada']
const VENTILATION_TYPES = ['VCV', 'PCV', 'SIMV', 'Outro']
const BLOCK_TYPES = ['Regional', 'Infiltrativo', 'Epidural', 'Outro']

const EMPTY = {
  patient_name: '', patient_species: 'Canino', patient_breed: '', patient_weight: '',
  patient_age: '', patient_sex: '', owner_name: '', owner_phone: '',
  procedure_name: '', start_time: '', clinic_name: '', surgeon_name: '',
  pathology: '', asa_classification: '', revenue: '',
  fasting_solid: false, fasting_solid_hours: '', fasting_liquid: false, fasting_liquid_hours: '',
  pre_existing_diseases: '', temperament: '', prior_medications: '', anamnesis_notes: '',
  pre_acp: '', pre_fc: '', pre_fr: '', pre_mucosas: '', pre_tpc: '', pre_temperature: '',
  pre_hydration: '', pre_pas: '', pre_pulse: '', pre_other_alterations: '',
  general_state: '', nutritional_state: '',
  exam_ht: '', exam_hb: '', exam_eritr: '', exam_ppt: '', exam_plaquetas: '', exam_leuc: '',
  exam_creat: '', exam_alt: '', exam_fa: '', exam_ureia: '', exam_alb: '', exam_glic: '',
  exam_segm: '', exam_bast: '', exam_linf: '',
  exam_raiox: '', exam_ultrassom: '', exam_eco_ecg: '', exam_outros: '',
  airway_type: '', airway_other: '', tube_number: '', breathing_mode: '', ventilation_type: '', breathing_system: '', peep: false,
  block_type: '', block_drug: '', block_dose_volume: '',
  anesthesia_start: '', procedure_start: '', procedure_end: '', anesthesia_end: '',
  extubation_time: '',
  post_operative: '', recovery_quality: '', monitoring_notes: '', status: 'scheduled',
  custom_vitals_params: '',
}

// --- Components ---
function Section({ title, open, onToggle, children, badge }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition min-h-[48px]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {badge && <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">{badge}</span>}
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

function Field({ label, children, span2 }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white min-h-[44px]'
const sel = inp

function parseConcentration(str) {
  if (!str) return null
  // Handle percentage: 1% = 10 mg/mL
  const pctMatch = str.match(/([\d.]+)\s*%/)
  if (pctMatch) return parseFloat(pctMatch[1]) * 10
  // Handle mg/mL
  const mgMatch = str.match(/([\d.]+)\s*mg/i)
  if (mgMatch) return parseFloat(mgMatch[1])
  // Handle mcg/mL -> convert to mg/mL
  const mcgMatch = str.match(/([\d.]+)\s*(?:mcg|µg)/i)
  if (mcgMatch) return parseFloat(mcgMatch[1]) / 1000
  return null
}

function calculateVolume({ dose, doseUnit, patientWeight, concentrationMgMl, phase, infusionMinutes }) {
  const doseNum = parseFloat(dose)
  if (!dose || isNaN(doseNum) || doseNum <= 0) return null

  // Direct volume units — no calculation needed
  if (doseUnit === 'mL') return doseNum
  if (doseUnit === 'mL/kg') return patientWeight > 0 ? doseNum * patientWeight : null

  if (!patientWeight || !concentrationMgMl || concentrationMgMl <= 0) return null

  // Infusion or TIVA — rate × time
  if (phase === 'infusao' || phase === 'manutencao_tiva') {
    const mins = parseFloat(infusionMinutes)
    if (!mins || mins <= 0) return 'need_times'
    const durationHours = mins / 60

    let mgKgH
    if (doseUnit === 'mg/kg/h') {
      mgKgH = doseNum
    } else if (doseUnit === 'mg/kg/min') {
      mgKgH = doseNum * 60
    } else if (doseUnit === 'mcg/kg/h') {
      mgKgH = doseNum / 1000
    } else if (doseUnit === 'mcg/kg/min') {
      mgKgH = (doseNum * 60) / 1000
    } else {
      return null
    }
    return (mgKgH * patientWeight * durationHours) / concentrationMgMl
  }

  // Bolus
  let mgKg
  if (doseUnit === 'mg/kg') {
    mgKg = doseNum
  } else if (doseUnit === 'mcg/kg') {
    mgKg = doseNum / 1000
  } else {
    return null
  }
  return (mgKg * patientWeight) / concentrationMgMl
}

function DrugRow({ med, allMedicines, onChange, onRemove, phase, patientWeight, customUnits, customRoutes, onAddUnit, onAddRoute }) {
  const isInfusion = phase === 'infusao' || phase === 'manutencao_tiva'
  const isMaintenance = phase === 'manutencao' || phase === 'manutencao_inalatoria' || phase === 'manutencao_tiva'
  const baseUnits = isInfusion ? INFUSION_UNITS : BOLUS_UNITS
  const unitOptions = [...baseUnits.filter(u => u !== '+ Nova unidade'), ...(customUnits || []), '+ Nova unidade']
  const routeOptions = [...ROUTES.filter(r => r !== '+ Nova via'), ...(customRoutes || []), '+ Nova via']
  const isAE = med.dose_ae === true
  const isAddingUnit = med._addingUnit === true
  const isAddingRoute = med._addingRoute === true
  const selectedMed = med.medicine_id ? allMedicines.find(m => String(m.id) === String(med.medicine_id)) : null
  const presType = selectedMed?.presentation_type

  // Calculate volume
  const concentrationMgMl = selectedMed ? parseConcentration(selectedMed.concentration) : null
  const calculatedVolume = (!isAE && selectedMed && concentrationMgMl && patientWeight > 0)
    ? calculateVolume({
        dose: med.dose,
        doseUnit: med.dose_unit,
        patientWeight,
        concentrationMgMl,
        phase,
        infusionMinutes: med.infusion_minutes,
      })
    : null

  // Store calculated volume in the med object when it changes
  const numericVolume = typeof calculatedVolume === 'number' ? calculatedVolume : null
  const prevVolRef = useRef(med.calculated_volume_ml)
  const medRef = useRef(med)
  medRef.current = med
  useEffect(() => {
    if (numericVolume !== prevVolRef.current) {
      prevVolRef.current = numericVolume
      onChange({ ...medRef.current, calculated_volume_ml: numericVolume })
    }
  }, [numericVolume]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-2 relative">
      <button type="button" onClick={onRemove} className="absolute top-2 right-2 p-1 text-slate-400 active:text-red-500">
        <X size={16} />
      </button>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <select value={med.medicine_id} onChange={e => onChange({ ...med, medicine_id: e.target.value })} className={sel}>
            <option value="">Selecione fármaco...</option>
            {allMedicines.map(m => <option key={m.id} value={m.id}>{m.name} {m.concentration || ''} {m.presentation_type === 'ampola' ? '(amp)' : ''}</option>)}
          </select>
          {selectedMed && presType === 'ampola' && (
            <p className="text-[10px] text-purple-600 font-medium mt-1">Ampola — unidade inteira</p>
          )}
          {!med.medicine_id && (
            <input type="text" value={med.custom_name || ''}
              onChange={e => onChange({ ...med, custom_name: e.target.value })}
              placeholder="Ou digite o nome do fármaco" className={`${inp} mt-2`} />
          )}
        </div>
        <div>
          {isMaintenance && (
            <div className="flex items-center gap-1 mb-1">
              <button type="button"
                onClick={() => onChange({ ...med, dose_ae: !isAE, dose: isAE ? '' : 'AE' })}
                className={`px-2 py-1 text-[10px] font-semibold rounded transition ${isAE ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                AE - ao efeito
              </button>
            </div>
          )}
          {isAE ? (
            <div className={`${inp} flex items-center justify-center text-teal-700 font-semibold bg-teal-50 border-teal-300`}>AE</div>
          ) : (
            <input type="number" step="0.01" inputMode="decimal" placeholder="Dose"
              value={med.dose} onChange={e => onChange({ ...med, dose: e.target.value })} className={inp} />
          )}
        </div>
        <div>
          {isAddingUnit ? (
            <div className="flex gap-1">
              <input type="text" value={med._newUnit || ''} onChange={e => onChange({ ...med, _newUnit: e.target.value })}
                placeholder="Nova unidade..." className={`${inp} flex-1`} autoFocus />
              <button type="button" onClick={() => {
                const u = (med._newUnit || '').trim()
                if (u) { onAddUnit(u); onChange({ ...med, dose_unit: u, _addingUnit: false, _newUnit: '' }) }
              }} className="px-2 py-1 bg-teal-600 text-white text-xs rounded-lg min-h-[40px]">OK</button>
              <button type="button" onClick={() => onChange({ ...med, _addingUnit: false, _newUnit: '' })}
                className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-lg min-h-[40px]"><X size={12} /></button>
            </div>
          ) : (
            <select value={unitOptions.includes(med.dose_unit) ? med.dose_unit : med.dose_unit || unitOptions[0]}
              onChange={e => {
                if (e.target.value === '+ Nova unidade') onChange({ ...med, _addingUnit: true, _newUnit: '' })
                else onChange({ ...med, dose_unit: e.target.value })
              }} className={sel}>
              {!unitOptions.includes(med.dose_unit) && med.dose_unit && <option value={med.dose_unit}>{med.dose_unit}</option>}
              {unitOptions.map(u => <option key={u}>{u}</option>)}
            </select>
          )}
        </div>
        <div>
          {isAddingRoute ? (
            <div className="flex gap-1">
              <input type="text" value={med._newRoute || ''} onChange={e => onChange({ ...med, _newRoute: e.target.value })}
                placeholder="Nova via..." className={`${inp} flex-1`} autoFocus />
              <button type="button" onClick={() => {
                const r = (med._newRoute || '').trim()
                if (r) { onAddRoute(r); onChange({ ...med, route: r, _addingRoute: false, _newRoute: '' }) }
              }} className="px-2 py-1 bg-teal-600 text-white text-xs rounded-lg min-h-[40px]">OK</button>
              <button type="button" onClick={() => onChange({ ...med, _addingRoute: false, _newRoute: '' })}
                className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-lg min-h-[40px]"><X size={12} /></button>
            </div>
          ) : (
            <select value={routeOptions.includes(med.route) ? med.route : med.route || ''}
              onChange={e => {
                if (e.target.value === '+ Nova via') onChange({ ...med, _addingRoute: true, _newRoute: '' })
                else onChange({ ...med, route: e.target.value })
              }} className={sel}>
              <option value="">Via...</option>
              {!routeOptions.includes(med.route) && med.route && <option value={med.route}>{med.route}</option>}
              {routeOptions.map(r => <option key={r}>{r}</option>)}
            </select>
          )}
        </div>
        <div>
          <input type="time" value={med.time} onChange={e => onChange({ ...med, time: e.target.value })} className={inp} />
        </div>
      </div>
      {/* Infusion duration field */}
      {isInfusion && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-500 shrink-0">Tempo infusão</label>
          <input type="number" inputMode="numeric" min="1" step="1" value={med.infusion_minutes || ''}
            onChange={e => onChange({ ...med, infusion_minutes: e.target.value })}
            placeholder="min" className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm text-center min-h-[36px]" />
          <span className="text-[10px] text-slate-400">min</span>
          {med.infusion_minutes && <span className="text-[10px] text-slate-400">({(parseFloat(med.infusion_minutes) / 60).toFixed(1)}h)</span>}
        </div>
      )}
      {/* Calculated volume display */}
      {typeof calculatedVolume === 'number' && (
        <p className="text-[10px] text-teal-600 font-medium">
          Volume: {calculatedVolume.toFixed(2)} mL {isInfusion ? `(${med.infusion_minutes}min)` : ''}
        </p>
      )}
      {calculatedVolume === 'need_times' && (
        <p className="text-[10px] text-amber-600 font-medium">
          Preencha o tempo de infusão para calcular volume
        </p>
      )}
      <div className="flex items-center gap-1 pt-1">
        <button type="button" onClick={() => onChange({ ...med, drug_source: 'proprio' })}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition min-h-[36px] ${med.drug_source === 'proprio' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
          Meu fármaco
        </button>
        <button type="button" onClick={() => onChange({ ...med, drug_source: 'clinica' })}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition min-h-[36px] ${med.drug_source === 'clinica' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
          Da clínica
        </button>
      </div>
    </div>
  )
}

// --- Main Component ---
export default function FichaForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user: authUser } = useAuth()

  // Field visibility from ficha_layout config
  const fv = (sectionKey, fieldKey) => {
    const layout = authUser?.ficha_layout
    if (!layout || !Array.isArray(layout)) return true
    const sec = layout.find(s => s.key === sectionKey)
    if (!sec) return true
    if (sec.visible === false) return false
    if (!sec.fields) return true
    return sec.fields[fieldKey] !== false
  }
  const secVis = (key) => {
    const layout = authUser?.ficha_layout
    if (!layout || !Array.isArray(layout)) return true
    const sec = layout.find(s => s.key === key)
    return sec ? sec.visible !== false : true
  }

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [allMedicines, setAllMedicines] = useState([])

  const [drugs, setDrugs] = useState({ mpa: [], inducao: [], manutencao_inalatoria: [], manutencao_tiva: [], infusao: [], transoperatorio: [], pos_operatorio: [] })
  const [disposables, setDisposables] = useState([])
  const [allDisposables, setAllDisposables] = useState([])
  const [blocks, setBlocks] = useState([])
  const [vitals, setVitals] = useState([])
  const [newVital, setNewVital] = useState({})
  const [customParams, setCustomParams] = useState([])
  const [paramOrder, setParamOrder] = useState([...DEFAULT_PARAM_ORDER])
  const [newParamName, setNewParamName] = useState('')
  const [complications, setComplications] = useState([])
  const [priorMeds, setPriorMeds] = useState([])
  const [customUnits, setCustomUnits] = useState(() => loadCustomList(CUSTOM_UNITS_KEY))
  const [customRoutes, setCustomRoutes] = useState(() => loadCustomList(CUSTOM_ROUTES_KEY))
  const addCustomUnit = (u) => { if (!customUnits.includes(u)) { const next = [...customUnits, u]; setCustomUnits(next); saveCustomList(CUSTOM_UNITS_KEY, next) } }
  const addCustomRoute = (r) => { if (!customRoutes.includes(r)) { const next = [...customRoutes, r]; setCustomRoutes(next); saveCustomList(CUSTOM_ROUTES_KEY, next) } }
  const moveParam = (index, direction) => {
    setParamOrder(prev => {
      const next = [...prev]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [draftData, setDraftData] = useState(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [savingDraft, setSavingDraft] = useState(false)
  const autoSaveTimer = useRef(null)
  const hasUnsavedChanges = useRef(false)
  const initialLoadDone = useRef(false)
  const savingRef = useRef(false)

  const [showEmergency, setShowEmergency] = useState(false)

  const [sections, setSections] = useState({
    paciente: true, anamnese: false, exame: false, exames_comp: false,
    protocolo: true, vias_aereas: false, bloqueios: false,
    transoperatorio: false, pos_operatorio: false, observacoes: false,
  })

  const toggle = (key) => setSections(s => ({ ...s, [key]: !s[key] }))
  const handle = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    hasUnsavedChanges.current = true
  }

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  const formRef = useRef(form)
  const drugsRef = useRef(drugs)
  const blocksRef = useRef(blocks)
  const vitalsRef = useRef(vitals)
  const complicationsRef = useRef(complications)
  const sectionsRef = useRef(sections)
  const disposablesRef = useRef(disposables)
  const customParamsRef = useRef(customParams)
  const paramOrderRef = useRef(paramOrder)
  const priorMedsRef = useRef(priorMeds)

  useEffect(() => { formRef.current = form }, [form])
  useEffect(() => { drugsRef.current = drugs }, [drugs])
  useEffect(() => { blocksRef.current = blocks }, [blocks])
  useEffect(() => { vitalsRef.current = vitals }, [vitals])
  useEffect(() => { complicationsRef.current = complications }, [complications])
  useEffect(() => { sectionsRef.current = sections }, [sections])
  useEffect(() => { disposablesRef.current = disposables }, [disposables])
  useEffect(() => { customParamsRef.current = customParams }, [customParams])
  useEffect(() => { paramOrderRef.current = paramOrder }, [paramOrder])
  useEffect(() => { priorMedsRef.current = priorMeds }, [priorMeds])

  const doAutoSave = useCallback(() => {
    if (!initialLoadDone.current) return
    const data = {
      form: formRef.current, drugs: drugsRef.current, blocks: blocksRef.current,
      vitals: vitalsRef.current, complications: complicationsRef.current,
      sections: sectionsRef.current, disposables: disposablesRef.current,
      customParams: customParamsRef.current, paramOrder: paramOrderRef.current,
      priorMeds: priorMedsRef.current,
    }
    saveDraftToStorage(id, data)
    setAutoSaveStatus('saved')
    setTimeout(() => setAutoSaveStatus(null), 3000)
  }, [id])

  useEffect(() => {
    if (!initialLoadDone.current) return
    hasUnsavedChanges.current = true
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(doAutoSave, 2000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [form, drugs, blocks, vitals, complications, disposables, customParams, paramOrder, priorMeds, doAutoSave])

  useEffect(() => {
    const draft = loadDraftFromStorage(id)
    if (draft && !isEdit) {
      const hasContent = draft.form?.patient_name || draft.form?.procedure_name
      if (hasContent) { setDraftData(draft); setShowDraftBanner(true); return }
    }
    if (draft && isEdit) {
      const serverLoadTime = new Date().toISOString()
      if (draft._savedAt > serverLoadTime) { setDraftData(draft); setShowDraftBanner(true); return }
    }
  }, [])

  const restoreDraft = () => {
    if (draftData) {
      if (draftData.form) setForm(draftData.form)
      if (draftData.drugs) setDrugs(draftData.drugs)
      if (draftData.blocks) setBlocks(draftData.blocks)
      if (draftData.vitals) setVitals(draftData.vitals)
      if (draftData.complications) setComplications(draftData.complications)
      if (draftData.sections) setSections(draftData.sections)
      if (draftData.disposables) setDisposables(draftData.disposables)
      if (draftData.customParams) setCustomParams(draftData.customParams)
      if (draftData.paramOrder) setParamOrder(draftData.paramOrder)
      if (draftData.priorMeds) setPriorMeds(draftData.priorMeds)
    }
    setShowDraftBanner(false); initialLoadDone.current = true
  }

  const discardDraft = () => {
    clearDraftFromStorage(id); setShowDraftBanner(false); setDraftData(null); initialLoadDone.current = true
  }

  useEffect(() => {
    const handler = (e) => { if (hasUnsavedChanges.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => hasUnsavedChanges.current && currentLocation.pathname !== nextLocation.pathname
  )

  const saveDraftToServer = async () => {
    if (savingRef.current) return
    setSavingDraft(true); savingRef.current = true; setError('')
    try {
      const payload = {
        ...form,
        patient_weight: form.patient_weight !== '' ? Number(form.patient_weight) : null,
        fasting_solid_hours: form.fasting_solid_hours !== '' ? Number(form.fasting_solid_hours) : null,
        fasting_liquid_hours: form.fasting_liquid_hours !== '' ? Number(form.fasting_liquid_hours) : null,
        fasting_solid: form.fasting_solid ? 1 : 0, fasting_liquid: form.fasting_liquid ? 1 : 0,
        peep: form.peep ? 1 : 0, revenue: form.revenue !== '' ? Number(form.revenue) : 0,
        pre_fc: form.pre_fc !== '' ? Number(form.pre_fc) : null, pre_fr: form.pre_fr !== '' ? Number(form.pre_fr) : null,
        pre_temperature: form.pre_temperature !== '' ? Number(form.pre_temperature) : null,
        pre_pas: form.pre_pas !== '' ? Number(form.pre_pas) : null,
        block_type: blocks.length > 0 ? JSON.stringify(blocks) : '', block_drug: '', block_dose_volume: '',
        complications: complications.filter(c => c.text.trim()).length > 0 ? JSON.stringify(complications.filter(c => c.text.trim())) : null,
        custom_vitals_params: (customParams.length > 0 || paramOrder.join(',') !== DEFAULT_PARAM_ORDER.join(',')) ? JSON.stringify({ params: customParams, order: paramOrder }) : null,
        prior_medications: priorMeds.filter(pm => pm.name.trim()).length > 0 ? JSON.stringify(priorMeds.filter(pm => pm.name.trim())) : null,
        status: 'scheduled',
      }
      let surgeryId = id
      if (isEdit) { await api.put(`/surgeries/${id}`, payload) }
      else {
        if (!payload.patient_name) payload.patient_name = 'Rascunho'
        if (!payload.procedure_name) payload.procedure_name = 'A definir'
        const res = await api.post('/surgeries', payload); surgeryId = res.data.surgery.id
      }
      clearDraftFromStorage(id); hasUnsavedChanges.current = false; setAutoSaveStatus('saved')
      if (!isEdit) navigate(`/fichas/${surgeryId}/edit`, { replace: true })
    } catch (err) {
      if (!navigator.onLine) { setError('Sem conexão. Dados salvos localmente no celular.'); doAutoSave() }
      else setError(err.response?.data?.error || 'Erro ao salvar rascunho.')
    } finally { setSavingDraft(false); savingRef.current = false }
  }

  useEffect(() => {
    api.get('/medicines?limit=999').then(res => {
      const meds = res.data?.medicines || res.data || []
      setAllMedicines(meds.filter(m => (m.medicine_type || 'farmaco') === 'farmaco'))
      setAllDisposables(meds.filter(m => m.medicine_type === 'descartavel'))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) {
      const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      setForm(f => ({ ...f, start_time: now.toISOString().slice(0, 16) })); initialLoadDone.current = true; return
    }
    api.get(`/surgeries/${id}`)
      .then(res => {
        const s = res.data.surgery || res.data
        const f = { ...EMPTY }
        for (const key of Object.keys(f)) {
          if (s[key] !== undefined && s[key] !== null) {
            if (key === 'fasting_solid' || key === 'fasting_liquid' || key === 'peep') f[key] = Boolean(s[key])
            else f[key] = s[key]
          }
        }
        if (f.start_time) f.start_time = f.start_time.slice(0, 16)
        if (f.anesthesia_start) f.anesthesia_start = f.anesthesia_start.slice(0, 16)
        if (f.procedure_start) f.procedure_start = f.procedure_start.slice(0, 16)
        if (f.procedure_end) f.procedure_end = f.procedure_end.slice(0, 16)
        if (f.anesthesia_end) f.anesthesia_end = f.anesthesia_end.slice(0, 16)
        if (f.extubation_time) f.extubation_time = f.extubation_time.slice(0, 16)
        setForm(f)

        if (f.block_type) {
          try {
            const parsed = JSON.parse(f.block_type)
            if (Array.isArray(parsed)) {
              setBlocks(parsed.map(blk => {
                if (blk.drugs && Array.isArray(blk.drugs)) return blk
                return { type: blk.type || '', other_type: blk.other_type || '',
                  drugs: blk.drug ? [{ name: blk.drug, dose_volume: blk.dose_volume || '' }] : [{ name: '', dose_volume: '' }] }
              }))
            }
          } catch {
            if (f.block_type) setBlocks([{ type: f.block_type, other_type: '', drugs: [{ name: f.block_drug || '', dose_volume: f.block_dose_volume || '' }] }])
          }
        }

        if (s.complications) {
          try { const parsed = JSON.parse(s.complications); setComplications(Array.isArray(parsed) ? parsed : [{ time: '', text: s.complications }]) }
          catch { setComplications([{ time: '', text: s.complications }]) }
        }

        // Load prior medications (structured JSON or legacy text)
        if (f.prior_medications) {
          try {
            const parsed = JSON.parse(f.prior_medications)
            if (Array.isArray(parsed)) setPriorMeds(parsed)
            else setPriorMeds([])
          } catch {
            // Legacy: plain text → single entry with text as name
            setPriorMeds(f.prior_medications.trim() ? [{ name: f.prior_medications, dose: '', route: '', time: '' }] : [])
          }
          f.prior_medications = '' // clear from form, managed by priorMeds state
        }

        setVitals((res.data.vitals || []).map(v => ({ ...v, fromServer: true })))

        if (s.custom_vitals_params) {
          try {
            const parsed = JSON.parse(s.custom_vitals_params)
            if (Array.isArray(parsed)) {
              // Legacy format: just an array of custom params
              setCustomParams(parsed)
              setParamOrder([...DEFAULT_PARAM_ORDER, ...parsed.map(p => p.key)])
            } else if (parsed && typeof parsed === 'object') {
              // New format: { params: [...], order: [...] }
              if (Array.isArray(parsed.params)) setCustomParams(parsed.params)
              if (Array.isArray(parsed.order)) setParamOrder(parsed.order)
            }
          } catch {}
        }

        if (res.data.disposables) {
          setDisposables(res.data.disposables.map(d => ({ id: d.id, medicine_id: String(d.medicine_id), quantity: String(d.quantity || 1), existing: true })))
        }

        const meds = res.data.medicines || []
        const grouped = { mpa: [], inducao: [], manutencao_inalatoria: [], manutencao_tiva: [], manutencao: [], infusao: [], transoperatorio: [], pos_operatorio: [] }
        meds.forEach(m => {
          const phase = m.phase || 'mpa'
          const key = grouped[phase] !== undefined ? phase : 'mpa'
          const isAE = m.dose_unit === 'AE' || String(m.dose || '') === 'AE'
          grouped[key].push({
            id: m.id, medicine_id: String(m.medicine_id || ''), custom_name: m.custom_name || '',
            dose: isAE ? 'AE' : String(m.dose || ''), dose_ae: isAE,
            dose_unit: m.dose_unit || 'mg/kg', custom_unit: m.custom_unit || '',
            route: m.route || '', custom_route: m.custom_route || '',
            time: m.administered_at ? m.administered_at.slice(11, 16) : '',
            drug_source: m.drug_source || 'proprio', original_drug_source: m.drug_source || 'proprio', existing: true,
          })
        })
        setDrugs(grouped)
      })
      .catch(() => setError('Erro ao carregar ficha.'))
      .finally(() => { setLoading(false); initialLoadDone.current = true })
  }, [id, isEdit])

  const currentTimeHHMM = () => new Date().toTimeString().slice(0, 5)

  const addVital = () => {
    const { vital_time, ...vitalData } = newVital
    const hasData = Object.values(vitalData).some(v => v !== undefined && v !== null && String(v).trim() !== '')
    if (!hasData) return
    const today = new Date().toISOString().slice(0, 10)
    const timeStr = vital_time || currentTimeHHMM()
    const recorded_at = `${today}T${timeStr}:00`
    setVitals(v => [...v, { ...vitalData, id: Date.now(), recorded_at }])
    setNewVital({}); hasUnsavedChanges.current = true
  }

  const removeVital = (idx) => { setVitals(v => v.filter((_, i) => i !== idx)); hasUnsavedChanges.current = true }
  const updateVital = (idx, key, value) => { setVitals(v => v.map((item, i) => i === idx ? { ...item, [key]: value, edited: true } : item)); hasUnsavedChanges.current = true }

  const addDrug = (phase) => {
    const defaultUnit = (phase === 'infusao' || phase === 'manutencao_tiva') ? 'mg/kg/min' : 'mg/kg'
    setDrugs(d => ({
      ...d, [phase]: [...(d[phase] || []), { medicine_id: '', custom_name: '', dose: '', dose_ae: false, dose_unit: defaultUnit, custom_unit: '', route: '', custom_route: '', time: '', drug_source: 'proprio' }]
    })); hasUnsavedChanges.current = true
  }

  const updateDrug = (phase, index, med) => { setDrugs(d => ({ ...d, [phase]: d[phase].map((m, i) => i === index ? med : m) })); hasUnsavedChanges.current = true }
  const removeDrug = (phase, index) => { setDrugs(d => ({ ...d, [phase]: d[phase].filter((_, i) => i !== index) })); hasUnsavedChanges.current = true }

  const submit = async (e) => {
    e.preventDefault()
    if (savingRef.current) return
    setError('')
    if (!form.patient_name || !form.procedure_name) { setError('Preencha pelo menos o nome do paciente e o procedimento.'); window.scrollTo(0, 0); return }
    setSaving(true); savingRef.current = true
    try {
      const payload = {
        ...form,
        patient_weight: form.patient_weight !== '' ? Number(form.patient_weight) : null,
        fasting_solid_hours: form.fasting_solid_hours !== '' ? Number(form.fasting_solid_hours) : null,
        fasting_liquid_hours: form.fasting_liquid_hours !== '' ? Number(form.fasting_liquid_hours) : null,
        fasting_solid: form.fasting_solid ? 1 : 0, fasting_liquid: form.fasting_liquid ? 1 : 0,
        peep: form.peep ? 1 : 0, revenue: form.revenue !== '' ? Number(form.revenue) : 0,
        pre_fc: form.pre_fc !== '' ? Number(form.pre_fc) : null, pre_fr: form.pre_fr !== '' ? Number(form.pre_fr) : null,
        pre_temperature: form.pre_temperature !== '' ? Number(form.pre_temperature) : null,
        pre_pas: form.pre_pas !== '' ? Number(form.pre_pas) : null,
        block_type: blocks.length > 0 ? JSON.stringify(blocks) : '', block_drug: '', block_dose_volume: '',
        complications: complications.filter(c => c.text.trim()).length > 0 ? JSON.stringify(complications.filter(c => c.text.trim())) : null,
        custom_vitals_params: (customParams.length > 0 || paramOrder.join(',') !== DEFAULT_PARAM_ORDER.join(',')) ? JSON.stringify({ params: customParams, order: paramOrder }) : null,
        prior_medications: priorMeds.filter(pm => pm.name.trim()).length > 0 ? JSON.stringify(priorMeds.filter(pm => pm.name.trim())) : null,
      }

      let surgeryId = id
      if (isEdit) await api.put(`/surgeries/${id}`, payload)
      else { const res = await api.post('/surgeries', payload); surgeryId = res.data.surgery.id }

      for (const vital of vitals) {
        if (vital.fromServer && !vital.edited) continue
        // If edited from server, delete old and recreate
        if (vital.fromServer && vital.edited) {
          try { await api.delete(`/surgeries/${surgeryId}/vitals/${vital.id}`) } catch {}
        }
        await api.post(`/surgeries/${surgeryId}/vitals`, {
          recorded_at: vital.recorded_at, fc: vital.fc || null, fr: vital.fr || null,
          spo2: vital.spo2 || null, etco2: vital.etco2 || null,
          pas: vital.pas || null, pam: vital.pam || null, pad: vital.pad || null,
          temperature: vital.temperature || null, fluid_ml_kg_h: vital.fluid_ml_kg_h || null,
          anesthetic: vital.anesthetic || null, o2_l_min: vital.o2_l_min || null,
          notes: vital.notes || null, custom_params: vital.custom_params || null, param_notes: vital.param_notes || null,
        })
      }

      const allDrugs = [
        ...drugs.mpa.map(d => ({ ...d, phase: 'mpa' })),
        ...drugs.inducao.map(d => ({ ...d, phase: 'inducao' })),
        ...(drugs.manutencao_inalatoria || []).map(d => ({ ...d, phase: 'manutencao_inalatoria' })),
        ...(drugs.manutencao_tiva || []).map(d => ({ ...d, phase: 'manutencao_tiva' })),
        ...(drugs.manutencao || []).map(d => ({ ...d, phase: 'manutencao' })),
        ...(drugs.infusao || []).map(d => ({ ...d, phase: 'infusao' })),
        ...(drugs.transoperatorio || []).map(d => ({ ...d, phase: 'transoperatorio' })),
        ...(drugs.pos_operatorio || []).map(d => ({ ...d, phase: 'pos_operatorio' })),
      ]

      for (const drug of allDrugs) {
        // Update existing drugs that changed drug_source
        if (drug.existing && drug.id && drug.drug_source !== drug.original_drug_source) {
          await api.put(`/surgeries/${surgeryId}/medicines/${drug.id}`, { drug_source: drug.drug_source })
          continue
        }
        if (drug.existing) continue
        const hasMed = drug.medicine_id
        const hasCustom = !drug.medicine_id && drug.custom_name
        if (!hasMed && !hasCustom) continue
        const isAE = drug.dose_ae === true
        if (!isAE && !drug.dose) continue
        const adminAt = drug.time ? `${form.start_time?.slice(0, 10) || new Date().toISOString().slice(0, 10)}T${drug.time}` : null
        const resolvedUnit = drug.dose_unit === 'Outro' && drug.custom_unit ? drug.custom_unit : drug.dose_unit
        const resolvedRoute = drug.route === 'Outro' && drug.custom_route ? drug.custom_route : drug.route
        await api.post(`/surgeries/${surgeryId}/medicines`, {
          medicine_id: hasMed ? Number(drug.medicine_id) : null, custom_name: hasCustom ? drug.custom_name : null,
          dose: isAE ? 0 : Number(drug.dose), dose_unit: isAE ? 'AE' : resolvedUnit,
          route: resolvedRoute || null, administered_at: adminAt, drug_source: drug.drug_source, phase: drug.phase,
          calculated_volume_ml: drug.calculated_volume_ml || null,
        })
      }

      for (const disp of disposables) {
        if (disp.existing) continue
        if (!disp.medicine_id) continue
        await api.post(`/surgeries/${surgeryId}/disposables`, { medicine_id: Number(disp.medicine_id), quantity: Number(disp.quantity) || 1 })
      }

      clearDraftFromStorage(id); hasUnsavedChanges.current = false
      navigate(`/fichas/${surgeryId}`)
    } catch (err) {
      if (!navigator.onLine) { doAutoSave(); setError('Sem conexão. Dados salvos localmente. Tente novamente quando tiver internet.') }
      else setError(err.response?.data?.error || 'Erro ao salvar ficha.')
      window.scrollTo(0, 0)
    } finally { setSaving(false); savingRef.current = false }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
    </div>
  )

  return (
    <form onSubmit={submit} className="pb-6">
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-slate-800">Sair sem salvar?</h3>
            <p className="text-sm text-slate-600">Você tem alterações não salvas no servidor. Os dados estão seguros no armazenamento local do celular.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => blocker.reset()} className="flex-1 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 min-h-[44px]">Continuar editando</button>
              <button type="button" onClick={() => blocker.proceed()} className="flex-1 py-2.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-xl active:bg-slate-300 min-h-[44px]">Sair</button>
            </div>
          </div>
        </div>
      )}

      {showEmergency && (
        <EmergencyModal surgery={{ patient_name: form.patient_name || 'Paciente', patient_weight: form.patient_weight, patient_species: form.patient_species }} onClose={() => setShowEmergency(false)} />
      )}

      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg active:bg-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <h1 className="text-base font-bold text-slate-800">{isEdit ? 'Editar Ficha' : 'Nova Ficha'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] shrink-0">
              {!isOnline && <span className="flex items-center gap-1 text-amber-600 font-medium"><WifiOff size={12} /> Offline</span>}
              {autoSaveStatus === 'saved' && isOnline && <span className="flex items-center gap-1 text-green-600"><Check size={12} /> Salvo local</span>}
              {autoSaveStatus === 'saved' && !isOnline && <span className="flex items-center gap-1 text-amber-600"><CloudOff size={12} /> Salvo local</span>}
            </div>
            <button type="button" onClick={() => setShowEmergency(true)}
              className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg active:bg-red-700 min-h-[40px] shadow-sm" title="Drogas de emergência">
              <AlertTriangle size={14} /><span>SOS</span>
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 transition min-h-[44px]">
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save size={16} />Salvar</>}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">

        {showDraftBanner && draftData && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
            <p className="text-sm font-medium text-amber-800">Rascunho encontrado{draftData.form?.patient_name ? ` — ${draftData.form.patient_name}` : ''}</p>
            <p className="text-xs text-amber-600">Salvo em {new Date(draftData._savedAt).toLocaleString('pt-BR')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={restoreDraft} className="flex-1 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg active:bg-amber-700 min-h-[40px]">Restaurar rascunho</button>
              <button type="button" onClick={discardDraft} className="flex-1 py-2 bg-white border border-amber-300 text-amber-700 text-xs font-medium rounded-lg active:bg-amber-50 min-h-[40px]">Descartar</button>
            </div>
          </div>
        )}

        {!isOnline && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
            <WifiOff size={16} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">Sem conexão. Seus dados estão sendo salvos localmente no celular.</p>
          </div>
        )}

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {secVis('paciente') && <Section title="Dados do Paciente" open={sections.paciente} onToggle={() => toggle('paciente')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do paciente *" span2><input name="patient_name" value={form.patient_name} onChange={handle} className={inp} placeholder="Rex" /></Field>
            {fv('paciente','patient_species') && <Field label="Espécie"><select name="patient_species" value={form.patient_species} onChange={handle} className={sel}>{SPECIES.map(s => <option key={s}>{s}</option>)}</select></Field>}
            {fv('paciente','patient_weight') && <Field label="Peso (kg)"><input type="number" step="0.1" inputMode="decimal" name="patient_weight" value={form.patient_weight} onChange={handle} className={inp} placeholder="15.5" /></Field>}
            {fv('paciente','patient_species') && <Field label="Raça"><input name="patient_breed" value={form.patient_breed} onChange={handle} className={inp} placeholder="Golden" /></Field>}
            {fv('paciente','patient_sex') && <Field label="Sexo"><select name="patient_sex" value={form.patient_sex} onChange={handle} className={sel}><option value="">-</option>{SEX_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></Field>}
            {fv('paciente','patient_age') && <Field label="Idade"><input name="patient_age" value={form.patient_age} onChange={handle} className={inp} placeholder="3 anos" /></Field>}
            {fv('paciente','owner_name') && <Field label="Tutor"><input name="owner_name" value={form.owner_name} onChange={handle} className={inp} placeholder="João Silva" /></Field>}
            {fv('paciente','owner_phone') && <Field label="Telefone tutor"><input name="owner_phone" value={form.owner_phone} onChange={handle} className={inp} placeholder="(11) 99999-9999" /></Field>}
            <Field label="Data"><input type="datetime-local" name="start_time" value={form.start_time} onChange={handle} className={inp} /></Field>
            {fv('paciente','clinic_name') && <Field label="Clínica/Hospital" span2><input name="clinic_name" value={form.clinic_name} onChange={handle} className={inp} placeholder="Clínica Exemplo" /></Field>}
            {fv('paciente','pathology') && <Field label="Patologia base" span2><input name="pathology" value={form.pathology} onChange={handle} className={inp} placeholder="Ex: Piometra" /></Field>}
            <Field label="Procedimento proposto *" span2><input name="procedure_name" value={form.procedure_name} onChange={handle} className={inp} placeholder="Ovariohisterectomia" /></Field>
            {fv('paciente','surgeon_name') && <Field label="Cirurgião" span2><input name="surgeon_name" value={form.surgeon_name} onChange={handle} className={inp} placeholder="Dra. Ana Lima" /></Field>}
            {fv('paciente','asa_classification') && <Field label="ASA">
              <div className="flex gap-1">
                {ASA_OPTIONS.map(a => (
                  <button key={a} type="button" onClick={() => setForm(f => ({ ...f, asa_classification: `ASA ${a}` }))}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg min-h-[44px] transition ${form.asa_classification === `ASA ${a}` ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}>{a}</button>
                ))}
              </div>
            </Field>}
            {fv('paciente','revenue') && <Field label="Valor cobrado (R$)" span2>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <input type="number" step="0.01" min="0" inputMode="decimal" name="revenue" value={form.revenue} onChange={handle} className={`${inp} pl-10`} placeholder="0,00" />
              </div>
            </Field>}
          </div>
        </Section>}

        {secVis('anamnese') && <Section title="Anamnese" open={sections.anamnese} onToggle={() => toggle('anamnese')}>
          <div className="space-y-3">
            {fv('anamnese','fasting') && <>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" name="fasting_solid" checked={form.fasting_solid} onChange={handle} className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-slate-700">Jejum sólido</span></label>
                {form.fasting_solid && <div className="flex items-center gap-1"><input type="number" inputMode="decimal" name="fasting_solid_hours" value={form.fasting_solid_hours} onChange={handle} className={`${inp} w-20`} placeholder="0" /><span className="text-sm text-slate-500 font-medium">h</span></div>}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" name="fasting_liquid" checked={form.fasting_liquid} onChange={handle} className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-slate-700">Jejum hídrico</span></label>
                {form.fasting_liquid && <div className="flex items-center gap-1"><input type="number" inputMode="decimal" name="fasting_liquid_hours" value={form.fasting_liquid_hours} onChange={handle} className={`${inp} w-20`} placeholder="0" /><span className="text-sm text-slate-500 font-medium">h</span></div>}
              </div>
            </>}
            {fv('anamnese','pre_existing_diseases') && <Field label="Doenças pré-existentes" span2><textarea name="pre_existing_diseases" value={form.pre_existing_diseases} onChange={handle} rows={2} className={inp} /></Field>}
            {fv('anamnese','temperament') && <Field label="Temperamento"><input name="temperament" value={form.temperament} onChange={handle} className={inp} placeholder="Dócil" /></Field>}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Medicações prévias</label>
                <button type="button" onClick={() => { setPriorMeds(p => [...p, { name: '', dose: '', route: '', time: '' }]); hasUnsavedChanges.current = true }}
                  className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
              </div>
              {priorMeds.length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma medicação prévia.</p>}
              {priorMeds.map((pm, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-2 space-y-2 relative">
                  <button type="button" onClick={() => { setPriorMeds(p => p.filter((_, idx) => idx !== i)); hasUnsavedChanges.current = true }} className="absolute top-1 right-1 p-1 text-slate-400 active:text-red-500"><X size={14} /></button>
                  <div className="grid grid-cols-2 gap-2 pr-6">
                    <input type="text" value={pm.name} onChange={e => { setPriorMeds(p => p.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item)); hasUnsavedChanges.current = true }} placeholder="Fármaco" className={inp} />
                    <input type="text" value={pm.dose} onChange={e => { setPriorMeds(p => p.map((item, idx) => idx === i ? { ...item, dose: e.target.value } : item)); hasUnsavedChanges.current = true }} placeholder="Dose" className={inp} />
                    <select value={pm.route} onChange={e => { setPriorMeds(p => p.map((item, idx) => idx === i ? { ...item, route: e.target.value } : item)); hasUnsavedChanges.current = true }} className={sel}>
                      <option value="">Via...</option>
                      {PRIOR_MED_ROUTES.map(r => <option key={r}>{r}</option>)}
                    </select>
                    <input type="time" value={pm.time} onChange={e => { setPriorMeds(p => p.map((item, idx) => idx === i ? { ...item, time: e.target.value } : item)); hasUnsavedChanges.current = true }} className={inp} />
                  </div>
                </div>
              ))}
            </div>
            {fv('anamnese','anamnesis_notes') && <Field label="Observações" span2><textarea name="anamnesis_notes" value={form.anamnesis_notes} onChange={handle} rows={2} className={inp} /></Field>}
          </div>
        </Section>}

        {secVis('exame_pre') && <Section title="Exame Pré-Anestésico" open={sections.exame} onToggle={() => toggle('exame')}>
          <div className="grid grid-cols-2 gap-3">
            {fv('exame_pre','pre_acp') && <Field label="ACP" span2><input name="pre_acp" value={form.pre_acp} onChange={handle} className={inp} /></Field>}
            {fv('exame_pre','pre_fc') && <Field label="FC (bpm)"><input type="number" inputMode="numeric" name="pre_fc" value={form.pre_fc} onChange={handle} className={inp} /></Field>}
            {fv('exame_pre','pre_fr') && <Field label="FR (mpm)"><input type="number" inputMode="numeric" name="pre_fr" value={form.pre_fr} onChange={handle} className={inp} /></Field>}
            {fv('exame_pre','pre_mucosas') && <Field label="Mucosas"><input name="pre_mucosas" value={form.pre_mucosas} onChange={handle} className={inp} placeholder="Rosadas" /></Field>}
            {fv('exame_pre','pre_tpc') && <Field label="TPC (seg)"><input name="pre_tpc" value={form.pre_tpc} onChange={handle} className={inp} placeholder="< 2s" /></Field>}
            {fv('exame_pre','pre_temperature') && <Field label="T°C"><input type="number" step="0.1" inputMode="decimal" name="pre_temperature" value={form.pre_temperature} onChange={handle} className={inp} placeholder="38.5" /></Field>}
            {fv('exame_pre','pre_hydration') && <Field label="Hidratação"><input name="pre_hydration" value={form.pre_hydration} onChange={handle} className={inp} placeholder="Normal" /></Field>}
            {fv('exame_pre','pre_pas') && <Field label="PAS (mmHg)"><input type="number" inputMode="numeric" name="pre_pas" value={form.pre_pas} onChange={handle} className={inp} /></Field>}
            {fv('exame_pre','pre_pulse') && <Field label="Pulso"><input name="pre_pulse" value={form.pre_pulse} onChange={handle} className={inp} placeholder="Forte" /></Field>}
            {fv('exame_pre','general_state') && <Field label="Estado geral"><input name="general_state" value={form.general_state} onChange={handle} className={inp} placeholder="Bom" /></Field>}
            {fv('exame_pre','nutritional_state') && <Field label="Estado nutricional"><input name="nutritional_state" value={form.nutritional_state} onChange={handle} className={inp} placeholder="Normal" /></Field>}
            {fv('exame_pre','pre_other_alterations') && <Field label="Outras alterações" span2><input name="pre_other_alterations" value={form.pre_other_alterations} onChange={handle} className={inp} /></Field>}
          </div>
        </Section>}

        {secVis('exames_comp') && <Section title="Exames Complementares" open={sections.exames_comp} onToggle={() => toggle('exames_comp')}>
          <div className="grid grid-cols-3 gap-2">
            {fv('exames_comp','hemograma') && [['Ht%','exam_ht'],['Hb','exam_hb'],['Eritr','exam_eritr'],['PPT','exam_ppt'],['Plaquetas','exam_plaquetas'],['Leuc','exam_leuc']].map(([label,name]) => (
              <Field key={name} label={label}><input name={name} value={form[name]} onChange={handle} className={inp} /></Field>
            ))}
            {fv('exames_comp','hemograma_diff') && [['N.Segm','exam_segm'],['N.Bast','exam_bast'],['Linfócitos','exam_linf']].map(([label,name]) => (
              <Field key={name} label={label}><input name={name} value={form[name]} onChange={handle} className={inp} /></Field>
            ))}
            {fv('exames_comp','bioquimica') && [['Creat','exam_creat'],['ALT','exam_alt'],['FA','exam_fa'],['Ureia','exam_ureia'],['Alb','exam_alb'],['Glic','exam_glic']].map(([label,name]) => (
              <Field key={name} label={label}><input name={name} value={form[name]} onChange={handle} className={inp} /></Field>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            {fv('exames_comp','imagem') && <>
              <Field label="Raio-X"><textarea name="exam_raiox" value={form.exam_raiox} onChange={handle} rows={2} className={inp} /></Field>
              <Field label="Ultrassom"><textarea name="exam_ultrassom" value={form.exam_ultrassom} onChange={handle} rows={2} className={inp} /></Field>
              <Field label="Eco/ECG" span2><textarea name="exam_eco_ecg" value={form.exam_eco_ecg} onChange={handle} rows={2} className={inp} /></Field>
            </>}
            {fv('exames_comp','exam_outros') && <Field label="Outros exames" span2><textarea name="exam_outros" value={form.exam_outros} onChange={handle} rows={2} className={inp} /></Field>}
          </div>
        </Section>}

        {secVis('farmacos') && <Section title="Protocolo Anestésico" open={sections.protocolo} onToggle={() => toggle('protocolo')}
          badge={drugs.mpa.length + drugs.inducao.length + (drugs.manutencao_inalatoria || []).length + (drugs.manutencao_tiva || []).length + (drugs.manutencao || []).length + (drugs.infusao || []).length + (drugs.transoperatorio || []).length || null}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Medicação Pré-Anestésica (MPA)</p>
              <button type="button" onClick={() => addDrug('mpa')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {drugs.mpa.map((med, i) => <DrugRow key={i} med={med} allMedicines={allMedicines} phase="mpa" onChange={(m) => updateDrug('mpa', i, m)} onRemove={() => removeDrug('mpa', i)} patientWeight={parseFloat(form.patient_weight) || 0} customUnits={customUnits} customRoutes={customRoutes} onAddUnit={addCustomUnit} onAddRoute={addCustomRoute} />)}
          </div>
          <div className="border-t border-slate-100 my-2" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Indução</p>
              <button type="button" onClick={() => addDrug('inducao')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {drugs.inducao.map((med, i) => <DrugRow key={i} med={med} allMedicines={allMedicines} phase="inducao" onChange={(m) => updateDrug('inducao', i, m)} onRemove={() => removeDrug('inducao', i)} patientWeight={parseFloat(form.patient_weight) || 0} customUnits={customUnits} customRoutes={customRoutes} onAddUnit={addCustomUnit} onAddRoute={addCustomRoute} />)}
          </div>
          <div className="border-t border-slate-100 my-2" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Manutenção — Inalatória</p>
              <button type="button" onClick={() => addDrug('manutencao_inalatoria')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {(drugs.manutencao_inalatoria || []).map((med, i) => <DrugRow key={i} med={med} allMedicines={allMedicines} phase="manutencao_inalatoria" onChange={(m) => updateDrug('manutencao_inalatoria', i, m)} onRemove={() => removeDrug('manutencao_inalatoria', i)} patientWeight={parseFloat(form.patient_weight) || 0} customUnits={customUnits} customRoutes={customRoutes} onAddUnit={addCustomUnit} onAddRoute={addCustomRoute} />)}
          </div>
          <div className="border-t border-slate-100 my-2" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Manutenção — TIVA</p>
              <button type="button" onClick={() => addDrug('manutencao_tiva')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {(drugs.manutencao_tiva || []).map((med, i) => <DrugRow key={i} med={med} allMedicines={allMedicines} phase="manutencao_tiva" onChange={(m) => updateDrug('manutencao_tiva', i, m)} onRemove={() => removeDrug('manutencao_tiva', i)} patientWeight={parseFloat(form.patient_weight) || 0} customUnits={customUnits} customRoutes={customRoutes} onAddUnit={addCustomUnit} onAddRoute={addCustomRoute} />)}
          </div>
          <div className="border-t border-slate-100 my-2" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Infusões Contínuas</p>
              <button type="button" onClick={() => addDrug('infusao')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {(drugs.infusao || []).map((med, i) => <DrugRow key={i} med={med} allMedicines={allMedicines} phase="infusao" onChange={(m) => updateDrug('infusao', i, m)} onRemove={() => removeDrug('infusao', i)} patientWeight={parseFloat(form.patient_weight) || 0} customUnits={customUnits} customRoutes={customRoutes} onAddUnit={addCustomUnit} onAddRoute={addCustomRoute} />)}
          </div>
        </Section>}

        {secVis('vias_aereas') && <Section title="Vias Aéreas" open={sections.vias_aereas} onToggle={() => toggle('vias_aereas')}>
          <div className="grid grid-cols-2 gap-3">
            {fv('vias_aereas','airway_type') && <Field label="Tipo" span2>
              <div className="flex gap-1 flex-wrap">
                {AIRWAY_TYPES.map(t => <button key={t} type="button" onClick={() => setForm(f => ({ ...f, airway_type: t }))}
                  className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] transition ${form.airway_type === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}>{t}</button>)}
              </div>
            </Field>}
            {fv('vias_aereas','airway_type') && form.airway_type === 'Outro' && <Field label="Descrever via aérea" span2><input name="airway_other" value={form.airway_other} onChange={handle} className={inp} placeholder="Ex: Traqueostomia, supraglótico..." /></Field>}
            {fv('vias_aereas','tube_number') && <Field label="Tubo nº/tipo"><input name="tube_number" value={form.tube_number} onChange={handle} className={inp} placeholder="7.5" /></Field>}
            {fv('vias_aereas','breathing_mode') && <Field label="Respiração">
              <div className="flex gap-1 flex-wrap">
                {BREATHING_MODES.map(m => {
                  const modes = (form.breathing_mode || '').split(',').map(s => s.trim()).filter(Boolean)
                  const isActive = modes.includes(m)
                  return <button key={m} type="button" onClick={() => {
                    const next = isActive ? modes.filter(x => x !== m) : [...modes, m]
                    setForm(f => ({ ...f, breathing_mode: next.join(', ') }))
                  }} className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] transition ${isActive ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}>{m}</button>
                })}
              </div>
            </Field>}
            {fv('vias_aereas','ventilation_type') && (form.breathing_mode || '').includes('Controlada') && (
              <Field label="Tipo de ventilação" span2>
                <div className="flex gap-1 flex-wrap">
                  {VENTILATION_TYPES.map(t => <button key={t} type="button" onClick={() => setForm(f => ({ ...f, ventilation_type: t }))}
                    className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] transition ${form.ventilation_type === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}>{t}</button>)}
                </div>
              </Field>
            )}
            {fv('vias_aereas','breathing_system') && <Field label="Sistema" span2><input name="breathing_system" value={form.breathing_system} onChange={handle} className={inp} placeholder="Ex: Circular" /></Field>}
            {fv('vias_aereas','peep') && <label className="flex items-center gap-2 min-h-[44px] col-span-2">
              <input type="checkbox" name="peep" checked={form.peep} onChange={handle} className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-sm text-slate-700">PEEP</span>
            </label>}
          </div>
        </Section>}

        {secVis('bloqueios') && <Section title="Bloqueios" open={sections.bloqueios} onToggle={() => toggle('bloqueios')} badge={blocks.length || null}>
          <div className="space-y-3">
            {blocks.map((blk, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2 relative">
                <button type="button" onClick={() => setBlocks(b => b.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 p-1 text-slate-400 active:text-red-500"><X size={16} /></button>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                  <div className="flex gap-1 flex-wrap">
                    {BLOCK_TYPES.map(t => <button key={t} type="button" onClick={() => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, type: t } : item))}
                      className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] transition ${blk.type === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}>{t}</button>)}
                  </div>
                </div>
                {blk.type === 'Outro' && (
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Descrever tipo</label>
                    <input type="text" value={blk.other_type || ''} onChange={e => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, other_type: e.target.value } : item))} className={inp} placeholder="Ex: TAP block, RUMM..." /></div>
                )}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-500">Fármacos</label>
                  {(blk.drugs || []).map((drug, di) => (
                    <div key={di} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input type="text" value={drug.name || ''} onChange={e => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, drugs: item.drugs.map((d, dIdx) => dIdx === di ? { ...d, name: e.target.value } : d) } : item))} className={`${inp} flex-1`} placeholder="Fármaco" />
                        <input type="text" value={drug.dose_volume || ''} onChange={e => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, drugs: item.drugs.map((d, dIdx) => dIdx === di ? { ...d, dose_volume: e.target.value } : d) } : item))} className={`${inp} flex-1`} placeholder="Dose/volume" />
                        {(blk.drugs || []).length > 1 && <button type="button" onClick={() => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, drugs: item.drugs.filter((_, dIdx) => dIdx !== di) } : item))} className="p-1 text-slate-400 active:text-red-500 shrink-0"><X size={14} /></button>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, drugs: item.drugs.map((d, dIdx) => dIdx === di ? { ...d, drug_source: 'proprio' } : d) } : item))}
                          className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition min-h-[32px] ${(drug.drug_source || 'proprio') === 'proprio' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          Meu fármaco
                        </button>
                        <button type="button" onClick={() => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, drugs: item.drugs.map((d, dIdx) => dIdx === di ? { ...d, drug_source: 'clinica' } : d) } : item))}
                          className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition min-h-[32px] ${drug.drug_source === 'clinica' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          Da clínica
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, drugs: [...(item.drugs || []), { name: '', dose_volume: '', drug_source: 'proprio' }] } : item))}
                    className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar fármaco</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setBlocks(b => [...b, { type: '', other_type: '', drugs: [{ name: '', dose_volume: '' }] }])}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-teal-400 text-teal-600 text-xs font-medium rounded-lg active:bg-teal-50 min-h-[44px]"><Plus size={14} /> Adicionar bloqueio</button>
          </div>
        </Section>}

        <Section title="Transoperatório" open={sections.transoperatorio} onToggle={() => toggle('transoperatorio')} badge={vitals.length || null}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {fv('tempos','anesthesia_start') && <Field label="Início anestesia"><input type="time" value={(form.anesthesia_start || '').slice(11, 16)} onChange={e => { const date = (form.start_time || new Date().toISOString()).slice(0, 10); setForm(f => ({ ...f, anesthesia_start: date + 'T' + e.target.value })); hasUnsavedChanges.current = true }} className={inp} /></Field>}
            {fv('tempos','procedure_start') && <Field label="Início procedimento"><input type="time" value={(form.procedure_start || '').slice(11, 16)} onChange={e => { const date = (form.start_time || new Date().toISOString()).slice(0, 10); setForm(f => ({ ...f, procedure_start: date + 'T' + e.target.value })); hasUnsavedChanges.current = true }} className={inp} /></Field>}
          </div>

          <div className="space-y-2 mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">Monitoração</p>
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {paramOrder.map((key) => {
                  const std = STANDARD_PARAMS[key]
                  if (std) {
                    const noteKey = std.noteKey || key
                    const notePlaceholder = key === 'fr' ? 'Ex: VA' : key === 'temperature' ? 'Ex: esofágica' : key === 'o2_l_min' ? 'Ex: MF' : 'Obs'
                    return (
                      <div key={key}><label className="block text-[10px] font-medium text-slate-500 mb-0.5">{std.label}</label>
                        {std.type === 'number' ? (
                          <input type="number" inputMode="decimal" step="any" value={newVital[key] || ''} onChange={e => setNewVital(v => ({ ...v, [key]: e.target.value }))} placeholder={std.unit} className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]" />
                        ) : (
                          <input type="text" value={newVital[key] || ''} onChange={e => setNewVital(v => ({ ...v, [key]: e.target.value }))} placeholder={std.placeholder || std.unit} className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]" />
                        )}
                        {std.hasNote && <input type="text" value={(newVital.param_notes || {})[noteKey] || ''} onChange={e => setNewVital(v => ({ ...v, param_notes: { ...(v.param_notes || {}), [noteKey]: e.target.value } }))} placeholder={notePlaceholder} className="w-full px-2 py-1 border border-slate-100 rounded text-[10px] text-slate-500 mt-0.5" />}
                      </div>
                    )
                  }
                  const cp = customParams.find(p => p.key === key)
                  if (cp) {
                    return (
                      <div key={key}><label className="block text-[10px] font-medium text-slate-500 mb-0.5">{cp.label}</label>
                        <input type="text" value={(newVital.custom_params || {})[cp.key] || ''} onChange={e => setNewVital(v => ({ ...v, custom_params: { ...(v.custom_params || {}), [cp.key]: e.target.value } }))} placeholder={cp.label} className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]" /></div>
                    )
                  }
                  return null
                })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="text" value={newParamName} onChange={e => setNewParamName(e.target.value)} placeholder="Novo parâmetro..." className="flex-1 px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]" />
                <button type="button" onClick={() => { if (!newParamName.trim()) return; const newKey = `custom_${Date.now()}`; setCustomParams(p => [...p, { key: newKey, label: newParamName.trim() }]); setParamOrder(o => [...o, newKey]); setNewParamName('') }}
                  className="flex items-center gap-1 px-3 py-2 bg-teal-50 text-teal-700 text-xs font-medium rounded-lg active:bg-teal-100 min-h-[40px] shrink-0"><Plus size={14} /> Parâmetro</button>
              </div>
              {paramOrder.length > 1 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {paramOrder.map((key, idx) => {
                    const std = STANDARD_PARAMS[key]
                    const cp = customParams.find(p => p.key === key)
                    const label = std ? std.label : cp ? cp.label : key
                    const isCustom = !std && !!cp
                    return (
                      <span key={key} className={`inline-flex items-center gap-0.5 px-2 py-1 ${isCustom ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'} text-[10px] rounded-full font-medium`}>
                        <button type="button" onClick={() => moveParam(idx, -1)} disabled={idx === 0} className={`p-0 ${idx === 0 ? 'text-slate-200' : 'text-slate-500 active:text-slate-700'}`}><ChevronUp size={10} /></button>
                        <button type="button" onClick={() => moveParam(idx, 1)} disabled={idx === paramOrder.length - 1} className={`p-0 ${idx === paramOrder.length - 1 ? 'text-slate-200' : 'text-slate-500 active:text-slate-700'}`}><ChevronDown size={10} /></button>
                        {label}
                        {isCustom && <button type="button" onClick={() => { setCustomParams(p => p.filter(pp => pp.key !== key)); setParamOrder(o => o.filter(k => k !== key)) }} className="text-teal-400 hover:text-red-500"><X size={10} /></button>}
                      </span>
                    )
                  })}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[10px] font-medium text-slate-500 whitespace-nowrap">Horário</label>
                <input type="time" value={newVital.vital_time !== undefined ? newVital.vital_time : currentTimeHHMM()} onChange={e => setNewVital(v => ({ ...v, vital_time: e.target.value }))} className="px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px] flex-1" />
              </div>
              <button type="button" onClick={addVital} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-teal-600 text-white text-xs font-medium rounded-lg active:bg-teal-700 min-h-[40px]"><Plus size={14} /> Registrar momento</button>
            </div>

            {vitals.length > 0 && (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="text-[11px] min-w-[760px] w-full">
                  <thead><tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 font-semibold text-slate-500">Hora</th>
                    {paramOrder.map(key => {
                      const std = STANDARD_PARAMS[key]
                      const cp = customParams.find(p => p.key === key)
                      const label = std ? std.label : cp ? cp.label : key
                      return <th key={key} className="text-center py-1.5 font-semibold text-slate-500">{label}</th>
                    })}
                    <th className="w-6"></th>
                  </tr></thead>
                  <tbody>{vitals.map((v, i) => (
                    <tr key={v.id || i} className={`border-b border-slate-50 ${v.edited ? 'bg-amber-50' : ''}`}>
                      <td className="py-1 font-mono text-slate-600">
                        <input type="time" value={v.recorded_at ? String(v.recorded_at).slice(11, 16) : ''} onChange={e => { const date = (form.start_time || new Date().toISOString()).slice(0, 10); updateVital(i, 'recorded_at', date + 'T' + e.target.value + ':00') }} className="w-[70px] px-1 py-1 border border-transparent focus:border-slate-300 rounded text-[11px] bg-transparent" />
                      </td>
                      {paramOrder.map(key => {
                        const std = STANDARD_PARAMS[key]
                        if (std) {
                          const noteKey = std.noteKey || key
                          let pn = v.param_notes; if (typeof pn === 'string') { try { pn = JSON.parse(pn) } catch { pn = {} } }
                          const noteVal = std.hasNote ? ((pn || {})[noteKey] || '') : ''
                          return (
                            <td key={key} className="py-1 text-center">
                              {std.type === 'number' ? (
                                <input type="number" step="any" inputMode="decimal" value={v[key] ?? ''} onChange={e => updateVital(i, key, e.target.value)} className="w-full px-1 py-1 border border-transparent focus:border-slate-300 rounded text-[11px] text-center bg-transparent" />
                              ) : (
                                <input type="text" value={v[key] ?? ''} onChange={e => updateVital(i, key, e.target.value)} className="w-full px-1 py-1 border border-transparent focus:border-slate-300 rounded text-[11px] text-center bg-transparent" />
                              )}
                              {std.hasNote && noteVal && <div className="text-[8px] text-teal-600 leading-tight">{noteVal}</div>}
                            </td>
                          )
                        }
                        const cp = customParams.find(p => p.key === key)
                        if (cp) {
                          let cpData = v.custom_params; if (typeof cpData === 'string') { try { cpData = JSON.parse(cpData) } catch { cpData = {} } }
                          return (
                            <td key={key} className="py-1 text-center">
                              <input type="text" value={(cpData || {})[cp.key] || ''} onChange={e => { const newCp = { ...(typeof v.custom_params === 'string' ? JSON.parse(v.custom_params || '{}') : (v.custom_params || {})), [cp.key]: e.target.value }; updateVital(i, 'custom_params', newCp) }} className="w-full px-1 py-1 border border-transparent focus:border-slate-300 rounded text-[11px] text-center bg-transparent" />
                            </td>
                          )
                        }
                        return null
                      })}
                      <td><button type="button" onClick={() => removeVital(i)} className="p-1 text-slate-400 active:text-red-500"><X size={12} /></button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Intercorrências / Anotações</p>
              <button type="button" onClick={() => setComplications(c => [...c, { time: currentTimeHHMM(), text: '' }])} className="flex items-center gap-1 text-xs text-orange-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {complications.length === 0 && <p className="text-xs text-slate-400 italic py-1">Nenhuma intercorrência registrada.</p>}
            {complications.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-2">
                <input type="time" value={entry.time} onChange={e => setComplications(c => c.map((item, idx) => idx === i ? { ...item, time: e.target.value } : item))} className="px-2 py-1.5 border border-orange-200 rounded text-sm min-h-[40px] w-[100px] shrink-0 bg-white" />
                <input type="text" value={entry.text} onChange={e => setComplications(c => c.map((item, idx) => idx === i ? { ...item, text: e.target.value } : item))} placeholder="Ex: Bradicardia, administrado atropina..." className="flex-1 px-2 py-1.5 border border-orange-200 rounded text-sm min-h-[40px] bg-white" />
                <button type="button" onClick={() => setComplications(c => c.filter((_, idx) => idx !== i))} className="p-1.5 text-orange-400 active:text-red-600 min-h-[40px] min-w-[36px] flex items-center justify-center"><X size={14} /></button>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Fármacos Trans-operatório</p>
              <button type="button" onClick={() => addDrug('transoperatorio')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {(drugs.transoperatorio || []).map((med, i) => <DrugRow key={i} med={med} allMedicines={allMedicines} phase="transoperatorio" onChange={(m) => updateDrug('transoperatorio', i, m)} onRemove={() => removeDrug('transoperatorio', i)} patientWeight={parseFloat(form.patient_weight) || 0} customUnits={customUnits} customRoutes={customRoutes} onAddUnit={addCustomUnit} onAddRoute={addCustomRoute} />)}
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Descartáveis Utilizados</p>
              <button type="button" onClick={() => setDisposables(d => [...d, { medicine_id: '', quantity: '1' }])} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {disposables.length === 0 && <p className="text-xs text-slate-400 italic py-1">Nenhum descartável registrado.</p>}
            {disposables.map((disp, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2 relative">
                <button type="button" onClick={() => setDisposables(d => d.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 p-1 text-slate-400 active:text-red-500"><X size={16} /></button>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2"><select value={disp.medicine_id} onChange={e => setDisposables(d => d.map((item, idx) => idx === i ? { ...item, medicine_id: e.target.value } : item))} className={sel} disabled={disp.existing}><option value="">Selecione descartável...</option>{allDisposables.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                  <div><input type="number" min="1" step="1" value={disp.quantity} onChange={e => setDisposables(d => d.map((item, idx) => idx === i ? { ...item, quantity: e.target.value } : item))} placeholder="Qtd" className={inp} disabled={disp.existing} /></div>
                </div>
                {disp.existing && <p className="text-[10px] text-slate-400 italic">Já salvo</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {fv('tempos','procedure_end') && <Field label="Final procedimento"><input type="time" value={(form.procedure_end || '').slice(11, 16)} onChange={e => { const date = (form.start_time || new Date().toISOString()).slice(0, 10); setForm(f => ({ ...f, procedure_end: date + 'T' + e.target.value })); hasUnsavedChanges.current = true }} className={inp} /></Field>}
            {fv('tempos','anesthesia_end') && <Field label="Final anestesia"><input type="time" value={(form.anesthesia_end || '').slice(11, 16)} onChange={e => { const date = (form.start_time || new Date().toISOString()).slice(0, 10); setForm(f => ({ ...f, anesthesia_end: date + 'T' + e.target.value })); hasUnsavedChanges.current = true }} className={inp} /></Field>}
            {fv('tempos','extubation_time') && <Field label="Extubação"><input type="time" value={(form.extubation_time || '').slice(11, 16)} onChange={e => { const date = (form.start_time || new Date().toISOString()).slice(0, 10); setForm(f => ({ ...f, extubation_time: date + 'T' + e.target.value })); hasUnsavedChanges.current = true }} className={inp} /></Field>}
          </div>
        </Section>

        {secVis('pos_operatorio') && <Section title="Pós-operatório" open={sections.pos_operatorio} onToggle={() => toggle('pos_operatorio')} badge={(drugs.pos_operatorio || []).length || null}>
          {fv('pos_operatorio','post_operative') && <Field label="Pós-operatório"><textarea name="post_operative" value={form.post_operative} onChange={handle} rows={4} className={inp} /></Field>}
          {fv('pos_operatorio','recovery_quality') && <Field label="Qualidade da recuperação"><textarea name="recovery_quality" value={form.recovery_quality} onChange={handle} rows={2} className={inp} placeholder="Ex: Recuperação suave, sem excitação..." /></Field>}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Fármacos Pós-operatório</p>
              <button type="button" onClick={() => addDrug('pos_operatorio')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2"><Plus size={14} /> Adicionar</button>
            </div>
            {(drugs.pos_operatorio || []).map((med, i) => <DrugRow key={i} med={med} allMedicines={allMedicines} phase="pos_operatorio" onChange={(m) => updateDrug('pos_operatorio', i, m)} onRemove={() => removeDrug('pos_operatorio', i)} patientWeight={parseFloat(form.patient_weight) || 0} customUnits={customUnits} customRoutes={customRoutes} onAddUnit={addCustomUnit} onAddRoute={addCustomRoute} />)}
          </div>
        </Section>}

        {secVis('observacoes') && <Section title="Observações" open={sections.observacoes} onToggle={() => toggle('observacoes')}>
          <Field label="Observações gerais"><textarea name="monitoring_notes" value={form.monitoring_notes} onChange={handle} rows={4} className={inp} /></Field>
        </Section>}

        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-600 text-white font-medium rounded-xl active:bg-teal-700 transition min-h-[52px] text-sm">
          {saving ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save size={18} />Salvar Ficha</>}
        </button>
      </div>
    </form>
  )
}
