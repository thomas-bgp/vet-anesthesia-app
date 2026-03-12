export default function StatCard({ title, value, subtitle, icon: Icon, color = 'teal', trend }) {
  const colors = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-green-50 text-green-700 border-green-200',
  }
  const iconColors = {
    teal: 'bg-teal-100 text-teal-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex items-start gap-4 ${colors[color]}`}>
      {Icon && (
        <div className={`p-2.5 rounded-lg ${iconColors[color]}`}>
          <Icon size={22} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        {trend !== undefined && (
          <p className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs. mês anterior
          </p>
        )}
      </div>
    </div>
  )
}
