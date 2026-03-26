import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { ClipboardList, Package, BarChart3, User, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

const tabs = [
  { to: '/fichas', label: 'Fichas', icon: ClipboardList },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/resumo', label: 'Resumo', icon: BarChart3 },
  { to: '/perfil', label: 'Perfil', icon: User },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  // Hide bottom nav when inside surgery form/detail (full-screen experience)
  const hideNav = /^\/(fichas\/new|fichas\/\d+)/.test(location.pathname)

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-teal-600 p-1.5 rounded-lg">
            <ClipboardList size={18} className="text-white" />
          </div>
          <span className="font-bold text-slate-700 text-sm">VetAnestesia</span>
        </div>
        <span className="text-xs text-slate-400 truncate max-w-[150px]">{user?.name}</span>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom nav - mobile style */}
      {!hideNav && (
        <nav className="flex items-center justify-around bg-white border-t border-slate-200 shrink-0 safe-bottom">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors ${
                  isActive
                    ? 'text-teal-600'
                    : 'text-slate-400'
                }`
              }
            >
              <Icon size={22} strokeWidth={1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
