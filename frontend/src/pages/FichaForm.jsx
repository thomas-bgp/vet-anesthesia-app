import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import api from '../api/axios'

// --- Constants ---
const SPECIES = ['Canino', 'Felino', 'Equino', 'Bovino', 'Suíno', 'Silvestre', 'Outro']
const SEX_OPTIONS = ['Macho', 'Fêmea', 'Macho castrado', 'Fêmea castrada']
const ASA_OPTIONS = ['I', 'II', 'III', 'IV', 'V']
const DOSE_UNITS = ['mL', 'mg', 'mg/kg', 'mcg/kg', 'UI']
const ROUTES = ['IV', 'IM', 'SC', 'VO', 'Inalatório', 'Epidural', 'Tópico', 'Retal']
const PHASES = [
  { value: 'mpa', label: 'MPA' },
  { value: 'inducao', label: 'Indução' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'bloqueio', label: 'Bloqueio' },
  { value: 'transoperatorio', label: 'Trans-op' },
]

const AIRWAY_TYPES = ['Intubação orotraqueal', 'Máscara', 'Outro']
const BREATHING_MODES = ['Espontânea', 'Assistida', 'Controlada']
const BLOCK_TYPES = ['Regional', 'Infiltrativo', 'Epidural', 'Outro']

const EMPTY = {
  patient_name: '', patient_species: 'Canino', patient_breed: '', patient_weight: '',
  patient_age: '', patient_sex: '', owner_name: '', owner_phone: '',
  procedure_name: '', start_time: '', clinic_name: '', surgeon_name: '',
  pathology: '', asa_classification: '',
  fasting_solid: false, fasting_solid_hours: '', fasting_liquid: false, fasting_liquid_hours: '',
  pre_existing_diseases: '', temperament: '', prior_medications: '', anamnesis_notes: '',
  pre_acp: '', pre_fc: '', pre_fr: '', pre_mucosas: '', pre_tpc: '', pre_temperature: '',
  pre_hydration: '', pre_pas: '', pre_pulse: '', pre_other_alterations: '',
  general_state: '', nutritional_state: '',
  exam_ht: '', exam_hb: '', exam_eritr: '', exam_ppt: '', exam_plaquetas: '', exam_leuc: '',
  exam_creat: '', exam_alt: '', exam_fa: '', exam_ureia: '', exam_alb: '', exam_glic: '',
  exam_raiox: '', exam_ultrassom: '', exam_eco_ecg: '', exam_outros: '',
  airway_type: '', tube_number: '', breathing_mode: '', breathing_system: '', peep: false,
  block_type: '', block_drug: '', block_dose_volume: '',
  anesthesia_start: '', procedure_start: '', procedure_end: '', anesthesia_end: '',
  extubation_time: '',
  post_operative: '', monitoring_notes: '', status: 'scheduled',
}

