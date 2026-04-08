import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Package, Droplets, X, Check, ChevronDown, ChevronUp, ShoppingCart, Trash2, Pencil, Calendar, Save } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState('estoque')

  // Purchases tab state
  const [purchases, setPurchases] = useState([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null) // { key, quantity, purchase_cost, purchased_at }
  const [editPurchaseSaving, setEditPurchaseSaving] = useState(false)

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

  const loadPurchases = useCallback(async () => {
    setPurchasesLoading(true)
    try {
      const res = await api.get('/bottles/purchases')
      setPurchases(res.data?.purchases || [])
    } catch {
      setError('Erro ao carregar compras.')
    } finally {
      setPurchasesLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (activeTab === 'compras' && purchases.length === 0) {
      loadPurchases()
    }
  }, [activeTab, loadPurchases, purchases.length])

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

  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [purchaseDateFrom, setPurchaseDateFrom] = useState('')
  const [purchaseDateTo, setPurchaseDateTo] = useState('')
  const [purchaseSort, setPurchaseSort] = useState('date') // 'date' | 'name'
  const [editBottle, setEditBottle] = useState(null) // { id, volume_ml, remaining_ml, purchase_cost, batch_number }
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDeleteBottle, setConfirmDeleteBottle] = useState(null)
  const [confirmDeletePurchase, setConfirmDeletePurchase] = useState(null)

  const handleDeleteBottle = async (id) => {
    setActionLoading(id)
    try {
      await api.delete(`/bottles/${id}`)
      setSuccessMsg('Frasco removido!')
      setConfirmDeleteBottle(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao remover frasco.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeletePurchase = async (p) => {
    try {
      await api.delete(`/bottles/purchase?medicine_id=${p.medicine_id}&purchased_at=${encodeURIComponent(p.purchased_at)}&volume_ml=${p.volume_ml}&purchase_cost=${p.purchase_cost}`)
      setSuccessMsg('Compra removida!')
      setConfirmDeletePurchase(null)
      loadPurchases()
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao remover compra.')
    }
  }

  const startEdit = (b, concentration) => setEditBottle({ id: b.id, volume_ml: String(b.volume_ml || ''), remaining_ml: String(b.remaining_ml || ''), purchase_cost: String(b.purchase_cost || ''), batch_number: b.batch_number || '', expiry_date: b.expiry_date ? b.expiry_date.split('T')[0] : '', concentration: concentration || '' })

  const saveEdit = async () => {
    if (!editBottle) return
    setEditSaving(true)
    try {
      await api.put(`/bottles/${editBottle.id}`, {
        volume_ml: parseFloat(editBottle.volume_ml),
        remaining_ml: parseFloat(editBottle.remaining_ml),
        purchase_cost: parseFloat(editBottle.purchase_cost),
        batch_number: editBottle.batch_number,
        expiry_date: editBottle.expiry_date || null,
        concentration: editBottle.concentration || null,
      })
      setSuccessMsg('Frasco atualizado!')
      setEditBottle(null)
      load()
    } catch { setError('Erro ao atualizar.') }
    finally { setEditSaving(false) }
  }

  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleDeleteMedicine = async (medicineId) => {
    try {
      await api.delete(`/medicines/${medicineId}`)
      setSuccessMsg('Farmaco descadastrado.')
      setConfirmDelete(null)
      load()
    } catch { setError('Erro ao descadastrar.') }
  }

  // Purchase editing handlers
  const startEditPurchase = (p) => {
    const key = `${p.medicine_id}_${p.purchased_at}_${p.volume_ml}_${p.purchase_cost}`
    setEditingPurchase({
      key,
      original: p,
      quantity: String(p.quantity),
      purchase_cost: String(p.purchase_cost || ''),
      purchased_at: p.purchased_at ? p.purchased_at.split('T')[0] : '',
      concentration: p.concentration || '',
    })
  }

  const savePurchaseEdit = async () => {
    if (!editingPurchase) return
    setEditPurchaseSaving(true)
    try {
      const orig = editingPurchase.original
      const newQty = parseInt(editingPurchase.quantity) || 0
      const oldQty = orig.quantity
      const diff = newQty - oldQty

      if (diff > 0) {
        // Add new sealed bottles
        await api.post('/bottles', {
          medicine_id: orig.medicine_id,
          quantity: diff,
          volume_ml: orig.volume_ml,
          purchase_cost_per_unit: parseFloat(editingPurchase.purchase_cost) || orig.purchase_cost,
          purchased_at: editingPurchase.purchased_at || orig.purchased_at,
        })
      } else if (diff < 0) {
        // Need to delete sealed bottles for this medicine+purchase group
        // Get sealed bottles for this medicine
        const res = await api.get(`/bottles?medicine_id=${orig.medicine_id}&status=sealed`)
        const sealedBottles = (res.data?.bottles || res.data || [])
          .filter(b => b.status === 'sealed' && b.purchased_at &&
            b.purchased_at.split('T')[0] === (orig.purchased_at ? orig.purchased_at.split('T')[0] : '') &&
            parseFloat(b.volume_ml) === parseFloat(orig.volume_ml) &&
            parseFloat(b.purchase_cost) === parseFloat(orig.purchase_cost))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // newest first

        const toDelete = Math.min(Math.abs(diff), sealedBottles.length)
        for (let i = 0; i < toDelete; i++) {
          await api.delete(`/bottles/${sealedBottles[i].id}`)
        }
      }

      // If cost or date changed, update remaining bottles in this group
      const costChanged = parseFloat(editingPurchase.purchase_cost) !== parseFloat(orig.purchase_cost)
      const dateChanged = editingPurchase.purchased_at !== (orig.purchased_at ? orig.purchased_at.split('T')[0] : '')
      if (costChanged || dateChanged) {
        const res = await api.get(`/bottles?medicine_id=${orig.medicine_id}&status=all`)
        const groupBottles = (res.data?.bottles || res.data || [])
          .filter(b =>
            b.purchased_at && b.purchased_at.split('T')[0] === (orig.purchased_at ? orig.purchased_at.split('T')[0] : '') &&
            parseFloat(b.volume_ml) === parseFloat(orig.volume_ml) &&
            parseFloat(b.purchase_cost) === parseFloat(orig.purchase_cost))
        for (const bottle of groupBottles) {
          const updates = {}
          if (costChanged) updates.purchase_cost = parseFloat(editingPurchase.purchase_cost)
          if (dateChanged) updates.purchased_at = editingPurchase.purchased_at
          await api.put(`/bottles/${bottle.id}`, updates)
        }
      }

      // If concentration changed, update via any bottle in this group
      if (editingPurchase.concentration !== (orig.concentration || '')) {
        const res2 = await api.get(`/bottles?medicine_id=${orig.medicine_id}&status=all`)
        const anyBottle = (res2.data?.bottles || res2.data || [])[0]
        if (anyBottle) {
          await api.put(`/bottles/${anyBottle.id}`, { concentration: editingPurchase.concentration })
        }
      }

      setSuccessMsg('Compra atualizada!')
      setEditingPurchase(null)
      loadPurchases()
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar compra.')
    } finally {
      setEditPurchaseSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Estoque</h1>
        <Link to="/compras" className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 min-h-[44px]">
          <ShoppingCart size={16} /> Compras
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('estoque')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border-2 min-h-[48px] ${
            activeTab === 'estoque'
              ? 'bg-teal-50 border-teal-600 text-teal-700'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          <Package size={16} className="inline mr-1.5 -mt-0.5" />
          Estoque
        </button>
        <button
          onClick={() => setActiveTab('compras')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border-2 min-h-[48px] ${
            activeTab === 'compras'
              ? 'bg-teal-50 border-teal-600 text-teal-700'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          <ShoppingCart size={16} className="inline mr-1.5 -mt-0.5" />
          Compras
        </button>
      </div>

      {successMsg && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2"><Check size={16} />{successMsg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}

      {activeTab === 'estoque' ? (
        <>
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
                          {[...g.opened, ...g.sealed].map(b => {
                            const statusCfg = { sealed: { l: 'Selado', c: 'bg-blue-100 text-blue-700' }, opened: { l: 'Aberto', c: 'bg-green-100 text-green-700' }, expired: { l: 'Vencido', c: 'bg-red-100 text-red-700' }, empty: { l: 'Vazio', c: 'bg-slate-100 text-slate-500' } }
                            const st = statusCfg[b.status] || statusCfg.sealed
                            const isInactive = b.status === 'expired' || b.status === 'empty'

                            return (
                              <div key={b.id} className={`px-4 py-3 ${isInactive ? 'opacity-40' : ''}`}>
                                {/* Edit mode */}
                                {editBottle?.id === b.id ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] text-slate-500">Volume total (mL)</label>
                                        <input type="number" step="0.1" value={editBottle.volume_ml}
                                          onChange={e => setEditBottle(v => ({ ...v, volume_ml: e.target.value }))}
                                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[36px]" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-500">Restante (mL)</label>
                                        <input type="number" step="0.1" value={editBottle.remaining_ml}
                                          onChange={e => setEditBottle(v => ({ ...v, remaining_ml: e.target.value }))}
                                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[36px]" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-500">Custo (R$)</label>
                                        <input type="number" step="0.01" value={editBottle.purchase_cost}
                                          onChange={e => setEditBottle(v => ({ ...v, purchase_cost: e.target.value }))}
                                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[36px]" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-500">Lote</label>
                                        <input type="text" value={editBottle.batch_number}
                                          onChange={e => setEditBottle(v => ({ ...v, batch_number: e.target.value }))}
                                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[36px]" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-500">Concentração</label>
                                        <input type="text" value={editBottle.concentration}
                                          onChange={e => setEditBottle(v => ({ ...v, concentration: e.target.value }))}
                                          placeholder="ex: 10mg/mL"
                                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[36px]" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-500">Validade</label>
                                        <input type="date" value={editBottle.expiry_date}
                                          onChange={e => setEditBottle(v => ({ ...v, expiry_date: e.target.value }))}
                                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[36px]" />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={saveEdit} disabled={editSaving}
                                        className="flex-1 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg min-h-[36px]">{editSaving ? '...' : 'Salvar'}</button>
                                      <button onClick={() => setEditBottle(null)}
                                        className="py-2 px-3 border border-slate-200 text-slate-500 text-xs rounded-lg min-h-[36px]">Cancelar</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.c}`}>{st.l}</span>
                                        <span className="text-xs text-slate-600">{b.remaining_ml}/{b.volume_ml} mL</span>
                                        {b.batch_number && <span className="text-[10px] text-slate-400">Lote: {b.batch_number}</span>}
                                        {b.expiry_date && <span className="text-[10px] text-amber-500">Val: {new Date(b.expiry_date).toLocaleDateString('pt-BR')}</span>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400">{b.cost_per_ml ? fmt(b.cost_per_ml) + '/mL' : ''}</span>
                                        <button onClick={() => startEdit(b, g.concentration)} className="p-1 text-slate-400 active:text-teal-600"><Pencil size={12} /></button>
                                      </div>
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
                                          <>
                                            <button onClick={() => handleOpen(b.id)} disabled={actionLoading === b.id}
                                              className="flex-1 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg active:bg-teal-700 min-h-[36px]">
                                              Abrir
                                            </button>
                                            <button onClick={() => handleDiscard(b.id)} disabled={actionLoading === b.id}
                                              className="py-2 px-3 border border-amber-200 text-amber-600 text-xs font-medium rounded-lg active:bg-amber-50 min-h-[36px]">
                                              Descartar
                                            </button>
                                            {confirmDeleteBottle === b.id ? (
                                              <div className="flex items-center gap-1">
                                                <button onClick={() => handleDeleteBottle(b.id)} disabled={actionLoading === b.id}
                                                  className="py-2 px-2 bg-red-600 text-white text-[10px] font-medium rounded-lg min-h-[36px]">Sim</button>
                                                <button onClick={() => setConfirmDeleteBottle(null)}
                                                  className="py-2 px-2 border border-slate-200 text-slate-500 text-[10px] rounded-lg min-h-[36px]">Não</button>
                                              </div>
                                            ) : (
                                              <button onClick={() => setConfirmDeleteBottle(b.id)}
                                                className="py-2 px-2 border border-red-200 text-red-500 text-xs rounded-lg active:bg-red-50 min-h-[36px]">
                                                <Trash2 size={14} />
                                              </button>
                                            )}
                                          </>
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
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {/* Descadastrar farmaco */}
                        <div className="px-4 py-3 border-t border-slate-100">
                          {confirmDelete === g.medicine_id ? (
                            <div className="flex items-center gap-2">
                              <p className="flex-1 text-xs text-red-600">Descadastrar {g.name}? Os frascos serao mantidos.</p>
                              <button onClick={() => handleDeleteMedicine(g.medicine_id)}
                                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg min-h-[32px]">Confirmar</button>
                              <button onClick={() => setConfirmDelete(null)}
                                className="px-3 py-1.5 border border-slate-200 text-slate-500 text-xs rounded-lg min-h-[32px]">Cancelar</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(g.medicine_id)}
                              className="flex items-center gap-1.5 text-xs text-slate-400 active:text-red-500">
                              <Trash2 size={12} /> Descadastrar farmaco
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
        </>
      ) : (() => {
        const filteredPurchases = purchases.filter(p => {
          if (purchaseSearch && !(p.medicine_name || '').toLowerCase().includes(purchaseSearch.toLowerCase())) return false
          if (purchaseDateFrom && p.purchased_at < purchaseDateFrom) return false
          if (purchaseDateTo && p.purchased_at > purchaseDateTo) return false
          return true
        }).sort((a, b) => purchaseSort === 'name'
          ? (a.medicine_name || '').localeCompare(b.medicine_name || '')
          : (b.purchased_at || '').localeCompare(a.purchased_at || '')
        )
        return (
        /* Compras tab */
        <>
          {/* Search + date filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)} placeholder="Buscar fármaco..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]" />
            </div>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg self-start">
              <button onClick={() => setPurchaseSort('date')}
                className={`px-3 py-1.5 rounded text-[11px] font-medium min-h-[32px] ${purchaseSort === 'date' ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}>
                Data
              </button>
              <button onClick={() => setPurchaseSort('name')}
                className={`px-3 py-1.5 rounded text-[11px] font-medium min-h-[32px] ${purchaseSort === 'name' ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}>
                A-Z
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" value={purchaseDateFrom} onChange={e => setPurchaseDateFrom(e.target.value)}
                  className="w-full pl-9 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 min-h-[40px]" placeholder="De" />
              </div>
              <div className="flex-1 relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" value={purchaseDateTo} onChange={e => setPurchaseDateTo(e.target.value)}
                  className="w-full pl-9 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 min-h-[40px]" placeholder="Até" />
              </div>
              {(purchaseDateFrom || purchaseDateTo) && (
                <button onClick={() => { setPurchaseDateFrom(''); setPurchaseDateTo('') }}
                  className="px-2 py-2 text-slate-400 active:text-slate-600 min-h-[40px]"><X size={16} /></button>
              )}
            </div>
          </div>

          {purchasesLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" /></div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">{purchases.length === 0 ? 'Nenhuma compra registrada' : 'Nenhuma compra encontrada'}</p>
              {purchases.length === 0 && <Link to="/compras" className="text-teal-600 text-sm font-medium">Registrar compra</Link>}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map((p, idx) => {
                const pKey = `${p.medicine_id}_${p.purchased_at}_${p.volume_ml}_${p.purchase_cost}`
                const isEditing = editingPurchase?.key === pKey

                return (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {isEditing ? (
                      /* Inline edit mode */
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-slate-800">{p.medicine_name}</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-500 mb-0.5 block">Concentração</label>
                            <input
                              type="text"
                              value={editingPurchase.concentration}
                              onChange={e => setEditingPurchase(v => ({ ...v, concentration: e.target.value }))}
                              placeholder="ex: 10mg/mL"
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 mb-0.5 block">Quantidade</label>
                            <input
                              type="number"
                              min="1"
                              value={editingPurchase.quantity}
                              onChange={e => setEditingPurchase(v => ({ ...v, quantity: e.target.value }))}
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 mb-0.5 block">Custo unit. (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingPurchase.purchase_cost}
                              onChange={e => setEditingPurchase(v => ({ ...v, purchase_cost: e.target.value }))}
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-500 mb-0.5 block">Data da compra</label>
                            <input
                              type="date"
                              value={editingPurchase.purchased_at}
                              onChange={e => setEditingPurchase(v => ({ ...v, purchased_at: e.target.value }))}
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={savePurchaseEdit}
                            disabled={editPurchaseSaving}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-teal-600 text-white text-xs font-medium rounded-lg min-h-[40px]"
                          >
                            <Save size={14} />
                            {editPurchaseSaving ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            onClick={() => setEditingPurchase(null)}
                            className="py-2.5 px-4 border border-slate-200 text-slate-500 text-xs rounded-lg min-h-[40px]"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-800 truncate">{p.medicine_name}</h3>
                            {p.concentration && <span className="text-[10px] text-slate-400">{p.concentration}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar size={12} />
                              {p.purchased_at ? new Date(p.purchased_at).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center mb-3">
                          <div className="bg-slate-50 rounded-lg py-2 px-1">
                            <p className="text-[10px] text-slate-400">Qtd</p>
                            <p className="text-sm font-bold text-slate-800">{p.quantity}</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg py-2 px-1">
                            <p className="text-[10px] text-slate-400">Volume</p>
                            <p className="text-sm font-bold text-slate-800">{p.volume_ml ? `${p.volume_ml}ml` : '-'}</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg py-2 px-1">
                            <p className="text-[10px] text-slate-400">Unit.</p>
                            <p className="text-sm font-bold text-teal-700">{fmt(p.purchase_cost)}</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg py-2 px-1">
                            <p className="text-[10px] text-slate-400">Total</p>
                            <p className="text-sm font-bold text-teal-700">{fmt(p.total_cost)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditPurchase(p)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg active:bg-slate-50 min-h-[36px]"
                          >
                            <Pencil size={12} />
                            Editar
                          </button>
                          {confirmDeletePurchase === pKey ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeletePurchase(p)}
                                className="py-2 px-3 bg-red-600 text-white text-xs font-medium rounded-lg min-h-[36px]">Excluir</button>
                              <button onClick={() => setConfirmDeletePurchase(null)}
                                className="py-2 px-3 border border-slate-200 text-slate-500 text-xs rounded-lg min-h-[36px]">Cancelar</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeletePurchase(pKey)}
                              className="py-2 px-3 border border-red-200 text-red-500 text-xs font-medium rounded-lg active:bg-red-50 min-h-[36px]">
                              <Trash2 size={14} />
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
        </>
        )
      })()}
    </div>
  )
}
