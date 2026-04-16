import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign, Clock, Check, X, Plus,
  Calendar, TrendingUp, TrendingDown, Wallet,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '-'

const EXP_CATEGORIES = {
  equipamento: { label: 'Equipamento', cls: 'bg-blue-100 text-blue-700' },
  material: { label: 'Material', cls: 'bg-teal-100 text-teal-700' },
  administrativo: { label: 'Administrativo', cls: 'bg-purple-100 text-purple-700' },
  seguro: { label: 'Seguro', cls: 'bg-amber-100 text-amber-700' },
  transporte: { label: 'Transporte', cls: 'bg-orange-100 text-orange-700' },
  geral: { label: 'Geral', cls: 'bg-slate-100 text-slate-600' },
}

const TABS = [
  { key: 'receivables', label: 'A Receber' },
  { key: 'expenses', label: 'Despesas' },
  { key: 'summary', label: 'Resumo' },
]

function monthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function Financeiro() {
  const [tab, setTab] = useState('receivables')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
        <p className="text-slate-500 text-sm mt-0.5">Receitas, despesas e resumo financeiro</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'receivables' && <ReceivablesTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'summary' && <SummaryTab />}
    </div>
  )
}

/* ==================== RECEIVABLES TAB ==================== */
function ReceivablesTab() {
  const [clinics, setClinics] = useState([])
  const [totalPending, setTotalPending] = useState(0)
  const [count, setCount] = useState(0)
  const [recentlyPaid, setRecentlyPaid] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [showRecent, setShowRecent] = useState(false)
  const [paying, setPaying] = useState(null)
  const [unpaying, setUnpaying] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/surgeries/unpaid')
      setClinics(res.data.clinics || [])
      setTotalPending(res.data.totalPending || 0)
      setCount(res.data.count || 0)
      setRecentlyPaid(res.data.recently_paid || [])
      const exp = {}
      for (const c of res.data.clinics || []) exp[c.clinic] = true
      setExpanded(exp)
    } catch {
      setError('Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (clinic) => setExpanded(e => ({ ...e, [clinic]: !e[clinic] }))

  const confirmPay = async () => {
    if (!payModal) return
    setPaying(payModal.id)
    try {
      await api.put(`/surgeries/${payModal.id}/pay`, { paid_at: payDate + 'T12:00:00' })
      setPayModal(null)
      load()
    } catch {
      setError('Erro ao marcar como pago.')
    } finally {
      setPaying(null)
    }
  }

  const markUnpaid = async (surgeryId) => {
    setUnpaying(surgeryId)
    try {
      await api.put(`/surgeries/${surgeryId}/unpay`)
      load()
    } catch {
      setError('Erro ao desfazer pagamento.')
    } finally {
      setUnpaying(null)
    }
  }

  const paidThisMonth = recentlyPaid
    .filter(s => {
      const now = new Date()
      const paid = new Date(s.paid_at)
      return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear()
    })
    .reduce((s, r) => s + (parseFloat(r.revenue) || 0), 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2.5 rounded-lg"><Clock size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Pendente</p>
              <p className="text-xl font-bold text-slate-800">{fmt(totalPending)}</p>
              <p className="text-[10px] text-slate-400">{count} {count === 1 ? 'cirurgia' : 'cirurgias'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2.5 rounded-lg"><Check size={20} className="text-green-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Recebido este mes</p>
              <p className="text-xl font-bold text-green-700">{fmt(paidThisMonth)}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {/* Unpaid by clinic */}
      {loading ? (
        <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
      ) : clinics.length === 0 ? (
        <div className="py-16 text-center">
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
                  <span className="text-sm font-bold text-amber-600">{fmt(group.total)}</span>
                </div>
              </button>

              {expanded[group.clinic] && (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {group.surgeries.map(s => (
                    <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.patient_name}</p>
                        <p className="text-xs text-slate-500 truncate">{s.procedure_name}</p>
                        <span className="text-[11px] text-slate-400">{fmtDate(s.start_time || s.created_at)}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-800">{fmt(s.revenue)}</p>
                      </div>
                      <button
                        onClick={() => { setPayModal(s); setPayDate(new Date().toISOString().slice(0, 10)) }}
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

      {/* Recently paid */}
      {recentlyPaid.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button onClick={() => setShowRecent(r => !r)}
            className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 min-h-[48px]">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-green-500" />
              <span className="text-sm font-medium text-slate-600">Recebidos recentemente</span>
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{recentlyPaid.length}</span>
            </div>
          </button>
          {showRecent && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {recentlyPaid.map(s => (
                <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{s.patient_name}</p>
                    <p className="text-[10px] text-slate-400">{s.clinic_name} — pago em {fmtDate(s.paid_at)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-700 shrink-0">{fmt(s.revenue)}</span>
                  <button
                    onClick={() => markUnpaid(s.id)}
                    disabled={unpaying === s.id}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 text-[10px] font-medium rounded-lg active:bg-slate-50 min-h-[32px] disabled:opacity-50"
                  >
                    {unpaying === s.id ? '...' : 'Desfazer'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pay modal */}
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
              <p className="text-lg font-bold text-green-700 mt-1">{fmt(payModal.revenue)}</p>
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
    </div>
  )
}

/* ==================== EXPENSES TAB ==================== */
function ExpensesTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => monthStr(new Date()))

  // Form
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
  const [formDesc, setFormDesc] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formCategory, setFormCategory] = useState('geral')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/expenses', { params: { month: selectedMonth } })
      setItems(res.data?.expenses || res.data || [])
    } catch {
      setError('Erro ao carregar despesas.')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t) }
  }, [successMsg])

  const monthlyTotal = items.reduce((s, i) => s + (i.amount || 0), 0)

  const resetForm = () => {
    setFormDate(new Date().toISOString().split('T')[0])
    setFormDesc(''); setFormValue(''); setFormCategory('geral')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDesc || !formValue) { setError('Preencha descrição e valor.'); return }
    setSaving(true)
    try {
      await api.post('/expenses', {
        date: formDate,
        description: formDesc,
        amount: parseFloat(formValue),
        category: formCategory,
      })
      setSuccessMsg('Despesa registrada!')
      resetForm()
      setShowForm(false)
      load()
    } catch {
      setError('Erro ao salvar despesa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Month selector + total */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-slate-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3">
          <div className="bg-red-100 p-2 rounded-lg"><TrendingDown size={18} className="text-red-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Total do mês</p>
            <p className="text-lg font-bold text-slate-800">{fmt(monthlyTotal)}</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <Check size={16} />{successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition min-h-[44px]"
        >
          <Plus size={18} />
          Nova Despesa
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
              <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Ex: Manutenção do monitor"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0.01" value={formValue} onChange={(e) => setFormValue(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {Object.entries(EXP_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 px-4 rounded-lg text-sm transition min-h-[44px]">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg text-sm transition disabled:opacity-50 min-h-[44px]">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhuma despesa neste mês</p>
            <p className="text-slate-400 text-sm mt-1">Clique em "Nova Despesa" para registrar</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {items.map((item) => {
                const cat = EXP_CATEGORIES[item.category] || { label: item.category || 'Geral', cls: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-800 text-sm">{item.description}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cat.cls}`}>{cat.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{fmt(item.amount)}</span>
                      <span className="text-xs text-slate-400">{fmtDate(item.date)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Descrição</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Categoria</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const cat = EXP_CATEGORIES[item.category] || { label: item.category || 'Geral', cls: 'bg-slate-100 text-slate-600' }
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{fmtDate(item.date)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.description}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cat.cls}`}>{cat.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(item.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-600">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(monthlyTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ==================== SUMMARY TAB ==================== */
function SummaryTab() {
  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(0)
  const [drugCost, setDrugCost] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [chartData, setChartData] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(() => monthStr(new Date()))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch summary from dashboard (surgeries) + expenses
      const [dashRes, expRes] = await Promise.allSettled([
        api.get('/dashboard/stats'),
        api.get('/expenses', { params: { month: selectedMonth } }),
      ])

      const expenseItems = expRes.status === 'fulfilled' ? (expRes.value.data?.expenses || expRes.value.data || []) : []
      const exp = expenseItems.reduce((s, e) => s + (e.amount || 0), 0)

      // Get revenue from dashboard monthly data for selected month
      let rev = 0
      if (dashRes.status === 'fulfilled') {
        const monthly = dashRes.value.data?.monthly_revenue || []
        const thisMonth = monthly.find(m => m.month === selectedMonth)
        rev = parseFloat(thisMonth?.paid_revenue || 0)
      }

      // Drug cost from dashboard stats (already fetched above)
      let drugs = 0
      if (dashRes.status === 'fulfilled') {
        drugs = dashRes.value.data?.drug_cost_this_month || dashRes.value.data?.medicine_cost || 0
      }

      setRevenue(rev)
      setDrugCost(drugs)
      setExpenses(exp)

      // Build simple chart data for last 6 months
      const months = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({
          name: d.toLocaleDateString('pt-BR', { month: 'short' }),
          month: monthStr(d),
        })
      }

      // Build chart from dashboard monthly + expenses per month
      const monthlyRevMap = {}
      if (dashRes.status === 'fulfilled') {
        for (const m of dashRes.value.data?.monthly_revenue || []) {
          monthlyRevMap[m.month] = parseFloat(m.paid_revenue || 0)
        }
      }

      const chartPromises = months.map(async (m) => {
        try {
          const eRes = await api.get('/expenses', { params: { month: m.month } })
          const exps = eRes.data?.expenses || eRes.data || []
          return {
            name: m.name,
            Receita: monthlyRevMap[m.month] || 0,
            Despesas: exps.reduce((s, e) => s + (e.amount || 0), 0),
          }
        } catch {
          return { name: m.name, Receita: monthlyRevMap[m.month] || 0, Despesas: 0 }
        }
      })

      const data = await Promise.all(chartPromises)
      setChartData(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => { load() }, [load])

  const profit = revenue - drugCost - expenses

  if (loading) {
    return <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <Calendar size={18} className="text-slate-400" />
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2.5 rounded-lg"><TrendingUp size={20} className="text-green-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Receita Total</p>
              <p className="text-xl font-bold text-green-700">{fmt(revenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2.5 rounded-lg"><DollarSign size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Custo Fármacos</p>
              <p className="text-xl font-bold text-blue-700">{fmt(drugCost)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2.5 rounded-lg"><TrendingDown size={20} className="text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Despesas Gerais</p>
              <p className="text-xl font-bold text-red-600">{fmt(expenses)}</p>
            </div>
          </div>
        </div>
        <div className={`bg-white rounded-xl border shadow-sm p-5 ${profit >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <Wallet size={20} className={profit >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Lucro Líquido</p>
              <p className={`text-xl font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(profit)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Receita vs Despesas (últimos 6 meses)</h3>
        {chartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(value) => fmt(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                />
                <Legend wrapperStyle={{ fontSize: '13px' }} />
                <Bar dataKey="Receita" fill="#19B5A0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">Sem dados para exibir</div>
        )}
      </div>
    </div>
  )
}
