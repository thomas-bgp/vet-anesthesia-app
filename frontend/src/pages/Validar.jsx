import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function Validar() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-validate if code is in URL
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) {
      setCode(urlCode)
      validate(urlCode)
    }
  }, [])

  const validate = async (verificationCode) => {
    const c = verificationCode || code
    if (!c.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/signatures/validate/${encodeURIComponent(c.trim())}`)
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Erro ao validar.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '-'
  const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 50%, #f8fafc 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0d9488', margin: '0 0 4px' }}>
          VetAnestesia
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Validação de Assinatura Eletrônica
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '32px 24px',
        width: '100%',
        maxWidth: '480px',
      }}>
        {/* Input */}
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
          Código de verificação
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && validate()}
            placeholder="Digite o código de verificação"
            style={{
              flex: 1,
              padding: '12px 14px',
              border: '1.5px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '15px',
              outline: 'none',
              fontFamily: 'monospace',
              letterSpacing: '0.5px',
            }}
          />
          <button
            onClick={() => validate()}
            disabled={loading || !code.trim()}
            style={{
              padding: '12px 20px',
              background: loading ? '#94a3b8' : '#0d9488',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '14px 16px',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Result: valid */}
        {result && result.valid && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '20px',
          }}>
            {/* Checkmark */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#22c55e',
                marginBottom: '8px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#166534', margin: '0 0 2px' }}>
                Documento Válido
              </p>
              <p style={{ fontSize: '12px', color: '#16a34a', margin: 0 }}>
                Assinatura eletrônica verificada com sucesso
              </p>
            </div>

            {/* Signer info */}
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '12px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                Signatário
              </p>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: '0 0 2px' }}>
                {result.signature.signer_name}
              </p>
              {result.signature.signer_crmv && (
                <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 2px' }}>
                  {result.signature.signer_crmv}
                </p>
              )}
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Assinado em {fmtDate(result.signature.signed_at)} às {fmtTime(result.signature.signed_at)}
              </p>
            </div>

            {/* Surgery info */}
            {result.surgery && (
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '12px',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                  Documento
                </p>
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Paciente:</strong> {result.surgery.patient_name}
                  </p>
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Procedimento:</strong> {result.surgery.procedure_name}
                  </p>
                  {result.surgery.clinic_name && (
                    <p style={{ margin: '0 0 4px' }}>
                      <strong>Clínica:</strong> {result.surgery.clinic_name}
                    </p>
                  )}
                  <p style={{ margin: 0 }}>
                    <strong>Data:</strong> {fmtDate(result.surgery.date)}
                  </p>
                </div>
              </div>
            )}

            {/* Hash */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '12px 14px',
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#64748b',
              wordBreak: 'break-all',
              lineHeight: '1.5',
            }}>
              <span style={{ fontWeight: 700 }}>SHA256:</span> {result.signature.hash_sha256}
            </div>
          </div>
        )}

        {/* Result: invalid */}
        {result && !result.valid && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ef4444',
              marginBottom: '8px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b', margin: '0 0 4px' }}>
              Documento não encontrado
            </p>
            <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>
              Nenhuma assinatura corresponde a este código de verificação.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ marginTop: '24px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
        Validação de assinatura eletrônica conforme Lei 14.063/2020
      </p>
    </div>
  )
}
