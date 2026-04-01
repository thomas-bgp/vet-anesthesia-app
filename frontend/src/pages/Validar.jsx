import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Search, Shield, Clock, User, Stethoscope } from 'lucide-react'

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '-'
const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'
const PHASE_LABELS = { mpa: 'MPA', inducao: 'Indução', manutencao: 'Manutenção', infusao: 'Infusão', transoperatorio: 'Trans-op', pos_operatorio: 'Pós-op', bloqueio: 'Bloqueio' }

export default function Validar() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) { setCode(urlCode); validate(urlCode) }
  }, [])

  const validate = async (verificationCode) => {
    const c = verificationCode || code
    if (!c.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch(`/api/signatures/validate/${encodeURIComponent(c.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const s = result?.surgery
  const sig = result?.signature
  const meds = result?.medicines || []
  const vitals = result?.vitals || []

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="bg-teal-600 p-2 rounded-lg">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg">VetAnestesia</h1>
            <p className="text-xs text-slate-500">Verificação de autenticidade</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Código de verificação</label>
          <div className="flex gap-2">
            <input type="text" value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && validate()}
              placeholder="Cole o código aqui" className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]" />
            <button onClick={() => validate()} disabled={loading || !code.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg active:bg-teal-700 min-h-[44px] disabled:opacity-50">
              {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Search size={16} /> Verificar</>}
            </button>
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {/* Invalid */}
        {result && !result.valid && (
          <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
            <XCircle size={48} className="mx-auto text-red-500 mb-3" />
            <h2 className="text-lg font-bold text-red-700 mb-1">Documento não encontrado</h2>
            <p className="text-sm text-slate-500">O código informado não corresponde a nenhum documento assinado.</p>
          </div>
        )}

        {/* Valid */}
        {result?.valid && sig && (
          <>
            {/* Verified badge */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle size={32} className="text-green-600" />
                <div>
                  <h2 className="text-lg font-bold text-green-800">Documento autêntico</h2>
                  <p className="text-xs text-green-600">Assinatura eletrônica válida (Lei 14.063/2020)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-green-600 font-medium">Assinado por</p>
                  <p className="font-semibold text-slate-800">{sig.signer_name}</p>
                  {sig.signer_crmv && <p className="text-xs text-slate-500">{sig.signer_crmv}</p>}
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium">Data da assinatura</p>
                  <p className="font-semibold text-slate-800">{fmtDate(sig.signed_at)}</p>
                  <p className="text-xs text-slate-500">{fmtTime(sig.signed_at)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-[10px] text-green-700 font-mono break-all">SHA256: {sig.hash_sha256}</p>
              </div>
            </div>

            {/* Surgery data — for comparison with the printed PDF */}
            {s && (
              <>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-slate-500" />
                      <h3 className="text-sm font-semibold text-slate-700">Dados do registro assinado</h3>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Compare com o documento impresso para verificar integridade</p>
                  </div>
                  <div className="p-4 space-y-1 text-sm">
                    <Row label="Paciente" value={s.patient_name} bold />
                    <Row label="Procedimento" value={s.procedure_name} bold />
                    <Row label="Espécie / Raça" value={[s.patient_species, s.patient_breed].filter(Boolean).join(' · ')} />
                    <Row label="Peso" value={s.patient_weight ? `${s.patient_weight} kg` : null} />
                    <Row label="Idade" value={s.patient_age} />
                    <Row label="Sexo" value={s.patient_sex} />
                    <Row label="Tutor" value={s.owner_name} />
                    <Row label="Clínica" value={s.clinic_name} />
                    <Row label="Cirurgião" value={s.surgeon_name} />
                    <Row label="ASA" value={s.asa_classification} />
                    <Row label="Data" value={fmtDate(s.start_time || s.created_at)} />
                    {s.pre_fc && <Row label="FC basal" value={`${s.pre_fc} bpm`} />}
                    {s.pre_fr && <Row label="FR basal" value={`${s.pre_fr} mpm`} />}
                    {s.pre_temperature && <Row label="T°C basal" value={s.pre_temperature} />}
                    {s.pre_pas && <Row label="PAS basal" value={`${s.pre_pas} mmHg`} />}
                    {s.airway_type && <Row label="Via aérea" value={s.airway_type} />}
                    {s.tube_number && <Row label="Tubo" value={s.tube_number} />}
                    {s.anesthesia_start && <Row label="Início anestesia" value={fmtTime(s.anesthesia_start)} />}
                    {s.procedure_start && <Row label="Início procedimento" value={fmtTime(s.procedure_start)} />}
                    {s.procedure_end && <Row label="Fim procedimento" value={fmtTime(s.procedure_end)} />}
                    {s.anesthesia_end && <Row label="Fim anestesia" value={fmtTime(s.anesthesia_end)} />}
                    {s.extubation_time && <Row label="Extubação" value={fmtTime(s.extubation_time)} />}
                  </div>
                </div>

                {/* Medicines */}
                {meds.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Stethoscope size={14} className="text-slate-500" />
                        <h3 className="text-sm font-semibold text-slate-700">Fármacos utilizados</h3>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {meds.map((m, i) => (
                        <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-slate-800">{m.name || '-'}</span>
                            <span className="text-slate-400 text-xs ml-2">{PHASE_LABELS[m.phase] || m.phase}</span>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            {m.dose} {m.dose_unit} {m.route ? `· ${m.route}` : ''} {m.administered_at ? `· ${fmtTime(m.administered_at)}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vitals */}
                {vitals.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-500" />
                        <h3 className="text-sm font-semibold text-slate-700">Monitoração transoperatória</h3>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Hora</th>
                            {['FC','FR','SpO2','PAS','PAM','PAD','ETCO2','T°C','Fluido','O2','Anest.'].map(h => (
                              <th key={h} className="text-center px-1.5 py-2 font-semibold text-slate-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vitals.map((v, i) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="px-3 py-1.5 font-mono text-slate-600">{fmtTime(v.recorded_at)}</td>
                              {['fc','fr','spo2','pas','pam','pad','etco2','temperature','fluid_ml_kg_h','o2_l_min','anesthetic'].map(k => (
                                <td key={k} className="text-center px-1.5 py-1.5 text-slate-700">{v[k] ?? '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Post-op */}
                {(s.post_operative || s.recovery_quality || s.complications) && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700">Pós-operatório</h3>
                    {s.post_operative && <p className="text-slate-600">{s.post_operative}</p>}
                    {s.recovery_quality && <Row label="Recuperação" value={s.recovery_quality} />}
                    {s.complications && <p className="text-slate-600 text-xs bg-amber-50 p-2 rounded">Intercorrências: {s.complications}</p>}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-xs text-slate-400">
          <p>VetAnestesia — Sistema de Gestão para Anestesiologistas Veterinários</p>
          <p className="mt-1">Validação de assinatura eletrônica conforme Lei 14.063/2020</p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-1 border-b border-slate-50">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${bold ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{value}</span>
    </div>
  )
}
