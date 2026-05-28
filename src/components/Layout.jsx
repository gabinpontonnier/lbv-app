import { Outlet, NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const tabs = [
  { to: '/',           label: 'Accueil',   icon: '🏠', end: true },
  { to: '/livraison',  label: 'Livraison', icon: '📦' },
  { to: '/mensuel',    label: 'Mensuel',   icon: '📋' },
  { to: '/parametres', label: 'Réglages',  icon: '⚙️' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow">
        <span className="font-bold text-lg">🧺 Laverie Belle Vie</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-blue-100 text-xs hover:text-white transition-colors"
        >
          Déconnexion
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-10 safe-area-bottom">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-semibold gap-0.5 transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`
            }
          >
            <span className="text-xl leading-tight">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
