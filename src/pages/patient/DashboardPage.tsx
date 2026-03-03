import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, FileText, Clock, ChevronRight, Plus } from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Card, CardContent } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { StatusProgress } from '../../components/ui/StatusProgress'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { getAppointmentsByPatient } from '../../lib/firestore'
import type { Appointment } from '../../types'
import { format } from 'date-fns'

export default function DashboardPage() {
  const { userProfile } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userProfile?.uid) return
    getAppointmentsByPatient(userProfile.uid)
      .then(setAppointments)
      .finally(() => setLoading(false))
  }, [userProfile?.uid])

  const pending = appointments.filter((a) => a.status === 'Pending').length
  const reportReady = appointments.filter((a) => a.status === 'Report Ready').length
  const recent = appointments.slice(0, 3)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <div className="bg-gradient-to-r from-teal-500 to-purple-600 rounded-3xl p-6 text-white">
          <h1 className="text-2xl font-extrabold mb-1">
            Hello, {userProfile?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-white/80 text-sm">Here's your health summary at a glance.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Total Appointments',
              value: appointments.length,
              icon: Calendar,
              color: 'text-blue-500 bg-blue-50',
            },
            { label: 'Pending', value: pending, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
            {
              label: 'Reports Ready',
              value: reportReady,
              icon: FileText,
              color: 'text-teal-600 bg-teal-50',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">{label}</p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-1">{value}</p>
                  </div>
                  <div className={`p-3 rounded-2xl ${color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent appointments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Appointments</h2>
            <Link
              to="/dashboard/appointments"
              className="text-sm text-teal-600 font-medium hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <LoadingSpinner className="py-10" />
          ) : recent.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No appointments yet</p>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  Book your first diagnostic test today.
                </p>
                <Link to="/dashboard/book">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Book a Test
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recent.map((appt) => (
                <Card key={appt.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">
                          {appt.packageName}
                        </p>
                        <p className="text-slate-500 text-sm">
                          {format(new Date(appt.date), 'dd MMM yyyy')} · {appt.timeSlot}
                        </p>
                        <StatusProgress status={appt.status} />
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Link to="/dashboard/book">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="h-5 w-5 mr-2" /> Book New Test
          </Button>
        </Link>
      </div>
    </DashboardLayout>
  )
}
