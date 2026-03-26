import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical,
  DollarSign,
  Package,
  TrendingDown,
  ShoppingCart,
  Syringe,
  Stethoscope,
  AlertTriangle,
  Clock,
  Droplets,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/StatCard'
import QuickActionButton from '../components/QuickActionButton'
import OpenBottleModal from '../components/OpenBottleModal'
import UseBottleModal from '../components/UseBottleModal'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../api/axios'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'agora mesmo'
  if (diff < 3600) return `${Math.floor(diff / 60)}min atras`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atras`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atras`
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

function expiryColor(days) {
  if (days === null) return 'text-slate-400'
  if (days <= 2) return 'text-red-600'
  if (days <= 7) return 'text-amber-500'
  return 'text-green-600'
}

function expiryBg(days) {
  if (days === null) return 'bg-slate-100'
  if (days <= 2) return 'bg-red-100'
  if (days <= 7) return 'bg-amber-100'
  return 'bg-green-100'
}

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const activityIcon = (type) => {
  if (type === 'usage' || type === 'stock_out') return Syringe
  if (type === 'purchase' || type === 'stock_in') return ShoppingCart
  if (type === 'surgery') return Stethoscope
  return Clock
}

const activityColor = (type) => {
  if (type === 'usage' || type === 'stock_out') return 'bg-green-100 text-green-600'
  if (type === 'purchase' || type === 'stock_in') return 'bg-teal-100 text-teal-600'
  if (type === 'surgery') return 'bg-purple-100 text-purple-600'
  return 'bg-slate-100 text-slate-600'
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState({})

  // Data
  const [bottleStats, setBottleStats] = useState(null)
  const [receivablesSummary, setReceivablesSummary] = useState(null)
  const [expensesSummary, setExpensesSummary] = useState(null)
  const [openedBottles, setOpenedBottles] = useState([])
  const [expiringBottles, setExpiringBottles] = useState([])
  const [recentActivity, setRecentActivity] = useState([])

  // Modals
  const [openBottleModal, setOpenBottleModal] = useState(false)
  const [useBottleModal, setUseBottleModal] = useState(false)

  const loadData = useCallback(async () => {
    const [statsRes, receivablesRes, expensesRes, openedRes, expiringRes, recentRes] =
      await Promise.allSettled([
        api.get('/bottles/stats'),
        api.get('/receivables/summary'),
        api.get('/expenses/summary'),
        api.get('/bottles', { params: { status: 'opened' } }),
        api.get('/bottles/expiring-soon'),
        api.get('/dashboard/recent-activity'),
      ])

    const errs = {}

    if (statsRes.status === 'fulfilled') {
      setBottleStats(statsRes.value.data?.stats ?? statsRes.value.data ?? null)
    } else {
      errs.stats = true
    }

    if (receivablesRes.status === 'fulfilled') {
      setReceivablesSummary(receivablesRes.value.data?.summary ?? receivablesRes.value.data ?? null)
    } else {
      errs.receivables = true
    }

    if (expensesRes.status === 'fulfilled') {
      setExpensesSummary(expensesRes.value.data?.summary ?? expensesRes.value.data ?? null)
    } else {
      errs.expenses = true
    }

    if (openedRes.status === 'fulfilled') {
      const list = openedRes.value.data?.bottles || openedRes.value.data?.data || openedRes.value.data || []
      setOpenedBottles(Array.isArray(list) ? list : [])
    } else {
      errs.opened = true
    }

    if (expiringRes.status === 'fulfilled') {
      const list = expiringRes.value.data?.bottles || expiringRes.value.data?.data || expiringRes.value.data || []
      setExpiringBottles(Array.isArray(list) ? list : [])
    } else {
      errs.expiring = true
    }

    if (recentRes.status === 'fulfilled') {
      setRecentActivity(recentRes.value.data?.activities || recentRes.value.data?.data || [])
    } else {
      errs.recent = true
    }

    setErrors(errs)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    setLoading(true)
    loadData()
  }

  // Derived values
  const openedCount = bottleStats?.opened_count ?? openedBottles.length
  const pendingReceivables = receivablesSummary?.pending_total ?? 0
  const overdueReceivables = receivablesSummary?.overdue_total ?? 0
  const stockValue = bottleStats?.total_stock_value ?? 0
  const monthlyExpenses = expensesSummary?.monthly_total ?? expensesSummary?.total ?? 0

  // Alerts
  const expiringCount = expiringBottles.length
  const hasExpiring = expiringCount > 0
  const hasOverdue = overdueReceivables > 0
  const hasAlerts = hasExpiring || hasOverdue

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] || 'Doutor(a)'

  return (
    <div className="space-y-6">
      {/* A) Greeting + Stats */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Ola, {firstName}! <span aria-hidden="true">&#128075;</span>
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Aqui esta o resumo do seu dia
        </p>
      </div>

      {/* Partial-load warning */}
      {Object.keys(errors).length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          Alguns dados nao puderam ser carregados. O dashboard pode estar incompleto.
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Frascos Abertos"
          value={openedCount}
          subtitle="em uso atualmente"
          icon={FlaskConical}
          color="teal"
        />
        <StatCard
          title="A Receber"
          value={fmt(pendingReceivables)}
          subtitle="pagamentos pendentes"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Estoque Total"
          value={fmt(stockValue)}
          subtitle="valor em medicamentos"
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Gastos do Mes"
          value={fmt(monthlyExpenses)}
          subtitle="despesas + compras"
          icon={TrendingDown}
          color="amber"
        />
      </div>

      {/* B) Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Acoes Rapidas
        </h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <QuickActionButton
            icon={ShoppingCart}
            label="Registrar Compra"
            color="teal"
            onClick={() => navigate('/compras')}
          />
          <QuickActionButton
            icon={FlaskConical}
            label="Abrir Frasco"
            color="blue"
            onClick={() => setOpenBottleModal(true)}
          />
          <QuickActionButton
            icon={Syringe}
            label="Registrar Uso"
            color="green"
            onClick={() => setUseBottleModal(true)}
          />
          <QuickActionButton
            icon={Stethoscope}
            label="Nova Cirurgia"
            color="purple"
            onClick={() => navigate('/surgeries/new')}
          />
        </div>
      </div>

      {/* C) Alerts */}
      {hasAlerts && (
        <div className="space-y-3">
          {hasExpiring && (
            <button
              onClick={() => navigate('/stock')}
              className="w-full text-left p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-3"
            >
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">
                  <span aria-hidden="true">&#9888;&#65039;</span> {expiringCount} frasco(s) vencem em breve!
                </p>
                <p className="text-xs text-red-600 mt-0.5">Clique para ver detalhes</p>
              </div>
            </button>
          )}
          {hasOverdue && (
            <button
              onClick={() => navigate('/receivables')}
              className="w-full text-left p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-3"
            >
              <div className="bg-amber-100 p-2 rounded-lg">
                <DollarSign size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  <span aria-hidden="true">&#128176;</span> {fmt(overdueReceivables)} em pagamentos atrasados
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Clique para ver detalhes</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* D) Two-column: Recent Activity + Opened Bottles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            Atividade Recente
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nenhuma atividade recente.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((activity, idx) => {
                const IconComp = activityIcon(activity.type)
                return (
                  <div key={activity.id ?? idx} className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg shrink-0 ${activityColor(activity.type)}`}>
                      <IconComp size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{activity.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {timeAgo(activity.created_at)}
                        {activity.amount != null && ` \u00b7 ${fmt(activity.amount)}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Opened Bottles */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Droplets size={16} className="text-teal-500" />
            Frascos Abertos
          </h3>
          {openedBottles.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nenhum frasco aberto.</p>
          ) : (
            <div className="space-y-2">
              {openedBottles.slice(0, 6).map((bottle) => {
                const name = bottle.medicine_name || bottle.medicine?.name || 'Desconhecido'
                const remaining = bottle.remaining_ml ?? bottle.volume_ml ?? 0
                const days = daysUntil(bottle.expires_at || bottle.expiry_date)
                return (
                  <div
                    key={bottle.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{name}</p>
                      <p className="text-xs text-slate-400">{remaining}ml restantes</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${expiryBg(days)} ${expiryColor(days)}`}
                      >
                        {days !== null
                          ? days <= 0
                            ? 'Vencido'
                            : `${days}d`
                          : '-'}
                      </span>
                    </div>
                  </div>
                )
              })}
              {openedBottles.length > 6 && (
                <button
                  onClick={() => navigate('/stock')}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1"
                >
                  Ver todos ({openedBottles.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <OpenBottleModal
        isOpen={openBottleModal}
        onClose={() => setOpenBottleModal(false)}
        onBottleOpened={handleRefresh}
      />
      <UseBottleModal
        isOpen={useBottleModal}
        onClose={() => setUseBottleModal(false)}
        onUsageRecorded={handleRefresh}
      />
    </div>
  )
}
