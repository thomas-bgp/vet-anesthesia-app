import { useState, useEffect } from 'react'
import { DollarSign, Check, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import api from '../api/axios'

function daysBadge(days) {
  if (days <= 7) return 'bg-green-100 text-green-700'
  if (days <= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default function AReceber() {
  const [clinics, setClinics] = useState([])
  const [totalPending, setTotalPending] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [paying, setPaying] = useState(null)

  const load = () => {
    api.get('/surgeries/unpaid')
      .then(res => {
        setClinics(res.data.clinics || [])
        setTotalPending(res.data.totalPending || 0)
        setCount(res.data.count || 0)
        // Expand all by default
        const exp = {}
        for (const c of res.data.clinics || []) exp[c.clinic] = true
        setExpanded(exp)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggle = (clinic) => setExpanded(e => ({ ...e, [clinic]: !e[clinic] }))

  const markPaid = async (surgeryId) => {
    setPaying(surgeryId)
    try {
      await api.put(`/surgeries/${surgeryId}/pay`)
      load()
    } catch {}
    finally { setPaying(null) }
  }

  const fmtDate = (v) => {
    if (!v) return ''
    return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const fmtMoney = (v) => {
    if (!v && v !== 0) return '-'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">A Receber</h1>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl">
            <DollarSign size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{fmtMoney(totalPending)}</p>
            <p className="text-xs text-slate-500">{count} {count === 1 ? 'cirurgia' : 'cirurgias'} em aberto</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
        </div>
      ) : clinics.length === 0 ? (
        <div className="text-center py-12">
          <Check size={40} className="mx-auto text-green-400 mb-3" />
          <p className="text-slate-500 font-medium">Tudo pago!</p>
          <p className="text-slate-400 text-sm mt-1">Nenhuma cirurgia com pagamento pendente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clinics.map(group => (
            <div key={group.clinic} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Clinic header */}
              <button type="button" onClick={() => toggle(group.clinic)}
                className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition min-h-[52px]">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-700 truncate">{group.clinic}</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    {group.surgeries.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-amber-600">{fmtMoney(group.total)}</span>
                  {expanded[group.clinic] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {/* Surgery list */}
              {expanded[group.clinic] && (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {group.surgeries.map(s => (
                    <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.patient_name}</p>
                        <p className="text-xs text-slate-500 truncate">{s.procedure_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-slate-400">{fmtDate(s.start_time || s.created_at)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5 ${daysBadge(s.days_ago)}`}>
                            <Clock size={10} />
                            {s.days_ago}d
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-800">{fmtMoney(s.revenue)}</p>
                      </div>
                      <button
                        onClick={() => markPaid(s.id)}
                        disabled={paying === s.id}
                        className="shrink-0 flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg active:bg-green-700 min-h-[40px] disabled:opacity-50"
                      >
                        {paying === s.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <><Check size={14} /> Pago</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
