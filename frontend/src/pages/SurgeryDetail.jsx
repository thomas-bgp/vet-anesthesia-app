import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Play, Square, Plus, Trash2,
  PawPrint, Activity, Syringe, Clock, DollarSign, FileText, Package
} from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const STATUS_MAP = {
  scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

export default function SurgeryDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [surgery, setSurgery] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [allMedicines, setAllMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddMed, setShowAddMed] = useState(false)
  const [newMed, setNewMed] = useState({ medicine_id: '', quantity_used: '', dose_mg_kg: '', time_administered: '' })
  const [savingMed, setSavingMed] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const load = async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        api.get(`/surgeries/${id}`),
        api.get(`/surgeries/${id}/medicines`),
      ])
      setSurgery(sRes.data.surgery || sRes.data)
      setMedicines(mRes.data?.medicines || mRes.data || [])
    } catch {
      setError('Erro ao carregar dados da cirurgia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    api.get('/medicines').then((res) => setAllMedicines(res.data?.medicines || res.data || [])).catch(() => {})
  }, [])

  const changeStatus = async (newStatus) => {
    setActionLoading(true)
    try {
      await api.patch(`/surgeries/${id}/status`, { status: newStatus })
      await load()
    } catch {
      setError('Erro ao atualizar status.')
    } finally {
      setActionLoading(false)
    }
  }

  const addMedicine = async (e) => {
    e.preventDefault()
    if (!newMed.medicine_id || !newMed.quantity_used) return
    setSavingMed(true)
    try {
      await api.post(`/surgeries/${id}/medicines`, {
        medicine_id: Number(newMed.medicine_id),
        quantity_used: Number(newMed.quantity_used),
        dose_mg_kg: newMed.dose_mg_kg ? Number(newMed.dose_mg_kg) : null,
        time_administered: newMed.time_administered || null,
      })
      setShowAddMed(false)
      setNewMed({ medicine_id: '', quantity_used: '', dose_mg_kg: '', time_administered: '' })
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

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  if (!surgery) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">Cirurgia não encontrada.</div>

  const st = STATUS_MAP[surgery.status] || { label: surgery.status, cls: 'bg-slate-100 text-slate-600' }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/surgeries')} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{surgery.patient_name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{surgery.procedure}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {surgery.status === 'scheduled' && (
            <button onClick={() => changeStatus('in_progress')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition">
              <Play size={16} />Iniciar
            </button>
          )}
          {surgery.status === 'in_progress' && (
            <button onClick={() => changeStatus('completed')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
              <Square size={16} />Finalizar
            </button>
          )}
          <button onClick={() => navigate(`/surgeries/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition">
            <Edit2 size={16} />Editar
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

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
              ['Espécie', surgery.species],
              ['Raça', surgery.breed || '-'],
              ['Peso', surgery.weight ? `${surgery.weight} kg` : '-'],
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
              ['Data', surgery.date ? new Date(surgery.date).toLocaleString('pt-BR') : '-'],
              ['Duração', surgery.duration_minutes ? `${surgery.duration_minutes} min` : '-'],
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
        {surgery.anesthesia_protocol && (
          <p className="text-sm text-slate-700 mb-4 font-medium">{surgery.anesthesia_protocol}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ['MPA', surgery.pre_anesthesia],
            ['Indução', surgery.induction],
            ['Manutenção', surgery.maintenance],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</p>
              <p className="text-sm text-slate-700">{value || <span className="text-slate-400 italic">Não informado</span>}</p>
            </div>
          ))}
        </div>
        {surgery.notes && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1"><FileText size={12} />Observações</p>
            <p className="text-sm text-amber-800">{surgery.notes}</p>
          </div>
        )}
      </div>

      {/* Medicines Used */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <Package size={15} />Medicamentos Utilizados
          </h3>
          <button onClick={() => setShowAddMed(!showAddMed)}
            className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium">
            <Plus size={16} />Adicionar
          </button>
        </div>

        {showAddMed && (
          <form onSubmit={addMedicine} className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Medicamento *</label>
                <select value={newMed.medicine_id} onChange={(e) => setNewMed({ ...newMed, medicine_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Selecione...</option>
                  {allMedicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Qtd. usada *</label>
                <input type="number" step="0.01" min="0" value={newMed.quantity_used}
                  onChange={(e) => setNewMed({ ...newMed, quantity_used: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Ex: 2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dose (mg/kg)</label>
                <input type="number" step="0.01" min="0" value={newMed.dose_mg_kg}
                  onChange={(e) => setNewMed({ ...newMed, dose_mg_kg: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Ex: 4.0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Horário</label>
                <input type="time" value={newMed.time_administered}
                  onChange={(e) => setNewMed({ ...newMed, time_administered: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setShowAddMed(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" disabled={savingMed}
                className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                {savingMed ? '...' : 'Adicionar'}
              </button>
            </div>
          </form>
        )}

        {medicines.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Nenhum medicamento registrado nesta cirurgia.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-2 font-semibold text-slate-600">Medicamento</th>
                    <th className="text-right pb-2 font-semibold text-slate-600">Qtd.</th>
                    <th className="text-right pb-2 font-semibold text-slate-600">Dose (mg/kg)</th>
                    <th className="text-right pb-2 font-semibold text-slate-600">Horário</th>
                    <th className="text-center pb-2 font-semibold text-slate-600">Remover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicines.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">{m.medicine_name || m.name}</td>
                      <td className="py-2.5 text-right text-slate-600">{m.quantity_used}</td>
                      <td className="py-2.5 text-right text-slate-600">{m.dose_mg_kg ?? '-'}</td>
                      <td className="py-2.5 text-right text-slate-600">{m.time_administered || '-'}</td>
                      <td className="py-2.5 text-center">
                        <button onClick={() => removeMedicine(m.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Timeline */}
            {medicines.filter(m => m.time_administered).length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                  <Clock size={12} />Linha do tempo
                </h4>
                <div className="space-y-2">
                  {[...medicines]
                    .filter(m => m.time_administered)
                    .sort((a, b) => a.time_administered.localeCompare(b.time_administered))
                    .map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded w-14 text-center">{m.time_administered}</span>
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-sm text-slate-700">{m.medicine_name || m.name} <span className="text-slate-400">({m.quantity_used} un.)</span></span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

