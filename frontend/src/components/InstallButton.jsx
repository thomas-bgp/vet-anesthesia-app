import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function InstallButton() {
  const { user } = useAuth()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => setInstalled(true)
    window.addEventListener('appinstalled', installedHandler)

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // Only show for paid plans
  if (!user || user.plan === 'free') return null
  if (installed) return null
  if (!deferredPrompt) return null

  const handleInstall = async () => {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  return (
    <button
      onClick={handleInstall}
      className="flex items-center justify-center gap-2 w-full py-3.5 bg-teal-600 text-white font-medium rounded-xl text-sm active:bg-teal-700 transition min-h-[48px] shadow-sm"
    >
      <Download size={18} />
      Instalar app
    </button>
  )
}
