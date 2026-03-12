import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import api from '../api/axios'

export default function PurchaseForm({ onClose, onSaved }) {
  const [medicines, setMedicines] = useState([])
  const [form, setForm] = useState({
    medicine_id: '', quantity: '', unit_cost: '', supplier: '', purchase_date: new Date().toISOString().slice(0, 10), notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/medicines').then((res) => setMedicines(res.data?.medicines || res.data || [])).catch(() => {})
  }, [])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.medicine_id || !form.quantity || !form.unit_cost) {
      setError('Preencha os campos obrigatórios.')
      return
    }
    setLoading(true)
    try {
      await api.post('/stock/purchases', {
        medicine_id: Number(form.medicine_id),
        quantity: Number(form.quantity),
        unit_cost: Number(form.unit_cost),
        supplier: form.supplier || null,
        purchase_date: form.purchase_date,
        notes: form.notes || null,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao registrar compra.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Registrar Compra</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Medicamento *</label>
            <select name="medicine_id" value={form.medicine_id} onChange={handle}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Selecione o medicamento...</option>
              {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.active_principle})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade *</label>
              <input type="number" min="1" name="quantity" value={form.quantity} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Ex: 10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custo unitário (R$) *</label>
              <input type="number" step="0.01" min="0" name="unit_cost" value={form.unit_cost} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="0,00" />
            </div>
          </div>

          {form.quantity && form.unit_cost && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm">
              <span className="text-teal-700 font-medium">Total: </span>
              <span className="text-teal-800 font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(form.quantity) * Number(form.unit_cost))}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
            <input name="supplier" value={form.supplier} onChange={handle}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Nome do fornecedor" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data da compra</label>
            <input type="date" name="purchase_date" value={form.purchase_date} onChange={handle}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea name="notes" value={form.notes} onChange={handle} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Informações adicionais..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-medium rounded-lg">
              {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save size={16} />Registrar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
