import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, LogOut, User, Shield } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { Button } from '../ui/Button'
import { useAuth } from '../../contexts/AuthContext'

export function Navbar() {
  const { currentUser, isAdmin, logOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isLanding = location.pathname === '/'

  async function handleLogout() {
    await logOut()
    navigate('/')
  }

  const navLinks = currentUser
    ? isAdmin
      ? [
          { to: '/admin', label: 'Dashboard' },
          { to: '/admin/appointments', label: 'Appointments' },
          { to: '/admin/patients', label: 'Patients' },
          { to: '/admin/packages', label: 'Packages' },
        ]
      : [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/dashboard/appointments', label: 'Appointments' },
          { to: '/dashboard/reports', label: 'Reports' },
        ]
    : []

  return (
    <nav
      className={`sticky top-0 z-40 ${
        isLanding
          ? 'bg-transparent'
          : 'bg-white/95 backdrop-blur border-b border-slate-100'
      } transition-all`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <BrandLogo white={isLanding} />

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`text-sm font-medium transition-colors ${
                  isLanding
                    ? 'text-white/90 hover:text-white'
                    : location.pathname === l.to
                    ? 'text-teal-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <>
                <Link to={isAdmin ? '/admin' : '/dashboard/profile'}>
                  <button
                    className={`flex items-center gap-2 text-sm font-medium ${
                      isLanding ? 'text-white' : 'text-slate-600'
                    } hover:opacity-80`}
                  >
                    {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    {isAdmin ? 'Admin' : 'Profile'}
                  </button>
                </Link>
                <Button
                  variant={isLanding ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={isLanding ? 'text-white hover:bg-white/10' : ''}
                  >
                    Log In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={`md:hidden p-2 rounded-xl ${
              isLanding ? 'text-white' : 'text-slate-600'
            }`}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 flex flex-col gap-3">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-slate-700 py-2"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {currentUser ? (
            <Button variant="danger" size="sm" onClick={handleLogout} className="w-full">
              Logout
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  Log In
                </Button>
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
