import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { ClipboardList, AlertTriangle, TrendingUp, DollarSign, ShoppingCart, CheckCircle, Clock } from 'lucide-react'

const MONTH_NAMES = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
}

function fmtMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[m] || m}/${y}`
}

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

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
  const monthlyRevenue = (d.monthly_revenue || []).slice().reverse()

  const totalRevenue = monthlyRevenue.reduce((s, m) => s + parseFloat(m.total_revenue || 0), 0)
  const totalPaid = monthlyRevenue.reduce((s, m) => s + parseFloat(m.paid_revenue || 0), 0)
  const totalPending = monthlyRevenue.reduce((s, m) => s + parseFloat(m.pending_revenue || 0), 0)

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-slate-800">Resumo</h1>

      {/* Top stats */}
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
            <span className="text-xs font-medium text-slate-500">Receita total</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{fmt(totalRevenue)}</p>
          <p className="text-xs text-slate-400">
            <span className="text-green-600 font-medium">{fmt(totalPaid)}</span> recebido
          </p>
        </div>
      </div>

      {/* Pending alert */}
      {totalPending > 0 && (
        <Link to="/a-receber" className="block bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">Pendente</span>
            </div>
            <span className="text-lg font-bold text-amber-700">{fmt(totalPending)}</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">Toque para ver detalhes por clínica</p>
        </Link>
      )}

      {/* Stock alerts */}
      {(stockAlerts.low_stock_count > 0 || stockAlerts.expiring_soon_count > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Alertas de Estoque</span>
          </div>
          {stockAlerts.low_stock_count > 0 && (
            <p className="text-sm text-amber-700">{stockAlerts.low_stock_count} fármaco(s) com estoque baixo</p>
          )}
          {stockAlerts.expiring_soon_count > 0 && (
            <p className="text-sm text-amber-700">{stockAlerts.expiring_soon_count} fármaco(s) próximo(s) do vencimento</p>
          )}
        </div>
      )}

      {/* Competência mensal */}
      {monthlyRevenue.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Competência Mensal</h3>
            <p className="text-[11px] text-slate-400">Receita por mês de realização da cirurgia</p>
          </div>
          <div className="divide-y divide-slate-100">
            {monthlyRevenue.map((m) => {
              const total = parseFloat(m.total_revenue || 0)
              const paid = parseFloat(m.paid_revenue || 0)
              const pending = parseFloat(m.pending_revenue || 0)
              const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0

              return (
                <div key={m.month} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-800">{fmtMonth(m.month)}</span>
                    <span className="text-sm font-bold text-slate-800">{fmt(total)}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle size={10} />
                        {fmt(paid)} ({m.paid_count || 0})
                      </span>
                      {pending > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <Clock size={10} />
                          {fmt(pending)} ({m.pending_count || 0})
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400">{m.count} {m.count === 1 ? 'ficha' : 'fichas'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/a-receber"
          className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 active:bg-slate-50 transition">
          <div className="bg-amber-50 p-2 rounded-lg">
            <DollarSign size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">A Receber</p>
            <p className="text-xs text-slate-400">Pagamentos pendentes</p>
          </div>
        </Link>
        <Link to="/compras"
          className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 active:bg-slate-50 transition">
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
