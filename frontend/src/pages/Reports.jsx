import { useState, useCallback } from 'react'
import { BarChart3, Download, DollarSign, ShoppingCart, TrendingUp, Search } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Reports() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(firstDay)
  const [dateTo, setDateTo] = useState(lastDay)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  const fmtDate = (d) => {
    if (!d) return '—'
    // Parse as local date to avoid UTC offset shifting the day
    const [year, month, day] = d.split('T')[0].split('-')
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pt-BR')
  }

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/reports/financial', {
        params: { date_from: dateFrom, date_to: dateTo },
      })
      setReport(res.data)
    } catch {
      setError('Erro ao carregar relatório.')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  // Profit = revenue minus the cost of medicines actually used in procedures
  const profit = report ? (report.total_revenue || 0) - (report.total_usage_cost || 0) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-slate-500 text-sm mt-0.5">Análise financeira do período</p>
        </div>
        <button
          onClick={() => alert('Exportação em desenvolvimento')}
          className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Download size={18} />
          Exportar
        </button>
      </div>

      {/* Date Picker */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Período de análise</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-600 mb-1">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-600 mb-1">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-medium rounded-lg"
          >
            <Search size={16} />
            {loading ? 'Buscando...' : 'Gerar Relatório'}
          </button>
          {/* Quick range buttons */}
          {[
            { label: 'Este mês', from: firstDay, to: lastDay },
            {
              label: 'Mês anterior',
              from: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10),
              to: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10),
            },
            {
              label: 'Este ano',
              from: `${today.getFullYear()}-01-01`,
              to: `${today.getFullYear()}-12-31`,
            },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => { setDateFrom(q.from); setDateTo(q.to) }}
              className="px-3 py-2 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>}

      {report && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ShoppingCart size={18} className="text-red-600" />
                </div>
                <p className="text-sm font-medium text-slate-500">Total em Compras</p>
              </div>
              <p className="text-2xl font-bold text-slate-800">{fmt(report.total_purchases)}</p>
              <p className="text-xs text-slate-400 mt-1">{report.purchases_count || 0} compras no período</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign size={18} className="text-green-600" />
                </div>
                <p className="text-sm font-medium text-slate-500">Total em Receita</p>
              </div>
              <p className="text-2xl font-bold text-slate-800">{fmt(report.total_revenue)}</p>
              <p className="text-xs text-slate-400 mt-1">{report.surgeries_count || 0} cirurgias no período</p>
            </div>

            <div
              className={`rounded-xl border shadow-sm p-5 ${
                profit >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${profit >= 0 ? 'bg-teal-100' : 'bg-red-100'}`}>
                  <TrendingUp size={18} className={profit >= 0 ? 'text-teal-600' : 'text-red-600'} />
                </div>
                <p className="text-sm font-medium text-slate-500">Lucro Bruto</p>
              </div>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                {fmt(profit)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Receita menos custo de uso</p>
            </div>
          </div>

          {/* Purchases by Medicine */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={17} className="text-slate-400" />
                Compras por Medicamento
              </h3>
            </div>
            {!report.purchases_by_medicine?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">Nenhuma compra no período.</p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Medicamento</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Qtd. Comprada</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Gasto</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Custo Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.purchases_by_medicine.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.medicine_name}</td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {item.total_quantity} {item.unit || ''}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {fmt(item.total_cost)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {fmt(item.avg_unit_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {report.purchases_by_medicine.map((item, i) => (
                    <div key={i} className="px-4 py-3 space-y-1">
                      <p className="font-semibold text-slate-800">{item.medicine_name}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Qtd. Comprada</span>
                        <span className="text-slate-700">
                          {item.total_quantity} {item.unit || ''}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total Gasto</span>
                        <span className="font-semibold text-slate-800">{fmt(item.total_cost)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Custo Médio</span>
                        <span className="text-slate-700">{fmt(item.avg_unit_cost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Revenue by Surgery */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <DollarSign size={17} className="text-slate-400" />
                Receita por Cirurgia
              </h3>
            </div>
            {!report.revenue_by_surgery?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">Nenhuma cirurgia com receita no período.</p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Data</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Paciente</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Procedimento</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Espécie</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Receita</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Custo Med.</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.revenue_by_surgery.map((item, i) => {
                        const margin = (item.revenue || 0) - (item.medicines_cost || 0)
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">{fmtDate(item.date)}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{item.patient_name}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{item.procedure}</td>
                            <td className="px-4 py-3 text-slate-600">{item.species}</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                              {fmt(item.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              {fmt(item.medicines_cost)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-semibold ${
                                margin >= 0 ? 'text-teal-700' : 'text-red-600'
                              }`}
                            >
                              {fmt(margin)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-600">
                          Total
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">
                          {fmt(report.total_revenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-600">
                          {fmt(report.total_usage_cost)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${
                            profit >= 0 ? 'text-teal-700' : 'text-red-600'
                          }`}
                        >
                          {fmt(profit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {report.revenue_by_surgery.map((item, i) => {
                    const margin = (item.revenue || 0) - (item.medicines_cost || 0)
                    return (
                      <div key={i} className="px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-800">{item.patient_name}</p>
                          <span className="text-xs text-slate-400">{fmtDate(item.date)}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {item.procedure} · {item.species}
                        </p>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Receita</span>
                          <span className="font-semibold text-green-700">{fmt(item.revenue)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Custo Med.</span>
                          <span className="text-slate-700">{fmt(item.medicines_cost)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Margem</span>
                          <span
                            className={`font-semibold ${
                              margin >= 0 ? 'text-teal-700' : 'text-red-600'
                            }`}
                          >
                            {fmt(margin)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {/* Mobile totals row */}
                  <div className="px-4 py-3 bg-slate-50 space-y-1">
                    <p className="font-semibold text-slate-700 text-sm">Totais do período</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Receita total</span>
                      <span className="font-bold text-green-700">{fmt(report.total_revenue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Custo total</span>
                      <span className="font-bold text-slate-600">{fmt(report.total_usage_cost)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Margem total</span>
                      <span
                        className={`font-bold ${profit >= 0 ? 'text-teal-700' : 'text-red-600'}`}
                      >
                        {fmt(profit)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="py-20 text-center">
          <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Selecione um período e clique em "Gerar Relatório"</p>
        </div>
      )}
    </div>
  )
}
