import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, ChevronRight, FileEdit, AlertTriangle } from 'lucide-react'
import api from '../api/axios'
import { countPendingSurgeries } from '../lib/draftStore'


function getLocalDraft() {
  try {
    const raw = localStorage.getItem('vetanestesia_draft_new')
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (draft.form?.patient_name || draft.form?.procedure_name) return draft
    return null
  } catch { return null }
}

export default function Fichas() {
  const navigate = useNavigate()
  const location = useLocation()
  const [surgeries, setSurgeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('data')
  const [localDraft] = useState(() => getLocalDraft())
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    countPendingSurgeries().then(setPendingCount).catch(() => {})
  }, [location.key])

  useEffect(() => {
    setLoading(true)
    api.get('/surgeries', { params: { limit: 100 } })
      .then(res => setSurgeries(res.data.surgeries || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [location.key])

  const filtered = (search
    ? surgeries.filter(s =>
        (s.patient_name + s.procedure_name + s.owner_name + s.clinic_name)
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : surgeries
  ).slice().sort((a, b) => {
    if (sortBy === 'nome') return (a.patient_name || '').localeCompare(b.patient_name || '', 'pt-BR')
    if (sortBy === 'clinica') {
      const ca = a.clinic_name || '', cb = b.clinic_name || ''
      if (!ca && cb) return 1
      if (ca && !cb) return -1
      return ca.localeCompare(cb, 'pt-BR')
    }
    // 'data' — newest first
    const da = a.start_time || a.created_at || '', db = b.start_time || b.created_at || ''
    return db.localeCompare(da)
  })

  const fmtDate = (v) => {
    if (!v) return ''
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}` : ''
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

      {/* Sort */}
      <div className="flex gap-1.5">
        {[['data', 'Data'], ['nome', 'Alfabética'], ['clinica', 'Clínica']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              sortBy === key
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-500 active:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pending drafts banner — surfaces any surgery with un-synced local data so the user
          can recover before the data is forgotten. See /rascunhos. */}
      {pendingCount > 0 && (
        <button
          onClick={() => navigate('/rascunhos')}
          className="w-full flex items-center gap-3 bg-amber-100 border-2 border-amber-400 rounded-xl p-3 active:bg-amber-200 transition text-left"
        >
          <div className="p-2 bg-amber-500 rounded-lg shrink-0">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-900 text-sm">
              {pendingCount === 1 ? '1 ficha não sincronizada' : `${pendingCount} fichas não sincronizadas`}
            </p>
            <p className="text-xs text-amber-700">Toque para revisar e recuperar</p>
          </div>
          <ChevronRight size={18} className="text-amber-600 shrink-0" />
        </button>
      )}

      {/* Local draft banner */}
      {localDraft && (
        <button
          onClick={() => navigate('/fichas/new')}
          className="w-full flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4 active:bg-amber-100 transition text-left"
        >
          <div className="p-2 bg-amber-200 rounded-lg shrink-0">
            <FileEdit size={18} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm">Rascunho não salvo</p>
            <p className="text-xs text-amber-600 truncate">
              {localDraft.form?.patient_name || 'Sem nome'} — {localDraft.form?.procedure_name || ''}
            </p>
            <p className="text-[10px] text-amber-500 mt-0.5">
              {new Date(localDraft._savedAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <ChevronRight size={18} className="text-amber-400 shrink-0" />
        </button>
      )}

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
          {filtered.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(`/fichas/${s.id}`)}
                className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 active:bg-slate-50 transition text-left min-h-[72px]"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate mb-0.5">{s.patient_name}</p>
                  <p className="text-xs text-slate-500 truncate">{s.procedure_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                    {s.clinic_name && <span>{s.clinic_name}</span>}
                    <span>{fmtDate(s.start_time || s.created_at)}</span>
                    {s.patient_species && <span>{s.patient_species}</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 shrink-0" />
              </button>
          ))}
        </div>
      )}
    </div>
  )
}
