import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { ClipboardList, AlertTriangle, DollarSign, Clock, CheckCircle, TrendingUp, Building2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const MONTHS = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' }
const COLORS = ['#0d9488', '#f59e0b', '#6366f1', '#ec4899', '#84cc16', '#f97316', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6']

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtShort = (v) => {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${Math.round(v)}`
}
const fmtMonth = (ym) => { const [, m] = (ym || '').split('-'); return MONTHS[m] || ym }

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

export default function Resumo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
    </div>
  )

  const d = data || {}
  const stats = d.surgery_stats || {}
  const stockAlerts = d.stock_alerts || {}
  const monthlyRevenue = d.monthly_revenue || []
  const byClinic = d.by_clinic || []
  const monthlyByClinic = d.monthly_by_clinic || []

  const totalRevenue = monthlyRevenue.reduce((s, m) => s + parseFloat(m.total_revenue || 0), 0)
  const totalPaid = monthlyRevenue.reduce((s, m) => s + parseFloat(m.paid_revenue || 0), 0)
  const totalPending = monthlyRevenue.reduce((s, m) => s + parseFloat(m.pending_revenue || 0), 0)
  const totalCost = monthlyRevenue.reduce((s, m) => s + parseFloat(m.stock_cost || 0), 0)

  // Chart data: monthly stacked bar
  const barData = monthlyRevenue.map(m => ({
    month: fmtMonth(m.month),
    Recebido: parseFloat(m.paid_revenue || 0),
    Pendente: parseFloat(m.pending_revenue || 0),
    Custo: parseFloat(m.stock_cost || 0),
  }))

  // Pie data: by clinic
  const pieData = byClinic
    .filter(c => parseFloat(c.total_revenue) > 0)
    .map(c => ({
      name: c.clinic,
      value: parseFloat(c.total_revenue),
    }))

  // Monthly by clinic: build stacked bar
  const clinicNames = [...new Set(monthlyByClinic.map(r => r.clinic))]
  const months = [...new Set(monthlyByClinic.map(r => r.month))].sort()
  const clinicBarData = months.map(month => {
    const row = { month: fmtMonth(month) }
    clinicNames.forEach(c => { row[c] = 0 })
    monthlyByClinic.filter(r => r.month === month).forEach(r => {
      row[r.clinic] = parseFloat(r.revenue || 0)
    })
    return row
  })

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={14} className="text-teal-600" />
            <span className="text-[10px] font-medium text-slate-400">Faturado</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{fmtShort(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-[10px] font-medium text-slate-400">Recebido</span>
          </div>
          <p className="text-xl font-bold text-green-700">{fmtShort(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={14} className="text-amber-600" />
            <span className="text-[10px] font-medium text-slate-400">Pendente</span>
          </div>
          <p className="text-xl font-bold text-amber-700">{fmtShort(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-red-500" />
            <span className="text-[10px] font-medium text-slate-400">Custo (estoque)</span>
          </div>
          <p className="text-xl font-bold text-red-600">{fmtShort(totalCost)}</p>
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
          <p className="text-[10px] text-slate-400 mb-3">Receita por mês de realização</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Recebido" stackId="receita" fill="#10b981" barSize={22} />
              <Bar dataKey="Pendente" stackId="receita" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="Custo" fill="#ef4444" radius={[4, 4, 4, 4]} barSize={12} opacity={0.7} />
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
          <p className="text-[10px] text-slate-400 mb-3">Distribuição do faturamento total</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={2} label={({ name, percent }) => `${name.length > 12 ? name.slice(0, 12) + '...' : name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 0.5 }} style={{ fontSize: '9px' }}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly by clinic - stacked bar */}
      {clinicBarData.length > 1 && clinicNames.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Evolução por Clínica</h3>
          <p className="text-[10px] text-slate-400 mb-3">Receita mensal por clínica</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={clinicBarData} barSize={20}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              {clinicNames.map((name, i) => (
                <Bar key={name} dataKey={name} stackId="clinic" fill={COLORS[i % COLORS.length]} radius={i === clinicNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
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
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Detalhamento por Clínica</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {byClinic.map((c, i) => {
              const total = parseFloat(c.total_revenue || 0)
              const paid = parseFloat(c.paid_revenue || 0)
              const pending = parseFloat(c.pending_revenue || 0)
              const cost = parseFloat(c.stock_cost || 0)
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
        </div>
      )}

      {/* Pending alert */}
      {totalPending > 0 && (
        <Link to="/a-receber" className="block bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">Total pendente</span>
            </div>
            <span className="text-lg font-bold text-amber-700">{fmt(totalPending)}</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">Ver detalhes por clínica</p>
        </Link>
      )}

      {/* Stock alerts */}
      {(stockAlerts.low_stock_count > 0 || stockAlerts.expiring_soon_count > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Alertas de Estoque</span>
          </div>
          {stockAlerts.low_stock_count > 0 && <p className="text-sm text-amber-700">{stockAlerts.low_stock_count} fármaco(s) com estoque baixo</p>}
          {stockAlerts.expiring_soon_count > 0 && <p className="text-sm text-amber-700">{stockAlerts.expiring_soon_count} próximo(s) do vencimento</p>}
        </div>
      )}
    </div>
  )
}
