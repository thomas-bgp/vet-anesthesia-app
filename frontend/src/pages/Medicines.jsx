import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, AlertTriangle, Clock, Package } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'
import MedicineForm from './MedicineForm'

export default function Medicines() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (filter === 'low_stock') params.low_stock = 'true'
      else if (filter === 'expiring') params.expiring_soon = 'true'
      const res = await api.get('/medicines', { params })
      setMedicines(res.data?.medicines || res.data || [])
    } catch {
      setError('Erro ao carregar medicamentos.')
    } finally {
      setLoading(false)
    }
  }, [search, filter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/medicines/${id}`)
      setDeleting(null)
      load()
    } catch {
      setError('Erro ao excluir medicamento.')
    }
  }

  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  const isLowStock = (m) => m.current_stock <= m.min_stock
  const isExpiringSoon = (m) => {
    if (!m.expiry_date) return false
    const diff = (new Date(m.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
    return diff <= 30 && diff >= 0
  }
  const isExpired = (m) => {
    if (!m.expiry_date) return false
    return new Date(m.expiry_date) < new Date()
  }

  const rowClass = (m) => {
    if (isLowStock(m)) return 'bg-red-50'
    if (isExpiringSoon(m) || isExpired(m)) return 'bg-amber-50'
    return ''
  }

  const statusBadge = (m) => {
    if (isLowStock(m)) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Estoque baixo</span>
    if (isExpired(m)) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Vencido</span>
    if (isExpiringSoon(m)) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Vencendo</span>
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">OK</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Medicamentos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestão do inventário de medicamentos</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition min-h-[44px]"
        >
          <Plus size={18} />
          Novo Medicamento
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou princípio ativo..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">Todos</option>
          <option value="low_stock">Estoque baixo</option>
          <option value="expiring">Vencimento próximo</option>
        </select>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
        ) : medicines.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhum medicamento encontrado</p>
            <p className="text-slate-400 text-sm mt-1">Adicione medicamentos ao inventário</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {medicines.map((m) => (
                <div key={m.id} className={`p-4 space-y-2 ${rowClass(m)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isLowStock(m) && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                        {(isExpiringSoon(m) || isExpired(m)) && !isLowStock(m) && <Clock size={14} className="text-amber-500 flex-shrink-0" />}
                        <p className="font-medium text-slate-800 truncate">{m.name}</p>
                      </div>
                      {m.active_principle && <p className="text-xs text-slate-500 mt-0.5">{m.active_principle}</p>}
                      {m.concentration && <p className="text-xs text-slate-400">{m.concentration} {m.unit || ''}</p>}
                    </div>
                    {statusBadge(m)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Estoque</p>
                      <p className={`font-semibold ${isLowStock(m) ? 'text-red-600' : 'text-slate-700'}`}>{m.current_stock}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Mínimo</p>
                      <p className="text-slate-600">{m.min_stock}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Custo unit.</p>
                      <p className="text-slate-700">{fmt(m.cost_per_unit)}</p>
                    </div>
                  </div>
                  {m.expiry_date && (
                    <p className={`text-xs ${isExpired(m) ? 'text-red-600 font-medium' : isExpiringSoon(m) ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                      Validade: {new Date(m.expiry_date).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setEditing(m); setShowForm(true) }}
                      className="flex-1 py-2.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 min-h-[44px]">Editar</button>
                    <button onClick={() => setDeleting(m)}
                      className="flex-1 py-2.5 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100 min-h-[44px]">Excluir</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Princípio Ativo</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Concentração</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Estoque</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Mínimo</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Custo Unit.</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Validade</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicines.map((m) => (
                    <tr key={m.id} className={`hover:bg-slate-50 transition ${rowClass(m)}`}>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          {isLowStock(m) && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                          {(isExpiringSoon(m) || isExpired(m)) && !isLowStock(m) && (
                            <Clock size={14} className="text-amber-500 flex-shrink-0" />
                          )}
                          {m.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.active_principle || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {m.concentration ? `${m.concentration} ${m.unit || ''}` : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${isLowStock(m) ? 'text-red-600' : 'text-slate-700'}`}>
                        {m.current_stock}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{m.min_stock}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmt(m.cost_per_unit)}</td>
                      <td className={`px-4 py-3 ${isExpired(m) ? 'text-red-600 font-medium' : isExpiringSoon(m) ? 'text-amber-600 font-medium' : 'text-slate-600'}`}>
                        {m.expiry_date ? new Date(m.expiry_date).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setEditing(m); setShowForm(true) }}
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Editar"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => setDeleting(m)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <MedicineForm
          medicine={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirmar exclusão</h3>
            <p className="text-slate-500 text-sm mb-6">
              Deseja excluir o medicamento <strong>{deleting.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg min-h-[44px]">Cancelar</button>
              <button onClick={() => handleDelete(deleting.id)} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg min-h-[44px]">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
