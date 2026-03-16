import { useState, useEffect, useCallback } from 'react'
import { Plus, Package, ShoppingCart, ArrowUpDown } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'
import PurchaseForm from './PurchaseForm'

const MOVEMENT_TYPE = {
  purchase: { label: 'Compra', cls: 'bg-green-100 text-green-700' },
  usage: { label: 'Uso em cirurgia', cls: 'bg-blue-100 text-blue-700' },
  adjustment: { label: 'Ajuste', cls: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Descarte', cls: 'bg-red-100 text-red-700' },
}

export default function Stock() {
  const [tab, setTab] = useState('purchases')
  const [purchases, setPurchases] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'purchases') {
        const res = await api.get('/stock/purchases')
        setPurchases(res.data?.purchases || res.data || [])
      } else {
        const res = await api.get('/stock/movements')
        setMovements(res.data?.movements || res.data || [])
      }
    } catch {
      setError('Erro ao carregar dados de estoque.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estoque</h1>
          <p className="text-slate-500 text-sm mt-0.5">Compras e movimentações de medicamentos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition min-h-[44px]"
        >
          <Plus size={18} />
          Registrar Compra
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('purchases')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition min-h-[44px] ${tab === 'purchases' ? 'bg-white shadow text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShoppingCart size={16} />Compras
        </button>
        <button
          onClick={() => setTab('movements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition min-h-[44px] ${tab === 'movements' ? 'bg-white shadow text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ArrowUpDown size={16} />Histórico
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
        ) : tab === 'purchases' ? (
          purchases.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Nenhuma compra registrada</p>
              <p className="text-slate-400 text-sm mt-1">Registre a primeira compra de medicamentos</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {purchases.map((p) => (
                  <div key={p.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{p.medicine_name}</p>
                        {p.active_principle && (
                          <p className="text-xs text-slate-500">{p.active_principle}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Qtd</p>
                        <p className="font-medium text-slate-700">{p.quantity} {p.medicine_unit || ''}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Custo unit.</p>
                        <p className="font-medium text-slate-700">{fmt(p.unit_cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Total</p>
                        <p className="font-bold text-teal-700">{fmt(p.total_cost || p.quantity * p.unit_cost)}</p>
                      </div>
                    </div>
                    {p.supplier && (
                      <p className="text-xs text-slate-500">Fornecedor: {p.supplier}</p>
                    )}
                    {p.notes && (
                      <p className="text-xs text-slate-400 truncate">{p.notes}</p>
                    )}
                  </div>
                ))}
                <div className="p-4 bg-slate-50 border-t-2 border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-600">Total gasto em compras</span>
                  <span className="font-bold text-teal-700">
                    {fmt(purchases.reduce((sum, p) => sum + (p.total_cost || p.quantity * p.unit_cost), 0))}
                  </span>
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Data</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Medicamento</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Quantidade</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Custo Unit.</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Fornecedor</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{p.medicine_name}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{p.quantity} {p.medicine_unit || ''}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmt(p.unit_cost)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(p.total_cost || p.quantity * p.unit_cost)}</td>
                        <td className="px-4 py-3 text-slate-600">{p.supplier || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-600">Total gasto em compras</td>
                      <td className="px-4 py-3 text-right font-bold text-teal-700">
                        {fmt(purchases.reduce((sum, p) => sum + (p.total_cost || p.quantity * p.unit_cost), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )
        ) : (
          movements.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowUpDown size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {movements.map((m) => {
                  const type = MOVEMENT_TYPE[m.type] || { label: m.type, cls: 'bg-slate-100 text-slate-600' }
                  return (
                    <div key={m.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-800 text-sm">{m.medicine_name}</p>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.cls}`}>{type.label}</span>
                        <span className={`text-sm font-bold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </div>
                      {m.patient_name && (
                        <p className="text-xs text-slate-500">Paciente: {m.patient_name}</p>
                      )}
                      {m.procedure_name && (
                        <p className="text-xs text-slate-500">Procedimento: {m.procedure_name}</p>
                      )}
                      {m.notes && (
                        <p className="text-xs text-slate-400 truncate">{m.notes}</p>
                      )}
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
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Medicamento</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Tipo</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Quantidade</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Paciente</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Procedimento</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => {
                      const type = MOVEMENT_TYPE[m.type] || { label: m.type, cls: 'bg-slate-100 text-slate-600' }
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">
                            {m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{m.medicine_name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.cls}`}>{type.label}</span>
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{m.patient_name || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{m.procedure_name || '-'}</td>
                          <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{m.notes || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>

      {showForm && (
        <PurchaseForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}
