import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Calendar, FileText, User, Plus, LogOut } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { Footer } from './Footer'
import { useAuth } from '../../contexts/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/appointments', label: 'Appointments', icon: Calendar, end: false },
  { to: '/dashboard/reports', label: 'Reports', icon: FileText, end: false },
  { to: '/dashboard/profile', label: 'Profile', icon: User, end: false },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { logOut, userProfile } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <NavLink to="/dashboard/book">
              <button className="gradient-bg text-white text-xs font-semibold px-4 py-2 rounded-full hover:opacity-90 transition flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Book Test
              </button>
            </NavLink>
            <span className="text-sm text-slate-500 hidden sm:block">{userProfile?.name}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 shrink-0">
          <nav className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3 flex flex-col gap-1 sticky top-24">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 flex z-30">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-2 text-xs transition-colors ${
                isActive ? 'text-teal-600' : 'text-slate-500'
              }`
            }
          >
            <Icon className="h-5 w-5 mb-0.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="pb-16 md:pb-0">
        <Footer />
      </div>
    </div>
  )
}
