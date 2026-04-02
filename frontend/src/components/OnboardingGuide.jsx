import { useState } from 'react'
import { User, Stethoscope, Package, Calculator } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function OnboardingGuide() {
  const { updateUser, user } = useAuth()
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = async () => {
    setDismissing(true)
    try {
      const res = await api.put('/auth/profile', {
        full_name: user?.full_name,
        professional_title: user?.professional_title,
        crmv_number: user?.crmv_number,
        signature_image: user?.signature_image,
        onboarding_done: true,
      })
      updateUser(res.data.user)
    } catch {
      // Still dismiss locally even if save fails
      updateUser({ ...user, onboarding_done: true })
    }
  }

  const tips = [
    { icon: User, text: 'Configure seu perfil com logo, assinatura e dados profissionais' },
    { icon: Stethoscope, text: 'Crie fichas anestesicas completas para cada cirurgia' },
    { icon: Package, text: 'Gerencie seu estoque de medicamentos e insumos' },
    { icon: Calculator, text: 'Acompanhe suas financas na aba Financeiro' },
  ]

  const themeColor = user?.theme_color || '#19B5A0'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <p className="text-3xl mb-2">👋</p>
          <h2 className="text-xl font-bold text-[#0B3D6B]">Bem-vinda ao Anestify!</h2>
          <p className="text-sm text-slate-500 mt-1">Aqui vai um resumo rapido do que voce pode fazer:</p>
        </div>

        {/* Tips */}
        <div className="px-6 pb-4 space-y-3">
          {tips.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: themeColor + '18' }}>
                <Icon size={16} style={{ color: themeColor }} />
              </div>
              <p className="text-sm text-slate-700 pt-1">{text}</p>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="w-full py-3 text-white font-semibold rounded-xl text-sm min-h-[48px] active:opacity-90 transition"
            style={{ backgroundColor: themeColor }}
          >
            {dismissing ? 'Carregando...' : 'Entendi, vamos la!'}
          </button>
          <p className="text-xs text-slate-400 text-center">
            Voce pode acessar o Perfil a qualquer momento para personalizar
          </p>
        </div>
      </div>
    </div>
  )
}
