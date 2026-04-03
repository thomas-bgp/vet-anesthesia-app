import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Package, Droplets, X, Check, ChevronDown, ChevronUp, ShoppingCart, Trash2 } from 'lucide-react'
import api from '../api/axios'

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

export default function Estoque() {
  const [bottles, setBottles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [useBottleId, setUseBottleId] = useState(null)
  const [mlUsed, setMlUsed] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [expanded, setExpanded] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/bottles')
      setBottles(res.data?.bottles || res.data || [])
    } catch {
      setError('Erro ao carregar estoque.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t) }
  }, [successMsg])

  // Group bottles by medicine
  const grouped = {}
  for (const b of bottles) {
    const key = b.medicine_id
    if (!grouped[key]) {
      grouped[key] = {
        medicine_id: key,
        name: b.medicine_name || 'Sem nome',
        concentration: b.concentration,
        medicine_type: b.medicine_type || 'farmaco',
        sealed: [],
        opened: [],
        expired: [],
        empty: [],
        totalVolume: 0,
        totalRemaining: 0,
        totalCost: 0,
      }
    }
    const g = grouped[key]
    if (b.status === 'sealed') g.sealed.push(b)
    else if (b.status === 'opened') g.opened.push(b)
    else if (b.status === 'expired') g.expired.push(b)
    else if (b.status === 'empty') g.empty.push(b)
    else g.sealed.push(b)

    if (b.status === 'sealed' || b.status === 'opened') {
      g.totalVolume += parseFloat(b.volume_ml) || 0
      g.totalRemaining += parseFloat(b.remaining_ml) || 0
      g.totalCost += parseFloat(b.purchase_cost) || 0
    }
  }

  const groups = Object.values(grouped)
    .filter(g => (g.sealed.length + g.opened.length) > 0) // hide if only discarded/empty/expired
    .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  const handleOpen = async (id) => {
    setActionLoading(id)
    try { await api.put(`/bottles/${id}/open`); setSuccessMsg('Frasco aberto!'); load() }
    catch { setError('Erro ao abrir.') }
    finally { setActionLoading(null) }
  }

  const handleDiscard = async (id) => {
    setActionLoading(id)
    try { await api.put(`/bottles/${id}/discard`); setSuccessMsg('Descartado.'); load() }
    catch { setError('Erro ao descartar.') }
    finally { setActionLoading(null) }
  }

  const handleUse = async (id) => {
    if (!mlUsed || parseFloat(mlUsed) <= 0) return
    setActionLoading(id)
    try { await api.post(`/bottles/${id}/use`, { ml_used: parseFloat(mlUsed) }); setSuccessMsg('Uso registrado!'); setUseBottleId(null); setMlUsed(''); load() }
    catch { setError('Erro ao registrar uso.') }
    finally { setActionLoading(null) }
  }

  const [confirmDelete, setConfirmDelete] = useState(null) // medicine_id

  const handleDeleteMedicine = async (medicineId) => {
    try {
      await api.delete(`/medicines/${medicineId}`)
      setSuccessMsg('Fármaco descadastrado.')
      setConfirmDelete(null)
      load()
    } catch { setError('Erro ao descadastrar.') }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Estoque</h1>
        <Link to="/compras" className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 min-h-[44px]">
          <ShoppingCart size={16} /> Compras
        </Link>
      </div>

      {successMsg && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2"><Check size={16} />{successMsg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar medicamento..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[48px]" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Estoque vazio</p>
          <Link to="/compras" className="text-teal-600 text-sm font-medium">Registrar compra</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const activeCount = g.sealed.length + g.opened.length
            const pct = g.totalVolume > 0 ? Math.round((g.totalRemaining / g.totalVolume) * 100) : 0
            const isOpen = expanded[g.medicine_id]

            return (
              <div key={g.medicine_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Summary row */}
                <button onClick={() => toggle(g.medicine_id)} className="w-full px-4 py-3 active:bg-slate-50 min-h-[64px]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800 truncate">{g.name}</h3>
                      {g.concentration && <span className="text-[10px] text-slate-400 shrink-0">{g.concentration}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-1">
                        {g.sealed.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{g.sealed.length} selado{g.sealed.length > 1 ? 's' : ''}</span>}
                        {g.opened.length > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{g.opened.length} aberto{g.opened.length > 1 ? 's' : ''}</span>}
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>
                  {/* Volume bar */}
                  {g.totalVolume > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct > 50 ? 'bg-teal-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 w-16 text-right">{g.totalRemaining.toFixed(0)}/{g.totalVolume.toFixed(0)} mL</span>
                    </div>
                  )}
                </button>

                {/* Expanded: individual bottles */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    <div className="divide-y divide-slate-50">
                      {[...g.opened, ...g.sealed, ...g.expired, ...g.empty].map(b => {
                        const statusCfg = { sealed: { l: 'Selado', c: 'bg-blue-100 text-blue-700' }, opened: { l: 'Aberto', c: 'bg-green-100 text-green-700' }, expired: { l: 'Vencido', c: 'bg-red-100 text-red-700' }, empty: { l: 'Vazio', c: 'bg-slate-100 text-slate-500' } }
                        const st = statusCfg[b.status] || statusCfg.sealed
                        const isInactive = b.status === 'expired' || b.status === 'empty'

                        return (
                          <div key={b.id} className={`px-4 py-3 ${isInactive ? 'opacity-40' : ''}`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.c}`}>{st.l}</span>
                                <span className="text-xs text-slate-600">{b.remaining_ml}/{b.volume_ml} mL</span>
                                {b.batch_number && <span className="text-[10px] text-slate-400">Lote: {b.batch_number}</span>}
                              </div>
                              <span className="text-[10px] text-slate-400">{b.cost_per_ml ? fmt(b.cost_per_ml) + '/mL' : ''}</span>
                            </div>

                            {useBottleId === b.id && (
                              <div className="flex gap-2 mt-2">
                                <input type="number" step="0.1" min="0.1" max={b.remaining_ml} value={mlUsed}
                                  onChange={e => setMlUsed(e.target.value)} placeholder="mL usados" autoFocus
                                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]" />
                                <button onClick={() => handleUse(b.id)} disabled={actionLoading === b.id}
                                  className="px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg min-h-[40px]">Salvar</button>
                                <button onClick={() => { setUseBottleId(null); setMlUsed('') }}
                                  className="px-2 py-2 border border-slate-200 rounded-lg min-h-[40px]"><X size={14} /></button>
                              </div>
                            )}

                            {!isInactive && useBottleId !== b.id && (
                              <div className="flex gap-1.5 mt-2">
                                {b.status === 'sealed' && (
                                  <button onClick={() => handleOpen(b.id)} disabled={actionLoading === b.id}
                                    className="flex-1 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg active:bg-teal-700 min-h-[36px]">
                                    Abrir
                                  </button>
                                )}
                                {b.status === 'opened' && (
                                  <>
                                    <button onClick={() => { setUseBottleId(b.id); setMlUsed('') }}
                                      className="flex-1 py-2 bg-green-600 text-white text-xs font-medium rounded-lg active:bg-green-700 min-h-[36px]">
                                      Registrar uso
                                    </button>
                                    <button onClick={() => handleDiscard(b.id)} disabled={actionLoading === b.id}
                                      className="py-2 px-3 border border-red-200 text-red-600 text-xs font-medium rounded-lg active:bg-red-50 min-h-[36px]">
                                      Descartar
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Descadastrar fármaco */}
                    <div className="px-4 py-3 border-t border-slate-100">
                      {confirmDelete === g.medicine_id ? (
                        <div className="flex items-center gap-2">
                          <p className="flex-1 text-xs text-red-600">Descadastrar {g.name}? Os frascos serão mantidos.</p>
                          <button onClick={() => handleDeleteMedicine(g.medicine_id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg min-h-[32px]">Confirmar</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1.5 border border-slate-200 text-slate-500 text-xs rounded-lg min-h-[32px]">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(g.medicine_id)}
                          className="flex items-center gap-1.5 text-xs text-slate-400 active:text-red-500">
                          <Trash2 size={12} /> Descadastrar fármaco
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
