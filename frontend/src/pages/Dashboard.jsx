import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Activity, DollarSign, Package, AlertTriangle } from 'lucide-react'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../api/axios'

const PIE_COLORS = ['#0F766E', '#0891b2', '#7c3aed', '#db2777', '#d97706', '#16a34a']

const activityTypeLabel = (type) => ({
  surgery: 'Cirurgia',
  stock_in: 'Entrada de estoque',
  stock_out: 'Saída de estoque',
  alert: 'Alerta',
  payment: 'Pagamento',
}[type] || type)

const activityTypeColor = (type) => ({
  surgery: 'bg-teal-100 text-teal-700',
  stock_in: 'bg-green-100 text-green-700',
  stock_out: 'bg-red-100 text-red-700',
  alert: 'bg-amber-100 text-amber-700',
  payment: 'bg-blue-100 text-blue-700',
}[type] || 'bg-slate-100 text-slate-600')

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [surgeriesByMonth, setSurgeriesByMonth] = useState([])
  const [revenueByMonth, setRevenueByMonth] = useState([])
  const [alerts, setAlerts] = useState([])
  const [recent, setRecent] = useState([])
  const [speciesDistribution, setSpeciesDistribution] = useState([])
  const [topMedicines, setTopMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const load = async () => {
      const [statsRes, surgeriesRes, stockAlertsRes, recentRes, speciesRes, medicinesRes] =
        await Promise.allSettled([
          api.get('/dashboard/stats'),
          api.get('/dashboard/surgeries-by-month'),
          api.get('/dashboard/stock-alerts'),
          api.get('/dashboard/recent-activity'),
          api.get('/dashboard/species-distribution'),
          api.get('/dashboard/top-medicines'),
        ])

      const errs = {}

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data?.stats ?? statsRes.value.data ?? null)
      } else {
        errs.stats = true
      }

      if (surgeriesRes.status === 'fulfilled') {
        const raw = surgeriesRes.value.data?.data || []
        setSurgeriesByMonth(raw)
        // Revenue lives inside the same endpoint response when present, otherwise stay empty
        // until the dedicated revenue endpoint resolves below
      } else {
        errs.surgeries = true
      }

      // Revenue is embedded in surgeries-by-month response as well
      // but we read it separately via the same array if it has a `revenue` field,
      // or fall back to an empty array until a dedicated endpoint is available.
      setRevenueByMonth(
        surgeriesRes.status === 'fulfilled'
          ? (surgeriesRes.value.data?.data || []).filter((d) => d.revenue !== undefined)
          : []
      )

      if (stockAlertsRes.status === 'fulfilled') {
        const d = stockAlertsRes.value.data || {}
        const low = (d.low_stock || []).map((i) => ({ ...i, _alertType: 'low_stock' }))
        const expiring = (d.expiring || []).map((i) => ({ ...i, _alertType: 'expiring' }))
        setAlerts([...low, ...expiring])
      } else {
        errs.alerts = true
      }

      if (recentRes.status === 'fulfilled') {
        setRecent(recentRes.value.data?.activities || [])
      } else {
        errs.recent = true
      }

      if (speciesRes.status === 'fulfilled') {
        setSpeciesDistribution(speciesRes.value.data?.data || [])
      } else {
        errs.species = true
      }

      if (medicinesRes.status === 'fulfilled') {
        setTopMedicines(medicinesRes.value.data?.data || [])
      } else {
        errs.medicines = true
      }

      setErrors(errs)
      setLoading(false)
    }

    load()
  }, [])

  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  const fmtDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )

  // Derive stat values from the nested backend shape
  const surgeriesThisMonth = stats?.surgeries?.this_month ?? 0
  const revenueThisMonth = stats?.revenue?.this_month ?? 0
  const stockValue = stats?.stock?.total_stock_value ?? 0
  const lowStockCount = stats?.stock?.low_stock_count ?? 0
  const surgeryTrend = stats?.surgeries?.month_change_percent ?? null
  const revenueTrend = stats?.revenue?.month_change_percent ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Visão geral do mês atual</p>
      </div>

      {/* Partial-load warning banner */}
      {Object.keys(errors).length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          Alguns dados não puderam ser carregados. O dashboard pode estar incompleto.
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Cirurgias este mês"
          value={surgeriesThisMonth}
          subtitle="procedimentos realizados"
          icon={Activity}
          color="teal"
          trend={surgeryTrend}
        />
        <StatCard
          title="Receita este mês"
          value={fmt(revenueThisMonth)}
          subtitle="honorários recebidos"
          icon={DollarSign}
          color="green"
          trend={revenueTrend}
        />
        <StatCard
          title="Valor em estoque"
          value={fmt(stockValue)}
          subtitle="medicamentos disponíveis"
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Alertas de estoque"
          value={lowStockCount}
          subtitle="itens abaixo do mínimo"
          icon={AlertTriangle}
          color={lowStockCount > 0 ? 'red' : 'teal'}
        />
      </div>

      {/* Charts row 1 — Surgeries & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Cirurgias por Mês</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={surgeriesByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0F766E"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Cirurgias"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Receita por Mês (R$)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="revenue" fill="#0891b2" radius={[4, 4, 0, 0]} name="Receita" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 — Species & Top Medicines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Distribuição por Espécie</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={speciesDistribution}
                cx="50%"
                cy="50%"
                outerRadius={75}
                dataKey="total"
                nameKey="species"
              >
                {speciesDistribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name]}
              />
              <Legend
                iconType="circle"
                iconSize={10}
                formatter={(value) => (
                  <span className="text-xs text-slate-600">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Medicamentos Mais Usados</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={topMedicines}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="usage_count" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Usos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables row — Stock Alerts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Alertas de Estoque
          </h3>
          {alerts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Nenhum alerta de estoque.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((item, idx) => (
                <div
                  key={item.id ?? idx}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item._alertType === 'low_stock' ? 'Estoque baixo' : 'Vencimento próximo'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      item._alertType === 'low_stock'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item._alertType === 'low_stock'
                      ? `${item.current_stock ?? item.quantity ?? 0} un.`
                      : `Vence ${fmtDate(item.expiry_date)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Atividade Recente</h3>
          {recent.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Nenhuma atividade recente.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((activity, idx) => (
                <div
                  key={activity.id ?? idx}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtDate(activity.created_at)}
                      {activity.extra ? ` · ${activity.extra}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${activityTypeColor(
                        activity.type
                      )}`}
                    >
                      {activityTypeLabel(activity.type)}
                    </span>
                    {activity.amount != null && (
                      <p className="text-xs text-slate-500">{fmt(activity.amount)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
