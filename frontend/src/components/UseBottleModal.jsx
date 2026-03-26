import { useState, useEffect } from 'react'
import { X, Syringe, Loader2, AlertCircle } from 'lucide-react'
import api from '../api/axios'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
  return Math.ceil(diff)
}

function daysColor(days) {
  if (days === null) return 'text-slate-400'
  if (days <= 2) return 'text-red-600'
  if (days <= 7) return 'text-amber-600'
  return 'text-green-600'
}

function daysBg(days) {
  if (days === null) return 'bg-slate-50'
  if (days <= 2) return 'bg-red-50 border-red-100'
  if (days <= 7) return 'bg-amber-50 border-amber-100'
  return 'bg-slate-50 border-slate-100'
}

export default function UseBottleModal({ isOpen, onClose, onUsageRecorded }) {
  const [bottles, setBottles] = useState([])
  const [surgeries, setSurgeries] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [selectedBottle, setSelectedBottle] = useState(null)
  const [mlUsed, setMlUsed] = useState('')
  const [surgeryId, setSurgeryId] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    setSelectedBottle(null)
    setMlUsed('')
    setSurgeryId('')
    setNotes('')

    Promise.allSettled([
      api.get('/bottles', { params: { status: 'opened' } }),
      api.get('/surgeries', { params: { limit: 50 } }),
    ]).then(([bottlesRes, surgeriesRes]) => {
      if (bottlesRes.status === 'fulfilled') {
        const list = bottlesRes.value.data?.bottles || bottlesRes.value.data?.data || bottlesRes.value.data || []
        const arr = Array.isArray(list) ? list : []
        // Sort FIFO: oldest expiry first
        arr.sort((a, b) => {
          const da = a.expires_at || a.expiry_date || ''
          const db = b.expires_at || b.expiry_date || ''
          return da.localeCompare(db)
        })
        setBottles(arr)
      } else {
        setError('Erro ao carregar frascos abertos.')
      }

      if (surgeriesRes.status === 'fulfilled') {
        const list = surgeriesRes.value.data?.surgeries || surgeriesRes.value.data?.data || surgeriesRes.value.data || []
        setSurgeries(Array.isArray(list) ? list : [])
      }

      setLoading(false)
    })
  }, [isOpen])

  const selected = bottles.find((b) => b.id === selectedBottle)
  const remainingMl = selected?.remaining_ml ?? selected?.volume_ml ?? 0
  const costPerMl = selected?.cost_per_ml ?? 0
  const mlNum = parseFloat(mlUsed) || 0
  const estimatedCost = mlNum * costPerMl
  const isValid = selectedBottle && mlNum > 0 && mlNum <= remainingMl

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post(`/bottles/${selectedBottle}/use`, {
        ml_used: mlNum,
        surgery_id: surgeryId || undefined,
        notes: notes || undefined,
      })
      onUsageRecorded?.()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao registrar uso. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 text-green-600 p-2 rounded-lg">
              <Syringe size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Registrar Uso</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-teal-600" />
            </div>
          ) : (
            <>
              {/* Bottle selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Selecione o frasco (FIFO - mais antigo primeiro)
                </label>
                {bottles.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4 text-center">
                    Nenhum frasco aberto disponivel.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {bottles.map((b) => {
                      const days = daysUntil(b.expires_at || b.expiry_date)
                      const remaining = b.remaining_ml ?? b.volume_ml ?? 0
                      const name = b.medicine_name || b.medicine?.name || 'Desconhecido'
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBottle(b.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedBottle === b.id
                              ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                              : `${daysBg(days)} hover:border-slate-300`
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">{name}</span>
                            <span className={`text-xs font-medium ${daysColor(days)}`}>
                              {days !== null ? (days <= 0 ? 'Vencido!' : `${days}d restantes`) : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {remaining}ml restantes
                            {b.cost_per_ml ? ` \u00b7 ${fmt(b.cost_per_ml)}/ml` : ''}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ml used */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Volume utilizado (ml)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={remainingMl}
                  value={mlUsed}
                  onChange={(e) => setMlUsed(e.target.value)}
                  placeholder={selected ? `Max: ${remainingMl}ml` : 'Selecione um frasco'}
                  disabled={!selectedBottle}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
                {mlNum > remainingMl && selectedBottle && (
                  <p className="text-xs text-red-600 mt-1">
                    Volume excede o restante ({remainingMl}ml).
                  </p>
                )}
              </div>

              {/* Cost estimate */}
              {selectedBottle && mlNum > 0 && costPerMl > 0 && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-sm text-teal-700">
                    Custo estimado: <span className="font-bold">{fmt(estimatedCost)}</span>
                  </p>
                </div>
              )}

              {/* Surgery (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cirurgia (opcional)
                </label>
                <select
                  value={surgeryId}
                  onChange={(e) => setSurgeryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Nenhuma</option>
                  {surgeries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.patient_name || s.animal_name || `#${s.id}`}
                      {s.date ? ` - ${new Date(s.date).toLocaleDateString('pt-BR')}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observacoes (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: dose de inducao"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="w-full py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Registrar Uso
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
