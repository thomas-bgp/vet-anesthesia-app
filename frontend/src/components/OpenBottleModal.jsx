import { useState, useEffect } from 'react'
import { X, FlaskConical, Loader2 } from 'lucide-react'
import api from '../api/axios'

export default function OpenBottleModal({ isOpen, onClose, onBottleOpened }) {
  const [bottles, setBottles] = useState([])
  const [loading, setLoading] = useState(false)
  const [openingId, setOpeningId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    api
      .get('/bottles', { params: { status: 'sealed' } })
      .then((res) => {
        const list = res.data?.bottles || res.data?.data || res.data || []
        setBottles(Array.isArray(list) ? list : [])
      })
      .catch(() => setError('Erro ao carregar frascos lacrados.'))
      .finally(() => setLoading(false))
  }, [isOpen])

  const handleOpen = async (id) => {
    setOpeningId(id)
    try {
      await api.put(`/bottles/${id}/open`)
      setBottles((prev) => prev.filter((b) => b.id !== id))
      onBottleOpened?.()
    } catch {
      setError('Erro ao abrir frasco. Tente novamente.')
    } finally {
      setOpeningId(null)
    }
  }

  // Group bottles by medicine name
  const grouped = bottles.reduce((acc, b) => {
    const name = b.medicine_name || b.medicine?.name || 'Desconhecido'
    if (!acc[name]) acc[name] = []
    acc[name].push(b)
    return acc
  }, {})

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
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <FlaskConical size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Abrir Frasco</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-teal-600" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">
              Nenhum frasco lacrado disponivel.
            </p>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([name, items]) => (
                <div key={name}>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">{name}</h3>
                  <div className="space-y-2">
                    {items.map((bottle) => (
                      <div
                        key={bottle.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700">
                            {bottle.volume_ml || bottle.total_ml}ml
                            {bottle.batch && (
                              <span className="text-slate-400 ml-2">Lote: {bottle.batch}</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Compra:{' '}
                            {bottle.purchased_at || bottle.created_at
                              ? new Date(
                                  bottle.purchased_at || bottle.created_at
                                ).toLocaleDateString('pt-BR')
                              : '-'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpen(bottle.id)}
                          disabled={openingId === bottle.id}
                          className="ml-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          {openingId === bottle.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : null}
                          Abrir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
