import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Package, Droplets, X, Check } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const STATUS_CONFIG = {
  open: { label: 'Aberto', cls: 'bg-green-100 text-green-700' },
  sealed: { label: 'Selado', cls: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Vencido', cls: 'bg-red-100 text-red-700' },
  empty: { label: 'Vazio', cls: 'bg-slate-100 text-slate-500' },
}

const TABS = [
  { key: 'open', label: 'Abertos' },
  { key: 'sealed', label: 'Selados' },
  { key: '', label: 'Todos' },
]

function daysSince(dateStr) {
  if (!dateStr) return null
  const diff = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
  return Math.floor(diff)
}

function daysUntilExpiry(openedAt, expiryDays = 14) {
  if (!openedAt) return null
  const opened = new Date(openedAt)
  const expires = new Date(opened.getTime() + expiryDays * 24 * 60 * 60 * 1000)
  return Math.ceil((expires - new Date()) / (1000 * 60 * 60 * 24))
}

function openDaysColor(days) {
  if (days === null) return 'text-slate-500'
  if (days < 10) return 'text-green-600'
  if (days <= 12) return 'text-amber-600'
  return 'text-red-600'
}

function volumePercent(remaining, total) {
  if (!total || total === 0) return 0
  return Math.max(0, Math.min(100, (remaining / total) * 100))
}

function volumeBarColor(pct) {
  if (pct > 50) return 'bg-teal-500'
  if (pct > 20) return 'bg-amber-500'
  return 'bg-red-500'
}

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

export default function Estoque() {
  const [bottles, setBottles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('open')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [useBottleId, setUseBottleId] = useState(null)
  const [mlUsed, setMlUsed] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (tab) params.status = tab
      const res = await api.get('/bottles', { params })
      setBottles(res.data?.bottles || res.data || [])
    } catch {
      setError('Erro ao carregar frascos.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 3000)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  const filtered = bottles.filter((b) =>
    !search || (b.medicine_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleOpen = async (id) => {
    setActionLoading(id)
    try {
      await api.put(`/bottles/${id}/open`)
      setSuccessMsg('Frasco aberto com sucesso!')
      load()
    } catch {
      setError('Erro ao abrir frasco.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDiscard = async (id) => {
    setActionLoading(id)
    try {
      await api.put(`/bottles/${id}/discard`)
      setSuccessMsg('Frasco descartado.')
      load()
    } catch {
      setError('Erro ao descartar frasco.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUse = async (id) => {
    if (!mlUsed || parseFloat(mlUsed) <= 0) return
    setActionLoading(id)
    try {
      await api.post(`/bottles/${id}/use`, { ml_used: parseFloat(mlUsed) })
      setSuccessMsg('Uso registrado com sucesso!')
      setUseBottleId(null)
      setMlUsed('')
      load()
    } catch {
      setError('Erro ao registrar uso.')
    } finally {
      setActionLoading(null)
    }
  }

  const isInactive = (b) => b.status === 'expired' || b.status === 'empty'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Estoque de Frascos</h1>
        <p className="text-slate-500 text-sm mt-0.5">Controle individual de frascos e ampolas</p>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition min-h-[40px] ${
                tab === t.key
                  ? 'bg-white shadow text-teal-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do medicamento..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-16 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhum frasco encontrado</p>
          <p className="text-slate-400 text-sm mt-1">
            Registre uma compra para começar!{' '}
            <Link to="/compras" className="text-teal-600 hover:underline font-medium">
              Ir para Compras
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => {
            const st = STATUS_CONFIG[b.status] || { label: b.status, cls: 'bg-slate-100 text-slate-500' }
            const pct = volumePercent(b.remaining_volume_ml, b.total_volume_ml)
            const daysSinceOpen = b.status === 'open' ? daysSince(b.opened_at) : null
            const daysLeft = b.status === 'open' ? daysUntilExpiry(b.opened_at, b.expiry_days_after_opening || 14) : null
            const inactive = isInactive(b)

            return (
              <div
                key={b.id}
                className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 transition ${
                  inactive ? 'opacity-50' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-lg text-slate-800 leading-tight">{b.medicine_name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                {/* Volume bar */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Droplets size={14} className="text-slate-400" />
                      {b.remaining_volume_ml != null ? `${b.remaining_volume_ml}` : '?'}/{b.total_volume_ml || '?'} ml restantes
                    </span>
                    <span className="text-slate-400 text-xs">{Math.round(pct)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${volumeBarColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Open info */}
                {b.status === 'open' && daysSinceOpen !== null && (
                  <p className={`text-sm ${openDaysColor(daysSinceOpen)}`}>
                    Aberto há {daysSinceOpen} {daysSinceOpen === 1 ? 'dia' : 'dias'}
                    {daysLeft !== null && (
                      <span className={daysLeft <= 2 ? 'text-red-600 font-semibold' : ''}>
                        {' '}&#8226; {daysLeft > 0 ? `Vence em ${daysLeft} dias` : 'Vencido!'}
                      </span>
                    )}
                  </p>
                )}

                {/* Cost */}
                {b.cost_per_ml != null && (
                  <p className="text-sm text-slate-500">{fmt(b.cost_per_ml)}/ml</p>
                )}

                {/* Batch */}
                {b.batch_number && (
                  <p className="text-xs text-slate-400">Lote: {b.batch_number}</p>
                )}

                {/* Inline use form */}
                {useBottleId === b.id && (
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
                    <label className="text-sm font-medium text-slate-700">Quantidade usada (ml)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max={b.remaining_volume_ml || 999}
                        value={mlUsed}
                        onChange={(e) => setMlUsed(e.target.value)}
                        placeholder="Ex: 2.5"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUse(b.id)}
                        disabled={actionLoading === b.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 min-h-[40px]"
                      >
                        {actionLoading === b.id ? '...' : 'Salvar'}
                      </button>
                      <button
                        onClick={() => { setUseBottleId(null); setMlUsed('') }}
                        className="border border-slate-300 text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm transition min-h-[40px]"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!inactive && useBottleId !== b.id && (
                  <div className="flex gap-2 pt-1">
                    {b.status === 'sealed' && (
                      <button
                        onClick={() => handleOpen(b.id)}
                        disabled={actionLoading === b.id}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition disabled:opacity-50 min-h-[44px]"
                      >
                        {actionLoading === b.id ? 'Abrindo...' : 'Abrir Frasco'}
                      </button>
                    )}
                    {b.status === 'open' && (
                      <>
                        <button
                          onClick={() => { setUseBottleId(b.id); setMlUsed('') }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition min-h-[44px]"
                        >
                          Registrar Uso
                        </button>
                        <button
                          onClick={() => handleDiscard(b.id)}
                          disabled={actionLoading === b.id}
                          className="border border-red-300 text-red-600 hover:bg-red-50 py-2 px-3 rounded-lg text-sm font-medium transition disabled:opacity-50 min-h-[44px]"
                        >
                          {actionLoading === b.id ? '...' : 'Descartar'}
                        </button>
                      </>
                    )}
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
