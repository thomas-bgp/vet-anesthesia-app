import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Plus, Check, X, ChevronDown, Pill, Package, Box } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

const TYPE_TABS = [
  { key: 'farmaco', label: 'Farmaco', icon: Pill },
  { key: 'descartavel', label: 'Descartavel', icon: Package },
]

export default function Compras() {
  const [medicines, setMedicines] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeType, setActiveType] = useState('farmaco')

  // Common form state
  const [medicineId, setMedicineId] = useState('')
  const [isNewMedicine, setIsNewMedicine] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [batchNumber, setBatchNumber] = useState('')

  // Purchase mode state
  const [purchaseMode, setPurchaseMode] = useState('unidade') // 'unidade' | 'caixa'
  const [numBoxes, setNumBoxes] = useState('')
  const [unitsPerBox, setUnitsPerBox] = useState('')
  const [boxPrice, setBoxPrice] = useState('')

  // Farmaco-specific new medicine fields
  const [newMedicineName, setNewMedicineName] = useState('')
  const [newMedicineVolume, setNewMedicineVolume] = useState('')
  const [newMedicineUnitsPerBox, setNewMedicineUnitsPerBox] = useState('1')
  const [newMedicineConcentration, setNewMedicineConcentration] = useState('')
  const [newMedicineActivePrinciple, setNewMedicineActivePrinciple] = useState('')
  const [newMedicinePresentation, setNewMedicinePresentation] = useState('ampola')

  // Descartavel-specific new medicine fields
  const [newDescName, setNewDescName] = useState('')

  const loadMedicines = useCallback(async () => {
    try {
      const res = await api.get('/medicines')
      setMedicines(res.data?.medicines || res.data || [])
    } catch {
      // silent
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await api.get('/bottles')
      const bottles = res.data?.bottles || res.data || []
      // Also load disposable purchases from stock movements
      const stockRes = await api.get('/stock/purchases')
      const purchases = stockRes.data?.purchases || []
      // Merge: bottles are farmacos, stock purchases with descartavel type are disposables
      setHistory({ bottles, purchases })
    } catch {
      // silent
    } finally {
      setHistLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadMedicines(), loadHistory()]).finally(() => setLoading(false))
  }, [loadMedicines, loadHistory])

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  const farmacoMedicines = medicines.filter(m => (m.medicine_type || 'farmaco') === 'farmaco')
  const descartavelMedicines = medicines.filter(m => m.medicine_type === 'descartavel')

  const selectedMedicine = medicines.find((m) => String(m.id) === String(medicineId))
  const volumeMl = isNewMedicine
    ? parseFloat(newMedicineVolume) || 0
    : selectedMedicine?.volume_per_unit_ml || selectedMedicine?.volume_ml || 0

  // Effective quantity and unit price based on purchase mode
  const nBoxes = parseFloat(numBoxes) || 0
  const uPerBox = parseFloat(unitsPerBox) || 0
  const bxPrice = parseFloat(boxPrice) || 0

  const effectiveQty = purchaseMode === 'caixa' ? nBoxes * uPerBox : (parseFloat(quantity) || 0)
  const effectiveUnitPrice = purchaseMode === 'caixa' ? (uPerBox > 0 ? bxPrice / uPerBox : 0) : (parseFloat(unitPrice) || 0)

  const qty = effectiveQty
  const uPrice = effectiveUnitPrice
  const totalPrice = purchaseMode === 'caixa' ? nBoxes * bxPrice : qty * uPrice
  const costPerMl = volumeMl > 0 && effectiveUnitPrice > 0 ? effectiveUnitPrice / volumeMl : 0

  const handleMedicineChange = (val) => {
    if (val === '__new__') {
      setIsNewMedicine(true)
      setMedicineId('')
      setUnitsPerBox('')
    } else {
      setIsNewMedicine(false)
      setMedicineId(val)
      // Pre-fill units per box from medicine data
      const med = medicines.find((m) => String(m.id) === String(val))
      if (med?.units_per_box) {
        setUnitsPerBox(String(med.units_per_box))
      } else {
        setUnitsPerBox('')
      }
    }
  }

  const resetForm = () => {
    setMedicineId('')
    setIsNewMedicine(false)
    setNewMedicineName('')
    setNewMedicineVolume('')
    setNewMedicineUnitsPerBox('1')
    setNewMedicineConcentration('')
    setNewMedicineActivePrinciple('')
    setNewMedicinePresentation('ampola')
    setNewDescName('')
    setQuantity('')
    setUnitPrice('')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setBatchNumber('')
    setPurchaseMode('unidade')
    setNumBoxes('')
    setUnitsPerBox('')
    setBoxPrice('')
  }

  const handleTabChange = (type) => {
    setActiveType(type)
    resetForm()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (activeType === 'farmaco') {
        await submitFarmaco()
      } else {
        await submitDescartavel()
      }
      setSuccessMsg('Compra registrada com sucesso!')
      resetForm()
      loadHistory()
      loadMedicines()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar compra.')
    } finally {
      setSaving(false)
    }
  }

  const submitFarmaco = async () => {
    let medId = medicineId

    if (isNewMedicine) {
      if (!newMedicineName.trim()) throw new Error('Informe o nome do farmaco.')
      if (!newMedicineVolume || parseFloat(newMedicineVolume) <= 0) throw new Error('Informe o volume por unidade.')

      const medRes = await api.post('/medicines', {
        name: newMedicineName.trim(),
        volume_ml: parseFloat(newMedicineVolume),
        units_per_box: parseInt(newMedicineUnitsPerBox) || 1,
        medicine_type: 'farmaco',
        concentration: newMedicineConcentration || null,
        active_principle: newMedicineActivePrinciple || null,
        presentation: newMedicinePresentation,
        unit: newMedicinePresentation === 'ampola' ? 'ampola' : 'frasco',
      })
      medId = medRes.data?.id || medRes.data?.medicine?.id
      if (!medId) throw new Error('Erro ao cadastrar medicamento.')
    }

    if (!medId) throw new Error('Selecione um medicamento.')
    if (purchaseMode === 'caixa') {
      if (!nBoxes || nBoxes <= 0) throw new Error('Informe a quantidade de caixas.')
      if (!uPerBox || uPerBox <= 0) throw new Error('Informe as unidades por caixa.')
      if (!bxPrice || bxPrice <= 0) throw new Error('Informe o preco da caixa.')
    } else {
      if (!qty || qty <= 0) throw new Error('Informe a quantidade.')
      if (!uPrice || uPrice <= 0) throw new Error('Informe o valor unitario.')
    }

    await api.post('/bottles', {
      medicine_id: parseInt(medId),
      quantity: effectiveQty,
      volume_ml: volumeMl,
      purchase_cost_per_unit: effectiveUnitPrice,
      units_per_box: isNewMedicine ? parseInt(newMedicineUnitsPerBox) || 1 : undefined,
      purchased_at: purchaseDate,
      batch_number: batchNumber || undefined,
    })
  }

  const submitDescartavel = async () => {
    let medId = medicineId

    if (isNewMedicine) {
      if (!newDescName.trim()) throw new Error('Informe o nome do descartavel.')

      const medRes = await api.post('/medicines', {
        name: newDescName.trim(),
        medicine_type: 'descartavel',
        unit: 'unidade',
        cost_per_unit: uPrice || 0,
      })
      medId = medRes.data?.id || medRes.data?.medicine?.id
      if (!medId) throw new Error('Erro ao cadastrar descartavel.')
    }

    if (!medId) throw new Error('Selecione um descartavel.')
    if (purchaseMode === 'caixa') {
      if (!nBoxes || nBoxes <= 0) throw new Error('Informe a quantidade de caixas.')
      if (!uPerBox || uPerBox <= 0) throw new Error('Informe as unidades por caixa.')
      if (!bxPrice || bxPrice <= 0) throw new Error('Informe o preco da caixa.')
    } else {
      if (!qty || qty <= 0) throw new Error('Informe a quantidade.')
      if (!uPrice || uPrice <= 0) throw new Error('Informe o valor unitario.')
    }

    await api.post('/stock/purchase', {
      medicine_id: parseInt(medId),
      quantity: effectiveQty,
      unit_cost: effectiveUnitPrice,
      supplier: null,
      notes: `Compra de descartavel`,
    })

    // Update cost_per_unit on the medicine
    await api.put(`/medicines/${medId}`, {
      cost_per_unit: effectiveUnitPrice,
    }).catch(() => {})
  }

  const formatMedicineLabel = (m) => {
    const parts = [m.name]
    if (m.concentration) parts.push(m.concentration)
    if (m.presentation) parts.push(m.presentation === 'ampola' ? 'Ampola' : 'Frasco')
    else if (m.volume_per_unit_ml) parts.push(`${m.volume_per_unit_ml} ml`)
    return parts.join(' - ')
  }

  // Filter history based on active tab
  const historyItems = activeType === 'farmaco'
    ? (history.bottles || [])
    : (history.purchases || []).filter(p => {
        const med = medicines.find(m => m.id === p.medicine_id)
        return med?.medicine_type === 'descartavel'
      })

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Compras</h1>
        <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Compras</h1>
        <p className="text-slate-500 text-sm mt-0.5">Registre compras de farmacos e descartaveis</p>
      </div>

      {/* Type tabs */}
      <div className="flex gap-3">
        {TYPE_TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 text-sm font-semibold transition min-h-[60px] ${
                activeType === t.key
                  ? 'bg-teal-50 border-teal-600 text-teal-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Icon size={20} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <Check size={16} />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {/* Purchase Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Plus size={20} className="text-teal-600" />
          Nova Compra - {activeType === 'farmaco' ? 'Farmaco' : 'Descartavel'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Medicine selector */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {activeType === 'farmaco' ? 'Farmaco' : 'Descartavel'}
              </label>
              <div className="relative">
                <select
                  value={isNewMedicine ? '__new__' : medicineId}
                  onChange={(e) => handleMedicineChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {(activeType === 'farmaco' ? farmacoMedicines : descartavelMedicines).map((m) => (
                    <option key={m.id} value={m.id}>
                      {activeType === 'farmaco' ? formatMedicineLabel(m) : m.name}
                    </option>
                  ))}
                  <option value="__new__">+ Cadastrar novo</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* New farmaco fields */}
            {isNewMedicine && activeType === 'farmaco' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do farmaco</label>
                  <input
                    type="text"
                    value={newMedicineName}
                    onChange={(e) => setNewMedicineName(e.target.value)}
                    placeholder="Ex: Propofol 1%"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Principio ativo</label>
                  <input
                    type="text"
                    value={newMedicineActivePrinciple}
                    onChange={(e) => setNewMedicineActivePrinciple(e.target.value)}
                    placeholder="Ex: Propofol"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Concentracao</label>
                  <input
                    type="text"
                    value={newMedicineConcentration}
                    onChange={(e) => setNewMedicineConcentration(e.target.value)}
                    placeholder="Ex: 10 mg/ml"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apresentacao</label>
                  <div className="flex gap-2">
                    {[{ key: 'ampola', label: 'Ampola' }, { key: 'frasco', label: 'Frasco' }].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setNewMedicinePresentation(t.key)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition min-h-[44px] ${
                          newMedicinePresentation === t.key
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Volume por unidade (ml)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newMedicineVolume}
                    onChange={(e) => setNewMedicineVolume(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unidades por caixa</label>
                  <input
                    type="number"
                    min="1"
                    value={newMedicineUnitsPerBox}
                    onChange={(e) => setNewMedicineUnitsPerBox(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Ex: caixa com 5 ampolas = 5</p>
                </div>
              </>
            )}

            {/* New descartavel fields */}
            {isNewMedicine && activeType === 'descartavel' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do descartavel</label>
                <input
                  type="text"
                  value={newDescName}
                  onChange={(e) => setNewDescName(e.target.value)}
                  placeholder="Ex: Seringa 10ml, Equipo macro, Cateter 22G"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}

            {/* Purchase mode toggle */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Modo de compra</label>
              <div className="flex gap-2">
                {[{ key: 'unidade', label: 'Unidades' }, { key: 'caixa', label: 'Caixas', icon: Box }].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPurchaseMode(t.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition min-h-[44px] ${
                      purchaseMode === t.key
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                    }`}
                  >
                    {t.icon && <t.icon size={16} />}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {purchaseMode === 'unidade' ? (
              <>
                {/* Unidade mode: Quantity + Unit price */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preco unitario (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="Ex: 28.00"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Caixa mode: Boxes, Units per box, Box price */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de caixas</label>
                  <input
                    type="number"
                    min="1"
                    value={numBoxes}
                    onChange={(e) => setNumBoxes(e.target.value)}
                    placeholder="Ex: 2"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unidades por caixa</label>
                  <input
                    type="number"
                    min="1"
                    value={unitsPerBox}
                    onChange={(e) => setUnitsPerBox(e.target.value)}
                    placeholder="Ex: 5"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preco da caixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={boxPrice}
                    onChange={(e) => setBoxPrice(e.target.value)}
                    placeholder="Ex: 120.00"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </>
            )}

            {/* Purchase date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data da compra</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Batch - only for farmacos */}
            {activeType === 'farmaco' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lote <span className="text-slate-400 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Ex: ABC123"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
          </div>

          {/* Auto-calculated summary */}
          {(effectiveQty > 0 || effectiveUnitPrice > 0 || totalPrice > 0) && (
            <div className={`bg-slate-50 rounded-lg p-4 grid grid-cols-2 ${activeType === 'farmaco' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Valor total da compra</p>
                <p className="text-lg font-bold text-slate-800">{fmt(totalPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Total de unidades</p>
                <p className="text-lg font-bold text-slate-800">{effectiveQty > 0 ? effectiveQty : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Preco por unidade</p>
                <p className="text-lg font-bold text-teal-700">{effectiveUnitPrice > 0 ? fmt(effectiveUnitPrice) : '-'}</p>
              </div>
              {activeType === 'farmaco' && (
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Preco por mL</p>
                  <p className="text-lg font-bold text-teal-700">{costPerMl > 0 ? fmt(costPerMl) + '/mL' : '-'}</p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg text-sm transition disabled:opacity-50 min-h-[48px]"
          >
            {saving ? 'Salvando...' : 'Salvar Compra'}
          </button>
        </form>
      </div>

      {/* Purchase History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart size={20} className="text-slate-400" />
            Historico de Compras - {activeType === 'farmaco' ? 'Farmacos' : 'Descartaveis'}
          </h2>
        </div>

        {histLoading ? (
          <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
        ) : historyItems.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma compra registrada</p>
            <p className="text-slate-400 text-sm mt-1">Use o formulario acima para registrar a primeira compra</p>
          </div>
        ) : activeType === 'farmaco' ? (
          /* Farmaco history */
          <>
            {/* Mobile cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {historyItems.map((b) => (
                <div key={b.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{b.medicine_name}</p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {b.purchased_at ? new Date(b.purchased_at).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Valor unit.</p>
                      <p className="font-medium text-slate-700">{fmt(b.purchase_cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Volume</p>
                      <p className="font-medium text-slate-700">{b.volume_ml ? `${b.volume_ml} ml` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Custo/ml</p>
                      <p className="font-bold text-teal-700">{b.cost_per_ml ? fmt(b.cost_per_ml) : '-'}</p>
                    </div>
                  </div>
                  {b.batch_number && <p className="text-xs text-slate-400">Lote: {b.batch_number}</p>}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Farmaco</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Volume</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Valor Unit.</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Custo/ml</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Lote</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyItems.map((b) => {
                    const st = { opened: 'Aberto', sealed: 'Selado', expired: 'Vencido', empty: 'Vazio' }[b.status] || b.status
                    const stCls = {
                      opened: 'bg-green-100 text-green-700',
                      sealed: 'bg-blue-100 text-blue-700',
                      expired: 'bg-red-100 text-red-700',
                      empty: 'bg-slate-100 text-slate-500',
                    }[b.status] || 'bg-slate-100 text-slate-600'
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          {b.purchased_at ? new Date(b.purchased_at).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{b.medicine_name}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{b.volume_ml ? `${b.volume_ml} ml` : '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmt(b.purchase_cost)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-teal-700">{b.cost_per_ml ? fmt(b.cost_per_ml) : '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{b.batch_number || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stCls}`}>{st}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* Descartavel history */
          <>
            <div className="block sm:hidden divide-y divide-slate-100">
              {historyItems.map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{p.medicine_name}</p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Qtd</p>
                      <p className="font-medium text-slate-700">{p.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Valor unit.</p>
                      <p className="font-medium text-slate-700">{fmt(p.unit_cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total</p>
                      <p className="font-bold text-teal-700">{fmt(p.total_cost)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Descartavel</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Qtd</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Valor Unit.</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyItems.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{p.medicine_name}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{p.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmt(p.unit_cost)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-teal-700">{fmt(p.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
