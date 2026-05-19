import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Package, Droplets, X, Check, ChevronDown, ChevronUp, ShoppingCart, Trash2, Pencil, Calendar, Save, Pill, Plus, TestTube } from 'lucide-react'
import api from '../api/axios'
import { getConcUnits, addConcUnit, parseConc, buildConc } from '../concUnits'

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

// Concentration field. Defined at module scope (NOT inside Estoque) so it isn't recreated on
// every parent render — recreating it remounts the input, dropping focus and any in-flight edit.
// That was the cause of "edit concentration doesn't save": each keystroke triggered a remount
// before the change could propagate. See PROXIMOS_PASSOS.md notes from 2026-05-15.
function ConcField({ value, unit, onChange, label = 'Concentração' }) {
  const [adding, setAdding] = useState(false)
  const [newUnitText, setNewUnitText] = useState('')
  const [unitsList, setUnitsList] = useState(getConcUnits)
  const confirmNewUnit = () => {
    const t = newUnitText.trim()
    if (t && addConcUnit(t)) setUnitsList(getConcUnits())
    if (t) onChange({ concUnit: t })
    setNewUnitText('')
    setAdding(false)
  }
  return (
    <div>
      <label className="text-[10px] text-slate-500 mb-0.5 block">{label}</label>
      <div className="flex gap-1">
        <input type="number" step="any" value={value}
          onChange={e => onChange({ concValue: e.target.value })}
          placeholder="Ex: 10"
          className="flex-1 px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]" />
        {adding ? (
          <div className="flex gap-0.5 items-center">
            <input type="text" value={newUnitText}
              onChange={e => setNewUnitText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmNewUnit()}
              placeholder="Nova unidade" autoFocus
              className="w-24 px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]" />
            <button type="button" onClick={confirmNewUnit}
              className="p-1 text-teal-600 active:text-teal-800"><Check size={14} /></button>
            <button type="button" onClick={() => { setAdding(false); setNewUnitText('') }}
              className="p-0.5 text-slate-400"><X size={12} /></button>
          </div>
        ) : (
          <select value={unit}
            onChange={e => { if (e.target.value === '__add__') { setAdding(true); setNewUnitText('') } else onChange({ concUnit: e.target.value }) }}
            className="w-24 px-1 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px] bg-white">
            {unitsList.map(u => <option key={u}>{u}</option>)}
            <option value="__add__">+ Nova</option>
          </select>
        )}
      </div>
    </div>
  )
}

