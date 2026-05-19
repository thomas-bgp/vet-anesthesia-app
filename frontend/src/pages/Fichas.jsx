import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, ChevronRight, Cloud, CloudOff } from 'lucide-react'
import api from '../api/axios'
import { listAllFichaKeys, getFichaMeta } from '../lib/draftStore'

// Modelo unificado: existe APENAS o conceito de "ficha". Esta tela mescla:
//   - Fichas do servidor (GET /surgeries)
//   - Fichas locais que ainda não chegaram ao servidor (IndexedDB, sem surgeryId)
//   - Fichas do servidor com edições locais não sincronizadas (existem dos dois lados,
//     marcamos como pendente pra que a anestesista veja o status real do upload)
// O status de sync vira um indicador inline (☁ verde sincronizada / ☁! amarelo pendente),
// estilo Steam. Não há mais página /rascunhos nem banners de "ficha não sincronizada".

function syncStatusFor(serverFicha, localMeta) {
  // Sem local meta → veio só do servidor → sincronizada.
  if (!localMeta) return 'synced'
  if (localMeta.lastSyncStatus === 'synced') return 'synced'
  // Tem local meta marcando pendente → ainda não subiu (POST/PUT incompleto)
  return 'pending'
}

function CloudBadge({ status }) {
  if (status === 'synced') {
    return (
      <span title="Sincronizada com a nuvem" className="text-teal-500 shrink-0">
        <Cloud size={16} strokeWidth={2} />
      </span>
    )
  }
  // pending / error
  return (
    <span title="Salva no celular, ainda não enviada" className="relative text-amber-500 shrink-0">
      <CloudOff size={16} strokeWidth={2} />
      <span className="absolute -top-1 -right-1 text-[9px] font-bold leading-none text-amber-700 bg-amber-100 rounded-full w-3 h-3 flex items-center justify-center border border-amber-400">!</span>
    </span>
  )
}

export default function Fichas() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState([]) // lista unificada (server + local)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('data')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      api.get('/surgeries', { params: { limit: 100 } })
        .then((res) => res.data.surgeries || [])
        .catch(() => []),
      listAllFichaKeys().catch(() => []),
    ]).then(async ([serverFichas, localMetas]) => {
      if (cancelled) return

      // Index local metadata: por surgeryId (servidor) e separado pro 'new'.
      const localByServerId = new Map()
      let localNew = null
      for (const m of localMetas) {
        if (m.surgeryKey === 'new') {
          if (m.patientName || m.procedureName) localNew = m
        } else if (m.surgeryId) {
          localByServerId.set(String(m.surgeryId), m)
        }
      }

      const merged = []

      // Ficha local 'new' (sem id de servidor) primeiro, pra anestesista achar fácil.
      if (localNew) {
        merged.push({
          _key: 'new',
          id: null,
          patient_name: localNew.patientName || '(rascunho)',
          procedure_name: localNew.procedureName || '',
          clinic_name: '',
          patient_species: '',
          start_time: localNew.lastEditAt || null,
          created_at: localNew.lastEditAt || null,
          _syncStatus: 'pending',
          _localOnly: true,
        })
      }

      // Fichas do servidor, decoradas com sync status local.
      for (const f of serverFichas) {
        const lm = localByServerId.get(String(f.id))
        merged.push({
          ...f,
          _key: String(f.id),
          _syncStatus: syncStatusFor(f, lm),
          _localOnly: false,
        })
      }

      setItems(merged)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [location.key])

  const filtered = (search
    ? items.filter((s) =>
        ((s.patient_name || '') + (s.procedure_name || '') + (s.owner_name || '') + (s.clinic_name || ''))
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : items
  ).slice().sort((a, b) => {
    if (sortBy === 'nome') return (a.patient_name || '').localeCompare(b.patient_name || '', 'pt-BR')
    if (sortBy === 'clinica') {
      const ca = a.clinic_name || '', cb = b.clinic_name || ''
      if (!ca && cb) return 1
      if (ca && !cb) return -1
      return ca.localeCompare(cb, 'pt-BR')
    }
    // 'data' — newest first; local-only sobe pro topo (sem data confiável vai pra start_time/lastEditAt)
    const da = a.start_time || a.created_at || ''
    const db = b.start_time || b.created_at || ''
    return db.localeCompare(da)
  })

  const fmtDate = (v) => {
    if (!v) return ''
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}` : ''
  }

  const openRow = (row) => {
    if (row._localOnly) {
      navigate('/fichas/new') // FichaForm restaura a 'new' local automaticamente
    } else {
      navigate(`/fichas/${row.id}`)
    }
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
          onChange={(e) => setSearch(e.target.value)}
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
          {filtered.map((s) => (
            <button
              key={s._key}
              onClick={() => openRow(s)}
              className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 active:bg-slate-50 transition text-left min-h-[72px]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm truncate">{s.patient_name || '(sem nome)'}</p>
                  <CloudBadge status={s._syncStatus} />
                </div>
                <p className="text-xs text-slate-500 truncate">{s.procedure_name || '(sem procedimento)'}</p>
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
