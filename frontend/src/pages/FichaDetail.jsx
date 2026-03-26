import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Play, Square, Plus, Trash2, Activity, Heart, Clock
} from 'lucide-react'
import api from '../api/axios'

const STATUS = {
  scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

const VITAL_FIELDS = [
  { key: 'fc', label: 'FC', unit: 'bpm', type: 'number' },
  { key: 'fr', label: 'FR', unit: 'mpm', type: 'number' },
  { key: 'spo2', label: 'SpO2', unit: '%', type: 'number' },
  { key: 'etco2', label: 'ETCO2', unit: '%', type: 'number' },
  { key: 'pas', label: 'PAS', unit: 'mmHg', type: 'number' },
  { key: 'pam', label: 'PAM', unit: 'mmHg', type: 'number' },
  { key: 'pad', label: 'PAD', unit: 'mmHg', type: 'number' },
  { key: 'temperature', label: 'T°C', unit: '', type: 'number' },
  { key: 'fluid_ml_kg_h', label: 'Fluido', unit: 'ml/kg/h', type: 'number' },
  { key: 'anesthetic', label: 'Anestésico', unit: '', type: 'text' },
  { key: 'o2_l_min', label: 'O₂', unit: 'L/min', type: 'number' },
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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate('/fichas')} className="p-2 -ml-2 rounded-lg active:bg-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
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
          <div className="flex items-center gap-1.5 shrink-0">
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
              <table className="text-xs min-w-[700px] w-full">
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

        {/* Pós-op e observações */}
        {(surgery.post_operative || surgery.monitoring_notes || surgery.complications) && (
          <Card title="Observações">
            {surgery.post_operative && (
              <div className="mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Pós-operatório</p>
                <p className="text-sm text-slate-700 mt-0.5">{surgery.post_operative}</p>
              </div>
            )}
            {surgery.monitoring_notes && (
              <div className="mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Observações</p>
                <p className="text-sm text-slate-700 mt-0.5">{surgery.monitoring_notes}</p>
              </div>
            )}
            {surgery.complications && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-[10px] font-bold text-red-600 uppercase">Complicações</p>
                <p className="text-sm text-red-700 mt-0.5">{surgery.complications}</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
