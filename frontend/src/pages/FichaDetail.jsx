import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Play, Square, Plus, Trash2, Activity, Heart, Clock, Printer, X, AlertTriangle
} from 'lucide-react'
import api from '../api/axios'

// ─── Emergency drugs data ────────────────────────────────────────────────────
const EMERGENCY_DRUGS = [
  { name: 'Atropina',   dosePerKg: 0.044, concentration: 0.5,  route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Adrenalina', dosePerKg: 0.01,  concentration: 1,    route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Efedrina',   dosePerKg: 0.1,   concentration: 50,   route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Lidocaína',  dosePerKg: 2,     concentration: 20,   route: 'IV',       note: 'somente cães', speciesFilter: 'canino' },
  { name: 'Amiodarona', dosePerKg: 5,     concentration: 50,   route: 'IV lento', note: null,           speciesFilter: null },
  { name: 'Naloxona',   dosePerKg: 0.04,  concentration: 0.4,  route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Flumazenil', dosePerKg: 0.01,  concentration: 0.1,  route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Doxapram',   dosePerKg: 1,     concentration: 20,   route: 'IV',       note: null,           speciesFilter: null },
]

function fmtDose(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return Number(n.toFixed(decimals)).toString()
}

function EmergencyModal({ surgery, onClose }) {
  const weight = parseFloat(surgery.patient_weight)
  const hasWeight = !isNaN(weight) && weight > 0
  const species = (surgery.patient_species || '').toLowerCase()
  const isCanine = species.includes('cão') || species.includes('cao') ||
                   species.includes('canino') || species.includes('dog')

  const drugs = EMERGENCY_DRUGS.filter(d => !d.speciesFilter || isCanine)

  return (
    <div
      className="emergency-modal-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md m-4 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Red header */}
        <div className="bg-red-600 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="text-white" />
            <span className="text-white text-xl font-black tracking-widest uppercase">Emergência</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-red-700 active:bg-red-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Patient info */}
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <p className="font-bold text-slate-800 text-base">{surgery.patient_name}</p>
          <p className="text-sm text-slate-600">
            {surgery.patient_species && <span>{surgery.patient_species} · </span>}
            {hasWeight
              ? <span className="font-semibold text-red-700">{weight} kg</span>
              : <span className="text-red-600 font-semibold">Peso não informado</span>
            }
          </p>
        </div>

        {/* Drug list */}
        <div className="bg-white divide-y divide-slate-100">
          {!hasWeight && (
            <div className="px-4 py-4 text-sm text-red-600 font-medium text-center">
              Cadastre o peso do paciente para calcular as doses.
            </div>
          )}
          {drugs.map((drug) => {
            const doseMg   = hasWeight ? weight * drug.dosePerKg : null
            const volumeMl = hasWeight ? doseMg / drug.concentration : null
            return (
              <div key={drug.name} className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-base">{drug.name}</span>
                    {drug.note && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        {drug.note}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {drug.dosePerKg} mg/kg · {drug.route} · {drug.concentration} mg/mL
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {hasWeight ? (
                    <>
                      <p className="text-base font-black text-red-700 leading-tight">{fmtDose(doseMg)} mg</p>
                      <p className="text-sm font-bold text-slate-700">{fmtDose(volumeMl)} mL</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
          <p className="text-[10px] text-slate-400 text-center leading-snug">
            Doses de referência. Confirme com o protocolo institucional.
          </p>
          <button
            onClick={onClose}
            className="mt-2 w-full py-3 bg-slate-200 text-slate-700 font-semibold rounded-xl active:bg-slate-300 text-sm min-h-[44px]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS = {
  scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

const VITAL_FIELDS = [
  { key: 'fc', label: 'FC', unit: 'bpm', type: 'number' },
  { key: 'pas', label: 'PAS', unit: 'mmHg', type: 'number' },
  { key: 'pam', label: 'PAM', unit: 'mmHg', type: 'number' },
  { key: 'pad', label: 'PAD', unit: 'mmHg', type: 'number' },
  { key: 'spo2', label: 'SpO2', unit: '%', type: 'number' },
  { key: 'fr', label: 'FR', unit: 'mpm', type: 'number' },
  { key: 'etco2', label: 'ETCO2', unit: '%', type: 'number' },
  { key: 'temperature', label: 'T°C', unit: '', type: 'number' },
  { key: 'fluid_ml_kg_h', label: 'Fluido', unit: 'ml/kg/h', type: 'number' },
  { key: 'o2_l_min', label: 'O₂', unit: 'L/min', type: 'number' },
  { key: 'anesthetic', label: 'Anestésico', unit: '', type: 'text' },
  { key: 'notes', label: 'Notas', unit: '', type: 'text' },
]

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon size={15} className="text-slate-400" />}
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

export default function FichaDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [surgery, setSurgery] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [vitals, setVitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Vitals quick-add
  const [showVitals, setShowVitals] = useState(false)
  const [newVital, setNewVital] = useState({})

  // Emergency modal
  const [showEmergency, setShowEmergency] = useState(false)

  const load = async () => {
    try {
      const res = await api.get(`/surgeries/${id}`)
      setSurgery(res.data.surgery || res.data)
      setMedicines(res.data.medicines || [])
      setVitals(res.data.vitals || [])
    } catch {
      setError('Erro ao carregar ficha.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const startSurgery = async () => {
    setActionLoading(true)
    try {
      await api.put(`/surgeries/${id}/start`)
      await load()
    } catch { setError('Erro ao iniciar.') }
    finally { setActionLoading(false) }
  }

  const endSurgery = async () => {
    setActionLoading(true)
    try {
      await api.put(`/surgeries/${id}/end`)
      await load()
    } catch { setError('Erro ao finalizar.') }
    finally { setActionLoading(false) }
  }

  const markCompleted = async () => {
    setActionLoading(true)
    try {
      await api.put(`/surgeries/${id}`, { status: 'completed' })
      await load()
    } catch { setError('Erro ao concluir ficha.') }
    finally { setActionLoading(false) }
  }

  const addVitals = async () => {
    try {
      const payload = { ...newVital, recorded_at: new Date().toISOString() }
      await api.post(`/surgeries/${id}/vitals`, payload)
      setNewVital({})
      setShowVitals(false)
      load()
    } catch { setError('Erro ao salvar sinais vitais.') }
  }

  const deleteVital = async (vitalId) => {
    try {
      await api.delete(`/surgeries/${id}/vitals/${vitalId}`)
      load()
    } catch { setError('Erro ao remover.') }
  }

  const removeMedicine = async (medId) => {
    try {
      await api.delete(`/surgeries/${id}/medicines/${medId}`)
      load()
    } catch { setError('Erro ao remover medicamento.') }
  }

  const handlePrint = () => window.print()

  const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '-'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
    </div>
  )

  if (!surgery) return <div className="p-4 text-red-600">Ficha não encontrada.</div>

  const st = STATUS[surgery.status] || STATUS.scheduled
  const groupedMeds = {}
  medicines.forEach(m => {
    const phase = m.phase || 'mpa'
    if (!groupedMeds[phase]) groupedMeds[phase] = []
    groupedMeds[phase].push(m)
  })
  const phaseLabels = { mpa: 'MPA', inducao: 'Indução', manutencao: 'Manutenção', bloqueio: 'Bloqueio', transoperatorio: 'Trans-op' }

  return (
    <div className="pb-6">
      {/* Emergency modal */}
      {showEmergency && (
        <EmergencyModal surgery={surgery} onClose={() => setShowEmergency(false)} />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/fichas')}
              className="no-print p-2 -ml-2 rounded-lg active:bg-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800 truncate">{surgery.patient_name}</h1>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{surgery.procedure_name}</p>
            </div>
          </div>
          <div className="no-print flex items-center gap-1.5 shrink-0">
            {/* Emergency button — always visible */}
            <button
              onClick={() => setShowEmergency(true)}
              className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg active:bg-red-700 min-h-[40px] shadow-sm"
              title="Drogas de emergência"
            >
              <AlertTriangle size={14} />
              <span className="hidden sm:inline">Emergência</span>
              <span className="sm:hidden">SOS</span>
            </button>

            {surgery.status === 'scheduled' && (
              <button onClick={startSurgery} disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white text-xs font-medium rounded-lg active:bg-amber-600 min-h-[40px]">
                <Play size={14} />Iniciar
              </button>
            )}
            {surgery.status === 'in_progress' && (
              <button onClick={endSurgery} disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg active:bg-green-700 min-h-[40px]">
                <Square size={14} />Finalizar
              </button>
            )}
            {(surgery.status === 'scheduled' || surgery.status === 'in_progress') && (
              <button onClick={markCompleted} disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg active:bg-teal-700 min-h-[40px]">
                <Clock size={14} />Concluir
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 text-xs font-medium rounded-lg active:bg-slate-300 min-h-[40px]"
              title="Imprimir / Exportar PDF"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button onClick={() => navigate(`/fichas/${id}/edit`)}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 text-xs font-medium rounded-lg active:bg-slate-300 min-h-[40px]">
              <Edit2 size={14} />Editar
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {/* Patient + Surgery info */}
        <Card title="Paciente">
          <InfoRow label="Espécie / Raça" value={[surgery.patient_species, surgery.patient_breed].filter(Boolean).join(' · ')} />
          <InfoRow label="Peso" value={surgery.patient_weight ? `${surgery.patient_weight} kg` : null} />
          <InfoRow label="Idade" value={surgery.patient_age} />
          <InfoRow label="Sexo" value={surgery.patient_sex} />
          <InfoRow label="Tutor" value={surgery.owner_name} />
          <InfoRow label="Clínica" value={surgery.clinic_name} />
          <InfoRow label="Cirurgião" value={surgery.surgeon_name} />
          <InfoRow label="Patologia" value={surgery.pathology} />
          <InfoRow label="ASA" value={surgery.asa_classification} />
          <InfoRow label="Data" value={fmtDate(surgery.start_time)} />
        </Card>

        {/* Anamnese */}
        {(surgery.pre_existing_diseases || surgery.temperament || surgery.prior_medications || surgery.anamnesis_notes) && (
          <Card title="Anamnese">
            <InfoRow label="Jejum sólido" value={surgery.fasting_solid ? `Sim (${surgery.fasting_solid_hours || '?'}h)` : null} />
            <InfoRow label="Jejum hídrico" value={surgery.fasting_liquid ? `Sim (${surgery.fasting_liquid_hours || '?'}h)` : null} />
            <InfoRow label="Doenças" value={surgery.pre_existing_diseases} />
            <InfoRow label="Temperamento" value={surgery.temperament} />
            <InfoRow label="Medicações prévias" value={surgery.prior_medications} />
            <InfoRow label="Obs" value={surgery.anamnesis_notes} />
          </Card>
        )}

        {/* Exame pré */}
        {(surgery.pre_fc || surgery.pre_fr || surgery.pre_acp) && (
          <Card title="Exame Pré-Anestésico">
            <InfoRow label="ACP" value={surgery.pre_acp} />
            <div className="grid grid-cols-2 gap-x-4">
              <InfoRow label="FC" value={surgery.pre_fc ? `${surgery.pre_fc} bpm` : null} />
              <InfoRow label="FR" value={surgery.pre_fr ? `${surgery.pre_fr} mpm` : null} />
              <InfoRow label="Mucosas" value={surgery.pre_mucosas} />
              <InfoRow label="TPC" value={surgery.pre_tpc} />
              <InfoRow label="T°C" value={surgery.pre_temperature} />
              <InfoRow label="Hidratação" value={surgery.pre_hydration} />
              <InfoRow label="PAS" value={surgery.pre_pas ? `${surgery.pre_pas} mmHg` : null} />
              <InfoRow label="Pulso" value={surgery.pre_pulse} />
            </div>
            <InfoRow label="Estado geral" value={surgery.general_state} />
            <InfoRow label="Estado nutricional" value={surgery.nutritional_state} />
          </Card>
        )}

        {/* Vias aéreas */}
        {(surgery.airway_type || surgery.breathing_mode) && (
          <Card title="Vias Aéreas">
            <InfoRow label="Tipo" value={surgery.airway_type} />
            <InfoRow label="Tubo" value={surgery.tube_number} />
            <InfoRow label="Respiração" value={surgery.breathing_mode} />
            <InfoRow label="Sistema" value={surgery.breathing_system} />
            {surgery.peep ? <InfoRow label="PEEP" value="Sim" /> : null}
          </Card>
        )}

        {/* Bloqueios */}
        {surgery.block_type && (
          <Card title="Bloqueios">
            <InfoRow label="Tipo" value={surgery.block_type} />
            <InfoRow label="Fármaco" value={surgery.block_drug} />
            <InfoRow label="Dose/volume" value={surgery.block_dose_volume} />
          </Card>
        )}

        {/* Medicamentos por fase */}
        <Card title="Fármacos Utilizados">
          {medicines.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum fármaco registrado.</p>
          ) : (
            Object.entries(groupedMeds).map(([phase, meds]) => (
              <div key={phase} className="mb-3 last:mb-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{phaseLabels[phase] || phase}</p>
                {meds.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.medicine_name}</p>
                      <p className="text-xs text-slate-500">
                        {m.dose} {m.dose_unit} · {m.route || '-'} · {fmtTime(m.administered_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        m.drug_source === 'clinica' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {m.drug_source === 'clinica' ? 'Clínica' : 'Próprio'}
                      </span>
                      {surgery.status !== 'completed' && (
                        <button onClick={() => removeMedicine(m.id)} className="p-1.5 text-slate-400 active:text-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </Card>

        {/* Tempos cirúrgicos */}
        {(surgery.anesthesia_start || surgery.procedure_start || surgery.procedure_end || surgery.anesthesia_end || surgery.extubation_time) && (
          <Card title="Tempos" icon={Clock}>
            <InfoRow label="Início anestesia" value={surgery.anesthesia_start ? fmtTime(surgery.anesthesia_start) : null} />
            <InfoRow label="Início procedimento" value={surgery.procedure_start ? fmtTime(surgery.procedure_start) : null} />
            <InfoRow label="Final procedimento" value={surgery.procedure_end ? fmtTime(surgery.procedure_end) : null} />
            <InfoRow label="Final anestesia" value={surgery.anesthesia_end ? fmtTime(surgery.anesthesia_end) : null} />
            <InfoRow label="Hora de extubação" value={surgery.extubation_time ? fmtTime(surgery.extubation_time) : null} />
          </Card>
        )}

        {/* === MONITORAÇÃO TRANSOPERATÓRIA === */}
        <Card title="Monitoração" icon={Heart}>
          {surgery.status === 'in_progress' && (
            <button
              onClick={() => setShowVitals(!showVitals)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 mb-3 bg-teal-50 text-teal-700 text-sm font-medium rounded-lg active:bg-teal-100 min-h-[44px]"
            >
              <Plus size={16} /> Registrar sinais vitais
            </button>
          )}

          {showVitals && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {VITAL_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">{f.label}</label>
                    <input
                      type={f.type}
                      inputMode={f.type === 'number' ? 'decimal' : 'text'}
                      step="any"
                      value={newVital[f.key] || ''}
                      onChange={e => setNewVital(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.unit}
                      className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowVitals(false); setNewVital({}) }}
                  className="flex-1 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg min-h-[44px]">
                  Cancelar
                </button>
                <button type="button" onClick={addVitals}
                  className="flex-1 py-2 text-sm text-white bg-teal-600 rounded-lg active:bg-teal-700 min-h-[44px] font-medium">
                  Salvar
                </button>
              </div>
            </div>
          )}

          {vitals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum registro.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="text-xs min-w-[820px] w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 font-semibold text-slate-500 sticky left-0 bg-white">Hora</th>
                    {VITAL_FIELDS.map(f => (
                      <th key={f.key} className="text-center py-2 font-semibold text-slate-500 px-1">{f.label}</th>
                    ))}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((v, i) => (
                    <tr key={v.id || i} className="border-b border-slate-50">
                      <td className="py-2 font-mono text-slate-600 sticky left-0 bg-white">{fmtTime(v.recorded_at)}</td>
                      {VITAL_FIELDS.map(f => (
                        <td key={f.key} className="py-2 text-center text-slate-700 px-1">{v[f.key] ?? '-'}</td>
                      ))}
                      <td>
                        {surgery.status !== 'completed' && (
                          <button onClick={() => deleteVital(v.id)} className="p-1 text-slate-400 active:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pós-operatório */}
        {(surgery.post_operative || surgery.complications) && (
          <Card title="Pós-operatório">
            {surgery.post_operative && (
              <p className="text-sm text-slate-700">{surgery.post_operative}</p>
            )}
            {surgery.complications && (() => {
              let entries = []
              try {
                const parsed = JSON.parse(surgery.complications)
                entries = Array.isArray(parsed) ? parsed : [{ time: '', text: surgery.complications }]
              } catch {
                entries = [{ time: '', text: surgery.complications }]
              }
              return (
                <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${surgery.post_operative ? 'mt-3' : ''}`}>
                  <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Intercorrências</p>
                  <div className="space-y-1.5">
                    {entries.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {entry.time && (
                          <span className="text-xs font-mono font-semibold text-red-600 shrink-0 mt-0.5">{entry.time}</span>
                        )}
                        <span className="text-sm text-red-700">{entry.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </Card>
        )}

        {/* Observações */}
        {surgery.monitoring_notes && (
          <Card title="Observações">
            <p className="text-sm text-slate-700">{surgery.monitoring_notes}</p>
          </Card>
        )}
      </div>
    </div>
  )
}
