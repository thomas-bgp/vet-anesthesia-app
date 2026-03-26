import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight } from 'lucide-react'
import api from '../api/axios'

const STATUS = {
  scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

export default function Fichas() {
  const navigate = useNavigate()
  const [surgeries, setSurgeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/surgeries', { params: { limit: 100 } })
      .then(res => setSurgeries(res.data.surgeries || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? surgeries.filter(s =>
        (s.patient_name + s.procedure_name + s.owner_name + s.clinic_name)
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : surgeries

  const fmtDate = (v) => {
    if (!v) return ''
    const d = new Date(v)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Fichas Anestésicas</h1>
        <button
          onClick={() => navigate('/fichas/new')}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl active:bg-teal-700 transition min-h-[44px]"
        >
          <Plus size={18} />
          Nova Ficha
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar paciente, tutor, clínica..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[48px]"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">
            {search ? 'Nenhuma ficha encontrada.' : 'Nenhuma ficha ainda. Crie a primeira!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const st = STATUS[s.status] || STATUS.scheduled
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/fichas/${s.id}`)}
                className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 active:bg-slate-50 transition text-left min-h-[72px]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-800 text-sm truncate">{s.patient_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{s.procedure_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                    {s.clinic_name && <span>{s.clinic_name}</span>}
                    <span>{fmtDate(s.start_time || s.created_at)}</span>
                    {s.patient_species && <span>{s.patient_species}</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
