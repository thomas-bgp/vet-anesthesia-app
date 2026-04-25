import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, AlertTriangle, Trash2, RotateCcw, Clock, ChevronRight } from 'lucide-react'
import { listPendingSurgeries, listSnapshots, purgeSurgery } from '../lib/draftStore'

// "Rascunhos não sincronizados" — discovery and recovery surface for any in-progress ficha
// that didn't make it to the server yet. This is the page that would have saved Giovana's
// "Alemão/Resgatado" ficha if it had existed before. See PROXIMOS_PASSOS.md → Sprint 0 / S0.7.

function formatRelative(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m} min atrás`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h atrás`
  const d = Math.round(h / 24)
  return `${d} d atrás`
}

export default function Rascunhos() {
  const navigate = useNavigate()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState(null)
  const [snapshots, setSnapshots] = useState({})
  const [confirmDiscard, setConfirmDiscard] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listPendingSurgeries()
      setPending(list)
    } catch (e) {
      console.error('Failed to list pending surgeries', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const expand = async (key) => {
    if (expandedKey === key) { setExpandedKey(null); return }
    setExpandedKey(key)
    if (!snapshots[key]) {
      const snaps = await listSnapshots(key)
      setSnapshots((s) => ({ ...s, [key]: snaps }))
    }
  }

  const restore = (item) => {
    // For surgeries already created on the server: open the edit form, which will read the
    // newest local snapshot and offer to restore it via the existing draft banner.
    if (item.surgeryId && item.surgeryKey !== 'new') {
      navigate(`/fichas/${item.surgeryId}/edit`)
    } else {
      // For 'new' drafts (never synced as a row): open the new-ficha form. The autosave-restore
      // banner there will pick up the latest snapshot and offer to restore.
      navigate('/fichas/new')
    }
  }

  const doDiscard = async (key) => {
    await purgeSurgery(key)
    setConfirmDiscard(null)
    refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="px-4 py-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-800">Rascunhos não sincronizados</h1>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Estas são fichas com edições que <strong>não chegaram ao servidor</strong> — geralmente por
        falha de rede durante a cirurgia. Os dados estão salvos no seu celular. Você pode restaurar
        ou descartar.
      </p>

      {pending.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-sm text-emerald-800 font-medium">✓ Todas as suas fichas estão sincronizadas</p>
          <p className="text-xs text-emerald-700 mt-1">Nenhum rascunho local pendente.</p>
        </div>
      )}

      <div className="space-y-2">
        {pending.map((item) => {
          const isExpanded = expandedKey === item.surgeryKey
          const snaps = snapshots[item.surgeryKey] || []
          return (
            <div key={item.surgeryKey} className="bg-white rounded-xl border border-amber-300 shadow-sm overflow-hidden">
              <button
                onClick={() => expand(item.surgeryKey)}
                className="w-full text-left p-3 flex items-center gap-3 active:bg-slate-50"
              >
                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                  <AlertTriangle size={18} className="text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {item.patientName || '(sem nome)'}
                    </span>
                    {item.surgeryKey === 'new' && (
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold">nova</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {item.procedureName || '(sem procedimento)'}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> última edição {formatRelative(item.lastEditAt)}
                  </div>
                </div>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-3 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => restore(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg active:bg-teal-700 min-h-[40px]"
                    >
                      <RotateCcw size={13} /> Restaurar
                    </button>
                    <button
                      onClick={() => setConfirmDiscard(item.surgeryKey)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 text-xs font-medium rounded-lg active:bg-red-100 min-h-[40px]"
                    >
                      <Trash2 size={13} /> Descartar
                    </button>
                  </div>

                  {snaps.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Histórico ({snaps.length} {snaps.length === 1 ? 'versão' : 'versões'})
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {snaps.slice(0, 10).map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-[11px] py-1 px-2 bg-slate-50 rounded">
                            <FileText size={11} className="text-slate-400 shrink-0" />
                            <span className="text-slate-600">{new Date(s.savedAt).toLocaleString('pt-BR')}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">{s.fieldsFilled} campos</span>
                            {s.suspicious && <span className="ml-auto text-amber-700 font-medium">⚠ suspeito</span>}
                            {s.syncStatus === 'synced' && <span className="ml-auto text-emerald-700 font-medium">✓ sincronizado</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-slate-800">Descartar este rascunho?</h3>
            <p className="text-sm text-slate-600">
              Os dados deste rascunho serão apagados do seu celular. <strong>Esta ação não pode ser desfeita.</strong>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDiscard(null)}
                className="flex-1 py-2.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-xl active:bg-slate-300 min-h-[44px]">
                Cancelar
              </button>
              <button onClick={() => doDiscard(confirmDiscard)}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl active:bg-red-700 min-h-[44px]">
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