// Medicine form fields (used for both add and edit). Same reasoning as ConcField — must be at
// module scope to keep its inputs stable across parent re-renders.
function MedicineFormFields({ data, onChange, onSave, onCancel, saving, saveLabel }) {
  return (
    <div className="p-4 space-y-3 bg-white rounded-xl border border-slate-200">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] text-slate-500 mb-0.5 block">Nome *</label>
          <input type="text" value={data.name}
            onChange={e => onChange({ name: e.target.value })}
            placeholder="Nome do fármaco"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-slate-500 mb-0.5 block">Princípio ativo</label>
          <input type="text" value={data.active_principle}
            onChange={e => onChange({ active_principle: e.target.value })}
            placeholder="Princípio ativo"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]" />
        </div>
        <div className="col-span-2">
          <ConcField value={data.concValue} unit={data.concUnit} onChange={onChange} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-0.5 block">Apresentação</label>
          <select value={data.presentation_type}
            onChange={e => onChange({ presentation_type: e.target.value })}
            className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px] bg-white">
            <option value="frasco">Frasco</option>
            <option value="ampola">Ampola</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-0.5 block">Volume/unid (mL)</label>
          <input type="number" step="0.1" value={data.volume_ml}
            onChange={e => onChange({ volume_ml: e.target.value })}
            placeholder="Ex: 10"
            className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm min-h-[40px]" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !data.name.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-teal-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 min-h-[40px]">
          <Save size={14} />
          {saving ? 'Salvando...' : saveLabel}
        </button>
        <button onClick={onCancel}
          className="py-2.5 px-4 border border-slate-200 text-slate-500 text-xs rounded-lg min-h-[40px]">
          Cancelar
        </button>
      </div>
    </div>
  )
}

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
  const [showOkSection, setShowOkSection] = useState(true)

  // Purchases tab state
  const [purchases, setPurchases] = useState([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null) // { key, quantity, purchase_cost, purchased_at }
  const [editPurchaseSaving, setEditPurchaseSaving] = useState(false)

  // Farmacos tab state
  const [medicines, setMedicines] = useState([])
  const [medicinesLoading, setMedicinesLoading] = useState(false)
  const [medicineSearch, setMedicineSearch] = useState('')
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [addMedicineForm, setAddMedicineForm] = useState({ name: '', active_principle: '', concValue: '', concUnit: 'mg/mL', presentation_type: 'frasco', volume_ml: '' })
  const [addMedicineSaving, setAddMedicineSaving] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [editMedicineSaving, setEditMedicineSaving] = useState(false)
  const [confirmDeleteMed, setConfirmDeleteMed] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // ?status=all so empty/expired bottles still come back — we need them to show "esgotado"
      // groups at the top of the list. The frontend filters out 'discarded' below since those
      // are explicit removals the user already chose to forget about.
      const res = await api.get('/bottles', { params: { status: 'all' } })
      const list = res.data?.bottles || res.data || []
      setBottles(list.filter(b => b.status !== 'discarded'))
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

  const loadMedicines = useCallback(async () => {
    setMedicinesLoading(true)
    try {
      const res = await api.get('/medicines')
      setMedicines(res.data?.medicines || res.data || [])
    } catch {
      setError('Erro ao carregar fármacos.')
    } finally {
      setMedicinesLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (activeTab === 'compras' && purchases.length === 0) {
      loadPurchases()
    }
  }, [activeTab, loadPurchases, purchases.length])

  useEffect(() => {
    if (activeTab === 'farmacos' && medicines.length === 0) {
      loadMedicines()
    }
  }, [activeTab, loadMedicines, medicines.length])

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
        // 'frasco' (default) ou 'ampola' — define se a barra é contínua por frasco ou ícone
        // discreto por unidade. Vem do JOIN com medicines.presentation_type no /bottles.
        presentation_type: b.presentation_type || 'frasco',
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

  // Classify each medicine group by urgency so the UI can surface what needs attention.
  // "critical" = nothing usable (no opened, no sealed) OR opened bottle near empty (<5%)
  // "warning"  = active stock <20% OR there's an opened bottle expiring within 7 days
  // "ok"       = everything else
  // Empty/expired bottles are kept on the group so the card can say "esgotado" instead of
  // disappearing the whole row when stock runs out.
  function classifyGroup(g) {
    const active = g.sealed.length + g.opened.length
    const pct = g.totalVolume > 0 ? (g.totalRemaining / g.totalVolume) * 100 : 0
    if (active === 0) return 'critical'
    if (g.opened.length > 0 && pct < 5) return 'critical'
    if (pct < 20) return 'warning'
    const soonMs = 7 * 86400000
    const openedExpiringSoon = g.opened.some(b => {
      const exp = b.expires_at || b.expiry_date
      if (!exp) return false
      const diff = new Date(exp).getTime() - Date.now()
      return diff > 0 && diff < soonMs
    })
    if (openedExpiringSoon) return 'warning'
    return 'ok'
  }

  const filteredGroups = Object.values(grouped)
    .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const criticalGroups = filteredGroups.filter(g => classifyGroup(g) === 'critical')
  const warningGroups = filteredGroups.filter(g => classifyGroup(g) === 'warning')
  const okGroups = filteredGroups.filter(g => classifyGroup(g) === 'ok')
  const groups = filteredGroups // kept for any leftover reference (empty state check below)

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

  const startEdit = (b, concentration) => {
    const conc = parseConc(concentration)
    setEditBottle({ id: b.id, volume_ml: String(b.volume_ml || ''), remaining_ml: String(b.remaining_ml || ''), purchase_cost: String(b.purchase_cost || ''), batch_number: b.batch_number || '', expiry_date: b.expiry_date ? b.expiry_date.split('T')[0] : '', concValue: conc.value, concUnit: conc.unit })
  }

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
        concentration: buildConc(editBottle.concValue, editBottle.concUnit),
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
    const conc = parseConc(p.concentration)
    setEditingPurchase({
      key,
      original: p,
      quantity: String(p.quantity),
      purchase_cost: String(p.purchase_cost || ''),
      purchased_at: p.purchased_at ? p.purchased_at.split('T')[0] : '',
      concValue: conc.value,
      concUnit: conc.unit,
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
      const newConc = buildConc(editingPurchase.concValue, editingPurchase.concUnit)
      if (newConc !== (orig.concentration || null)) {
        const res2 = await api.get(`/bottles?medicine_id=${orig.medicine_id}&status=all`)
        const anyBottle = (res2.data?.bottles || res2.data || [])[0]
        if (anyBottle) {
          await api.put(`/bottles/${anyBottle.id}`, { concentration: newConc })
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

  // Farmacos CRUD handlers
  const handleAddMedicine = async () => {
    if (!addMedicineForm.name.trim()) return
    setAddMedicineSaving(true)
    try {
      await api.post('/medicines', {
        name: addMedicineForm.name.trim(),
        active_principle: addMedicineForm.active_principle.trim() || null,
        concentration: buildConc(addMedicineForm.concValue, addMedicineForm.concUnit),
        presentation_type: addMedicineForm.presentation_type,
        volume_ml: addMedicineForm.volume_ml ? parseFloat(addMedicineForm.volume_ml) : null,
        unit: addMedicineForm.concValue ? addMedicineForm.concUnit : 'unidade',
        medicine_type: 'farmaco',
      })
      setSuccessMsg('Fármaco cadastrado!')
      setShowAddMedicine(false)
      setAddMedicineForm({ name: '', active_principle: '', concValue: '', concUnit: 'mg/mL', presentation_type: 'frasco', volume_ml: '' })
      loadMedicines()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar fármaco.')
    } finally {
      setAddMedicineSaving(false)
    }
  }

  const startEditMedicine = (m) => {
    const conc = parseConc(m.concentration)
    setEditingMedicine({
      id: m.id,
      name: m.name || '',
      active_principle: m.active_principle || '',
      concValue: conc.value,
      concUnit: conc.unit,
      concCustom: conc.custom || '',
      presentation_type: m.presentation_type || 'frasco',
      volume_ml: m.volume_ml ? String(m.volume_ml) : '',
      originalUnit: m.unit || 'unidade',
    })
  }

  const saveEditMedicine = async () => {
    if (!editingMedicine || !editingMedicine.name.trim()) return
    setEditMedicineSaving(true)
    try {
      await api.put(`/medicines/${editingMedicine.id}`, {
        name: editingMedicine.name.trim(),
        active_principle: editingMedicine.active_principle.trim() || null,
        concentration: buildConc(editingMedicine.concValue, editingMedicine.concUnit),
        presentation_type: editingMedicine.presentation_type,
        volume_ml: editingMedicine.volume_ml ? parseFloat(editingMedicine.volume_ml) : null,
        unit: editingMedicine.concValue ? editingMedicine.concUnit : (editingMedicine.originalUnit || 'unidade'),
        medicine_type: 'farmaco',
      })
      setSuccessMsg('Fármaco atualizado!')
      setEditingMedicine(null)
      loadMedicines()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar fármaco.')
    } finally {
      setEditMedicineSaving(false)
    }
  }

  const handleDeleteMed = async (id) => {
    try {
      await api.delete(`/medicines/${id}`)
      setMedicines(prev => prev.filter(m => m.id !== id))
      setSuccessMsg('Fármaco removido!')
      setConfirmDeleteMed(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao remover fármaco.')
    }
  }

  const filteredMedicines = medicines.filter(m =>
    !medicineSearch || (m.name || '').toLowerCase().includes(medicineSearch.toLowerCase()) ||
    (m.active_principle || '').toLowerCase().includes(medicineSearch.toLowerCase())
  ).sort((a, b) => (a.name || '').localeCompare(b.name || ''))

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
        <button
          onClick={() => setActiveTab('farmacos')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border-2 min-h-[48px] ${
            activeTab === 'farmacos'
              ? 'bg-teal-50 border-teal-600 text-teal-700'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          <Pill size={16} className="inline mr-1.5 -mt-0.5" />
          Fármacos
        </button>
      </div>

      {successMsg && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2"><Check size={16} />{successMsg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}

      {activeTab === 'farmacos' ? (
        /* Farmacos tab */
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={medicineSearch} onChange={e => setMedicineSearch(e.target.value)} placeholder="Buscar fármaco..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]" />
            </div>
            <button onClick={() => { setShowAddMedicine(true); setEditingMedicine(null) }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 min-h-[44px] shrink-0">
              <Plus size={16} /> Novo
            </button>
          </div>

          {showAddMedicine && (
            <MedicineFormFields
              data={addMedicineForm}
              onChange={(fields) => setAddMedicineForm(prev => ({ ...prev, ...fields }))}
              onSave={handleAddMedicine}
              onCancel={() => setShowAddMedicine(false)}
              saving={addMedicineSaving}
              saveLabel="Cadastrar"
            />
          )}

          {medicinesLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" /></div>
          ) : filteredMedicines.length === 0 ? (
            <div className="text-center py-12">
              <Pill size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">{medicines.length === 0 ? 'Nenhum fármaco cadastrado' : 'Nenhum fármaco encontrado'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMedicines.map(m => {
                const isEditing = editingMedicine?.id === m.id
                return (
                  <div key={m.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {isEditing ? (
                      <MedicineFormFields
                        data={editingMedicine}
                        onChange={(fields) => setEditingMedicine(prev => ({ ...prev, ...fields }))}
                        onSave={saveEditMedicine}
                        onCancel={() => setEditingMedicine(null)}
                        saving={editMedicineSaving}
                        saveLabel="Salvar"
                      />
                    ) : (
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-800 truncate">{m.name}</h3>
                            {m.active_principle && <p className="text-[11px] text-slate-400 truncate">{m.active_principle}</p>}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${m.presentation_type === 'ampola' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {m.presentation_type === 'ampola' ? 'Ampola' : 'Frasco'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                          {m.concentration && <span>{m.concentration}</span>}
                          {m.volume_ml && <span>{m.volume_ml} mL</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { startEditMedicine(m); setShowAddMedicine(false) }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg active:bg-slate-50 min-h-[36px]">
                            <Pencil size={12} /> Editar
                          </button>
                          {confirmDeleteMed === m.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeleteMed(m.id)}
                                className="py-2 px-3 bg-red-600 text-white text-xs font-medium rounded-lg min-h-[36px]">Excluir</button>
                              <button onClick={() => setConfirmDeleteMed(null)}
                                className="py-2 px-3 border border-slate-200 text-slate-500 text-xs rounded-lg min-h-[36px]">Cancelar</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteMed(m.id)}
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
      ) : activeTab === 'estoque' ? (
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
          ) : (() => {
            // Card renderer — defined inline so we can use it inside each section without
            // duplicating ~200 lines. Returns plain JSX (not a component) so React reconciles
            // each card by its `key` instead of treating "renderGroupCard" as a fresh type.
            const renderGroupCard = (g, urgency) => {
              const activeCount = g.sealed.length + g.opened.length
              const isOpen = expanded[g.medicine_id]
              const isEsgotado = activeCount === 0
              // Border color encodes urgency at a glance — same hierarchy Steve uses on the
              // weather app's "today vs tomorrow" rows. Heavy enough to scan, not loud enough
              // to feel like an alert overload.
              const borderCls = urgency === 'critical'
                ? 'border-red-300'
                : urgency === 'warning' ? 'border-amber-300' : 'border-slate-200'

              return (
                <div key={g.medicine_id} className={`bg-white rounded-xl border ${borderCls} overflow-hidden`}>
                  {/* Summary row */}
                  <button onClick={() => toggle(g.medicine_id)} className="w-full px-4 py-3 active:bg-slate-50 min-h-[64px] text-left">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 truncate">{g.name}</h3>
                        {g.concentration && <span className="text-[10px] text-slate-400 shrink-0">{g.concentration}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isEsgotado ? (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold tracking-wide">ESGOTADO</span>
                        ) : (
                          <span className={`text-sm font-bold tabular-nums ${urgency === 'critical' ? 'text-red-700' : urgency === 'warning' ? 'text-amber-700' : 'text-slate-700'}`}>
                            {g.totalRemaining.toFixed(0)}<span className="text-[10px] font-normal text-slate-400 ml-0.5">mL</span>
                          </span>
                        )}
                        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </div>
                    {/* Display de estoque — diferente pra ampola e pra frasco:
                        - Ampola: cada unidade é discreta. Ícone de tubinho por ampola ativa (até
                          20 visíveis; "+N" se passar). Não faz sentido mostrar barra contínua —
                          ampola tá ou inteira ou consumida.
                        - Frasco: cada frasco vira uma mini-barra independente. Aberto mostra %
                          restante (verde→âmbar→vermelho conforme nível). Selado fica cheio em
                          azul. Anestesistas reclamaram da barra única que dava 100% mesmo com
                          frascos pela metade — fica enganoso. */}
                    {!isEsgotado && g.presentation_type === 'ampola' && (() => {
                      const activeCount = g.opened.length + g.sealed.length
                      const MAX_ICONS = 20
                      const visible = Math.min(activeCount, MAX_ICONS)
                      const overflow = activeCount - visible
                      return (
                        <div className="flex items-center gap-1 flex-wrap">
                          {Array.from({ length: visible }).map((_, i) => (
                            <TestTube key={i} size={14} strokeWidth={2} className="text-slate-500 shrink-0" />
                          ))}
                          {overflow > 0 && (
                            <span className="text-[10px] text-slate-500 font-medium ml-1">+{overflow}</span>
                          )}
                          <span className="text-[10px] text-slate-400 ml-auto">{activeCount} {activeCount === 1 ? 'amp.' : 'amp.'}</span>
                        </div>
                      )
                    })()}
                    {!isEsgotado && g.presentation_type !== 'ampola' && (g.opened.length + g.sealed.length) > 0 && (
                      <div className="space-y-1">
                        {[...g.opened, ...g.sealed].slice(0, 6).map((b) => {
                          const vol = parseFloat(b.volume_ml) || 0
                          const rem = parseFloat(b.remaining_ml) || 0
                          const bpct = vol > 0 ? Math.max(0, Math.min(100, (rem / vol) * 100)) : 0
                          const isSealed = b.status === 'sealed'
                          // Flag visual de idade: frasco aberto cuja validade pós-abertura
                          // (expires_at) já passou. NÃO marca como vencido automaticamente —
                          // só avisa. A anestesista decide se quer Descartar.
                          const expAt = b.expires_at ? new Date(b.expires_at) : null
                          const isStale = !isSealed && expAt && expAt.getTime() < Date.now()
                          const barColor = isSealed
                            ? 'bg-blue-400'
                            : isStale
                              ? 'bg-slate-400'
                              : (bpct > 50 ? 'bg-teal-500' : bpct > 20 ? 'bg-amber-500' : 'bg-red-500')
                          return (
                            <div key={b.id} className="flex items-center gap-2" title={`${isSealed ? 'Selado' : 'Aberto'} — ${rem.toFixed(0)}/${vol.toFixed(0)} mL${isStale ? ' (passou da validade pós-abertura)' : ''}`}>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${bpct}%` }} />
                              </div>
                              {isStale && (
                                <span className="text-[9px] text-slate-500 bg-slate-100 px-1 py-px rounded font-medium shrink-0">vencido?</span>
                              )}
                              <span className="text-[10px] text-slate-500 shrink-0 tabular-nums w-12 text-right">
                                {isSealed ? `${vol.toFixed(0)} mL` : `${rem.toFixed(0)} mL`}
                              </span>
                            </div>
                          )
                        })}
                        {(g.opened.length + g.sealed.length) > 6 && (
                          <span className="text-[10px] text-slate-400">+{(g.opened.length + g.sealed.length) - 6} frasco{((g.opened.length + g.sealed.length) - 6) > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    )}
                    {/* Counter chips only matter when expanded — keep top row clean otherwise. */}
                    {isOpen && (g.sealed.length > 0 || g.opened.length > 0) && (
                      <div className="flex gap-1 mt-2">
                        {g.opened.length > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{g.opened.length} aberto{g.opened.length > 1 ? 's' : ''}</span>}
                        {g.sealed.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{g.sealed.length} selado{g.sealed.length > 1 ? 's' : ''}</span>}
                        {g.empty.length > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{g.empty.length} vazio{g.empty.length > 1 ? 's' : ''}</span>}
                        {g.expired.length > 0 && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-medium">{g.expired.length} vencido{g.expired.length > 1 ? 's' : ''}</span>}
                      </div>
                    )}
                  </button>

                  {/* Quick CTA for esgotado — Steve's "obvious next action" principle. */}
                  {isEsgotado && (
                    <div className="px-4 pb-3 -mt-1">
                      <Link to="/compras" className="block w-full text-center py-2.5 bg-red-600 text-white text-xs font-semibold rounded-lg active:bg-red-700 min-h-[40px]">
                        + Adicionar frasco
                      </Link>
                    </div>
                  )}

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
                                      <ConcField value={editBottle.concValue} unit={editBottle.concUnit}
                                        onChange={o => setEditBottle(v => ({ ...v, ...o }))} />
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
              }

              return (
                <div className="space-y-4">
                  {/* Precisa repor — empty/very-low. Card vermelho com CTA. */}
                  {criticalGroups.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Precisa repor</span>
                        <span className="text-[11px] text-red-500">({criticalGroups.length})</span>
                      </div>
                      <div className="space-y-2">
                        {criticalGroups.map(g => renderGroupCard(g, 'critical'))}
                      </div>
                    </section>
                  )}
                  {/* Atenção — baixo ou vencendo logo. */}
                  {warningGroups.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Atenção</span>
                        <span className="text-[11px] text-amber-500">({warningGroups.length})</span>
                      </div>
                      <div className="space-y-2">
                        {warningGroups.map(g => renderGroupCard(g, 'warning'))}
                      </div>
                    </section>
                  )}
                  {/* Em estoque — colapsável; o que está OK não precisa competir por atenção. */}
                  {okGroups.length > 0 && (
                    <section>
                      <button onClick={() => setShowOkSection(s => !s)} className="flex items-center gap-2 mb-2 px-1 active:opacity-60 min-h-[28px]">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Em estoque</span>
                        <span className="text-[11px] text-slate-400">({okGroups.length})</span>
                        {showOkSection ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                      </button>
                      {showOkSection && (
                        <div className="space-y-2">
                          {okGroups.map(g => renderGroupCard(g, 'ok'))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )
            })()
          }
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
                            <ConcField value={editingPurchase.concValue} unit={editingPurchase.concUnit}
                              onChange={o => setEditingPurchase(v => ({ ...v, ...o }))} />
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
