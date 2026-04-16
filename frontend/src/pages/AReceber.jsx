import { useState, useEffect } from 'react'
import { DollarSign, Check, ChevronDown, ChevronUp, Clock, Undo2, X, Plus } from 'lucide-react'
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
  const [recentlyPaid, setRecentlyPaid] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [showRecent, setShowRecent] = useState(false)
  const [paying, setPaying] = useState(null)
  const [unpaying, setUnpaying] = useState(null)

  // Quick add modal
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickForm, setQuickForm] = useState({
    patient_name: '',
    procedure_name: '',
    clinic_name: '',
    revenue: '',
    start_time: new Date().toISOString().slice(0, 10),
  })

  // Pay modal
  const [payModal, setPayModal] = useState(null) // surgery object or null
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))

  const load = () => {
    api.get('/surgeries/unpaid')
      .then(res => {
        setClinics(res.data.clinics || [])
        setTotalPending(res.data.totalPending || 0)
        setCount(res.data.count || 0)
        setRecentlyPaid(res.data.recently_paid || [])
        const exp = {}
        for (const c of res.data.clinics || []) exp[c.clinic] = true
        setExpanded(exp)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggle = (clinic) => setExpanded(e => ({ ...e, [clinic]: !e[clinic] }))

  const openPayModal = (surgery) => {
    setPayModal(surgery)
    setPayDate(new Date().toISOString().slice(0, 10))
  }

  const confirmPay = async () => {
    if (!payModal) return
    setPaying(payModal.id)
    try {
      await api.put(`/surgeries/${payModal.id}/pay`, { paid_at: payDate + 'T12:00:00' })
      setPayModal(null)
      load()
    } catch {}
    finally { setPaying(null) }
  }

  const markUnpaid = async (surgeryId) => {
    setUnpaying(surgeryId)
    try {
      await api.put(`/surgeries/${surgeryId}/unpay`)
      load()
    } catch {}
    finally { setUnpaying(null) }
  }

  const submitQuickAdd = async () => {
    if (!quickForm.patient_name.trim() || !quickForm.procedure_name.trim()) return
    setQuickSaving(true)
    try {
      await api.post('/surgeries', {
        patient_name: quickForm.patient_name.trim(),
        procedure_name: quickForm.procedure_name.trim(),
        clinic_name: quickForm.clinic_name.trim() || null,
        revenue: parseFloat(quickForm.revenue) || 0,
        start_time: quickForm.start_time ? quickForm.start_time + 'T12:00:00' : null,
        patient_species: 'Canino',
        status: 'completed',
      })
      setShowQuickAdd(false)
      setQuickForm({ patient_name: '', procedure_name: '', clinic_name: '', revenue: '', start_time: new Date().toISOString().slice(0, 10) })
      load()
    } catch {}
    finally { setQuickSaving(false) }
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
        <button onClick={() => setShowQuickAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 min-h-[44px]">
          <Plus size={16} /> Receita
        </button>
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
                        onClick={() => openPayModal(s)}
                        className="shrink-0 flex items-center gap-1 px-3 py-2 border-2 border-dashed border-amber-400 text-amber-700 bg-amber-50 text-xs font-medium rounded-lg active:bg-amber-100 min-h-[40px]"
                      >
                        <DollarSign size={14} /> Receber
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recently paid — collapsible */}
      {recentlyPaid.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button onClick={() => setShowRecent(r => !r)}
            className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 min-h-[48px]">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-green-500" />
              <span className="text-sm font-medium text-slate-600">Recebidos recentemente</span>
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{recentlyPaid.length}</span>
            </div>
            {showRecent ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>
          {showRecent && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {recentlyPaid.map(s => (
                <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{s.patient_name}</p>
                    <p className="text-[10px] text-slate-400">{s.clinic_name} — pago em {fmtDate(s.paid_at)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-700 shrink-0">{fmtMoney(s.revenue)}</span>
                  <button
                    onClick={() => markUnpaid(s.id)}
                    disabled={unpaying === s.id}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 text-[10px] font-medium rounded-lg active:bg-slate-50 min-h-[32px] disabled:opacity-50"
                  >
                    {unpaying === s.id ? '...' : <><Undo2 size={11} /> Desfazer</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pay modal — asks for date */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Confirmar recebimento</h3>
              <button onClick={() => setPayModal(null)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm font-semibold text-slate-800">{payModal.patient_name}</p>
              <p className="text-xs text-slate-500">{payModal.procedure_name} — {payModal.clinic_name}</p>
              <p className="text-lg font-bold text-green-700 mt-1">{fmtMoney(payModal.revenue)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quando recebeu?</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
            </div>

            <button
              onClick={confirmPay}
              disabled={paying === payModal.id}
              className="w-full py-3 bg-green-600 text-white font-medium rounded-xl text-sm active:bg-green-700 min-h-[48px] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {paying === payModal.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <><Check size={18} /> Confirmar pagamento</>
              )}
            </button>
          </div>
        </div>
      )}
      {/* Quick add modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowQuickAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Adicionar receita</h3>
              <button onClick={() => setShowQuickAdd(false)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
                <input type="text" value={quickForm.patient_name}
                  onChange={e => setQuickForm(f => ({ ...f, patient_name: e.target.value }))}
                  placeholder="Nome do paciente"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Procedimento</label>
                <input type="text" value={quickForm.procedure_name}
                  onChange={e => setQuickForm(f => ({ ...f, procedure_name: e.target.value }))}
                  placeholder="Ex: OSH, Orquiectomia"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clinica</label>
                <input type="text" value={quickForm.clinic_name}
                  onChange={e => setQuickForm(f => ({ ...f, clinic_name: e.target.value }))}
                  placeholder="Nome da clinica"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" min="0" value={quickForm.revenue}
                    onChange={e => setQuickForm(f => ({ ...f, revenue: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input type="date" value={quickForm.start_time}
                    onChange={e => setQuickForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
                </div>
              </div>
            </div>

            <button
              onClick={submitQuickAdd}
              disabled={quickSaving || !quickForm.patient_name.trim() || !quickForm.procedure_name.trim()}
              className="w-full py-3 bg-teal-600 text-white font-medium rounded-xl text-sm active:bg-teal-700 min-h-[48px] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {quickSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <><Plus size={18} /> Salvar receita</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
