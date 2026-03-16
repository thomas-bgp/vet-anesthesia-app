import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Edit2, Trash2, Activity } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const STATUS_MAP = {
  scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

export default function Surgeries() {
  const navigate = useNavigate()
  const [surgeries, setSurgeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter !== 'all') params.status = statusFilter
      if (speciesFilter !== 'all') params.species = speciesFilter
      if (dateFrom) params.start_date = dateFrom
      if (dateTo) params.end_date = dateTo
      const res = await api.get('/surgeries', { params })
      setSurgeries(res.data?.surgeries || res.data || [])
    } catch {
      setError('Erro ao carregar cirurgias.')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, speciesFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/surgeries/${id}`)
      setDeleting(null)
      load()
    } catch {
      setError('Erro ao excluir cirurgia.')
    }
  }

  const fmt = (v) =>
    v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '-'

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString('pt-BR') : '-'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cirurgias</h1>
          <p className="text-slate-500 text-sm mt-0.5">Registro de procedimentos anestésicos</p>
        </div>
        <button
          onClick={() => navigate('/surgeries/new')}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={18} />
          Nova Cirurgia
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente ou procedimento..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="all">Todas as espécies</option>
            {['Canino', 'Felino', 'Equino', 'Bovino', 'Suíno', 'Silvestre', 'Outro'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
        ) : surgeries.length === 0 ? (
          <div className="py-16 text-center">
            <Activity size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma cirurgia encontrada</p>
            <p className="text-slate-400 text-sm mt-1">Registre o primeiro procedimento</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block sm:hidden space-y-3 p-4">
              {surgeries.map((s) => {
                const st = STATUS_MAP[s.status] || { label: s.status, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 cursor-pointer active:bg-slate-50 transition"
                    onClick={() => navigate(`/surgeries/${s.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{s.patient_name}</p>
                        <p className="text-sm text-slate-600">{s.procedure_name || '-'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span>{s.patient_species || '-'}</span>
                      {s.patient_breed && <span className="text-slate-400">· {s.patient_breed}</span>}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{fmtDate(s.start_time)}</span>
                      <span className="font-medium text-slate-700">{fmt(s.revenue)}</span>
                    </div>
                    <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/surgeries/${s.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-sm text-teal-600 border border-teal-200 hover:bg-teal-50 rounded-lg transition"
                      >
                        <Eye size={15} />
                        Ver
                      </button>
                      <button
                        onClick={() => navigate(`/surgeries/${s.id}/edit`)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 size={15} />
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleting(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Paciente</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Espécie</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Clínica</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Procedimento</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Duração</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Honorários</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {surgeries.map((s) => {
                    const st = STATUS_MAP[s.status] || { label: s.status, cls: 'bg-slate-100 text-slate-600' }
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => navigate(`/surgeries/${s.id}`)}>
                        <td className="px-4 py-3 text-slate-600">{fmtDate(s.start_time)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{s.patient_name}</td>
                        <td className="px-4 py-3 text-slate-600">{s.patient_species || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{s.clinic_name || '-'}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{s.procedure_name || '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {s.duration_minutes ? `${s.duration_minutes} min` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(s.revenue)}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate(`/surgeries/${s.id}`)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                              title="Ver detalhes"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => navigate(`/surgeries/${s.id}/edit`)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Editar"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleting(s)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirmar exclusão</h3>
            <p className="text-slate-500 text-sm mb-6">
              Excluir a cirurgia de <strong>{deleting.patient_name}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={() => handleDelete(deleting.id)} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
