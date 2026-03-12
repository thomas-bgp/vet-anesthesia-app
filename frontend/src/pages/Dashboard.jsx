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

const statusLabel = (s) => ({
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}[s] || s)

const statusColor = (s) => ({
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}[s] || 'bg-slate-100 text-slate-600')

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [charts, setCharts] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, chartsRes, alertsRes, recentRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/charts'),
          api.get('/dashboard/alerts'),
          api.get('/dashboard/recent'),
        ])
        setStats(statsRes.data)
        setCharts(chartsRes.data)
        setAlerts(alertsRes.data?.alerts || [])
        setRecent(recentRes.data?.surgeries || [])
      } catch (err) {
        setError('Erro ao carregar o dashboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Visão geral do mês atual</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Cirurgias este mês"
          value={stats?.surgeriesThisMonth ?? 0}
          subtitle="procedimentos realizados"
          icon={Activity}
          color="teal"
          trend={stats?.surgeryTrend}
        />
        <StatCard
          title="Receita este mês"
          value={fmt(stats?.revenueThisMonth)}
          subtitle="honorários recebidos"
          icon={DollarSign}
          color="green"
          trend={stats?.revenueTrend}
        />
        <StatCard
          title="Valor em estoque"
          value={fmt(stats?.stockValue)}
          subtitle="medicamentos disponíveis"
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Alertas de estoque"
          value={stats?.lowStockAlerts ?? 0}
          subtitle="itens abaixo do mínimo"
          icon={AlertTriangle}
          color={stats?.lowStockAlerts > 0 ? 'red' : 'teal'}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Cirurgias por Mês</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts?.surgeriesByMonth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0F766E" strokeWidth={2} dot={{ r: 4 }} name="Cirurgias" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Receita por Mês (R$)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts?.revenueByMonth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="revenue" fill="#0891b2" radius={[4, 4, 0, 0]} name="Receita" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Distribuição por Espécie</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={charts?.speciesDistribution || []}
                cx="50%" cy="50%"
                outerRadius={80}
                dataKey="count"
                nameKey="species"
                label={({ species, percent }) => `${species} ${(percent * 100).toFixed(0)}%`}
              >
                {(charts?.speciesDistribution || []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Medicamentos Mais Usados</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={charts?.topMedicines || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Bar dataKey="uses" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Usos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables row */}
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
              {alerts.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.alert_type === 'low_stock' ? 'Estoque baixo' : 'Vencimento próximo'}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.alert_type === 'low_stock' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.alert_type === 'low_stock' ? `${item.current_stock} un.` : `Vence ${new Date(item.expiry_date).toLocaleDateString('pt-BR')}`}
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
            <p className="text-slate-400 text-sm text-center py-6">Nenhuma cirurgia recente.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.patient_name}</p>
                    <p className="text-xs text-slate-400">{s.species} · {s.procedure}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(s.date).toLocaleDateString('pt-BR')}</p>
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
