import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { ClipboardList, Package, AlertTriangle, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react'

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

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  const currentMonth = monthlyRevenue[monthlyRevenue.length - 1]

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-slate-800">Resumo</h1>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={16} className="text-teal-600" />
            <span className="text-xs font-medium text-slate-500">Fichas</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.total || 0}</p>
          <p className="text-xs text-slate-400">{stats.completed || 0} concluídas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-600" />
            <span className="text-xs font-medium text-slate-500">Este mês</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{currentMonth?.count || 0}</p>
          <p className="text-xs text-slate-400">procedimentos</p>
        </div>
      </div>

      {/* Stock alerts */}
      {(stockAlerts.low_stock_count > 0 || stockAlerts.expiring_soon_count > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Alertas de Estoque</span>
          </div>
          {stockAlerts.low_stock_count > 0 && (
            <p className="text-sm text-amber-700">
              {stockAlerts.low_stock_count} fármaco(s) com estoque baixo
            </p>
          )}
          {stockAlerts.expiring_soon_count > 0 && (
            <p className="text-sm text-amber-700">
              {stockAlerts.expiring_soon_count} fármaco(s) próximo(s) do vencimento
            </p>
          )}
        </div>
      )}

      {/* Monthly revenue */}
      {monthlyRevenue.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-500 mb-3">Últimos meses</h3>
          <div className="space-y-2">
            {monthlyRevenue.slice(-4).reverse().map((m, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{m.month}</span>
                <div className="text-right">
                  <span className="font-medium text-slate-800">{m.count} fichas</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links to financial sections */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/financeiro"
          className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:border-teal-400 hover:shadow-sm transition"
        >
          <div className="bg-teal-50 p-2 rounded-lg">
            <DollarSign size={18} className="text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Financeiro</p>
            <p className="text-xs text-slate-400">Receitas e despesas</p>
          </div>
        </Link>
        <Link
          to="/compras"
          className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:border-teal-400 hover:shadow-sm transition"
        >
          <div className="bg-teal-50 p-2 rounded-lg">
            <ShoppingCart size={18} className="text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Compras</p>
            <p className="text-xs text-slate-400">Registrar compras</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
