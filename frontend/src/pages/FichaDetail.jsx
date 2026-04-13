import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Plus, Trash2, Heart, Clock, Printer, X, AlertTriangle
} from 'lucide-react'
import api from '../api/axios'
import { QRCodeSVG } from 'qrcode.react'

// ─── Emergency drugs data ────────────────────────────────────────────────────
const EMERGENCY_DRUGS = [
  { name: 'Atropina',   dosePerKg: 0.044, concentration: 0.5,  route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Adrenalina', dosePerKg: 0.01,  concentration: 1,    route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Efedrina',   dosePerKg: 0.1,   concentration: 50,   route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Lidocaína',  dosePerKg: 2,     concentration: 20,   route: 'IV',       note: 'somente cães', speciesFilter: 'canino' },
  { name: 'Amiodarona', dosePerKg: 5,     concentration: 50,   route: 'IV lento', note: null,           speciesFilter: null },
  { name: 'Naloxona',   dosePerKg: 0.04,  concentration: 0.4,  route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Flumazenil', dosePerKg: 0.01,  concentration: 0.1,  route: 'IV',       note: null,           speciesFilter: null },
  { name: 'Doxapram',   dosePerKg: 1,     concentration: 20,   route: 'IV',       note: null,           speciesFilter: null },
]

function fmtDose(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return Number(n.toFixed(decimals)).toString()
}

function EmergencyModal({ surgery, onClose }) {
  const weight = parseFloat(surgery.patient_weight)
  const hasWeight = !isNaN(weight) && weight > 0
  const species = (surgery.patient_species || '').toLowerCase()
  const isCanine = species.includes('cão') || species.includes('cao') ||
                   species.includes('canino') || species.includes('dog')

  const drugs = EMERGENCY_DRUGS.filter(d => !d.speciesFilter || isCanine)

  return (
    <div
      className="emergency-modal-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md m-4 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Red header */}
        <div className="bg-red-600 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="text-white" />
            <span className="text-white text-xl font-black tracking-widest uppercase">Emergência</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-red-700 active:bg-red-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Patient info */}
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <p className="font-bold text-slate-800 text-base">{surgery.patient_name}</p>
          <p className="text-sm text-slate-600">
            {surgery.patient_species && <span>{surgery.patient_species} · </span>}
            {hasWeight
              ? <span className="font-semibold text-red-700">{weight} kg</span>
              : <span className="text-red-600 font-semibold">Peso não informado</span>
            }
          </p>
        </div>

        {/* Drug list */}
        <div className="bg-white divide-y divide-slate-100">
          {!hasWeight && (
            <div className="px-4 py-4 text-sm text-red-600 font-medium text-center">
              Cadastre o peso do paciente para calcular as doses.
            </div>
          )}
          {drugs.map((drug) => {
            const doseMg   = hasWeight ? weight * drug.dosePerKg : null
            const volumeMl = hasWeight ? doseMg / drug.concentration : null
            return (
              <div key={drug.name} className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-base">{drug.name}</span>
                    {drug.note && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        {drug.note}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {drug.dosePerKg} mg/kg · {drug.route} · {drug.concentration} mg/mL
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {hasWeight ? (
                    <>
                      <p className="text-base font-black text-red-700 leading-tight">{fmtDose(doseMg)} mg</p>
                      <p className="text-sm font-bold text-slate-700">{fmtDose(volumeMl)} mL</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
          <p className="text-[10px] text-slate-400 text-center leading-snug">
            Doses de referência. Confirme com o protocolo institucional.
          </p>
          <button
            onClick={onClose}
            className="mt-2 w-full py-3 bg-slate-200 text-slate-700 font-semibold rounded-xl active:bg-slate-300 text-sm min-h-[44px]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS = {
  scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

const VITAL_FIELDS = [
  { key: 'fc', label: 'FC', unit: 'bpm', type: 'number' },
  { key: 'pas', label: 'PAS', unit: 'mmHg', type: 'number' },
  { key: 'pam', label: 'PAM', unit: 'mmHg', type: 'number' },
  { key: 'pad', label: 'PAD', unit: 'mmHg', type: 'number' },
  { key: 'spo2', label: 'SpO2', unit: '%', type: 'number' },
  { key: 'fr', label: 'FR', unit: 'mpm', type: 'number' },
  { key: 'etco2', label: 'ETCO2', unit: '%', type: 'number' },
  { key: 'temperature', label: 'T°C', unit: '', type: 'number' },
  { key: 'fluid_ml_kg_h', label: 'Fluido', unit: 'ml/kg/h', type: 'number' },
  { key: 'o2_l_min', label: 'O₂', unit: 'L/min', type: 'number' },
  { key: 'anesthetic', label: 'Anestésico', unit: '', type: 'text' },
  { key: 'notes', label: 'Notas', unit: '', type: 'text' },
]

function InfoRow({ label, value }) {
  if (!value) return null
  const isMultiline = typeof value === 'string' && value.includes('\n')
  return isMultiline ? (
    <div className="text-sm py-1.5">
      <span className="text-slate-500">{label}</span>
      <p className="font-medium text-slate-800 mt-0.5 whitespace-pre-line">{value}</p>
    </div>
  ) : (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function Card({ title, icon: Icon, children, ...rest }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4" {...rest}>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon size={15} className="text-slate-400" />}
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

export default function FichaDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [surgery, setSurgery] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [vitals, setVitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Vitals quick-add
  const [showVitals, setShowVitals] = useState(false)
  const [newVital, setNewVital] = useState({})

  // Emergency modal
  const [showEmergency, setShowEmergency] = useState(false)

  const [disposables, setDisposables] = useState([])
  const [summary, setSummary] = useState(null)
  const [profile, setProfile] = useState(null)

  // Electronic signature
  const [signature, setSignature] = useState(null)
  const [signing, setSigning] = useState(false)

  // Online status for signature blocking
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const load = async () => {
    try {
      const [surgeryRes, profileRes] = await Promise.all([
        api.get(`/surgeries/${id}`),
        api.get('/auth/me').catch(() => ({ data: {} })),
      ])
      setSurgery(surgeryRes.data.surgery || surgeryRes.data)
      setMedicines(surgeryRes.data.medicines || [])
      setVitals(surgeryRes.data.vitals || [])
      setDisposables(surgeryRes.data.disposables || [])
      setSummary(surgeryRes.data.summary || null)
      setProfile(profileRes.data.user || null)
      // Load existing signature
      api.get(`/signatures/surgery/${id}`).then(res => setSignature(res.data.signature)).catch(() => {})
    } catch {
      setError('Erro ao carregar ficha.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const addVitals = async () => {
    try {
      const payload = { ...newVital, recorded_at: new Date().toISOString() }
      await api.post(`/surgeries/${id}/vitals`, payload)
      setNewVital({})
      setShowVitals(false)
      load()
    } catch { setError('Erro ao salvar sinais vitais.') }
  }

  const deleteVital = async (vitalId) => {
    try {
      await api.delete(`/surgeries/${id}/vitals/${vitalId}`)
      load()
    } catch { setError('Erro ao remover.') }
  }

  const removeMedicine = async (medId) => {
    try {
      await api.delete(`/surgeries/${id}/medicines/${medId}`)
      load()
    } catch { setError('Erro ao remover medicamento.') }
  }

  const handlePrint = () => window.print()

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta ficha? Esta ação não pode ser desfeita.')) return
    try {
      await api.delete(`/surgeries/${id}`)
      navigate('/fichas')
    } catch {
      setError('Erro ao excluir ficha.')
    }
  }

  const handleSign = async () => {
    if (!navigator.onLine) {
      setError('A assinatura eletrônica requer conexão com a internet.')
      return
    }
    setSigning(true)
    try {
      const res = await api.post(`/signatures/sign/${id}`)
      setSignature(res.data.signature)
      setTimeout(() => window.print(), 500)
    } catch { setError('Erro ao assinar.') }
    finally { setSigning(false) }
  }

  // Extract time/date directly from ISO string — avoids UTC→local conversion
  const fmtTime = (v) => {
    if (!v) return '-'
    const s = String(v)
    // "2026-04-02T15:50:00+00:00" → extract "15:50" directly from the string
    const match = s.match(/T(\d{2}:\d{2})/)
    if (match) return match[1]
    return '-'
  }
  const fmtDate = (v) => {
    if (!v) return '-'
    const s = String(v)
    // "2026-04-02T..." → "02/04/2026"
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
    return '-'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
    </div>
  )

  if (!surgery) return (
    <div className="p-4">
      <button onClick={() => navigate('/fichas')} className="mb-4 text-teal-600 font-medium flex items-center gap-1">
        ← Voltar
      </button>
      <p className="text-red-600">Ficha não encontrada.</p>
    </div>
  )

  const st = STATUS[surgery.status] || STATUS.scheduled
  const groupedMeds = {}
  medicines.forEach(m => {
    const phase = m.phase || 'mpa'
    if (!groupedMeds[phase]) groupedMeds[phase] = []
    groupedMeds[phase].push(m)
  })
  const phaseLabels = { mpa: 'MPA', inducao: 'Indução', manutencao: 'Manutenção', manutencao_inalatoria: 'Manut. Inalatória', manutencao_tiva: 'Manut. TIVA', infusao: 'Infusão Contínua', bloqueio: 'Bloqueio', transoperatorio: 'Trans-op', pos_operatorio: 'Pós-operatório' }
  const PHASE_ORDER = ['mpa', 'inducao', 'manutencao_inalatoria', 'manutencao_tiva', 'manutencao', 'infusao', 'bloqueio', 'transoperatorio', 'pos_operatorio']
  const orderedPhases = PHASE_ORDER.filter(p => groupedMeds[p]).map(p => [p, groupedMeds[p]])

  // Layout configuration — determines section visibility and order
  const DEFAULT_LAYOUT_KEYS = ['paciente','anamnese','exame_pre','exames_comp','farmacos','vias_aereas','bloqueios','tempos','monitorizacao','intercorrencias','pos_operatorio','observacoes']
  const fichaLayout = (() => {
    const saved = profile?.ficha_layout
    if (!saved || !Array.isArray(saved)) return DEFAULT_LAYOUT_KEYS.map(k => ({ key: k, visible: true }))
    const merged = saved.map(s => ({ ...s }))
    for (const k of DEFAULT_LAYOUT_KEYS) { if (!merged.find(s => s.key === k)) merged.push({ key: k, visible: true }) }
    return merged
  })()
  const secHidden = new Set(fichaLayout.filter(s => s.visible === false).map(s => s.key))
  const secOrder = fichaLayout.filter(s => s.visible !== false).map(s => s.key)
  const secVis = (key) => !secHidden.has(key)
  const fv = (sectionKey, fieldKey) => {
    const sec = fichaLayout.find(s => s.key === sectionKey)
    if (!sec || sec.visible === false) return false
    if (!sec.fields) return true
    return sec.fields[fieldKey] !== false
  }

  return (
    <div className="pb-6">
      {/* Emergency modal */}
      {showEmergency && (
        <EmergencyModal surgery={surgery} onClose={() => setShowEmergency(false)} />
      )}

      {/* Inject theme color as CSS variable for print */}
      <style>{`
        :root { --print-theme: ${profile?.theme_color || '#19B5A0'}; }
      `}</style>

      {/* Print-only professional header */}
      <div className="print-only print-header" style={{ display: 'none', position: 'relative' }}>
        {/* Logo: top-right corner, fixed size */}
        {profile?.logo_image && (
          <img src={profile.logo_image} alt="Logo" className="print-logo" style={{ position: 'absolute', top: 0, right: 0, width: '60pt', height: '30pt', objectFit: 'contain' }} />
        )}
        {/* Left-aligned professional info */}
        <div style={{ textAlign: 'left', paddingRight: profile?.logo_image ? '70pt' : 0 }}>
          {profile?.full_name && (
            <p style={{ fontSize: '11pt', fontWeight: 700, margin: '0 0 1pt', color: profile?.theme_color || '#19B5A0' }}>{profile.full_name}</p>
          )}
          {profile?.professional_title && (
            <p style={{ fontSize: '8pt', color: '#555', margin: 0 }}>{profile.professional_title}{profile?.crmv_number ? ` — ${profile.crmv_number}` : ''}</p>
          )}
          {(profile?.business_address || profile?.business_phone || profile?.business_email) && (
            <p style={{ fontSize: '7.5pt', color: '#777', margin: '1pt 0 0' }}>
              {[profile.business_address, profile.business_phone, profile.business_email].filter(Boolean).join(' | ')}
            </p>
          )}
        </div>
        {/* Title centered */}
        <h1 style={{ marginTop: '8pt' }}>Ficha de Registro Anestésico</h1>
        <p style={{ fontSize: '9pt', color: '#666', marginTop: '2pt' }}>
          Data: {fmtDate(surgery.start_time || surgery.created_at)}
          {surgery.clinic_name ? ` — ${surgery.clinic_name}` : ''}
        </p>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5" data-no-print>
        {/* Row 1: back + name + status */}
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => navigate('/fichas')}
            className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h1 className="text-sm font-bold text-slate-800 truncate flex-1">{surgery.patient_name}</h1>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.cls}`}>{st.label}</span>
        </div>
        {/* Row 2: action buttons, evenly spaced */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEmergency(true)}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg active:bg-red-700 min-h-[38px]">
            <AlertTriangle size={13} /> SOS
          </button>
          {!signature ? (
            <button onClick={handleSign} disabled={signing || !isOnline}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg min-h-[38px] ${!isOnline ? 'bg-slate-300 text-slate-500' : 'bg-teal-600 text-white active:bg-teal-700'}`}>
              <Printer size={13} /> {signing ? 'Assinando...' : 'Assinar e Imprimir'}
            </button>
          ) : (
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-200 text-slate-700 text-xs font-medium rounded-lg active:bg-slate-300 min-h-[38px]">
              <Printer size={13} /> Imprimir
              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold ml-1">Assinado</span>
            </button>
          )}
          <button onClick={() => navigate(`/fichas/${id}/edit`)}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 text-xs font-medium rounded-lg active:bg-slate-300 min-h-[38px]">
            <Edit2 size={13} /> Editar
          </button>
          <button onClick={handleDelete}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 text-xs font-medium rounded-lg active:bg-red-200 min-h-[38px]">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3 max-w-lg mx-auto">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {secVis('paciente') && <Card title="Identificação" style={{ order: secOrder.indexOf('paciente') }}>
          <InfoRow label="Paciente" value={surgery.patient_name} />
          <InfoRow label="Procedimento" value={surgery.procedure_name} />
          <InfoRow label="Espécie / Raça" value={[surgery.patient_species, surgery.patient_breed].filter(Boolean).join(' · ')} />
          <InfoRow label="Peso" value={surgery.patient_weight ? `${surgery.patient_weight} kg` : null} />
          <InfoRow label="Idade" value={surgery.patient_age} />
          <InfoRow label="Sexo" value={surgery.patient_sex} />
          <InfoRow label="Tutor" value={surgery.owner_name} />
          <InfoRow label="Clínica" value={surgery.clinic_name} />
          <InfoRow label="Cirurgião" value={surgery.surgeon_name} />
          <InfoRow label="Patologia" value={surgery.pathology} />
          <InfoRow label="ASA" value={surgery.asa_classification} />
          <InfoRow label="Data" value={fmtDate(surgery.start_time)} />
        </Card>}

        {/* Financial summary — always visible, screen only */}
        {(surgery.revenue > 0 || (summary && summary.total_cost > 0)) && (
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200 p-4" data-no-print style={{ order: -1 }}>
            <h3 className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Financeiro</h3>
            <div className="grid grid-cols-2 gap-3">
              {surgery.revenue > 0 && (
                <div>
                  <p className="text-[10px] text-teal-600 font-medium">Valor cobrado</p>
                  <p className="text-lg font-bold text-teal-800">R$ {(surgery.revenue || 0).toFixed(2).replace('.', ',')}</p>
                </div>
              )}
              {summary && summary.total_cost > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Custo total</p>
                  <p className="text-lg font-bold text-slate-700">R$ {(summary.total_cost || 0).toFixed(2).replace('.', ',')}</p>
                </div>
              )}
              {summary && summary.total_medicine_cost > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Farmacos</p>
                  <p className="text-sm font-semibold text-slate-600">R$ {(summary.total_medicine_cost || 0).toFixed(2).replace('.', ',')}</p>
                </div>
              )}
              {summary && summary.total_disposable_cost > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Descartaveis</p>
                  <p className="text-sm font-semibold text-slate-600">R$ {(summary.total_disposable_cost || 0).toFixed(2).replace('.', ',')}</p>
                </div>
              )}
              {surgery.revenue > 0 && summary && (
                <div className="col-span-2 pt-2 border-t border-teal-200">
                  <p className="text-[10px] text-teal-600 font-medium">Margem</p>
                  <p className={`text-lg font-bold ${(summary.margin || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    R$ {(summary.margin || 0).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Anamnese */}
        {secVis('anamnese') && (surgery.pre_existing_diseases || surgery.temperament || surgery.prior_medications || surgery.anamnesis_notes) && (
          <Card title="Anamnese" style={{ order: secOrder.indexOf('anamnese') }}>
            <InfoRow label="Jejum sólido" value={surgery.fasting_solid ? `Sim (${surgery.fasting_solid_hours || '?'}h)` : null} />
            <InfoRow label="Jejum hídrico" value={surgery.fasting_liquid ? `Sim (${surgery.fasting_liquid_hours || '?'}h)` : null} />
            <InfoRow label="Doenças" value={surgery.pre_existing_diseases} />
            <InfoRow label="Temperamento" value={surgery.temperament} />
            {(() => {
              let pmeds = null
              try { pmeds = JSON.parse(surgery.prior_medications) } catch {}
              if (Array.isArray(pmeds) && pmeds.length > 0) {
                return (
                  <div className="text-sm py-1.5">
                    <span className="text-slate-500">Medicações prévias</span>
                    <div className="mt-1 space-y-1">
                      {pmeds.map((pm, i) => (
                        <div key={i} className="flex items-center gap-2 text-slate-800 text-sm">
                          <span className="font-medium">{pm.name}</span>
                          {pm.dose && <span className="text-slate-500">{pm.dose}</span>}
                          {pm.route && <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{pm.route}</span>}
                          {pm.time && <span className="text-xs text-slate-400">{pm.time}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              return <InfoRow label="Medicações prévias" value={surgery.prior_medications} />
            })()}
            <InfoRow label="Obs" value={surgery.anamnesis_notes} />
          </Card>
        )}

        {/* Exame pré */}
        {secVis('exame_pre') && (surgery.pre_fc || surgery.pre_fr || surgery.pre_acp) && (
          <Card title="Exame Pré-Anestésico" style={{ order: secOrder.indexOf('exame_pre') }}>
            <InfoRow label="ACP" value={surgery.pre_acp} />
            <div className="grid grid-cols-2 gap-x-4">
              <InfoRow label="FC" value={surgery.pre_fc ? `${surgery.pre_fc} bpm` : null} />
              <InfoRow label="FR" value={surgery.pre_fr ? `${surgery.pre_fr} mpm` : null} />
              <InfoRow label="Mucosas" value={surgery.pre_mucosas} />
              <InfoRow label="TPC" value={surgery.pre_tpc} />
              <InfoRow label="T°C" value={surgery.pre_temperature} />
              <InfoRow label="Hidratação" value={surgery.pre_hydration} />
              <InfoRow label="PAS" value={surgery.pre_pas ? `${surgery.pre_pas} mmHg` : null} />
              <InfoRow label="Pulso" value={surgery.pre_pulse} />
            </div>
            <InfoRow label="Estado geral" value={surgery.general_state} />
            <InfoRow label="Estado nutricional" value={surgery.nutritional_state} />
          </Card>
        )}

        {/* Exames complementares */}
        {secVis('exames_comp') && (surgery.exam_raiox || surgery.exam_ultrassom || surgery.exam_eco_ecg || surgery.exam_outros || surgery.exam_ht) && (
          <Card title="Exames Complementares" style={{ order: secOrder.indexOf('exames_comp') }}>
            <div className="grid grid-cols-3 gap-x-4">
              <InfoRow label="Ht%" value={surgery.exam_ht} />
              <InfoRow label="Hb" value={surgery.exam_hb} />
              <InfoRow label="Eritr" value={surgery.exam_eritr} />
              <InfoRow label="PPT" value={surgery.exam_ppt} />
              <InfoRow label="Plaquetas" value={surgery.exam_plaquetas} />
              <InfoRow label="Leuc" value={surgery.exam_leuc} />
              <InfoRow label="N.Segm" value={surgery.exam_segm} />
              <InfoRow label="N.Bast" value={surgery.exam_bast} />
              <InfoRow label="Linfócitos" value={surgery.exam_linf} />
              <InfoRow label="Creat" value={surgery.exam_creat} />
              <InfoRow label="ALT" value={surgery.exam_alt} />
              <InfoRow label="FA" value={surgery.exam_fa} />
              <InfoRow label="Ureia" value={surgery.exam_ureia} />
              <InfoRow label="Alb" value={surgery.exam_alb} />
              <InfoRow label="Glic" value={surgery.exam_glic} />
            </div>
            <InfoRow label="Raio-X" value={surgery.exam_raiox} />
            <InfoRow label="Ultrassom" value={surgery.exam_ultrassom} />
            <InfoRow label="Eco/ECG" value={surgery.exam_eco_ecg} />
            <InfoRow label="Outros exames" value={surgery.exam_outros} />
          </Card>
        )}

        {/* Vias aéreas */}
        {secVis('vias_aereas') && (surgery.airway_type || surgery.breathing_mode) && (
          <Card title="Vias Aéreas" style={{ order: secOrder.indexOf('vias_aereas') }}>
            {fv('vias_aereas','airway_type') && <InfoRow label="Tipo" value={surgery.airway_type === 'Outro' && surgery.airway_other ? `Outro: ${surgery.airway_other}` : surgery.airway_type} />}
            {fv('vias_aereas','tube_number') && <InfoRow label="Tubo" value={surgery.tube_number} />}
            {fv('vias_aereas','breathing_mode') && <InfoRow label="Respiração" value={surgery.breathing_mode} />}
            {fv('vias_aereas','ventilation_type') && (surgery.breathing_mode || '').includes('Controlada') && surgery.ventilation_type && (
              <InfoRow label="Tipo de ventilação" value={surgery.ventilation_type} />
            )}
            {fv('vias_aereas','breathing_system') && <InfoRow label="Sistema" value={surgery.breathing_system} />}
            {fv('vias_aereas','peep') && surgery.peep ? <InfoRow label="PEEP" value="Sim" /> : null}
          </Card>
        )}

        {/* Bloqueios */}
        {secVis('bloqueios') && surgery.block_type && (() => {
          let parsedBlocks = []
          try { parsedBlocks = JSON.parse(surgery.block_type) } catch { parsedBlocks = [{ type: surgery.block_type, drug: surgery.block_drug, dose_volume: surgery.block_dose_volume }] }
          return parsedBlocks.length > 0 ? (
            <Card title="Bloqueios" style={{ order: secOrder.indexOf('bloqueios') }}>
              {parsedBlocks.map((blk, i) => (
                <div key={i} className={`${i > 0 ? 'mt-3 pt-3 border-t border-slate-100' : ''}`}>
                  <InfoRow label="Tipo" value={blk.type === 'Outro' && blk.other_type ? `Outro: ${blk.other_type}` : blk.type} />
                  {blk.drugs && Array.isArray(blk.drugs) ? (
                    blk.drugs.map((drug, di) => (
                      <div key={di} className="ml-2">
                        <span className="text-slate-500">Fármaco{blk.drugs.length > 1 ? ` ${di + 1}` : ''}</span>
                        <span className="text-slate-700 ml-1">{drug.name || '-'}</span>
                        {drug.dose_volume && <span className="text-slate-500 ml-1">({drug.dose_volume})</span>}
                      </div>
                    ))
                  ) : (
                    <>
                      <InfoRow label="Fármaco" value={blk.drug} />
                      <InfoRow label="Dose/volume" value={blk.dose_volume} />
                    </>
                  )}
                </div>
              ))}
            </Card>
          ) : null
        })()}

        {/* Medicamentos por fase */}
        {secVis('farmacos') && <Card title="Fármacos Utilizados" style={{ order: secOrder.indexOf('farmacos') }}>
          {medicines.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum fármaco registrado.</p>
          ) : (
            <>
              {/* Screen: cards */}
              <div className="print-hide">
                {orderedPhases.map(([phase, meds]) => (
                  <div key={phase} className="mb-3 last:mb-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{phaseLabels[phase] || phase}</p>
                    {meds.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{m.medicine_name}</p>
                          <p className="text-xs text-slate-500">
                            {m.dose} {m.dose_unit} · {m.route || '-'} · {fmtTime(m.administered_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            m.drug_source === 'clinica' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                          }`}>
                            {m.drug_source === 'clinica' ? 'Clínica' : 'Próprio'}
                          </span>
                          {surgery.status !== 'completed' && (
                            <button onClick={() => removeMedicine(m.id)} className="p-1.5 text-slate-400 active:text-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {/* Print: compact table */}
              <div className="print-only" style={{ display: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                  <thead>
                    <tr style={{ borderBottom: '1pt solid #999' }}>
                      <th style={{ textAlign: 'left', padding: '3pt 4pt', fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Fase</th>
                      <th style={{ textAlign: 'left', padding: '3pt 4pt', fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Fármaco</th>
                      <th style={{ textAlign: 'center', padding: '3pt 4pt', fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Dose</th>
                      <th style={{ textAlign: 'center', padding: '3pt 4pt', fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Via</th>
                      <th style={{ textAlign: 'center', padding: '3pt 4pt', fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedPhases.flatMap(([phase, meds]) =>
                      meds.map((m) => (
                        <tr key={m.id} style={{ borderBottom: '0.5pt solid #ddd' }}>
                          <td style={{ padding: '2.5pt 4pt', textAlign: 'left' }}>{phaseLabels[phase]}</td>
                          <td style={{ padding: '2.5pt 4pt', textAlign: 'left' }}>{m.medicine_name}</td>
                          <td style={{ padding: '2.5pt 4pt', textAlign: 'center' }}>{m.dose} {m.dose_unit}</td>
                          <td style={{ padding: '2.5pt 4pt', textAlign: 'center' }}>{m.route || '-'}</td>
                          <td style={{ padding: '2.5pt 4pt', textAlign: 'center' }}>{fmtTime(m.administered_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>}

        {/* Descartáveis Utilizados */}
        {disposables.length > 0 && (
          <Card title="Descartáveis Utilizados" data-no-print style={{ order: secOrder.indexOf('farmacos') }}>
            {disposables.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{d.medicine_name}</p>
                  <p className="text-xs text-slate-500">Qtd: {d.quantity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-700">
                    R$ {(d.total_cost || 0).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Tempos cirúrgicos */}
        {secVis('tempos') && (surgery.anesthesia_start || surgery.procedure_start || surgery.procedure_end || surgery.anesthesia_end || surgery.extubation_time) && (
          <Card title="Tempos" icon={Clock} style={{ order: secOrder.indexOf('tempos') }}>
            {fv('tempos','anesthesia_start') && <InfoRow label="Início anestesia" value={surgery.anesthesia_start ? fmtTime(surgery.anesthesia_start) : null} />}
            {fv('tempos','procedure_start') && <InfoRow label="Início procedimento" value={surgery.procedure_start ? fmtTime(surgery.procedure_start) : null} />}
            {fv('tempos','procedure_end') && <InfoRow label="Final procedimento" value={surgery.procedure_end ? fmtTime(surgery.procedure_end) : null} />}
            {fv('tempos','anesthesia_end') && <InfoRow label="Final anestesia" value={surgery.anesthesia_end ? fmtTime(surgery.anesthesia_end) : null} />}
            {fv('tempos','extubation_time') && <InfoRow label="Hora de extubação" value={surgery.extubation_time ? fmtTime(surgery.extubation_time) : null} />}
          </Card>
        )}

        {/* === MONITORAÇÃO TRANSOPERATÓRIA === */}
        {secVis('monitorizacao') && <Card title="Monitoração" icon={Heart} style={{ order: secOrder.indexOf('monitorizacao') }}>
          <button
            onClick={() => setShowVitals(!showVitals)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 mb-3 bg-teal-50 text-teal-700 text-sm font-medium rounded-lg active:bg-teal-100 min-h-[44px]"
            data-no-print
          >
            <Plus size={16} /> Registrar sinais vitais
          </button>

          {showVitals && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2" data-no-print>
              <div className="grid grid-cols-3 gap-2">
                {VITAL_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">{f.label}</label>
                    <input
                      type={f.type}
                      inputMode={f.type === 'number' ? 'decimal' : 'text'}
                      step="any"
                      value={newVital[f.key] || ''}
                      onChange={e => setNewVital(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.unit}
                      className="w-full px-2 py-2 border border-slate-200 rounded text-sm min-h-[40px]"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowVitals(false); setNewVital({}) }}
                  className="flex-1 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg min-h-[44px]">
                  Cancelar
                </button>
                <button type="button" onClick={addVitals}
                  className="flex-1 py-2 text-sm text-white bg-teal-600 rounded-lg active:bg-teal-700 min-h-[44px] font-medium">
                  Salvar
                </button>
              </div>
            </div>
          )}

          {vitals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum registro.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="text-xs min-w-[820px] w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 font-semibold text-slate-500 sticky left-0 bg-white">Hora</th>
                    {VITAL_FIELDS.map(f => (
                      <th key={f.key} className="text-center py-2 font-semibold text-slate-500 px-1">{f.label}</th>
                    ))}
                    <th className="w-8" data-no-print></th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((v, i) => (
                    <tr key={v.id || i} className="border-b border-slate-50">
                      <td className="py-2 font-mono text-slate-600 sticky left-0 bg-white">{fmtTime(v.recorded_at)}</td>
                      {VITAL_FIELDS.map(f => {
                        const noteKeyMap = { pas: 'pas', fr: 'fr', temperature: 'temperature', o2_l_min: 'o2' }
                        const noteKey = noteKeyMap[f.key]
                        let pn = v.param_notes; if (typeof pn === 'string') { try { pn = JSON.parse(pn) } catch { pn = {} } }
                        const noteVal = noteKey ? (pn || {})[noteKey] : null
                        return (
                          <td key={f.key} className="py-2 text-center text-slate-700 px-1">
                            {v[f.key] ?? '-'}
                            {noteVal && <div className="text-[8px] text-teal-600 leading-tight">{noteVal}</div>}
                          </td>
                        )
                      })}
                      <td data-no-print>
                        {surgery.status !== 'completed' && (
                          <button onClick={() => deleteVital(v.id)} className="p-1 text-slate-400 active:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>}

        {/* Intercorrências / Anotações */}
        {secVis('intercorrencias') && surgery.complications && (() => {
          let entries = []
          try {
            const parsed = JSON.parse(surgery.complications)
            entries = Array.isArray(parsed) ? parsed : [{ time: '', text: surgery.complications }]
          } catch {
            entries = [{ time: '', text: surgery.complications }]
          }
          if (entries.length === 0 || entries.every(e => !e.text?.trim())) return null
          return (
            <Card title="Intercorrências / Anotações" style={{ order: secOrder.indexOf('intercorrencias') }}>
              <div className="space-y-1.5">
                {entries.filter(e => e.text?.trim()).map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    {entry.time && (
                      <span className="text-xs font-mono font-semibold text-red-600 shrink-0 mt-0.5">{entry.time}</span>
                    )}
                    <span className="text-sm text-slate-800 whitespace-pre-line">{entry.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })()}

        {/* Pós-operatório */}
        {secVis('pos_operatorio') && (surgery.post_operative || surgery.recovery_quality) && (
          <Card title="Pós-operatório" style={{ order: secOrder.indexOf('pos_operatorio') }}>
            {surgery.post_operative && (
              <p className="text-sm text-slate-700 whitespace-pre-line">{surgery.post_operative}</p>
            )}
            {surgery.recovery_quality && (
              <InfoRow label="Qualidade da recuperação" value={surgery.recovery_quality} />
            )}
          </Card>
        )}

        {/* Observações */}
        {secVis('observacoes') && surgery.monitoring_notes && (
          <Card title="Observações" style={{ order: secOrder.indexOf('observacoes') }}>
            <p className="text-sm text-slate-700 whitespace-pre-line">{surgery.monitoring_notes}</p>
          </Card>
        )}

        {/* Electronic Signature Block (print only) */}
        {signature && (
          <div className="print-only" style={{
            order: 100,
            display: 'none',
            marginTop: '24pt',
            padding: '12pt 16pt',
            border: '1.5pt solid var(--print-theme, #19B5A0)',
            borderRadius: '4pt',
            fontSize: '8pt',
            color: '#334155',
            lineHeight: '1.6',
            pageBreakInside: 'avoid',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12pt' }}>
              {/* QR Code */}
              <div style={{ flexShrink: 0 }}>
                <QRCodeSVG
                  value={`${window.location.origin}/validar?code=${signature.verification_code}`}
                  size={72}
                  level="M"
                  fgColor={profile?.theme_color || '#19B5A0'}
                />
              </div>
              {/* Signature info */}
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 3pt', fontSize: '8.5pt', fontWeight: 700, color: 'var(--print-theme, #19B5A0)', letterSpacing: '0.5pt', textTransform: 'uppercase' }}>
                  Assinatura Eletrônica
                </p>
                <p style={{ margin: '0 0 2pt', fontSize: '7pt', color: '#64748b' }}>
                  Art. 4°, II da Lei 14.063/2020
                </p>
                <p style={{ margin: '0 0 2pt', fontFamily: 'monospace', fontSize: '6.5pt', wordBreak: 'break-all', color: '#64748b' }}>
                  SHA256: {signature.hash_sha256}
                </p>
                <p style={{ margin: '0 0 2pt', fontSize: '7.5pt' }}>
                  Código: <strong>{signature.verification_code}</strong>
                </p>
                <p style={{ margin: '0 0 4pt', fontSize: '7pt', color: '#64748b' }}>
                  Escaneie o QR code ou acesse: {window.location.origin}/validar?code={signature.verification_code}
                </p>
                <p style={{ margin: 0, fontSize: '7.5pt', borderTop: '0.5pt solid #e2e8f0', paddingTop: '3pt' }}>
                  <strong>{signature.signer_name}</strong>
                  {signature.signer_crmv ? ` (${signature.signer_crmv})` : ''} assinou em{' '}
                  {fmtDate(signature.signed_at)} às {fmtTime(signature.signed_at)}
                  {signature.signer_ip ? ` — IP ${signature.signer_ip}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Carimbo / Stamp (visible only in print) */}
        {profile && (profile.full_name || profile.crmv_number) && (
          <div className="print-carimbo" style={{ order: 99 }}>
            <div className="carimbo-line" />
            <div className="carimbo-content">
              {profile.signature_image && (
                <img src={profile.signature_image} alt="Assinatura" className="carimbo-signature" />
              )}
              {profile.full_name && (
                <p className="carimbo-name">{profile.full_name}</p>
              )}
              {profile.professional_title && (
                <p className="carimbo-title">{profile.professional_title}</p>
              )}
              {profile.crmv_number && (
                <p className="carimbo-crmv">{profile.crmv_number}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
