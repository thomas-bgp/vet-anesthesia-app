import { useState, useEffect } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

export default function InstallButton() {
  const { user } = useAuth()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!user || user.plan === 'free') return null
  if (installed) return null

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    } else {
      setShowGuide(true)
    }
  }

  return (
    <>
      <button onClick={handleInstall}
        className="flex items-center justify-center gap-2 w-full py-3.5 bg-teal-600 text-white font-medium rounded-xl text-sm active:bg-teal-700 transition min-h-[48px] shadow-sm">
        <Download size={18} />
        Instalar app no celular
      </button>

      {showGuide && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowGuide(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Instalar Anestify</h3>
              <button onClick={() => setShowGuide(false)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>

            {isIOS ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">No Safari do iPhone/iPad:</p>
                <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                  <span className="text-lg">1.</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Toque no botão <Share size={14} className="inline text-blue-500" /> Compartilhar</p>
                    <p className="text-xs text-slate-500">Na barra inferior do Safari</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                  <span className="text-lg">2.</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Toque em "Adicionar à Tela de Início"</p>
                    <p className="text-xs text-slate-500">Role pra baixo se não aparecer</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                  <span className="text-lg">3.</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Toque em "Adicionar"</p>
                    <p className="text-xs text-slate-500">O app aparece na tela inicial como um app nativo</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">No Chrome do Android:</p>
                <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                  <span className="text-lg">1.</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Toque nos 3 pontinhos ⋮</p>
                    <p className="text-xs text-slate-500">No canto superior direito do Chrome</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                  <span className="text-lg">2.</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Toque em "Instalar app" ou "Adicionar à tela inicial"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                  <span className="text-lg">3.</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Confirme a instalação</p>
                    <p className="text-xs text-slate-500">O app funciona offline após instalar</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
