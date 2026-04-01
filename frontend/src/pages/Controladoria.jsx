import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, X, Trash2, Zap, Settings, Save } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../api/axios'

const MONTHS_PT = { '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril', '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro' }
const MONTHS_SHORT = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' }

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtShort = (v) => { if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`; return `R$${Math.round(v)}` }
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''

function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function shiftMonth(ym, delta) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(ym) { const [y, m] = (ym || '').split('-'); return `${MONTHS_PT[m] || m} ${y}` }

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

export default function Controladoria() {
  const [tab, setTab] = useState('dre') // dre | cadastro
  const [month, setMonth] = useState(currentMonth())
  const [dre, setDre] = useState(null)
  const [costCenters, setCostCenters] = useState([])
  const [totals, setTotals] = useState({})
  const [summary, setSummary] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [modalForm, setModalForm] = useState({ type: 'despesa', category: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '', supplier_name: '' })
  const [saving, setSaving] = useState(false)

  const loadDre = async (m) => {
    try {
      const [dreRes, sumRes, catRes] = await Promise.all([
        api.get(`/controladoria/dre?month=${m}`),
        api.get('/controladoria/summary'),
        api.get('/controladoria/categories'),
      ])
      setDre(dreRes.data.dre || {})
      setCostCenters(dreRes.data.cost_centers || [])
      setTotals(dreRes.data.totals || {})
      setSummary(sumRes.data || [])
      setCategories(catRes.data.categories || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadDre(month) }, [month])

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  const manualCategories = categories.filter(c => !c.is_auto && c.type === modalForm.type)

  const handleSave = async () => {
    if (!modalForm.category || !modalForm.amount) return
    setSaving(true)
    try {
      await api.post('/controladoria', {
        date: modalForm.date,
        type: modalForm.type,
        category: modalForm.category,
        amount: parseFloat(modalForm.amount),
        description: modalForm.description,
        supplier_name: modalForm.supplier_name,
      })
      setShowModal(false)
      setModalForm({ type: 'despesa', category: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '', supplier_name: '' })
      loadDre(month)
    } catch {}
    finally { setSaving(false) }
  }

  const deleteEntry = async (id) => {
    try { await api.delete(`/controladoria/${id}`); loadDre(month) } catch {}
  }

  const chartData = summary.map(s => ({
    month: MONTHS_SHORT[(s.month || '').split('-')[1]] || s.month,
    Receita: s.receita || 0,
    Despesa: Math.abs(s.despesa || 0),
    Resultado: s.resultado || 0,
  }))

  const ccLabel = (key) => costCenters.find(c => c.key === key)?.label || key

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" /></div>

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      {/* Tab header */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('dre')} className={`flex-1 py-2.5 text-sm font-medium rounded-lg min-h-[44px] transition ${tab === 'dre' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Financeiro</button>
        <button onClick={() => setTab('cadastro')} className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 text-sm font-medium rounded-lg min-h-[44px] transition ${tab === 'cadastro' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Settings size={14} /> Cadastro</button>
      </div>

      {tab === 'cadastro' ? <CadastroTab categories={categories} costCenters={costCenters} onUpdate={() => loadDre(month)} /> : (
        <>
          {/* Month nav */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
            <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-2 rounded-lg active:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"><ChevronLeft size={20} className="text-slate-600" /></button>
            <h2 className="text-base font-bold text-slate-800">{monthLabel(month)}</h2>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} className="p-2 rounded-lg active:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"><ChevronRight size={20} className="text-slate-600" /></button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-medium text-green-600 mb-0.5">Receitas</p>
              <p className="text-lg font-bold text-green-700">{fmtShort(totals.total_receita || 0)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-medium text-red-500 mb-0.5">Despesas</p>
              <p className="text-lg font-bold text-red-600">{fmtShort(Math.abs(totals.total_despesa || 0))}</p>
            </div>
            <div className={`rounded-xl border p-3 ${(totals.resultado || 0) >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-[10px] font-medium text-slate-500 mb-0.5">Seu Salário</p>
              <p className={`text-lg font-bold ${(totals.resultado || 0) >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmtShort(totals.resultado || 0)}</p>
            </div>
          </div>

          {/* DRE by cost center */}
          {dre && costCenters.filter(cc => cc.key !== 'receita').length > 0 && (
            <div className="space-y-3">
              {/* Receitas */}
              {dre.receita && (
                <DreSection title="RECEITAS" color="green" ccData={dre.receita} expanded={expanded} toggle={toggle} prefix="r" onDelete={deleteEntry} />
              )}

              {/* Despesas by cost center */}
              {costCenters.filter(cc => cc.key !== 'receita').map(cc => {
                const ccData = dre[cc.key]
                if (!ccData) return null
                const hasData = Object.values(ccData.categories).some(c => c.total > 0 || c.entries.length > 0)
                const ccTotal = Object.values(ccData.categories).reduce((s, c) => s + (c.type === 'despesa' ? c.total : 0), 0)
                return (
                  <div key={cc.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <button onClick={() => toggle('cc_' + cc.key)} className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 min-h-[48px]">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-700">{cc.label}</h3>
                        {!hasData && <span className="text-[10px] text-slate-400">—</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {ccTotal > 0 && <span className="text-sm font-bold text-red-600">-{fmt(ccTotal)}</span>}
                        {expanded['cc_' + cc.key] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </button>
                    {expanded['cc_' + cc.key] && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {Object.entries(ccData.categories).map(([catKey, catData]) => (
                          <CategoryRow key={catKey} catKey={catKey} catData={catData} expanded={expanded} toggle={toggle} prefix="d" onDelete={deleteEntry} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={2}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Receita" fill="#10b981" barSize={16} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Despesa" fill="#ef4444" barSize={16} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Resultado" fill="#0d9488" barSize={16} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Receita</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Despesa</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-600" /> Resultado</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* FAB */}
      {tab === 'dre' && (
        <button onClick={() => setShowModal(true)}
          className="fixed bottom-20 right-4 flex items-center gap-2 px-5 py-3 bg-teal-600 text-white text-sm font-medium rounded-full shadow-lg active:bg-teal-700 min-h-[48px] z-20">
          <Plus size={18} /> Lançamento
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Novo lançamento</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>

            {/* Type */}
            <div className="flex gap-2">
              {[['despesa', 'Despesa', 'bg-red-600'], ['receita', 'Receita', 'bg-green-600']].map(([v, l, c]) => (
                <button key={v} onClick={() => setModalForm(f => ({ ...f, type: v, category: '' }))}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg min-h-[44px] transition ${modalForm.type === v ? `${c} text-white` : 'bg-slate-100 text-slate-600'}`}>{l}</button>
              ))}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <select value={modalForm.category} onChange={e => setModalForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]">
                <option value="">Selecione...</option>
                {manualCategories.map(c => (
                  <option key={c.category_key} value={c.category_key}>{c.category_label}</option>
                ))}
              </select>
              {modalForm.category && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Centro de custo: {ccLabel(categories.find(c => c.category_key === modalForm.category)?.cost_center)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" value={modalForm.amount}
                  onChange={e => setModalForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <input type="date" value={modalForm.date}
                  onChange={e => setModalForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input type="text" value={modalForm.description}
                onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" placeholder="Ex: DAS MEI abril" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor / Origem</label>
              <input type="text" value={modalForm.supplier_name}
                onChange={e => setModalForm(f => ({ ...f, supplier_name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" placeholder="Opcional" />
            </div>

            <button onClick={handleSave} disabled={saving || !modalForm.category || !modalForm.amount}
              className="w-full py-3 bg-teal-600 text-white font-medium rounded-xl text-sm active:bg-teal-700 min-h-[48px] disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DRE Section (Receitas) ──────────────────────────────────────────────────
function DreSection({ title, color, ccData, expanded, toggle, prefix, onDelete }) {
  const total = Object.values(ccData.categories).reduce((s, c) => s + c.total, 0)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => toggle(prefix + '_section')} className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 min-h-[48px]">
        <h3 className={`text-sm font-bold ${color === 'green' ? 'text-green-700' : 'text-red-600'}`}>{title}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${color === 'green' ? 'text-green-700' : 'text-red-600'}`}>{fmt(total)}</span>
          {expanded[prefix + '_section'] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>
      {expanded[prefix + '_section'] && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {Object.entries(ccData.categories).map(([catKey, catData]) => (
            <CategoryRow key={catKey} catKey={catKey} catData={catData} expanded={expanded} toggle={toggle} prefix={prefix} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Category Row ────────────────────────────────────────────────────────────
function CategoryRow({ catKey, catData, expanded, toggle, prefix, onDelete }) {
  const key = prefix + '_' + catKey
  return (
    <div>
      <button onClick={() => toggle(key)} className="w-full flex items-center justify-between px-4 py-2.5 active:bg-slate-50 min-h-[40px]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700">{catData.label}</span>
          {catData.is_auto && <Zap size={10} className="text-amber-500" />}
          {catData.entries.length > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{catData.entries.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          {catData.total > 0 && <span className="text-sm font-semibold text-slate-800">{fmt(catData.total)}</span>}
          {catData.entries.length > 0 && (expanded[key] ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />)}
        </div>
      </button>
      {expanded[key] && catData.entries.length > 0 && (
        <div className="px-4 pb-2 space-y-1">
          {catData.entries.map((e, i) => (
            <div key={e.id || i} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded text-xs">
              <div className="flex-1 min-w-0">
                <span className="text-slate-700">{e.description || '-'}</span>
                {e.supplier_name && <span className="text-slate-400 ml-1">({e.supplier_name})</span>}
                <span className="text-slate-400 ml-2">{fmtDate(e.date)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {e.source === 'auto' && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">auto</span>}
                <span className="font-semibold text-slate-800">{fmt(e.amount)}</span>
                {e.source === 'manual' && (
                  <button onClick={() => onDelete(e.id)} className="p-1 text-slate-400 active:text-red-500"><Trash2 size={12} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Cadastro Tab ────────────────────────────────────────────────────────────
function CadastroTab({ categories, costCenters, onUpdate }) {
  const [editingId, setEditingId] = useState(null)
  const [editCC, setEditCC] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newCat, setNewCat] = useState({ type: 'despesa', category_key: '', category_label: '', cost_center: 'operacional' })
  const [saving, setSaving] = useState(false)

  const grouped = {}
  for (const cc of costCenters) grouped[cc.key] = { label: cc.label, items: [] }
  for (const c of categories) {
    if (grouped[c.cost_center]) grouped[c.cost_center].items.push(c)
    else {
      if (!grouped._other) grouped._other = { label: 'Outros', items: [] }
      grouped._other.items.push(c)
    }
  }

  const startEdit = (cat) => { setEditingId(cat.id); setEditCC(cat.cost_center); setEditLabel(cat.category_label) }

  const saveEdit = async (id) => {
    setSaving(true)
    try {
      await api.put(`/controladoria/categories/${id}`, { cost_center: editCC, category_label: editLabel })
      setEditingId(null)
      onUpdate()
    } catch {}
    finally { setSaving(false) }
  }

  const deleteCat = async (id) => {
    try { await api.delete(`/controladoria/categories/${id}`); onUpdate() } catch {}
  }

  const addCategory = async () => {
    if (!newCat.category_key || !newCat.category_label) return
    setSaving(true)
    try {
      await api.post('/controladoria/categories', newCat)
      setShowNew(false)
      setNewCat({ type: 'despesa', category_key: '', category_label: '', cost_center: 'operacional' })
      onUpdate()
    } catch {}
    finally { setSaving(false) }
  }

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm min-h-[44px]'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">De-Para: Categoria → Centro de Custo</h3>
        <p className="text-[11px] text-slate-400 mb-3">Cada categoria pertence a um centro de custo. Edite o vínculo ou adicione novas categorias.</p>

        {Object.entries(grouped).map(([ccKey, ccData]) => {
          if (ccData.items.length === 0) return null
          return (
            <div key={ccKey} className="mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">{ccData.label}</p>
              <div className="space-y-1.5">
                {ccData.items.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 py-1.5">
                    {editingId === cat.id ? (
                      <>
                        <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[36px]" />
                        <select value={editCC} onChange={e => setEditCC(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs min-h-[36px]">
                          {costCenters.map(cc => <option key={cc.key} value={cc.key}>{cc.label}</option>)}
                        </select>
                        <button onClick={() => saveEdit(cat.id)} disabled={saving} className="p-1.5 text-teal-600 active:text-teal-800"><Save size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">{cat.category_label}</span>
                        {cat.is_auto && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">auto</span>}
                        <button onClick={() => startEdit(cat)} className="p-1.5 text-slate-400 active:text-teal-600 min-h-[36px] min-w-[36px] flex items-center justify-center">
                          <Settings size={13} />
                        </button>
                        {!cat.is_auto && (
                          <button onClick={() => deleteCat(cat.id)} className="p-1.5 text-slate-400 active:text-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add new category */}
      {!showNew ? (
        <button onClick={() => setShowNew(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 border border-dashed border-teal-400 text-teal-600 text-sm font-medium rounded-xl active:bg-teal-50 min-h-[48px]">
          <Plus size={16} /> Nova categoria
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Nova categoria</h3>
          <div className="flex gap-2">
            {[['despesa', 'Despesa'], ['receita', 'Receita']].map(([v, l]) => (
              <button key={v} onClick={() => setNewCat(f => ({ ...f, type: v }))}
                className={`flex-1 py-2 text-xs font-medium rounded-lg min-h-[40px] ${newCat.type === v ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
            ))}
          </div>
          <input type="text" value={newCat.category_label} onChange={e => setNewCat(f => ({ ...f, category_label: e.target.value, category_key: e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }))}
            className={inp} placeholder="Nome da categoria" />
          <select value={newCat.cost_center} onChange={e => setNewCat(f => ({ ...f, cost_center: e.target.value }))} className={inp}>
            {costCenters.filter(c => c.key !== 'receita' || newCat.type === 'receita').map(cc => <option key={cc.key} value={cc.key}>{cc.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg min-h-[44px]">Cancelar</button>
            <button onClick={addCategory} disabled={saving || !newCat.category_label} className="flex-1 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg min-h-[44px] disabled:opacity-50">Salvar</button>
          </div>
        </div>
      )}
    </div>
  )
}
