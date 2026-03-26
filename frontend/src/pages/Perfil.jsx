import { useAuth } from '../context/AuthContext'
import { LogOut, User } from 'lucide-react'

export default function Perfil() {
  const { user, logout } = useAuth()

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center">
            <User size={28} className="text-teal-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">{user?.name}</p>
            <p className="text-slate-500 text-sm">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl text-sm active:bg-red-100 transition min-h-[48px]"
        >
          <LogOut size={18} />
          Sair da conta
        </button>
      </div>
    </div>
  )
}
