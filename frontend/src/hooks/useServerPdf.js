import { useState, useEffect } from 'react'
import api from '../api/axios'

// iOS 26 (update de 27/10/26) parou de abrir a impressão via window.print() no app instalado
// na tela inicial; no Safari segue funcionando. Nesse caso o PDF vem pronto do backend e vai
// pro share sheet (Salvar em Arquivos, AirDrop, WhatsApp, Imprimir).
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
export const needsServerPdf = isIOS && isStandalone

async function fetchPdfFile(surgeryId, patientName) {
  const res = await api.get(`/surgeries/${surgeryId}/pdf`, { responseType: 'blob' })
  const name = `ficha-${(patientName || surgeryId).toString().replace(/[^\w-]+/g, '_')}.pdf`
  return new File([res.data], name, { type: 'application/pdf' })
}

export function useServerPdf(surgeryId, surgery) {
  // Guarda pra qual ficha (objeto carregado) o PDF foi gerado: recarregou a ficha, o PDF velho
  // deixa de valer sem precisar de setState síncrono no effect.
  const [result, setResult] = useState({ for: null, file: null, error: false })
  const current = result.for === surgery
  const status = !needsServerPdf || !surgery ? 'idle'
    : !current ? 'loading' : result.error ? 'error' : 'ready'

  // O share sheet do iOS exige gesto do usuário "fresco": se o fetch acontecer depois do toque,
  // o navigator.share é recusado. Por isso o PDF é pré-gerado assim que a ficha carrega.
  useEffect(() => {
    if (!needsServerPdf || !surgery) return
    let cancelled = false
    fetchPdfFile(surgeryId, surgery.patient_name)
      .then((file) => { if (!cancelled) setResult({ for: surgery, file, error: false }) })
      .catch((error) => {
        console.error('Erro ao gerar PDF no servidor:', { surgeryId, error })
        if (!cancelled) setResult({ for: surgery, file: null, error: true })
      })
    return () => { cancelled = true }
  }, [surgeryId, surgery])

  const sharePdf = async () => {
    let f = current ? result.file : null
    if (!f) {
      try { f = await fetchPdfFile(surgeryId, surgery?.patient_name) } catch (error) {
        console.error('Erro ao gerar PDF no servidor:', { surgeryId, error })
        alert('Não foi possível gerar o PDF. Tente novamente.')
        return
      }
    }
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: f.name })
        return
      }
    } catch (error) {
      if (error.name === 'AbortError') return
      console.error('Erro ao compartilhar PDF:', error)
    }
    window.location.assign(URL.createObjectURL(f))
  }

  return { status, sharePdf }
}
