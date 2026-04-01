import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, X, Pencil, Trash2, Calculator, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../api/axios'

const MONTHS_PT = { '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril', '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro' }
const MONTHS_SHORT = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' }

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtShort = (v) => {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${Math.round(v)}`
}
const fmtDate = (v) => {
  if (!v) return ''
  return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym) {
  const [y, m] = (ym || '').split('-')
  return `${MONTHS_PT[m] || m} ${y}`
}

// Map categories to their default cost center
const CATEGORY_COST_CENTER = {
  medicamentos_insumos: 'operacional',
  impostos: 'administrativo',
  contabilidade: 'administrativo',
  transporte: 'transporte',
  equipamentos: 'operacional',
  manutencao_equip: 'operacional',
  seguros: 'administrativo',
  educacao: 'desenvolvimento',
  marketing: 'comercial',
  telefone_internet: 'administrativo',
  aluguel: 'administrativo',
  crmv_associacoes: 'administrativo',
  material_escritorio: 'administrativo',
  alimentacao: 'pessoal',
  outros: 'administrativo',
  outras_receitas: null,
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Controladoria() {
  const [month, setMonth] = useState(currentMonth)
  const [dre, setDre] = useState(null)
  const [summary, setSummary] = useState([])
  const [categories, setCategories] = useState(null)
  const [costCenters, setCostCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  // Form state
  const [form, setForm] = useState({
    type: 'despesa',
    category: '',
    cost_center: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    supplier_name: '',
  })

  // Load categories once
  useEffect(() => {
    api.get('/controladoria/categories')
      .then(res => {
        setCategories(res.data.categories)
        setCostCenters(res.data.cost_centers)
      })
      .catch(() => {})
  }, [])

  // Load DRE + summary when month changes
  const loadData = () => {
    setLoading(true)
    Promise.all([
      api.get(`/controladoria/dre?month=${month}`),
      api.get('/controladoria/summary'),
    ])
      .then(([dreRes, sumRes]) => {
        setDre(dreRes.data)
        setSummary(sumRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [month])

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  // Filtered categories for the form
  const formCategories = useMemo(() => {
    if (!categories) return []
    const cats = categories[form.type] || []
    return cats.filter(c => !c.auto)
  }, [categories, form.type])

  const resetForm = () => {
    setForm({
      type: 'despesa',
      category: '',
      cost_center: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      supplier_name: '',
    })
    setEditingEntry(null)
  }

  const openNew = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (entry) => {
    setEditingEntry(entry)
    setForm({
      type: entry.type || 'despesa',
      category: entry.category || '',
      cost_center: entry.cost_center || '',
      amount: String(entry.amount || ''),
      date: entry.date ? entry.date.split('T')[0] : '',
      description: entry.description || '',
      supplier_name: entry.supplier_name || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.category || !form.amount || !form.date) return
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        category: form.category,
        cost_center: form.cost_center || null,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description,
        supplier_name: form.supplier_name,
      }

      if (editingEntry) {
        await api.put(`/controladoria/${editingEntry.id}`, payload)
      } else {
        await api.post('/controladoria', payload)
      }

      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este lançamento?')) return
    setDeleting(id)
    try {
      await api.delete(`/controladoria/${id}`)
      loadData()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir')
    } finally {
      setDeleting(null)
    }
  }

  // Chart data
  const chartData = useMemo(() => {
    return summary.map(s => ({
      month: MONTHS_SHORT[s.month.split('-')[1]] || s.month,
      Receitas: s.receita || 0,
      Despesas: Math.abs(s.despesa || 0),
      Resultado: s.resultado || 0,
    }))
  }, [summary])

  const totals = dre?.totals || { total_receita: 0, total_despesa: 0, resultado: 0 }
  const resultado = totals.resultado || 0

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth(m => shiftMonth(m, -1))}
          className="p-2 rounded-lg active:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-800">{monthLabel(month)}</h1>
        <button
          onClick={() => setMonth(m => shiftMonth(m, 1))}
          className="p-2 rounded-lg active:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-medium text-green-600 mb-0.5">Receitas</p>
              <p className="text-lg font-bold text-green-700">{fmtShort(totals.total_receita)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-medium text-red-500 mb-0.5">Despesas</p>
              <p className="text-lg font-bold text-red-600">{fmtShort(Math.abs(totals.total_despesa))}</p>
            </div>
            <div className={`rounded-xl border p-3 ${resultado >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-[10px] font-medium mb-0.5 ${resultado >= 0 ? 'text-teal-600' : 'text-red-500'}`}>Seu Salário</p>
              <p className={`text-lg font-bold ${resultado >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmtShort(resultado)}</p>
            </div>
          </div>

          {/* RECEITAS */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-green-50">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-green-800">Receitas</h2>
                <span className="text-sm font-bold text-green-700">{fmt(totals.total_receita)}</span>
              </div>
            </div>
            {dre && categories && categories.receita.map(cat => {
              const data = dre.receitas[cat.key]
              if (!data) return null
              const isExpanded = expanded[`r_${cat.key}`]
              return (
                <div key={cat.key} className="border-b border-slate-50 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggle(`r_${cat.key}`)}
                    className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition min-h-[48px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{cat.label}</span>
                      {cat.auto && <span className="text-[9px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">auto</span>}
                      {data.entries.length > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                          {data.entries.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-700">{fmt(data.total)}</span>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </button>
                  {isExpanded && data.entries.length > 0 && (
                    <div className="divide-y divide-slate-50 bg-slate-50/50">
                      {data.entries.map((entry, i) => (
                        <div key={`${entry.source}_${entry.id}_${i}`} className="px-4 py-2.5 flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 truncate">{entry.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400">{fmtDate(entry.date)}</span>
                              {entry.source === 'auto' && (
                                <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                  <Zap size={8} /> automático
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-green-700 shrink-0">{fmt(entry.amount)}</span>
                          {entry.source === 'manual' && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => openEdit(entry)} className="p-1.5 rounded-lg active:bg-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                <Pencil size={14} className="text-slate-400" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deleting === entry.id}
                                className="p-1.5 rounded-lg active:bg-red-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
                              >
                                {deleting === entry.id ? (
                                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                                ) : (
                                  <Trash2 size={14} className="text-red-400" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && data.entries.length === 0 && (
                    <div className="px-4 py-3 bg-slate-50/50">
                      <p className="text-xs text-slate-400">Nenhum lançamento neste mês</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* DESPESAS */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-red-50">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-red-800">Despesas</h2>
                <span className="text-sm font-bold text-red-700">{fmt(Math.abs(totals.total_despesa))}</span>
              </div>
            </div>
            {dre && categories && categories.despesa.map(cat => {
              const data = dre.despesas[cat.key]
              if (!data) return null
              const isExpanded = expanded[`d_${cat.key}`]
              return (
                <div key={cat.key} className="border-b border-slate-50 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggle(`d_${cat.key}`)}
                    className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition min-h-[48px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{cat.label}</span>
                      {cat.auto && <span className="text-[9px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">auto</span>}
                      {data.entries.length > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                          {data.entries.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {data.total > 0 && <span className="text-sm font-semibold text-red-600">{fmt(data.total)}</span>}
                      {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </button>
                  {isExpanded && data.entries.length > 0 && (
                    <div className="divide-y divide-slate-50 bg-slate-50/50">
                      {data.entries.map((entry, i) => (
                        <div key={`${entry.source}_${entry.id}_${i}`} className="px-4 py-2.5 flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 truncate">{entry.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400">{fmtDate(entry.date)}</span>
                              {entry.supplier_name && <span className="text-[10px] text-slate-400">{entry.supplier_name}</span>}
                              {entry.source === 'auto' && (
                                <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                  <Zap size={8} /> automático
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-red-600 shrink-0">{fmt(entry.amount)}</span>
                          {entry.source === 'manual' && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => openEdit(entry)} className="p-1.5 rounded-lg active:bg-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                <Pencil size={14} className="text-slate-400" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deleting === entry.id}
                                className="p-1.5 rounded-lg active:bg-red-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
                              >
                                {deleting === entry.id ? (
                                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                                ) : (
                                  <Trash2 size={14} className="text-red-400" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && data.entries.length === 0 && (
                    <div className="px-4 py-3 bg-slate-50/50">
                      <p className="text-xs text-slate-400">Nenhum lançamento neste mês</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Cost center breakdown */}
          {dre?.by_cost_center && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Despesas por Centro de Custo</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {costCenters.filter(cc => (dre.by_cost_center[cc.key] || 0) > 0).map(cc => (
                  <div key={cc.key} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-slate-600">{cc.label}</span>
                    <span className="text-sm font-semibold text-red-600">{fmt(dre.by_cost_center[cc.key])}</span>
                  </div>
                ))}
                {costCenters.every(cc => (dre.by_cost_center[cc.key] || 0) === 0) && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-slate-400">Nenhuma despesa neste mês</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chart - last 6 months */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Evolução (6 meses)</h3>
              <p className="text-[10px] text-slate-400 mb-3">Receitas vs Despesas vs Resultado</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={2}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Receitas" fill="#10b981" barSize={16} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#ef4444" barSize={16} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Resultado" fill="#0d9488" barSize={16} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Receitas</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Despesas</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-600" /> Resultado</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* FAB - New entry */}
      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 bg-teal-600 text-white rounded-full shadow-lg active:bg-teal-700 transition flex items-center gap-2 px-5 py-3.5 min-h-[48px] z-40"
      >
        <Plus size={18} />
        <span className="text-sm font-semibold">Novo lançamento</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-slate-800">
                {editingEntry ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm() }} className="p-2 rounded-lg active:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Type toggle */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'receita', category: '' }))}
                    className={`py-3 rounded-xl text-sm font-semibold transition min-h-[48px] ${
                      form.type === 'receita'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'despesa', category: '' }))}
                    className={`py-3 rounded-xl text-sm font-semibold transition min-h-[48px] ${
                      form.type === 'despesa'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    Despesa
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const cat = e.target.value
                    setForm(f => ({
                      ...f,
                      category: cat,
                      cost_center: CATEGORY_COST_CENTER[cat] || f.cost_center,
                    }))
                  }}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm min-h-[48px] bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Selecione...</option>
                  {formCategories.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Cost center */}
              {form.type === 'despesa' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Centro de Custo</label>
                  <select
                    value={form.cost_center}
                    onChange={(e) => setForm(f => ({ ...f, cost_center: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm min-h-[48px] bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Selecione...</option>
                    {costCenters.map(cc => (
                      <option key={cc.key} value={cc.key}>{cc.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Valor (R$)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: DAS MEI abril"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Supplier */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Fornecedor / Origem (opcional)</label>
                <input
                  type="text"
                  value={form.supplier_name}
                  onChange={(e) => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                  placeholder="Ex: Receita Federal"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || !form.category || !form.amount || !form.date}
                className="w-full bg-teal-600 text-white rounded-xl py-3.5 text-sm font-semibold active:bg-teal-700 transition min-h-[48px] disabled:opacity-50 disabled:active:bg-teal-600"
              >
                {saving ? (
                  <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : editingEntry ? 'Salvar Alterações' : 'Adicionar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
