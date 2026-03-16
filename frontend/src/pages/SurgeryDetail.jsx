import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Play, Square, Plus, Trash2,
  PawPrint, Activity, Syringe, Clock, DollarSign, FileText, Package, Heart
} from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const STATUS_MAP = {
  scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

const DOSE_UNITS = ['mL', 'mg', 'mg/kg', 'UI']
const ROUTES = ['IV', 'IM', 'SC', 'VO', 'Inalatório', 'Epidural', 'Tópico']

const EMPTY_MED = {
  medicine_id: '',
  dose: '',
  dose_unit: 'mL',
  dose_mg_kg: '',
  administered_at: '',
  route: 'IV',
}

export default function SurgeryDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [surgery, setSurgery] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [vitals, setVitals] = useState([])
  const [summary, setSummary] = useState(null)
  const [allMedicines, setAllMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddMed, setShowAddMed] = useState(false)
  const [newMed, setNewMed] = useState(EMPTY_MED)
  const [savingMed, setSavingMed] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const load = async () => {
    try {
      const res = await api.get(`/surgeries/${id}`)
      setSurgery(res.data.surgery || res.data)
      setMedicines(res.data.medicines || [])
      setVitals(res.data.vitals || [])
      setSummary(res.data.summary || null)
    } catch {
      setError('Erro ao carregar dados da cirurgia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    api.get('/medicines')
      .then((res) => setAllMedicines(res.data?.medicines || res.data || []))
      .catch(() => {})
  }, [])

  const startSurgery = async () => {
    setActionLoading(true)
    try {
      await api.put(`/surgeries/${id}/start`)
      await load()
    } catch {
      setError('Erro ao iniciar cirurgia.')
    } finally {
      setActionLoading(false)
    }
  }

  const endSurgery = async () => {
    setActionLoading(true)
    try {
      await api.put(`/surgeries/${id}/end`)
      await load()
    } catch {
      setError('Erro ao finalizar cirurgia.')
    } finally {
      setActionLoading(false)
    }
  }

  const addMedicine = async (e) => {
    e.preventDefault()
    if (!newMed.medicine_id || !newMed.dose || !newMed.dose_unit) return
    setSavingMed(true)
    try {
      await api.post(`/surgeries/${id}/medicines`, {
        medicine_id: Number(newMed.medicine_id),
        dose: Number(newMed.dose),
        dose_unit: newMed.dose_unit,
        dose_mg_kg: newMed.dose_mg_kg ? Number(newMed.dose_mg_kg) : null,
        administered_at: newMed.administered_at || null,
        route: newMed.route || null,
      })
      setShowAddMed(false)
      setNewMed(EMPTY_MED)
      load()
    } catch {
      setError('Erro ao adicionar medicamento.')
    } finally {
      setSavingMed(false)
    }
  }

  const removeMedicine = async (medId) => {
    try {
      await api.delete(`/surgeries/${id}/medicines/${medId}`)
      load()
    } catch {
      setError('Erro ao remover medicamento.')
    }
  }

  const fmt = (v) =>
    v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '-'

  const fmtDatetime = (v) =>
    v ? new Date(v).toLocaleString('pt-BR') : '-'

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  if (!surgery) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">Cirurgia não encontrada.</div>

  const st = STATUS_MAP[surgery.status] || { label: surgery.status, cls: 'bg-slate-100 text-slate-600' }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/surgeries')}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{surgery.patient_name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{surgery.procedure_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {surgery.status === 'scheduled' && (
            <button
              onClick={startSurgery}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition min-h-[44px]"
            >
              <Play size={16} />Iniciar
            </button>
          )}
          {surgery.status === 'in_progress' && (
            <button
              onClick={endSurgery}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition min-h-[44px]"
            >
              <Square size={16} />Finalizar
            </button>
          )}
          <button
            onClick={() => navigate(`/surgeries/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition min-h-[44px]"
          >
            <Edit2 size={16} />Editar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Patient Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <PawPrint size={15} />Paciente
          </h3>
          <dl className="space-y-2">
            {[
              ['Nome', surgery.patient_name],
              ['Tutor', surgery.owner_name || '-'],
              ['Espécie', surgery.patient_species || '-'],
              ['Raça', surgery.patient_breed || '-'],
              ['Peso', surgery.patient_weight ? `${surgery.patient_weight} kg` : '-'],
              ['Idade', surgery.patient_age || '-'],
              ['Sexo', surgery.patient_sex || '-'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Surgery Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Activity size={15} />Cirurgia
          </h3>
          <dl className="space-y-2">
            {[
              ['Procedimento', surgery.procedure_name || '-'],
              ['Clínica', surgery.clinic_name || '-'],
              ['Data', fmtDatetime(surgery.start_time)],
              ['Duração', surgery.duration_minutes ? `${surgery.duration_minutes} min` : '-'],
              ['ASA', surgery.asa_classification || '-'],
              ['Jejum sólido', surgery.fasting_solid_hours != null ? `${surgery.fasting_solid_hours}h` : '-'],
              ['Jejum líquido', surgery.fasting_liquid_hours != null ? `${surgery.fasting_liquid_hours}h` : '-'],
              ['Honorários', fmt(surgery.revenue)],
              ['Status', st.label],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Anesthesia Protocol */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Syringe size={15} />Protocolo Anestésico
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ['MPA', surgery.pre_anesthesia],
            ['Indução', surgery.induction],
            ['Manutenção', surgery.maintenance],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</p>
              <p className="text-sm text-slate-700">
                {value || <span className="text-slate-400 italic">Não informado</span>}
              </p>
            </div>
          ))}
        </div>
        {surgery.monitoring_notes && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
              <FileText size={12} />Observações de monitoração
            </p>
            <p className="text-sm text-amber-800">{surgery.monitoring_notes}</p>
          </div>
        )}
        {surgery.complications && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
              <FileText size={12} />Complicações
            </p>
            <p className="text-sm text-red-800">{surgery.complications}</p>
          </div>
        )}
      </div>

      {/* Medicines Used */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <Package size={15} />Medicamentos Utilizados
          </h3>
          <button
            onClick={() => setShowAddMed(!showAddMed)}
            className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium min-h-[44px] px-2"
          >
            <Plus size={16} />Adicionar
          </button>
        </div>

        {showAddMed && (
          <form onSubmit={addMedicine} className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Medicamento *</label>
                <select
                  value={newMed.medicine_id}
                  onChange={(e) => setNewMed({ ...newMed, medicine_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {allMedicines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dose *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMed.dose}
                  onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Ex: 2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unidade *</label>
                <select
                  value={newMed.dose_unit}
                  onChange={(e) => setNewMed({ ...newMed, dose_unit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                >
                  {DOSE_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dose (mg/kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMed.dose_mg_kg}
                  onChange={(e) => setNewMed({ ...newMed, dose_mg_kg: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Ex: 4.0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Via</label>
                <select
                  value={newMed.route}
                  onChange={(e) => setNewMed({ ...newMed, route: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {ROUTES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Horário</label>
                <input
                  type="datetime-local"
                  value={newMed.administered_at}
                  onChange={(e) => setNewMed({ ...newMed, administered_at: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => { setShowAddMed(false); setNewMed(EMPTY_MED) }}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingMed}
                className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 min-h-[44px]"
              >
                {savingMed ? '...' : 'Adicionar'}
              </button>
            </div>
          </form>
        )}

        {medicines.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Nenhum medicamento registrado nesta cirurgia.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-2 font-semibold text-slate-600">Medicamento</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">Dose</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">mg/kg</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">Horário</th>
                  <th className="text-center pb-2 font-semibold text-slate-600">Via</th>
                  <th className="text-center pb-2 font-semibold text-slate-600">Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{m.medicine_name || m.name}</td>
                    <td className="py-2.5 text-right text-slate-600">
                      {m.dose != null ? `${m.dose} ${m.dose_unit || ''}`.trim() : '-'}
                    </td>
                    <td className="py-2.5 text-right text-slate-600">{m.dose_mg_kg ?? '-'}</td>
                    <td className="py-2.5 text-right text-slate-600">
                      {m.administered_at ? new Date(m.administered_at).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="py-2.5 text-center text-slate-600">{m.route || '-'}</td>
                    <td className="py-2.5 text-center">
                      <button
                        onClick={() => removeMedicine(m.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monitoring Vitals */}
      {vitals && vitals.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Heart size={15} />Monitoração — Sinais Vitais
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-2 font-semibold text-slate-600">Horário</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">FC</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">FR</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">SpO2</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">ETCO2</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">PAM</th>
                  <th className="text-right pb-2 font-semibold text-slate-600">Temp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vitals.map((v, i) => (
                  <tr key={v.id ?? i} className="hover:bg-slate-50">
                    <td className="py-2.5 text-slate-700 font-mono text-xs">
                      {v.recorded_at ? new Date(v.recorded_at).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="py-2.5 text-right text-slate-600">{v.FC ?? v.heart_rate ?? '-'}</td>
                    <td className="py-2.5 text-right text-slate-600">{v.FR ?? v.respiratory_rate ?? '-'}</td>
                    <td className="py-2.5 text-right text-slate-600">{v.SpO2 ?? v.spo2 ?? '-'}</td>
                    <td className="py-2.5 text-right text-slate-600">{v.ETCO2 ?? v.etco2 ?? '-'}</td>
                    <td className="py-2.5 text-right text-slate-600">{v.PAM ?? v.map ?? '-'}</td>
                    <td className="py-2.5 text-right text-slate-600">{v.Temp ?? v.temperature ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <DollarSign size={15} />Resumo Financeiro
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Custo de Medicamentos</p>
              <p className="text-lg font-bold text-slate-800">{fmt(summary.total_medicine_cost)}</p>
            </div>
            <div className="bg-teal-50 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-teal-600 uppercase mb-1">Honorários</p>
              <p className="text-lg font-bold text-teal-700">{fmt(summary.revenue ?? surgery.revenue)}</p>
            </div>
            <div className={`rounded-lg p-4 text-center ${summary.margin >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${summary.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Margem
              </p>
              <p className={`text-lg font-bold ${summary.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(summary.margin)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
