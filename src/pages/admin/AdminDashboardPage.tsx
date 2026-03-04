import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Calendar, FileText, Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { getAdminStats, getAllAppointments } from '../../lib/firestore'
import type { Appointment } from '../../types'
import { format } from 'date-fns'

export default function AdminDashboardPage() {
  const { userProfile, logOut } = useAuth()
  const [stats, setStats] = useState({
    totalAppointments: 0,
    pendingAppointments: 0,
    totalPatients: 0,
    reportsUploaded: 0,
  })
  const [recent, setRecent] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAdminStats(), getAllAppointments()])
      .then(([s, appts]) => {
        setStats(s)
        setRecent(appts.slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await logOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">
              Admin: {userProfile?.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-500 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Admin nav */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {[
            { to: '/admin', label: 'Dashboard' },
            { to: '/admin/appointments', label: 'Appointments' },
            { to: '/admin/patients', label: 'Patients' },
            { to: '/admin/packages', label: 'Packages' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:border-teal-400 hover:text-teal-600 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Admin Dashboard</h1>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                {
                  label: 'Total Appointments',
                  value: stats.totalAppointments,
                  icon: Calendar,
                  color: 'text-blue-600 bg-blue-50',
                },
                {
                  label: 'Pending',
                  value: stats.pendingAppointments,
                  icon: Clock,
                  color: 'text-yellow-600 bg-yellow-50',
                },
                {
                  label: 'Total Patients',
                  value: stats.totalPatients,
                  icon: Users,
                  color: 'text-purple-600 bg-purple-50',
                },
                {
                  label: 'Reports Uploaded',
                  value: stats.reportsUploaded,
                  icon: FileText,
                  color: 'text-teal-600 bg-teal-50',
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent appointments */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Recent Appointments</h2>
              <Link
                to="/admin/appointments"
                className="text-sm text-teal-600 font-medium hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                    <th className="text-left px-6 py-3 font-semibold">Patient</th>
                    <th className="text-left px-6 py-3 font-semibold hidden sm:table-cell">
                      Package
                    </th>
                    <th className="text-left px-6 py-3 font-semibold hidden md:table-cell">Date</th>
                    <th className="text-left px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recent.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">{appt.patientName}</td>
                      <td className="px-6 py-3 text-slate-600 hidden sm:table-cell">
                        {appt.packageName}
                      </td>
                      <td className="px-6 py-3 text-slate-600 hidden md:table-cell">
                        {format(new Date(appt.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={appt.status} />
                      </td>
                      <td className="px-6 py-3">
                        <Link
                          to="/admin/appointments"
                          className="text-teal-600 font-medium hover:underline text-xs"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
