import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { ClipboardList, AlertTriangle, DollarSign, Clock, CheckCircle, TrendingUp, Building2, ChevronDown, ChevronUp, Package, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts'

const MONTHS = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' }
const COLORS = ['#19B5A0', '#f59e0b', '#6366f1', '#ec4899', '#84cc16', '#f97316', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6']

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtShort = (v) => {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${Math.round(v)}`
}
const fmtMonth = (ym) => { const [, m] = (ym || '').split('-'); return MONTHS[m] || ym }

function CustomTooltip({ active, payload, label, showTotal }) {
  if (!active || !payload?.length) return null
  const total = showTotal
    ? payload.filter(p => p.dataKey === 'Recebido' || p.dataKey === 'Pendente').reduce((s, p) => s + (p.value || 0), 0)
    : null
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
      {showTotal && total > 0 && (
        <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex items-center justify-between gap-3">
          <span className="text-slate-500">Total:</span>
          <span className="font-bold text-slate-800">{fmt(total)}</span>
        </div>
      )}
    </div>
  )
}

export default function Resumo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alertOpen, setAlertOpen] = useState(false)
  const [filterMonth, setFilterMonth] = useState(null)
  const [filterClinic, setFilterClinic] = useState(null)
  const [onlyPending, setOnlyPending] = useState(true)

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const d = data || {}
  const stats = d.surgery_stats || {}
  const stockAlerts = d.stock_alerts || {}
  const monthlyRevenue = d.monthly_revenue || []
  const byClinic = d.by_clinic || []
  const monthlyByClinic = d.monthly_by_clinic || []

  // Build (month, clinic) lookup
  const mbcByMonthClinic = useMemo(() => {
    const m = {}
    for (const r of monthlyByClinic) m[`${r.month}|${r.clinic}`] = r
    return m
  }, [monthlyByClinic])

  // KPIs — reflect active filter
  const kpis = useMemo(() => {
    let total = 0, paid = 0, pending = 0, cost = 0
    if (filterMonth && filterClinic) {
      const r = mbcByMonthClinic[`${filterMonth}|${filterClinic}`]
      if (r) {
        total = parseFloat(r.revenue || 0)
        paid = parseFloat(r.paid_revenue || 0)
        pending = parseFloat(r.pending_revenue || 0)
        cost = parseFloat(r.stock_cost || 0)
      }
    } else if (filterMonth) {
      const r = monthlyRevenue.find(x => x.month === filterMonth)
      if (r) {
        total = parseFloat(r.total_revenue || 0)
        paid = parseFloat(r.paid_revenue || 0)
        pending = parseFloat(r.pending_revenue || 0)
        cost = parseFloat(r.stock_cost || 0)
      }
    } else if (filterClinic) {
      const r = byClinic.find(x => x.clinic === filterClinic)
      if (r) {
        total = parseFloat(r.total_revenue || 0)
        paid = parseFloat(r.paid_revenue || 0)
        pending = parseFloat(r.pending_revenue || 0)
        cost = parseFloat(r.stock_cost || 0)
      }
    } else {
      total = monthlyRevenue.reduce((s, m) => s + parseFloat(m.total_revenue || 0), 0)
      paid = monthlyRevenue.reduce((s, m) => s + parseFloat(m.paid_revenue || 0), 0)
      pending = monthlyRevenue.reduce((s, m) => s + parseFloat(m.pending_revenue || 0), 0)
      cost = monthlyRevenue.reduce((s, m) => s + parseFloat(m.stock_cost || 0), 0)
    }
    return { total, paid, pending, cost }
  }, [filterMonth, filterClinic, monthlyRevenue, byClinic, mbcByMonthClinic])

  // Competência Mensal — filtered by clinic if set
  const barData = useMemo(() => {
    const source = filterClinic
      ? (() => {
          const months = [...new Set(monthlyByClinic.map(r => r.month))].sort()
          return months.map(month => {
            const r = mbcByMonthClinic[`${month}|${filterClinic}`]
            return {
              month: fmtMonth(month),
              monthRaw: month,
              Recebido: r ? parseFloat(r.paid_revenue || 0) : 0,
              Pendente: r ? parseFloat(r.pending_revenue || 0) : 0,
              Custo: r ? parseFloat(r.stock_cost || 0) : 0,
            }
          })
        })()
      : monthlyRevenue.map(m => ({
          month: fmtMonth(m.month),
          monthRaw: m.month,
          Recebido: parseFloat(m.paid_revenue || 0),
          Pendente: parseFloat(m.pending_revenue || 0),
          Custo: parseFloat(m.stock_cost || 0),
        }))
    return source.map(r => ({ ...r, Total: r.Recebido + r.Pendente }))
  }, [filterClinic, monthlyRevenue, monthlyByClinic, mbcByMonthClinic])

  // Pie — filtered by month if set
  const pieData = useMemo(() => {
    const source = filterMonth
      ? monthlyByClinic
          .filter(r => r.month === filterMonth && parseFloat(r.revenue || 0) > 0)
          .map(r => ({ name: r.clinic, value: parseFloat(r.revenue || 0) }))
      : byClinic
          .filter(c => parseFloat(c.total_revenue) > 0)
          .map(c => ({ name: c.clinic, value: parseFloat(c.total_revenue) }))
    return source
  }, [filterMonth, byClinic, monthlyByClinic])

  // Evolução por Clínica — full series, but if clinic filter active, show only that clinic
  const { clinicNames, clinicBarData } = useMemo(() => {
    const allClinics = [...new Set(monthlyByClinic.map(r => r.clinic))]
    const names = filterClinic ? allClinics.filter(n => n === filterClinic) : allClinics
    const months = [...new Set(monthlyByClinic.map(r => r.month))].sort()
    const rows = months.map(month => {
      const row = { month: fmtMonth(month), monthRaw: month }
      names.forEach(c => { row[c] = 0 })
      monthlyByClinic
        .filter(r => r.month === month && names.includes(r.clinic))
        .forEach(r => { row[r.clinic] = parseFloat(r.revenue || 0) })
      return row
    })
    return { clinicNames: names, clinicBarData: rows }
  }, [monthlyByClinic, filterClinic])

  // Detalhamento por Clínica — applies filterMonth + onlyPending switch
  const detailRows = useMemo(() => {
    const baseRows = filterMonth
      ? monthlyByClinic
          .filter(r => r.month === filterMonth)
          .map(r => ({
            clinic: r.clinic,
            count: r.count,
            total_revenue: parseFloat(r.revenue || 0),
            paid_revenue: parseFloat(r.paid_revenue || 0),
            pending_revenue: parseFloat(r.pending_revenue || 0),
            stock_cost: parseFloat(r.stock_cost || 0),
          }))
      : byClinic.map(c => ({
          clinic: c.clinic,
          count: c.count,
          total_revenue: parseFloat(c.total_revenue || 0),
          paid_revenue: parseFloat(c.paid_revenue || 0),
          pending_revenue: parseFloat(c.pending_revenue || 0),
          stock_cost: parseFloat(c.stock_cost || 0),
        }))
    let rows = filterClinic ? baseRows.filter(r => r.clinic === filterClinic) : baseRows
    if (onlyPending) rows = rows.filter(r => r.pending_revenue > 0)
    return rows.sort((a, b) => b.total_revenue - a.total_revenue)
  }, [filterMonth, filterClinic, byClinic, monthlyByClinic, onlyPending])

  const pendingDetailHidden = useMemo(() => {
    if (!onlyPending) return 0
    const base = filterMonth
      ? monthlyByClinic.filter(r => r.month === filterMonth)
      : byClinic
    const all = filterClinic ? base.filter(r => r.clinic === filterClinic) : base
    return all.length - detailRows.length
  }, [onlyPending, filterMonth, filterClinic, byClinic, monthlyByClinic, detailRows.length])

  const handleBarClick = (entry) => {
    if (!entry || !entry.monthRaw) return
    setFilterMonth(prev => prev === entry.monthRaw ? null : entry.monthRaw)
  }
  const handlePieClick = (entry) => {
    if (!entry || !entry.name) return
    setFilterClinic(prev => prev === entry.name ? null : entry.name)
  }
  const clearFilters = () => { setFilterMonth(null); setFilterClinic(null) }
  const hasFilter = filterMonth || filterClinic

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>

      {/* Active filter chip */}
      {hasFilter && (
        <div className="flex items-center flex-wrap gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
          <span className="text-xs text-teal-700 font-medium">Filtros ativos:</span>
          {filterMonth && (
            <button onClick={() => setFilterMonth(null)} className="flex items-center gap-1 bg-white border border-teal-300 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs text-teal-700 font-semibold active:bg-teal-100">
              {fmtMonth(filterMonth)}
              <X size={12} />
            </button>
          )}
          {filterClinic && (
            <button onClick={() => setFilterClinic(null)} className="flex items-center gap-1 bg-white border border-teal-300 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs text-teal-700 font-semibold active:bg-teal-100">
              {filterClinic}
              <X size={12} />
            </button>
          )}
          <button onClick={clearFilters} className="ml-auto text-[10px] text-teal-600 underline">limpar</button>
        </div>
      )}

      {/* Stock alerts — collapsible frame at top */}
      {(stockAlerts.low_stock_count > 0 || stockAlerts.expiring_soon_count > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <button onClick={() => setAlertOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 active:bg-red-100 min-h-[48px]">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <span className="text-sm font-semibold text-red-700">
                {(stockAlerts.low_stock_count || 0) + (stockAlerts.expiring_soon_count || 0)} alerta{((stockAlerts.low_stock_count || 0) + (stockAlerts.expiring_soon_count || 0)) > 1 ? 's' : ''} de estoque
              </span>
            </div>
            {alertOpen ? <ChevronUp size={16} className="text-red-400" /> : <ChevronDown size={16} className="text-red-400" />}
          </button>
          {alertOpen && (stockAlerts.items || []).length > 0 && (
            <div className="border-t border-red-200 divide-y divide-red-100">
              {(stockAlerts.items || []).map(m => (
                <div key={m.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={14} className="text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                      {m.concentration && <p className="text-[10px] text-slate-400">{m.concentration}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-red-700">{m.current_stock || 0} un</p>
                    {m.min_stock > 0 && <p className="text-[10px] text-slate-400">mín: {m.min_stock}</p>}
                    {m.current_stock === 0 && m.min_stock === 0 && <p className="text-[10px] text-red-500 font-medium">zerou</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={14} className="text-teal-600" />
            <span className="text-[10px] font-medium text-slate-400">Faturado</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{fmtShort(kpis.total)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-[10px] font-medium text-slate-400">Recebido</span>
          </div>
          <p className="text-xl font-bold text-green-700">{fmtShort(kpis.paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={14} className="text-amber-600" />
            <span className="text-[10px] font-medium text-slate-400">Pendente</span>
          </div>
          <p className="text-xl font-bold text-amber-700">{fmtShort(kpis.pending)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-red-500" />
            <span className="text-[10px] font-medium text-slate-400">Custo (estoque)</span>
          </div>
          <p className="text-xl font-bold text-red-600">{fmtShort(kpis.cost)}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="bg-teal-50 p-2 rounded-lg">
            <ClipboardList size={18} className="text-teal-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">{stats.total || 0}</p>
            <p className="text-[10px] text-slate-400">{stats.completed || 0} concluídas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-lg">
            <Building2 size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">{byClinic.length}</p>
            <p className="text-[10px] text-slate-400">clínicas atendidas</p>
          </div>
        </div>
      </div>

      {/* Monthly revenue chart */}
      {barData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Competência Mensal</h3>
          <p className="text-[10px] text-slate-400 mb-3">
            {filterClinic ? `Receita de ${filterClinic} por mês · toque pra filtrar` : 'Receita por mês · toque numa barra pra filtrar'}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barGap={2} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomTooltip showTotal />} cursor={{ fill: 'rgba(20,184,166,0.06)' }} />
              <Bar dataKey="Recebido" stackId="receita" barSize={22} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                {barData.map((e, i) => (
                  <Cell key={i} fill="#10b981" opacity={filterMonth && e.monthRaw !== filterMonth ? 0.3 : 1} />
                ))}
              </Bar>
              <Bar dataKey="Pendente" stackId="receita" radius={[4, 4, 0, 0]} barSize={22} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                {barData.map((e, i) => (
                  <Cell key={i} fill="#f59e0b" opacity={filterMonth && e.monthRaw !== filterMonth ? 0.3 : 1} />
                ))}
                <LabelList dataKey="Total" position="top" formatter={(v) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fontWeight: 600, fill: '#475569' }} />
              </Bar>
              <Bar dataKey="Custo" radius={[4, 4, 4, 4]} barSize={12} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                {barData.map((e, i) => (
                  <Cell key={i} fill="#ef4444" opacity={filterMonth && e.monthRaw !== filterMonth ? 0.25 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Recebido</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Pendente</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 opacity-70" /> Custo</span>
          </div>
        </div>
      )}

      {/* Revenue by clinic - Pie chart */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Receita por Clínica</h3>
          <p className="text-[10px] text-slate-400 mb-3">
            {filterMonth ? `Distribuição em ${fmtMonth(filterMonth)} · toque pra filtrar` : 'Distribuição do faturamento · toque pra filtrar'}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={2} onClick={handlePieClick} style={{ cursor: 'pointer' }} label={({ name, percent }) => `${name.length > 12 ? name.slice(0, 12) + '...' : name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 0.5 }} fontSize={9}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={filterClinic && entry.name !== filterClinic ? 0.3 : 1} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly by clinic - stacked bar */}
      {clinicBarData.length > 1 && clinicNames.length >= 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Evolução por Clínica</h3>
          <p className="text-[10px] text-slate-400 mb-3">
            {filterClinic ? `Receita mensal de ${filterClinic}` : 'Receita mensal por clínica'}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={clinicBarData} barSize={20}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20,184,166,0.06)' }} />
              {clinicNames.map((name, idx) => (
                <Bar key={name} dataKey={name} stackId="clinic" radius={idx === clinicNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                  {clinicBarData.map((e, i) => (
                    <Cell key={i} fill={COLORS[idx % COLORS.length]} opacity={filterMonth && e.monthRaw !== filterMonth ? 0.3 : 1} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2 text-[10px]">
            {clinicNames.map((name, i) => (
              <span key={name} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clinic detail table */}
      {byClinic.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Detalhamento por Clínica
              {filterMonth && <span className="text-[10px] font-normal text-slate-400 ml-1">· {fmtMonth(filterMonth)}</span>}
            </h3>
            <button
              onClick={() => setOnlyPending(p => !p)}
              role="switch"
              aria-checked={onlyPending}
              className="flex items-center gap-2 text-[11px] text-slate-600 active:opacity-70 min-h-[32px]"
            >
              <span>Só pendentes</span>
              <span className={`relative inline-block w-8 h-4 rounded-full transition-colors ${onlyPending ? 'bg-teal-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 ${onlyPending ? 'left-4' : 'left-0.5'} w-3 h-3 bg-white rounded-full transition-all shadow`} />
              </span>
            </button>
          </div>
          {detailRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              {onlyPending
                ? `Nenhuma clínica com valores pendentes${filterMonth ? ` em ${fmtMonth(filterMonth)}` : ''}.`
                : 'Sem dados pra exibir.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {detailRows.map((c, i) => {
                const total = c.total_revenue
                const paid = c.paid_revenue
                const pending = c.pending_revenue
                const cost = c.stock_cost
                const margin = total - cost
                const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-800 truncate">{c.clinic}</span>
                      <span className="text-sm font-bold text-slate-800 shrink-0 ml-2">{fmt(total)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${paidPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-green-600 font-medium">{fmt(paid)} pago</span>
                        {pending > 0 && <span className="text-amber-600 font-medium">{fmt(pending)} pend.</span>}
                        {cost > 0 && <span className="text-red-500 font-medium">{fmt(cost)} custo</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {total > 0 && <span className={`font-bold ${margin >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{fmt(margin)}</span>}
                        <span className="text-slate-400">{c.count} fichas</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {pendingDetailHidden > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setOnlyPending(false)} className="text-[11px] text-teal-600 underline">
                Mostrar {pendingDetailHidden} clínica{pendingDetailHidden > 1 ? 's' : ''} sem pendência
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending alert */}
      {kpis.pending > 0 && (
        <Link to="/a-receber" className="block bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">Total pendente</span>
            </div>
            <span className="text-lg font-bold text-amber-700">{fmt(kpis.pending)}</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">Ver detalhes por clínica</p>
        </Link>
      )}

    </div>
  )
}
