import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import api from '../api/axios'

const EMPTY = {
  name: '', active_principle: '', concentration: '', bottle_volume: '', unit: 'mg/mL',
  current_stock: '', min_stock: '', cost_per_unit: '', supplier: '', expiry_date: '',
}

export default function MedicineForm({ medicine, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (medicine) {
      setForm({
        name: medicine.name || '',
        active_principle: medicine.active_principle || '',
        concentration: medicine.concentration || '',
        bottle_volume: medicine.bottle_volume || '',
        unit: medicine.unit || 'mg/mL',
        current_stock: medicine.current_stock ?? '',
        min_stock: medicine.min_stock ?? '',
        cost_per_unit: medicine.cost_per_unit ?? '',
        supplier: medicine.supplier || '',
        expiry_date: medicine.expiry_date ? medicine.expiry_date.slice(0, 10) : '',
      })
    }
  }, [medicine])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name || !form.current_stock || !form.min_stock || !form.cost_per_unit) {
      setError('Preencha os campos obrigatórios.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        current_stock: Number(form.current_stock),
        min_stock: Number(form.min_stock),
        cost_per_unit: Number(form.cost_per_unit),
      }
      if (medicine?.id) {
        await api.put(`/medicines/${medicine.id}`, payload)
      } else {
        await api.post('/medicines', payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar medicamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {medicine ? 'Editar Medicamento' : 'Novo Medicamento'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome comercial *</label>
              <input name="name" value={form.name} onChange={handle} className={inputClass} placeholder="Ex: Propofol" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Princípio ativo</label>
              <input name="active_principle" value={form.active_principle} onChange={handle} className={inputClass} placeholder="Ex: Propofol" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Concentração</label>
              <input name="concentration" value={form.concentration} onChange={handle} className={inputClass} placeholder="Ex: 10 mg/mL" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Volume do frasco</label>
              <input name="bottle_volume" value={form.bottle_volume} onChange={handle} className={inputClass} placeholder="Ex: 20 mL" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
              <select name="unit" value={form.unit} onChange={handle} className={inputClass}>
                <option>mg/mL</option>
                <option>mg</option>
                <option>mL</option>
                <option>UI/mL</option>
                <option>mcg/mL</option>
                <option>%</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
              <input name="supplier" value={form.supplier} onChange={handle} className={inputClass} placeholder="Nome do fornecedor" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque atual *</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" name="current_stock" value={form.current_stock} onChange={handle} className={inputClass} placeholder="0" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque mínimo *</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" name="min_stock" value={form.min_stock} onChange={handle} className={inputClass} placeholder="0" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custo unitário (R$) *</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" name="cost_per_unit" value={form.cost_per_unit} onChange={handle} className={inputClass} placeholder="0,00" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de validade</label>
              <input type="date" name="expiry_date" value={form.expiry_date} onChange={handle} className={inputClass} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition min-h-[44px]">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-medium rounded-lg transition min-h-[44px]">
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <><Save size={16} />Salvar</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
