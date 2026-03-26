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
  const [drugs, setDrugs] = useState({ mpa: [], inducao: [], manutencao: [] })

  // Section open/close state
  const [sections, setSections] = useState({
    paciente: true, anamnese: false, exame: false, exames_comp: false,
    protocolo: true, vias_aereas: false, bloqueios: false, observacoes: false,
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
        setForm(f)

        // Load existing medicines grouped by phase
        const meds = res.data.medicines || []
        const grouped = { mpa: [], inducao: [], manutencao: [] }
        meds.forEach(m => {
          const phase = m.phase || 'mpa'
          const key = grouped[phase] ? phase : 'mpa'
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
      }

      let surgeryId = id
      if (isEdit) {
        await api.put(`/surgeries/${id}`, payload)
      } else {
        const res = await api.post('/surgeries', payload)
        surgeryId = res.data.surgery.id
      }

      // Save drugs - for new surgeries or new drugs in edit mode
      const allDrugs = [
        ...drugs.mpa.map(d => ({ ...d, phase: 'mpa' })),
        ...drugs.inducao.map(d => ({ ...d, phase: 'inducao' })),
        ...drugs.manutencao.map(d => ({ ...d, phase: 'manutencao' })),
      ]

      for (const drug of allDrugs) {
        if (drug.existing || !drug.medicine_id || !drug.dose) continue
        const adminAt = drug.time
          ? `${form.start_time?.slice(0, 10) || new Date().toISOString().slice(0, 10)}T${drug.time}`
          : null
        await api.post(`/surgeries/${surgeryId}/medicines`, {
          medicine_id: Number(drug.medicine_id),
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
                <input name="prior_medications" value={form.prior_medications} onChange={handle} className={inp} />
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
              <input name="exam_raiox" value={form.exam_raiox} onChange={handle} className={inp} />
            </Field>
            <Field label="Ultrassom">
              <input name="exam_ultrassom" value={form.exam_ultrassom} onChange={handle} className={inp} />
            </Field>
            <Field label="Eco/ECG" span2>
              <input name="exam_eco_ecg" value={form.exam_eco_ecg} onChange={handle} className={inp} />
            </Field>
            <Field label="Outros exames" span2>
              <input name="exam_outros" value={form.exam_outros} onChange={handle} className={inp} />
            </Field>
          </div>
        </Section>

        {/* === PROTOCOLO ANESTÉSICO (MPA / INDUÇÃO / MANUTENÇÃO) === */}
        <Section title="Protocolo Anestésico" open={sections.protocolo} onToggle={() => toggle('protocolo')}
          badge={drugs.mpa.length + drugs.inducao.length + drugs.manutencao.length || null}>
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
        <Section title="Bloqueios" open={sections.bloqueios} onToggle={() => toggle('bloqueios')}>
          <div className="space-y-3">
            <Field label="Tipo">
              <div className="flex gap-1 flex-wrap">
                {BLOCK_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, block_type: t }))}
                    className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] transition ${
                      form.block_type === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fármaco">
                <input name="block_drug" value={form.block_drug} onChange={handle} className={inp} />
              </Field>
              <Field label="Dose/volume">
                <input name="block_dose_volume" value={form.block_dose_volume} onChange={handle} className={inp} />
              </Field>
            </div>
          </div>
        </Section>

        {/* === OBSERVAÇÕES / PÓS-OP === */}
        <Section title="Observações" open={sections.observacoes} onToggle={() => toggle('observacoes')}>
          <div className="space-y-3">
            <Field label="Pós-operatório">
              <textarea name="post_operative" value={form.post_operative} onChange={handle} rows={3} className={`${inp} resize-none`} />
            </Field>
            <Field label="Observações gerais">
              <textarea name="monitoring_notes" value={form.monitoring_notes} onChange={handle} rows={3} className={`${inp} resize-none`} />
            </Field>
          </div>
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
