import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Plus, Check, X, ChevronDown } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

export default function Compras() {
  const [medicines, setMedicines] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // Form state
  const [medicineId, setMedicineId] = useState('')
  const [isNewMedicine, setIsNewMedicine] = useState(false)
  const [newMedicineName, setNewMedicineName] = useState('')
  const [newMedicineVolume, setNewMedicineVolume] = useState('')
  const [newMedicineUnitsPerBox, setNewMedicineUnitsPerBox] = useState('1')
  const [newMedicineType, setNewMedicineType] = useState('farmaco')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [batchNumber, setBatchNumber] = useState('')

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
      setHistory(bottles)
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

  const selectedMedicine = medicines.find((m) => String(m.id) === String(medicineId))
  const volumeMl = isNewMedicine
    ? parseFloat(newMedicineVolume) || 0
    : selectedMedicine?.volume_ml || selectedMedicine?.default_volume_ml || 0

  const qty = parseFloat(quantity) || 0
  const uPrice = parseFloat(unitPrice) || 0
  const totalPrice = qty * uPrice
  const costPerMl = volumeMl > 0 && uPrice > 0 ? uPrice / volumeMl : 0

  const handleMedicineChange = (val) => {
    if (val === '__new__') {
      setIsNewMedicine(true)
      setMedicineId('')
    } else {
      setIsNewMedicine(false)
      setMedicineId(val)
    }
  }

  const resetForm = () => {
    setMedicineId('')
    setIsNewMedicine(false)
    setNewMedicineName('')
    setNewMedicineVolume('')
    setNewMedicineUnitsPerBox('1')
    setNewMedicineType('farmaco')
    setQuantity('')
    setUnitPrice('')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setBatchNumber('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      let medId = medicineId

      // Create new medicine if needed
      if (isNewMedicine) {
        if (!newMedicineName.trim()) {
          setError('Informe o nome do medicamento.')
          setSaving(false)
          return
        }
        if (!newMedicineVolume || parseFloat(newMedicineVolume) <= 0) {
          setError('Informe o volume por unidade.')
          setSaving(false)
          return
        }
        const medRes = await api.post('/medicines', {
          name: newMedicineName.trim(),
          volume_ml: parseFloat(newMedicineVolume),
          units_per_box: parseInt(newMedicineUnitsPerBox) || 1,
          medicine_type: newMedicineType,
        })
        medId = medRes.data?.id || medRes.data?.medicine?.id
        if (!medId) {
          setError('Erro ao cadastrar medicamento.')
          setSaving(false)
          return
        }
        await loadMedicines()
      }

      if (!medId) {
        setError('Selecione um medicamento.')
        setSaving(false)
        return
      }
      if (!qty || qty <= 0) {
        setError('Informe a quantidade.')
        setSaving(false)
        return
      }
      if (!uPrice || uPrice <= 0) {
        setError('Informe o valor unitário.')
        setSaving(false)
        return
      }

      await api.post('/bottles', {
        medicine_id: parseInt(medId),
        quantity: qty,
        volume_ml: volumeMl,
        purchase_cost_per_unit: uPrice,
        units_per_box: isNewMedicine ? parseInt(newMedicineUnitsPerBox) || 1 : undefined,
        purchased_at: purchaseDate,
        batch_number: batchNumber || undefined,
      })

      setSuccessMsg('Compra registrada com sucesso!')
      resetForm()
      loadHistory()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar compra.')
    } finally {
      setSaving(false)
    }
  }

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
        <p className="text-slate-500 text-sm mt-0.5">Registre compras de medicamentos e insumos</p>
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
          Nova Compra
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Medicine selector */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Medicamento</label>
              <div className="relative">
                <select
                  value={isNewMedicine ? '__new__' : medicineId}
                  onChange={(e) => handleMedicineChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white"
                >
                  <option value="">Selecione um medicamento...</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.volume_ml ? `(${m.volume_ml} ml)` : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Cadastrar novo medicamento</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* New medicine fields */}
            {isNewMedicine && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do medicamento</label>
                  <input
                    type="text"
                    value={newMedicineName}
                    onChange={(e) => setNewMedicineName(e.target.value)}
                    placeholder="Ex: Propofol 1%"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <div className="flex gap-2">
                    {[{ key: 'farmaco', label: 'Fármaco' }, { key: 'descartavel', label: 'Descartável' }].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setNewMedicineType(t.key)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition min-h-[44px] ${
                          newMedicineType === t.key
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade comprada</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex: 10"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Unit price */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor unitário (R$)</label>
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

            {/* Batch */}
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
          </div>

          {/* Auto-calculated summary */}
          {(qty > 0 || uPrice > 0) && (
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Valor total</p>
                <p className="text-lg font-bold text-slate-800">{fmt(totalPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Volume unitário</p>
                <p className="text-lg font-bold text-slate-800">{volumeMl > 0 ? `${volumeMl} ml` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Custo por ml</p>
                <p className="text-lg font-bold text-teal-700">{costPerMl > 0 ? fmt(costPerMl) + '/ml' : '-'}</p>
              </div>
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
            Histórico de Compras
          </h2>
        </div>

        {histLoading ? (
          <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma compra registrada</p>
            <p className="text-slate-400 text-sm mt-1">Use o formulário acima para registrar a primeira compra</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {history.map((b) => (
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
                      <p className="font-medium text-slate-700">{fmt(b.purchase_cost_per_unit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Volume</p>
                      <p className="font-medium text-slate-700">{b.total_volume_ml ? `${b.total_volume_ml} ml` : '-'}</p>
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
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Fármaco</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Volume</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Valor Unit.</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Custo/ml</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Lote</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((b) => {
                    const st = { open: 'Aberto', sealed: 'Selado', expired: 'Vencido', empty: 'Vazio' }[b.status] || b.status
                    const stCls = {
                      open: 'bg-green-100 text-green-700',
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
                        <td className="px-4 py-3 text-right text-slate-700">{b.total_volume_ml ? `${b.total_volume_ml} ml` : '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmt(b.purchase_cost_per_unit)}</td>
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
        )}
      </div>
    </div>
  )
}
