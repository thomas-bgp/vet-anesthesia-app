import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign, Clock, AlertTriangle, Check, X, Plus,
  Calendar, TrendingUp, TrendingDown, Wallet,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '-'

const REC_STATUS = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Pago', cls: 'bg-green-100 text-green-700' },
  overdue: { label: 'Atrasado', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
}

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
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Form
  const [formDesc, setFormDesc] = useState('')
  const [formClinic, setFormClinic] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [editingId, setEditingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/receivables')
      setItems(res.data?.receivables || res.data || [])
    } catch {
      setError('Erro ao carregar recebíveis.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t) }
  }, [successMsg])

  const pendingTotal = items.filter((i) => i.status === 'pending').reduce((s, i) => s + (i.amount || 0), 0)
  const overdueTotal = items.filter((i) => i.status === 'overdue').reduce((s, i) => s + (i.amount || 0), 0)
  const paidThisMonth = items
    .filter((i) => {
      if (i.status !== 'paid') return false
      const now = new Date()
      const paid = new Date(i.paid_at || i.updated_at)
      return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear()
    })
    .reduce((s, i) => s + (i.amount || 0), 0)

  const resetForm = () => {
    setFormDesc(''); setFormClinic(''); setFormValue(''); setFormDueDate(''); setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDesc || !formValue) { setError('Preencha descrição e valor.'); return }
    setSaving(true)
    try {
      const payload = {
        description: formDesc,
        clinic: formClinic,
        amount: parseFloat(formValue),
        due_date: formDueDate || undefined,
      }
      if (editingId) {
        await api.put(`/receivables/${editingId}`, payload)
        setSuccessMsg('Atualizado com sucesso!')
      } else {
        await api.post('/receivables', payload)
        setSuccessMsg('Recebível criado!')
      }
      resetForm()
      setShowForm(false)
      load()
    } catch {
      setError('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const markPaid = async (id) => {
    try {
      await api.put(`/receivables/${id}`, { status: 'paid', paid_at: new Date().toISOString() })
      setSuccessMsg('Marcado como recebido!')
      load()
    } catch {
      setError('Erro ao atualizar status.')
    }
  }

  const markCancelled = async (id) => {
    try {
      await api.put(`/receivables/${id}`, { status: 'cancelled' })
      load()
    } catch {
      setError('Erro ao cancelar.')
    }
  }

  const startEdit = (item) => {
    setFormDesc(item.description || '')
    setFormClinic(item.clinic || '')
    setFormValue(String(item.amount || ''))
    setFormDueDate(item.due_date ? item.due_date.split('T')[0] : '')
    setEditingId(item.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2.5 rounded-lg"><Clock size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Pendente</p>
              <p className="text-xl font-bold text-slate-800">{fmt(pendingTotal)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2.5 rounded-lg"><AlertTriangle size={20} className="text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Atrasado</p>
              <p className="text-xl font-bold text-red-600">{fmt(overdueTotal)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2.5 rounded-lg"><Check size={20} className="text-green-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Recebido este mês</p>
              <p className="text-xl font-bold text-green-700">{fmt(paidThisMonth)}</p>
            </div>
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

      {/* New / Edit form */}
      <div className="flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition min-h-[44px]"
        >
          <Plus size={18} />
          Novo a Receber
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{editingId ? 'Editar Recebível' : 'Novo Recebível'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
              <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Ex: Anestesia geral - Cirurgia X" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Clínica</label>
              <input type="text" value={formClinic} onChange={(e) => setFormClinic(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Nome da clínica" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0.01" value={formValue} onChange={(e) => setFormValue(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vencimento</label>
              <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 px-4 rounded-lg text-sm transition min-h-[44px]">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg text-sm transition disabled:opacity-50 min-h-[44px]">
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
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
            <DollarSign size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhum recebível cadastrado</p>
            <p className="text-slate-400 text-sm mt-1">Clique em "Novo a Receber" para começar</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {items.map((item) => {
                const st = REC_STATUS[item.status] || { label: item.status, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{item.description}</p>
                        {item.clinic && <p className="text-xs text-slate-500">{item.clinic}</p>}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">{fmt(item.amount)}</span>
                      <span className="text-xs text-slate-400">{fmtDate(item.due_date)}</span>
                    </div>
                    {item.status === 'pending' || item.status === 'overdue' ? (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => markPaid(item.id)}
                          className="flex-1 py-2 text-sm rounded-lg bg-green-50 text-green-700 hover:bg-green-100 min-h-[44px] font-medium">Recebido</button>
                        <button onClick={() => startEdit(item)}
                          className="flex-1 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 min-h-[44px]">Editar</button>
                        <button onClick={() => markCancelled(item.id)}
                          className="flex-1 py-2 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100 min-h-[44px]">Cancelar</button>
                      </div>
                    ) : null}
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
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Clínica</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Valor</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const st = REC_STATUS[item.status] || { label: item.status, cls: 'bg-slate-100 text-slate-600' }
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{fmtDate(item.due_date)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">{item.description}</td>
                        <td className="px-4 py-3 text-slate-600">{item.clinic || '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(item.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {(item.status === 'pending' || item.status === 'overdue') && (
                              <>
                                <button onClick={() => markPaid(item.id)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition min-h-[36px]">
                                  Recebido
                                </button>
                                <button onClick={() => startEdit(item)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition min-h-[36px]">
                                  Editar
                                </button>
                                <button onClick={() => markCancelled(item.id)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition min-h-[36px]">
                                  Cancelar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
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
      // Try to fetch summary data from multiple endpoints
      const [recRes, expRes] = await Promise.allSettled([
        api.get('/receivables', { params: { month: selectedMonth } }),
        api.get('/expenses', { params: { month: selectedMonth } }),
      ])

      const receivables = recRes.status === 'fulfilled' ? (recRes.value.data?.receivables || recRes.value.data || []) : []
      const expenseItems = expRes.status === 'fulfilled' ? (expRes.value.data?.expenses || expRes.value.data || []) : []

      const rev = receivables
        .filter((r) => r.status === 'paid')
        .reduce((s, r) => s + (r.amount || 0), 0)
      const exp = expenseItems.reduce((s, e) => s + (e.amount || 0), 0)

      // Try dashboard stats for drug cost
      let drugs = 0
      try {
        const dashRes = await api.get('/dashboard/stats')
        drugs = dashRes.data?.drug_cost_this_month || dashRes.data?.medicine_cost || 0
      } catch {
        // silent
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

      const chartPromises = months.map(async (m) => {
        try {
          const [rRes, eRes] = await Promise.allSettled([
            api.get('/receivables', { params: { month: m.month } }),
            api.get('/expenses', { params: { month: m.month } }),
          ])
          const recs = rRes.status === 'fulfilled' ? (rRes.value.data?.receivables || rRes.value.data || []) : []
          const exps = eRes.status === 'fulfilled' ? (eRes.value.data?.expenses || eRes.value.data || []) : []
          return {
            name: m.name,
            Receita: recs.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.amount || 0), 0),
            Despesas: exps.reduce((s, e) => s + (e.amount || 0), 0),
          }
        } catch {
          return { name: m.name, Receita: 0, Despesas: 0 }
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
                <Bar dataKey="Receita" fill="#0d9488" radius={[4, 4, 0, 0]} />
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