// --- Components ---
function Section({ title, open, onToggle, children, badge }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition min-h-[48px]"
      >
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

function DrugRow({ med, allMedicines, onChange, onRemove }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-2 relative">
      <button type="button" onClick={onRemove} className="absolute top-2 right-2 p-1 text-slate-400 active:text-red-500">
        <X size={16} />
      </button>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <select value={med.medicine_id} onChange={e => onChange({ ...med, medicine_id: e.target.value })} className={sel}>
            <option value="">Selecione fármaco...</option>
            {allMedicines.map(m => <option key={m.id} value={m.id}>{m.name} {m.concentration || ''}</option>)}
          </select>
          {!med.medicine_id && (
            <input
              type="text"
              value={med.custom_name || ''}
              onChange={e => onChange({ ...med, custom_name: e.target.value })}
              placeholder="Ou digite o nome do fármaco"
              className={`${inp} mt-2`}
            />
          )}
        </div>
        <div>
          <input type="number" step="0.01" inputMode="decimal" placeholder="Dose"
            value={med.dose} onChange={e => onChange({ ...med, dose: e.target.value })} className={inp} />
        </div>
        <div>
          <select value={med.dose_unit} onChange={e => onChange({ ...med, dose_unit: e.target.value })} className={sel}>
            {DOSE_UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <select value={med.route} onChange={e => onChange({ ...med, route: e.target.value })} className={sel}>
            <option value="">Via...</option>
            {ROUTES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <input type="time" value={med.time} onChange={e => onChange({ ...med, time: e.target.value })} className={inp} />
        </div>
      </div>
      {/* Own vs Clinic toggle */}
      <div className="flex items-center gap-1 pt-1">
        <button
          type="button"
          onClick={() => onChange({ ...med, drug_source: 'proprio' })}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition min-h-[36px] ${
            med.drug_source === 'proprio' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
          }`}
        >
          Meu fármaco
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...med, drug_source: 'clinica' })}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition min-h-[36px] ${
            med.drug_source === 'clinica' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'
          }`}
        >
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

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [allMedicines, setAllMedicines] = useState([])

  // Drug lists per phase
  const [drugs, setDrugs] = useState({ mpa: [], inducao: [], manutencao: [], transoperatorio: [] })

  // Blocks (multiple)
  const [blocks, setBlocks] = useState([])

  // Vitals (transoperative monitoring)
  const [vitals, setVitals] = useState([])
  const [newVital, setNewVital] = useState({})

  // Intercorrências (intraoperative events)
  const [complications, setComplications] = useState([])

  // Section open/close state
  const [sections, setSections] = useState({
    paciente: true, anamnese: false, exame: false, exames_comp: false,
    protocolo: true, vias_aereas: false, bloqueios: false,
    transoperatorio: false, pos_operatorio: false, observacoes: false,
  })

  const toggle = (key) => setSections(s => ({ ...s, [key]: !s[key] }))
  const handle = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  useEffect(() => {
    api.get('/medicines').then(res => setAllMedicines(res.data?.medicines || res.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) {
      // Set default start_time to now
      const now = new Date()
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      setForm(f => ({ ...f, start_time: now.toISOString().slice(0, 16) }))
      return
    }
    api.get(`/surgeries/${id}`)
      .then(res => {
        const s = res.data.surgery || res.data
        const f = { ...EMPTY }
        for (const key of Object.keys(f)) {
          if (s[key] !== undefined && s[key] !== null) {
            if (key === 'fasting_solid' || key === 'fasting_liquid' || key === 'peep') {
              f[key] = Boolean(s[key])
            } else {
              f[key] = s[key]
            }
          }
        }
        if (f.start_time) f.start_time = f.start_time.slice(0, 16)
        if (f.anesthesia_start) f.anesthesia_start = f.anesthesia_start.slice(0, 16)
        if (f.procedure_start) f.procedure_start = f.procedure_start.slice(0, 16)
        if (f.procedure_end) f.procedure_end = f.procedure_end.slice(0, 16)
        if (f.anesthesia_end) f.anesthesia_end = f.anesthesia_end.slice(0, 16)
        if (f.extubation_time) f.extubation_time = f.extubation_time.slice(0, 16)
        setForm(f)

        // Load existing blocks from block_type JSON
        if (f.block_type) {
          try {
            const parsed = JSON.parse(f.block_type)
            if (Array.isArray(parsed)) setBlocks(parsed)
          } catch {
            // Legacy single block stored as plain text — migrate to array
            if (f.block_type) {
              setBlocks([{ type: f.block_type, other_type: '', drug: f.block_drug || '', dose_volume: f.block_dose_volume || '' }])
            }
          }
        }

        // Load existing complications
        if (s.complications) {
          try {
            const parsed = JSON.parse(s.complications)
            setComplications(Array.isArray(parsed) ? parsed : [{ time: '', text: s.complications }])
          } catch {
            setComplications([{ time: '', text: s.complications }])
          }
        }

        // Load existing vitals
        setVitals((res.data.vitals || []).map(v => ({ ...v, fromServer: true })))

        // Load existing medicines grouped by phase
        const meds = res.data.medicines || []
        const grouped = { mpa: [], inducao: [], manutencao: [], transoperatorio: [] }
        meds.forEach(m => {
          const phase = m.phase || 'mpa'
          const key = grouped[phase] !== undefined ? phase : 'mpa'
          grouped[key].push({
            id: m.id,
            medicine_id: String(m.medicine_id),
            dose: String(m.dose || ''),
            dose_unit: m.dose_unit || 'mL',
            route: m.route || '',
            time: m.administered_at ? m.administered_at.slice(11, 16) : '',
            drug_source: m.drug_source || 'proprio',
            existing: true,
          })
        })
        setDrugs(grouped)
      })
      .catch(() => setError('Erro ao carregar ficha.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const currentTimeHHMM = () => {
    const now = new Date()
    return now.toTimeString().slice(0, 5)
  }

  const addVital = () => {
    const { vital_time, ...vitalData } = newVital
    if (!Object.values(vitalData).some(v => v)) return
    const today = new Date().toISOString().slice(0, 10)
    const timeStr = vital_time || currentTimeHHMM()
    const recorded_at = `${today}T${timeStr}:00`
    setVitals(v => [...v, { ...vitalData, id: Date.now(), recorded_at }])
    setNewVital({})
  }

  const removeVital = (idx) => {
    setVitals(v => v.filter((_, i) => i !== idx))
  }

  const addDrug = (phase) => {
    setDrugs(d => ({
      ...d,
      [phase]: [...d[phase], { medicine_id: '', dose: '', dose_unit: 'mL', route: '', time: '', drug_source: 'proprio' }]
    }))
  }

  const updateDrug = (phase, index, med) => {
    setDrugs(d => ({ ...d, [phase]: d[phase].map((m, i) => i === index ? med : m) }))
  }

  const removeDrug = (phase, index) => {
    setDrugs(d => ({ ...d, [phase]: d[phase].filter((_, i) => i !== index) }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.patient_name || !form.procedure_name) {
      setError('Preencha pelo menos o nome do paciente e o procedimento.')
      window.scrollTo(0, 0)
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        patient_weight: form.patient_weight !== '' ? Number(form.patient_weight) : null,
        fasting_solid_hours: form.fasting_solid_hours !== '' ? Number(form.fasting_solid_hours) : null,
        fasting_liquid_hours: form.fasting_liquid_hours !== '' ? Number(form.fasting_liquid_hours) : null,
        fasting_solid: form.fasting_solid ? 1 : 0,
        fasting_liquid: form.fasting_liquid ? 1 : 0,
        peep: form.peep ? 1 : 0,
        pre_fc: form.pre_fc !== '' ? Number(form.pre_fc) : null,
        pre_fr: form.pre_fr !== '' ? Number(form.pre_fr) : null,
        pre_temperature: form.pre_temperature !== '' ? Number(form.pre_temperature) : null,
        pre_pas: form.pre_pas !== '' ? Number(form.pre_pas) : null,
        block_type: blocks.length > 0 ? JSON.stringify(blocks) : '',
        block_drug: '',
        block_dose_volume: '',
        complications: complications.filter(c => c.text.trim()).length > 0
          ? JSON.stringify(complications.filter(c => c.text.trim()))
          : null,
      }

      let surgeryId = id
      if (isEdit) {
        await api.put(`/surgeries/${id}`, payload)
      } else {
        const res = await api.post('/surgeries', payload)
        surgeryId = res.data.surgery.id
      }

      // Save vitals - for new entries (no existing id from server)
      for (const vital of vitals) {
        if (vital.fromServer) continue
        await api.post(`/surgeries/${surgeryId}/vitals`, {
          recorded_at: vital.recorded_at,
          fc: vital.fc || null, fr: vital.fr || null,
          spo2: vital.spo2 || null, etco2: vital.etco2 || null,
          pas: vital.pas || null, pam: vital.pam || null, pad: vital.pad || null,
          temperature: vital.temperature || null,
          fluid_ml_kg_h: vital.fluid_ml_kg_h || null,
          anesthetic: vital.anesthetic || null,
          o2_l_min: vital.o2_l_min || null,
          notes: vital.notes || null,
        })
      }

      // Save drugs - for new surgeries or new drugs in edit mode
      const allDrugs = [
        ...drugs.mpa.map(d => ({ ...d, phase: 'mpa' })),
        ...drugs.inducao.map(d => ({ ...d, phase: 'inducao' })),
        ...drugs.manutencao.map(d => ({ ...d, phase: 'manutencao' })),
        ...(drugs.transoperatorio || []).map(d => ({ ...d, phase: 'transoperatorio' })),
      ]

      for (const drug of allDrugs) {
        if (drug.existing) continue
        const hasMed = drug.medicine_id
        const hasCustom = !drug.medicine_id && drug.custom_name
        if (!hasMed && !hasCustom) continue
        if (!drug.dose) continue
        const adminAt = drug.time
          ? `${form.start_time?.slice(0, 10) || new Date().toISOString().slice(0, 10)}T${drug.time}`
          : null
        await api.post(`/surgeries/${surgeryId}/medicines`, {
          medicine_id: hasMed ? Number(drug.medicine_id) : null,
          custom_name: hasCustom ? drug.custom_name : null,
          dose: Number(drug.dose),
          dose_unit: drug.dose_unit,
          route: drug.route || null,
          administered_at: adminAt,
          drug_source: drug.drug_source,
          phase: drug.phase,
        })
      }

      navigate(`/fichas/${surgeryId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar ficha.')
      window.scrollTo(0, 0)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
    </div>
  )

  return (
    <form onSubmit={submit} className="pb-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg active:bg-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h1 className="text-base font-bold text-slate-800">{isEdit ? 'Editar Ficha' : 'Nova Ficha'}</h1>
        </div>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 transition min-h-[44px]">
          {saving
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <><Save size={16} />Salvar</>}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {/* === DADOS DO PACIENTE === */}
        <Section title="Dados do Paciente" open={sections.paciente} onToggle={() => toggle('paciente')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do paciente *" span2>
              <input name="patient_name" value={form.patient_name} onChange={handle} className={inp} placeholder="Rex" />
            </Field>
            <Field label="Espécie">
              <select name="patient_species" value={form.patient_species} onChange={handle} className={sel}>
                {SPECIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Peso (kg)">
              <input type="number" step="0.1" inputMode="decimal" name="patient_weight" value={form.patient_weight} onChange={handle} className={inp} placeholder="15.5" />
            </Field>
            <Field label="Raça">
              <input name="patient_breed" value={form.patient_breed} onChange={handle} className={inp} placeholder="Golden" />
            </Field>
            <Field label="Sexo">
              <select name="patient_sex" value={form.patient_sex} onChange={handle} className={sel}>
                <option value="">-</option>
                {SEX_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Idade">
              <input name="patient_age" value={form.patient_age} onChange={handle} className={inp} placeholder="3 anos" />
            </Field>
            <Field label="Tutor">
              <input name="owner_name" value={form.owner_name} onChange={handle} className={inp} placeholder="João Silva" />
            </Field>
            <Field label="Data">
              <input type="datetime-local" name="start_time" value={form.start_time} onChange={handle} className={inp} />
            </Field>
            <Field label="Clínica/Hospital" span2>
              <input name="clinic_name" value={form.clinic_name} onChange={handle} className={inp} placeholder="Clínica Exemplo" />
            </Field>
            <Field label="Patologia base" span2>
              <input name="pathology" value={form.pathology} onChange={handle} className={inp} placeholder="Ex: Piometra" />
            </Field>
            <Field label="Procedimento proposto *" span2>
              <input name="procedure_name" value={form.procedure_name} onChange={handle} className={inp} placeholder="Ovariohisterectomia" />
            </Field>
            <Field label="Cirurgião" span2>
              <input name="surgeon_name" value={form.surgeon_name} onChange={handle} className={inp} placeholder="Dra. Ana Lima" />
            </Field>
          </div>
        </Section>

        {/* === ANAMNESE === */}
        <Section title="Anamnese" open={sections.anamnese} onToggle={() => toggle('anamnese')}>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 min-h-[44px]">
                <input type="checkbox" name="fasting_solid" checked={form.fasting_solid} onChange={handle} className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Jejum sólido</span>
              </label>
              {form.fasting_solid && (
                <input type="number" inputMode="decimal" name="fasting_solid_hours" value={form.fasting_solid_hours} onChange={handle}
                  className={`${inp} w-20`} placeholder="h" />
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 min-h-[44px]">
                <input type="checkbox" name="fasting_liquid" checked={form.fasting_liquid} onChange={handle} className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Jejum hídrico</span>
              </label>
              {form.fasting_liquid && (
                <input type="number" inputMode="decimal" name="fasting_liquid_hours" value={form.fasting_liquid_hours} onChange={handle}
                  className={`${inp} w-20`} placeholder="h" />
              )}
            </div>
            <Field label="Doenças pré-existentes" span2>
              <textarea name="pre_existing_diseases" value={form.pre_existing_diseases} onChange={handle} rows={2} className={`${inp} resize-none`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperamento">
                <input name="temperament" value={form.temperament} onChange={handle} className={inp} placeholder="Dócil" />
              </Field>
              <Field label="Medicações prévias">
                <textarea name="prior_medications" value={form.prior_medications} onChange={handle} rows={2} className={`${inp} resize-none`} />
              </Field>
            </div>
            <Field label="Observações" span2>
              <textarea name="anamnesis_notes" value={form.anamnesis_notes} onChange={handle} rows={2} className={`${inp} resize-none`} />
            </Field>
          </div>
        </Section>

        {/* === EXAME PRÉ-ANESTÉSICO === */}
        <Section title="Exame Pré-Anestésico" open={sections.exame} onToggle={() => toggle('exame')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ACP" span2>
              <input name="pre_acp" value={form.pre_acp} onChange={handle} className={inp} />
            </Field>
            <Field label="FC (bpm)">
              <input type="number" inputMode="numeric" name="pre_fc" value={form.pre_fc} onChange={handle} className={inp} />
            </Field>
            <Field label="FR (mpm)">
              <input type="number" inputMode="numeric" name="pre_fr" value={form.pre_fr} onChange={handle} className={inp} />
            </Field>
            <Field label="Mucosas">
              <input name="pre_mucosas" value={form.pre_mucosas} onChange={handle} className={inp} placeholder="Rosadas" />
            </Field>
            <Field label="TPC (seg)">
              <input name="pre_tpc" value={form.pre_tpc} onChange={handle} className={inp} placeholder="< 2s" />
            </Field>
            <Field label="T°C">
              <input type="number" step="0.1" inputMode="decimal" name="pre_temperature" value={form.pre_temperature} onChange={handle} className={inp} placeholder="38.5" />
            </Field>
            <Field label="Hidratação">
              <input name="pre_hydration" value={form.pre_hydration} onChange={handle} className={inp} placeholder="Normal" />
            </Field>
            <Field label="PAS (mmHg)">
              <input type="number" inputMode="numeric" name="pre_pas" value={form.pre_pas} onChange={handle} className={inp} />
            </Field>
            <Field label="Pulso">
              <input name="pre_pulse" value={form.pre_pulse} onChange={handle} className={inp} placeholder="Forte" />
            </Field>
            <Field label="ASA">
              <div className="flex gap-1">
                {ASA_OPTIONS.map(a => (
                  <button key={a} type="button"
                    onClick={() => setForm(f => ({ ...f, asa_classification: `ASA ${a}` }))}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg min-h-[44px] transition ${
                      form.asa_classification === `ASA ${a}` ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                    }`}
                  >{a}</button>
                ))}
              </div>
            </Field>
            <Field label="Estado geral">
              <input name="general_state" value={form.general_state} onChange={handle} className={inp} placeholder="Bom" />
            </Field>
            <Field label="Estado nutricional">
              <input name="nutritional_state" value={form.nutritional_state} onChange={handle} className={inp} placeholder="Normal" />
            </Field>
            <Field label="Outras alterações" span2>
              <input name="pre_other_alterations" value={form.pre_other_alterations} onChange={handle} className={inp} />
            </Field>
          </div>
        </Section>

        {/* === EXAMES COMPLEMENTARES === */}
        <Section title="Exames Complementares" open={sections.exames_comp} onToggle={() => toggle('exames_comp')}>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Ht%', 'exam_ht'], ['Hb', 'exam_hb'], ['Eritr', 'exam_eritr'],
              ['PPT', 'exam_ppt'], ['Plaquetas', 'exam_plaquetas'], ['Leuc', 'exam_leuc'],
              ['Creat', 'exam_creat'], ['ALT', 'exam_alt'], ['FA', 'exam_fa'],
              ['Ureia', 'exam_ureia'], ['Alb', 'exam_alb'], ['Glic', 'exam_glic'],
            ].map(([label, name]) => (
              <Field key={name} label={label}>
                <input name={name} value={form[name]} onChange={handle} className={inp} />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="Raio-X">
              <textarea name="exam_raiox" value={form.exam_raiox} onChange={handle} rows={2} className={`${inp} resize-none`} />
            </Field>
            <Field label="Ultrassom">
              <textarea name="exam_ultrassom" value={form.exam_ultrassom} onChange={handle} rows={2} className={`${inp} resize-none`} />
            </Field>
            <Field label="Eco/ECG" span2>
              <textarea name="exam_eco_ecg" value={form.exam_eco_ecg} onChange={handle} rows={2} className={`${inp} resize-none`} />
            </Field>
            <Field label="Outros exames" span2>
              <textarea name="exam_outros" value={form.exam_outros} onChange={handle} rows={2} className={`${inp} resize-none`} />
            </Field>
          </div>
        </Section>

        {/* === PROTOCOLO ANESTÉSICO (MPA / INDUÇÃO / MANUTENÇÃO) === */}
        <Section title="Protocolo Anestésico" open={sections.protocolo} onToggle={() => toggle('protocolo')}
          badge={drugs.mpa.length + drugs.inducao.length + drugs.manutencao.length + (drugs.transoperatorio || []).length || null}>
          {/* MPA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Medicação Pré-Anestésica (MPA)</p>
              <button type="button" onClick={() => addDrug('mpa')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {drugs.mpa.map((med, i) => (
              <DrugRow key={i} med={med} allMedicines={allMedicines}
                onChange={(m) => updateDrug('mpa', i, m)} onRemove={() => removeDrug('mpa', i)} />
            ))}
          </div>

          <div className="border-t border-slate-100 my-2" />

          {/* Indução */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Indução</p>
              <button type="button" onClick={() => addDrug('inducao')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {drugs.inducao.map((med, i) => (
              <DrugRow key={i} med={med} allMedicines={allMedicines}
                onChange={(m) => updateDrug('inducao', i, m)} onRemove={() => removeDrug('inducao', i)} />
            ))}
          </div>

          <div className="border-t border-slate-100 my-2" />

          {/* Manutenção */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Manutenção</p>
              <button type="button" onClick={() => addDrug('manutencao')} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {drugs.manutencao.map((med, i) => (
              <DrugRow key={i} med={med} allMedicines={allMedicines}
                onChange={(m) => updateDrug('manutencao', i, m)} onRemove={() => removeDrug('manutencao', i)} />
            ))}
          </div>
        </Section>

        {/* === VIAS AÉREAS === */}
        <Section title="Vias Aéreas" open={sections.vias_aereas} onToggle={() => toggle('vias_aereas')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" span2>
              <div className="flex gap-1 flex-wrap">
                {AIRWAY_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, airway_type: t }))}
                    className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] transition ${
                      form.airway_type === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </Field>
            <Field label="Tubo nº/tipo">
              <input name="tube_number" value={form.tube_number} onChange={handle} className={inp} placeholder="7.5" />
            </Field>
            <Field label="Respiração">
              <select name="breathing_mode" value={form.breathing_mode} onChange={handle} className={sel}>
                <option value="">-</option>
                {BREATHING_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Sistema" span2>
              <input name="breathing_system" value={form.breathing_system} onChange={handle} className={inp} placeholder="Ex: Circular" />
            </Field>
            <label className="flex items-center gap-2 min-h-[44px] col-span-2">
              <input type="checkbox" name="peep" checked={form.peep} onChange={handle} className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-sm text-slate-700">PEEP</span>
            </label>
          </div>
        </Section>

        {/* === BLOQUEIOS === */}
        <Section title="Bloqueios" open={sections.bloqueios} onToggle={() => toggle('bloqueios')}
          badge={blocks.length || null}>
          <div className="space-y-3">
            {blocks.map((blk, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2 relative">
                <button type="button"
                  onClick={() => setBlocks(b => b.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 p-1 text-slate-400 active:text-red-500">
                  <X size={16} />
                </button>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                  <div className="flex gap-1 flex-wrap">
                    {BLOCK_TYPES.map(t => (
                      <button key={t} type="button"
                        onClick={() => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, type: t } : item))}
                        className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] transition ${
                          blk.type === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                {blk.type === 'Outro' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Descrever tipo</label>
                    <input
                      type="text"
                      value={blk.other_type || ''}
                      onChange={e => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, other_type: e.target.value } : item))}
                      className={inp}
                      placeholder="Ex: TAP block, RUMM..."
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Fármaco</label>
                    <input
                      type="text"
                      value={blk.drug || ''}
                      onChange={e => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, drug: e.target.value } : item))}
                      className={inp}
                      placeholder="Bupivacaína"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Dose/volume</label>
                    <input
                      type="text"
                      value={blk.dose_volume || ''}
                      onChange={e => setBlocks(b => b.map((item, idx) => idx === i ? { ...item, dose_volume: e.target.value } : item))}
                      className={inp}
                      placeholder="0.3 ml/kg"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setBlocks(b => [...b, { type: '', other_type: '', drug: '', dose_volume: '' }])}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-teal-400 text-teal-600 text-xs font-medium rounded-lg active:bg-teal-50 min-h-[44px]"
            >
              <Plus size={14} /> Adicionar bloqueio
            </button>
          </div>
        </Section>

        {/* === TRANSOPERATÓRIO (Página 2 da ficha) === */}
        <Section title="Transoperatório" open={sections.transoperatorio} onToggle={() => toggle('transoperatorio')}
          badge={vitals.length || null}>
          {/* Tempos */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Início anestesia">
              <input type="datetime-local" name="anesthesia_start" value={form.anesthesia_start} onChange={handle} className={inp} />
            </Field>
            <Field label="Início procedimento">
              <input type="datetime-local" name="procedure_start" value={form.procedure_start} onChange={handle} className={inp} />
            </Field>
          </div>

          {/* Monitoração - tabela de sinais vitais */}
          <div className="space-y-2 mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">Monitoração</p>

            {/* Quick-add vitals */}
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['FC', 'fc', 'bpm'], ['PAS', 'pas', 'mmHg'], ['PAM', 'pam', 'mmHg'],
                  ['PAD', 'pad', 'mmHg'], ['SpO2', 'spo2', '%'], ['FR', 'fr', 'mpm'],
                  ['ETCO2', 'etco2', '%'], ['T°C', 'temperature', '°C'], ['Fluido', 'fluid_ml_kg_h', 'ml/kg/h'],
                ].map(([label, key, unit]) => (
                  <div key={key}>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">{label}</label>
                    <input
                      type="number" inputMode="decimal" step="any"
                      value={newVital[key] || ''}
                      onChange={e => setNewVital(v => ({ ...v, [key]: e.target.value }))}
                      placeholder={unit}
                      className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">O₂</label>
                  <input
                    type="number" inputMode="decimal" step="any"
                    value={newVital.o2_l_min || ''}
                    onChange={e => setNewVital(v => ({ ...v, o2_l_min: e.target.value }))}
                    placeholder="L/min"
                    className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Anestésico</label>
                  <input
                    type="text"
                    value={newVital.anesthetic || ''}
                    onChange={e => setNewVital(v => ({ ...v, anesthetic: e.target.value }))}
                    placeholder="ISO 1.5%"
                    className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Notas/Outros</label>
                  <input
                    type="text"
                    value={newVital.notes || ''}
                    onChange={e => setNewVital(v => ({ ...v, notes: e.target.value }))}
                    placeholder="Parâmetros adicionais ou observações..."
                    className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[10px] font-medium text-slate-500 whitespace-nowrap">Horário</label>
                <input
                  type="time"
                  value={newVital.vital_time !== undefined ? newVital.vital_time : currentTimeHHMM()}
                  onChange={e => setNewVital(v => ({ ...v, vital_time: e.target.value }))}
                  className="px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px] flex-1"
                />
              </div>
              <button type="button" onClick={addVital}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-teal-600 text-white text-xs font-medium rounded-lg active:bg-teal-700 min-h-[40px]">
                <Plus size={14} /> Registrar momento
              </button>
            </div>

            {/* Registered vitals list */}
            {vitals.length > 0 && (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="text-[11px] min-w-[760px] w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-1.5 font-semibold text-slate-500">Hora</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">FC</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">PAS</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">PAM</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">PAD</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">SpO2</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">FR</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">ETCO2</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">T°C</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">Fluido</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">O₂</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">Anest.</th>
                      <th className="text-center py-1.5 font-semibold text-slate-500">Notas</th>
                      <th className="w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitals.map((v, i) => (
                      <tr key={v.id || i} className="border-b border-slate-50">
                        <td className="py-1.5 font-mono text-slate-600">
                          {v.recorded_at ? new Date(v.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="py-1.5 text-center text-slate-700">{v.fc || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.pas || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.pam || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.pad || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.spo2 || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.fr || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.etco2 || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.temperature || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.fluid_ml_kg_h || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.o2_l_min || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700">{v.anesthetic || '-'}</td>
                        <td className="py-1.5 text-center text-slate-700 max-w-[80px] truncate">{v.notes || '-'}</td>
                        <td>
                          {!v.fromServer && (
                            <button type="button" onClick={() => removeVital(i)} className="p-1 text-slate-400 active:text-red-500">
                              <X size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Intercorrências */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Intercorrências</p>
              <button
                type="button"
                onClick={() => setComplications(c => [...c, { time: currentTimeHHMM(), text: '' }])}
                className="flex items-center gap-1 text-xs text-orange-600 font-medium min-h-[36px] px-2"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {complications.length === 0 && (
              <p className="text-xs text-slate-400 italic py-1">Nenhuma intercorrência registrada.</p>
            )}
            {complications.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-2">
                <input
                  type="time"
                  value={entry.time}
                  onChange={e => setComplications(c => c.map((item, idx) => idx === i ? { ...item, time: e.target.value } : item))}
                  className="px-2 py-1.5 border border-orange-200 rounded text-sm min-h-[40px] w-[100px] shrink-0 bg-white"
                />
                <input
                  type="text"
                  value={entry.text}
                  onChange={e => setComplications(c => c.map((item, idx) => idx === i ? { ...item, text: e.target.value } : item))}
                  placeholder="Ex: Bradicardia, administrado atropina..."
                  className="flex-1 px-2 py-1.5 border border-orange-200 rounded text-sm min-h-[40px] bg-white"
                />
                <button
                  type="button"
                  onClick={() => setComplications(c => c.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-orange-400 active:text-red-600 min-h-[40px] min-w-[36px] flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Fármacos administrados no transoperatório */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Fármacos Trans-operatório</p>
              <button type="button" onClick={() => {
                setDrugs(d => ({
                  ...d,
                  transoperatorio: [...(d.transoperatorio || []), { medicine_id: '', dose: '', dose_unit: 'mL', route: '', time: '', drug_source: 'proprio' }]
                }))
              }} className="flex items-center gap-1 text-xs text-teal-600 font-medium min-h-[36px] px-2">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {(drugs.transoperatorio || []).map((med, i) => (
              <DrugRow key={i} med={med} allMedicines={allMedicines}
                onChange={(m) => setDrugs(d => ({ ...d, transoperatorio: d.transoperatorio.map((item, idx) => idx === i ? m : item) }))}
                onRemove={() => setDrugs(d => ({ ...d, transoperatorio: d.transoperatorio.filter((_, idx) => idx !== i) }))} />
            ))}
          </div>

          {/* Tempos finais */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Final procedimento">
              <input type="datetime-local" name="procedure_end" value={form.procedure_end} onChange={handle} className={inp} />
            </Field>
            <Field label="Final anestesia">
              <input type="datetime-local" name="anesthesia_end" value={form.anesthesia_end} onChange={handle} className={inp} />
            </Field>
            <Field label="Hora de extubação">
              <input type="datetime-local" name="extubation_time" value={form.extubation_time} onChange={handle} className={inp} />
            </Field>
          </div>
        </Section>

        {/* === PÓS-OPERATÓRIO === */}
        <Section title="Pós-operatório" open={sections.pos_operatorio} onToggle={() => toggle('pos_operatorio')}>
          <Field label="Pós-operatório">
            <textarea name="post_operative" value={form.post_operative} onChange={handle} rows={4} className={`${inp} resize-none`} />
          </Field>
        </Section>

        {/* === OBSERVAÇÕES === */}
        <Section title="Observações" open={sections.observacoes} onToggle={() => toggle('observacoes')}>
          <Field label="Observações gerais">
            <textarea name="monitoring_notes" value={form.monitoring_notes} onChange={handle} rows={4} className={`${inp} resize-none`} />
          </Field>
        </Section>

        {/* Bottom save button */}
        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-600 text-white font-medium rounded-xl active:bg-teal-700 transition min-h-[52px] text-sm">
          {saving
            ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <><Save size={18} />Salvar Ficha</>}
        </button>
      </div>
    </form>
  )
}
