import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, PiggyBank, Target, TrendingUp, TrendingDown,
  Plus, X, Trash2, ChevronLeft, ChevronRight, Copy, ArrowUpCircle, ArrowDownCircle,
  DollarSign, Settings, Check,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const MONTHS_PT = { '01': 'Janeiro', '02': 'Fevereiro', '03': 'Marco', '04': 'Abril', '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro' }
const MONTHS_SHORT = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' }

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtShort = (v) => { if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`; return `R$${Math.round(v)}` }
const fmtDate = (v) => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''

function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function shiftMonth(ym, delta) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(ym) { const [y, m] = (ym || '').split('-'); return `${MONTHS_PT[m] || m} ${y}` }

const TABS = [
  { key: 'overview', label: 'Visao Geral' },
  { key: 'transactions', label: 'Transacoes' },
  { key: 'budget', label: 'Orcamento' },
  { key: 'goals', label: 'Metas' },
]

const GOAL_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#10b981']

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function FinancasPessoais({ embedded = false }) {
  const [tab, setTab] = useState('overview')
  const [month, setMonth] = useState(currentMonth())

  return (
    <div className={embedded ? 'space-y-4' : 'p-4 max-w-lg mx-auto space-y-4 pb-24'}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financas Pessoais</h1>
          <p className="text-slate-500 text-sm mt-0.5">Controle seu dinheiro pessoal</p>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-2 rounded-lg active:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-base font-bold text-slate-800">{monthLabel(month)}</h2>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} className="p-2 rounded-lg active:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg min-h-[44px] transition ${
              tab === t.key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab month={month} />}
      {tab === 'transactions' && <TransactionsTab month={month} />}
      {tab === 'budget' && <BudgetTab month={month} />}
      {tab === 'goals' && <GoalsTab />}
    </div>
  )
}

/* ==================== OVERVIEW TAB ==================== */
function OverviewTab({ month }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [proLabore, setProLabore] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, setRes] = await Promise.all([
        api.get(`/personal-finance/summary?month=${month}`),
        api.get('/personal-finance/settings'),
      ])
      setData(sumRes.data)
      setProLabore(String(setRes.data.settings?.pro_labore || 0))
    } catch {}
    finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.put('/personal-finance/settings', { pro_labore: parseFloat(proLabore) || 0 })
      setShowSettings(false)
      load()
    } catch {}
    finally { setSaving(false) }
  }

  if (loading) return <LoadingSpinner />
  if (!data) return <p className="text-center text-slate-400 py-8">Erro ao carregar dados</p>

  const chartData = (data.trend || []).map(t => ({
    month: MONTHS_SHORT[(t.month || '').split('-')[1]] || t.month,
    Receita: t.receita || 0,
    Despesa: t.despesa || 0,
  }))

  return (
    <div className="space-y-3">
      {/* Pro-labore card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-teal-600" />
            <span className="text-sm font-semibold text-slate-700">Pro-labore</span>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Settings size={16} className="text-slate-400" />
          </button>
        </div>
        <p className="text-2xl font-bold text-teal-700">{fmt(data.pro_labore)}</p>
        {data.business_profit !== null && (
          <p className="text-xs text-slate-400 mt-1">
            Lucro do negocio: {fmt(data.business_profit)}
            {data.pro_labore > 0 && data.business_profit > 0 && (
              <span className="ml-1">({Math.round((data.pro_labore / data.business_profit) * 100)}% do lucro)</span>
            )}
          </p>
        )}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Configuracoes</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Pro-labore mensal (R$)</label>
              <input
                type="number"
                value={proLabore}
                onChange={e => setProLabore(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                placeholder="Ex: 5000"
              />
              <p className="text-xs text-slate-400 mt-1">Valor que voce retira mensalmente do negocio para uso pessoal</p>
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium min-h-[44px] active:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-medium text-green-600 mb-0.5">Receitas</p>
          <p className="text-lg font-bold text-green-700">{fmtShort(data.receita)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-medium text-red-500 mb-0.5">Despesas</p>
          <p className="text-lg font-bold text-red-600">{fmtShort(data.despesa)}</p>
        </div>
        <div className={`rounded-xl border p-3 ${data.saldo >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-[10px] font-medium text-slate-500 mb-0.5">Saldo</p>
          <p className={`text-lg font-bold ${data.saldo >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmtShort(data.saldo)}</p>
        </div>
      </div>

      {/* Budget progress */}
      {data.budget.limit > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Orcamento</span>
            <span className="text-xs text-slate-500">{data.budget.pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.budget.pct > 100 ? 'bg-red-500' : data.budget.pct > 80 ? 'bg-amber-500' : 'bg-teal-500'}`}
              style={{ width: `${Math.min(data.budget.pct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">{fmt(data.budget.spent)} de {fmt(data.budget.limit)}</p>
        </div>
      )}

      {/* Mini chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Ultimos 6 meses</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtShort(v)} width={50} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Receita" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Despesa" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top goals */}
      {data.goals.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Metas</p>
          <div className="space-y-3">
            {data.goals.map(g => {
              const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{g.name}</span>
                    <span className="text-xs text-slate-400">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: g.color || '#14b8a6' }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{fmt(g.current_amount)} de {fmt(g.target_amount)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================== TRANSACTIONS TAB ==================== */
function TransactionsTab({ month }) {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState({ receita: [], despesa: [] })
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({ type: 'despesa', category: '', description: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ month })
      if (filterCat) params.set('category', filterCat)
      const res = await api.get(`/personal-finance/transactions?${params}`)
      setItems(res.data.transactions || [])
      if (res.data.categories) setCategories(res.data.categories)
    } catch {}
    finally { setLoading(false) }
  }, [month, filterCat])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setForm({ type: 'despesa', category: '', description: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' })
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!form.category || !form.description || !form.amount) return
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/personal-finance/transactions/${editingId}`, { ...form, amount: parseFloat(form.amount) })
      } else {
        await api.post('/personal-finance/transactions', { ...form, amount: parseFloat(form.amount) })
      }
      setShowForm(false)
      resetForm()
      load()
    } catch {}
    finally { setSaving(false) }
  }

  const handleEdit = (item) => {
    setForm({
      type: item.type,
      category: item.category,
      description: item.description,
      amount: String(item.amount),
      date: item.date?.slice(0, 10) || '',
      notes: item.notes || '',
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    try { await api.delete(`/personal-finance/transactions/${id}`); load() } catch {}
  }

  // Group by date
  const grouped = {}
  for (const item of items) {
    const dateKey = item.date?.slice(0, 10) || 'sem-data'
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(item)
  }

  const totalReceita = items.filter(i => i.type === 'receita').reduce((s, i) => s + (i.amount || 0), 0)
  const totalDespesa = items.filter(i => i.type === 'despesa').reduce((s, i) => s + (i.amount || 0), 0)

  const currentCategories = form.type === 'receita' ? categories.receita : categories.despesa

  return (
    <div className="space-y-3">
      {/* Totals */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center">
          <p className="text-[10px] text-green-600 font-medium">Receitas</p>
          <p className="text-base font-bold text-green-700">{fmt(totalReceita)}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center">
          <p className="text-[10px] text-red-500 font-medium">Despesas</p>
          <p className="text-base font-bold text-red-600">{fmt(totalDespesa)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">Todas categorias</option>
          <optgroup label="Receitas">
            {categories.receita.map(c => <option key={c} value={c}>{c}</option>)}
          </optgroup>
          <optgroup label="Despesas">
            {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
          </optgroup>
        </select>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="bg-teal-600 text-white p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center active:bg-teal-700"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Transactions list */}
      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">Nenhuma transacao neste mes</p>
      ) : (
        Object.entries(grouped).map(([dateKey, dateItems]) => (
          <div key={dateKey}>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-xs font-semibold text-slate-500">{fmtDate(dateKey)}</span>
              <span className="text-xs text-slate-400">
                {fmt(dateItems.reduce((s, i) => s + (i.type === 'receita' ? i.amount : -i.amount), 0))}
              </span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {dateItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.type === 'receita' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {item.type === 'receita'
                      ? <ArrowUpCircle size={16} className="text-green-600" />
                      : <ArrowDownCircle size={16} className="text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => handleEdit(item)}>
                    <p className="text-sm font-medium text-slate-700 truncate">{item.description}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">{item.category}</span>
                      {item.source === 'pro_labore' && (
                        <span className="text-[9px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">Pro-labore</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${item.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.type === 'receita' ? '+' : '-'}{fmt(item.amount)}
                  </span>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100 flex-shrink-0">
                    <Trash2 size={14} className="text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => { setShowForm(false); resetForm() }}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Editar' : 'Nova'} Transacao</h3>
              <button onClick={() => { setShowForm(false); resetForm() }} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setForm(f => ({ ...f, type: 'despesa', category: '' }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px] ${form.type === 'despesa' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-500'}`}
              >Despesa</button>
              <button
                onClick={() => setForm(f => ({ ...f, type: 'receita', category: '' }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px] ${form.type === 'receita' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500'}`}
              >Receita</button>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
              >
                <option value="">Selecione...</option>
                {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Descricao</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                placeholder="Ex: Aluguel, Supermercado..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Valor (R$)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Notas (opcional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                placeholder="Observacoes..."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.category || !form.description || !form.amount}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium min-h-[44px] active:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================== BUDGET TAB ==================== */
function BudgetTab({ month }) {
  const [budgets, setBudgets] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formCat, setFormCat] = useState('')
  const [formLimit, setFormLimit] = useState('')
  const [copying, setCopying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/personal-finance/budgets?month=${month}`)
      setBudgets(res.data.budgets || [])
      setAllCategories(res.data.categories || [])
    } catch {}
    finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!formCat || !formLimit) return
    setSaving(true)
    try {
      await api.post('/personal-finance/budgets', { category: formCat, monthly_limit: parseFloat(formLimit), month })
      setShowForm(false)
      setFormCat('')
      setFormLimit('')
      load()
    } catch {}
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await api.delete(`/personal-finance/budgets/${id}`); load() } catch {}
  }

  const copyPrevious = async () => {
    setCopying(true)
    try {
      await api.post('/personal-finance/budgets/copy', { from_month: shiftMonth(month, -1), to_month: month })
      load()
    } catch {}
    finally { setCopying(false) }
  }

  const totalLimit = budgets.reduce((s, b) => s + b.monthly_limit, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const usedCategories = budgets.map(b => b.category)
  const availableCategories = allCategories.filter(c => !usedCategories.includes(c))

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      {/* Total */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Total do Orcamento</span>
          <span className="text-sm font-bold text-slate-800">{fmt(totalLimit)}</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${totalLimit > 0 && totalSpent / totalLimit > 1 ? 'bg-red-500' : totalLimit > 0 && totalSpent / totalLimit > 0.8 ? 'bg-amber-500' : 'bg-teal-500'}`}
            style={{ width: totalLimit > 0 ? `${Math.min((totalSpent / totalLimit) * 100, 100)}%` : '0%' }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">Gasto: {fmt(totalSpent)} ({totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0}%)</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={copyPrevious}
          disabled={copying}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium min-h-[44px] active:bg-slate-200 disabled:opacity-50"
        >
          <Copy size={14} /> {copying ? 'Copiando...' : 'Copiar mes anterior'}
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium min-h-[44px] active:bg-teal-700 ml-auto"
        >
          <Plus size={14} /> Categoria
        </button>
      </div>

      {/* Budget list */}
      {budgets.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">Nenhum orcamento definido</p>
      ) : (
        <div className="space-y-2">
          {budgets.map(b => (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{b.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{fmt(b.spent)} / {fmt(b.monthly_limit)}</span>
                  <button onClick={() => handleDelete(b.id)} className="p-1 rounded hover:bg-slate-100">
                    <Trash2 size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${b.pct > 100 ? 'bg-red-500' : b.pct > 80 ? 'bg-amber-500' : 'bg-teal-500'}`}
                  style={{ width: `${Math.min(b.pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className={`text-[10px] font-medium ${b.pct > 100 ? 'text-red-500' : b.pct > 80 ? 'text-amber-500' : 'text-teal-600'}`}>
                  {b.pct}%
                </span>
                <span className="text-[10px] text-slate-400">
                  {b.pct <= 100 ? `Resta ${fmt(b.monthly_limit - b.spent)}` : `Excedido ${fmt(b.spent - b.monthly_limit)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Novo Limite</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Categoria</label>
              <select
                value={formCat}
                onChange={e => setFormCat(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
              >
                <option value="">Selecione...</option>
                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Limite mensal (R$)</label>
              <input
                type="number"
                value={formLimit}
                onChange={e => setFormLimit(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                placeholder="Ex: 1500"
                step="0.01"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !formCat || !formLimit}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium min-h-[44px] active:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Criar Limite'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================== GOALS TAB ==================== */
function GoalsTab() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDeposit, setShowDeposit] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ name: '', target_amount: '', deadline: '', color: '#14b8a6' })
  const [depositAmount, setDepositAmount] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/personal-finance/goals')
      setGoals(res.data.goals || [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name || !form.target_amount) return
    setSaving(true)
    try {
      await api.post('/personal-finance/goals', { ...form, target_amount: parseFloat(form.target_amount) })
      setShowForm(false)
      setForm({ name: '', target_amount: '', deadline: '', color: '#14b8a6' })
      load()
    } catch {}
    finally { setSaving(false) }
  }

  const handleDeposit = async (goalId) => {
    if (!depositAmount) return
    setSaving(true)
    try {
      await api.put(`/personal-finance/goals/${goalId}`, { add_amount: parseFloat(depositAmount) })
      setShowDeposit(null)
      setDepositAmount('')
      load()
    } catch {}
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await api.delete(`/personal-finance/goals/${id}`); load() } catch {}
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium min-h-[44px] active:bg-teal-700"
        >
          <Plus size={14} /> Nova Meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-12">
          <PiggyBank size={48} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nenhuma meta criada ainda</p>
          <p className="text-slate-400 text-xs mt-1">Crie metas para acompanhar suas economias</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const pct = goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0
            const remaining = goal.target_amount - goal.current_amount
            const daysLeft = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))) : null

            return (
              <div key={goal.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (goal.color || '#14b8a6') + '20' }}>
                      {goal.is_completed
                        ? <Check size={20} className="text-green-600" />
                        : <Target size={20} style={{ color: goal.color || '#14b8a6' }} />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{goal.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {goal.is_completed ? 'Concluida!' : daysLeft !== null ? `${daysLeft} dias restantes` : 'Sem prazo'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded-lg hover:bg-slate-100">
                    <Trash2 size={14} className="text-slate-400" />
                  </button>
                </div>

                {/* Progress */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{fmt(goal.current_amount)}</span>
                    <span className="text-xs font-medium text-slate-700">{fmt(goal.target_amount)}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: goal.color || '#14b8a6' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] font-medium" style={{ color: goal.color || '#14b8a6' }}>{pct}%</span>
                    {!goal.is_completed && <span className="text-[10px] text-slate-400">Faltam {fmt(remaining)}</span>}
                  </div>
                </div>

                {/* Deposit button */}
                {!goal.is_completed && (
                  showDeposit === goal.id ? (
                    <div className="flex gap-2 mt-3">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={e => setDepositAmount(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                        placeholder="Valor"
                        step="0.01"
                        autoFocus
                      />
                      <button
                        onClick={() => handleDeposit(goal.id)}
                        disabled={saving || !depositAmount}
                        className="bg-teal-600 text-white px-4 rounded-lg text-sm font-medium min-h-[44px] active:bg-teal-700 disabled:opacity-50"
                      >
                        {saving ? '...' : 'OK'}
                      </button>
                      <button
                        onClick={() => { setShowDeposit(null); setDepositAmount('') }}
                        className="px-3 rounded-lg bg-slate-100 text-slate-500 min-h-[44px]"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeposit(goal.id)}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-500 min-h-[44px] active:bg-slate-50"
                    >
                      <DollarSign size={14} /> Depositar
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New goal modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Nova Meta</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Nome da meta</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                placeholder="Ex: Reserva de emergencia, Viagem..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Valor alvo (R$)</label>
                <input
                  type="number"
                  value={form.target_amount}
                  onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                  placeholder="10000"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Prazo (opcional)</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {GOAL_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-9 h-9 rounded-full border-2 transition ${form.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.target_amount}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium min-h-[44px] active:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Criando...' : 'Criar Meta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
