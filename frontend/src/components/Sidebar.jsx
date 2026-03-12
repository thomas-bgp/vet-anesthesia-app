import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Syringe,
  PawPrint,
  Package,
  Users,
  BarChart3,
  LogOut,
  Activity,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/surgeries', label: 'Cirurgias', icon: Activity },
  { to: '/medicines', label: 'Medicamentos', icon: Syringe },
  { to: '/stock', label: 'Estoque', icon: Package },
  { to: '/referrals', label: 'Indicações', icon: Users },
  { to: '/reports', label: 'Relatórios', icon: BarChart3 },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-slate-800 flex flex-col z-30
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="bg-teal-600 p-2 rounded-lg">
            <PawPrint size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">VetAnestesia</p>
            <p className="text-slate-400 text-xs">Gestão Veterinária</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-slate-700">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
