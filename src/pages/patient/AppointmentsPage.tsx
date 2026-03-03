import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Card, CardContent } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { StatusProgress } from '../../components/ui/StatusProgress'
import { useAuth } from '../../contexts/AuthContext'
import { usePatientAppointments } from '../../hooks/useAppointments'
import { updateAppointmentStatus } from '../../lib/firestore'
import type { Appointment, AppointmentStatus } from '../../types'
import { format } from 'date-fns'

const FILTER_TABS: (AppointmentStatus | 'All')[] = [
  'All',
  'Pending',
  'Confirmed',
  'Sample Collected',
  'Report Ready',
  'Completed',
  'Cancelled',
]

function AppointmentCard({
  appt,
  onCancel,
}: {
  appt: Appointment
  onCancel: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function handleCancel() {
    setCancelling(true)
    await updateAppointmentStatus(appt.id, 'Cancelled')
    onCancel(appt.id)
    setCancelling(false)
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900">{appt.packageName}</h3>
              <StatusBadge status={appt.status} />
            </div>
            <p className="text-slate-500 text-sm mt-1">
              {format(new Date(appt.date), 'dd MMM yyyy')} · {appt.timeSlot}
            </p>
            <StatusProgress status={appt.status} />
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-400">Package Price</p>
                <p className="font-medium">₹{appt.packagePrice}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Booked On</p>
                <p className="font-medium">
                  {appt.createdAt?.toDate
                    ? format(appt.createdAt.toDate(), 'dd MMM yyyy')
                    : '—'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Collection Address</p>
              <p className="font-medium">{appt.collectionAddress}</p>
            </div>
            {appt.notes && (
              <div>
                <p className="text-xs text-slate-400">Notes</p>
                <p className="font-medium">{appt.notes}</p>
              </div>
            )}
            {appt.status === 'Pending' && (
              <Button
                variant="danger"
                size="sm"
                loading={cancelling}
                onClick={handleCancel}
                className="mt-2"
              >
                Cancel Appointment
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AppointmentsPage() {
  const { userProfile } = useAuth()
  const { appointments, loading, error, setAppointments } = usePatientAppointments(userProfile?.uid)
  const [activeFilter, setActiveFilter] = useState<AppointmentStatus | 'All'>('All')

  const filtered =
    activeFilter === 'All'
      ? appointments
      : appointments.filter((a) => a.status === activeFilter)

  function handleCancel(id: string) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Cancelled' as AppointmentStatus } : a)),
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900">My Appointments</h1>
          <Link to="/dashboard/book">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === tab
                  ? 'gradient-bg text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No appointments found</p>
              {activeFilter === 'All' && (
                <>
                  <p className="text-slate-400 text-sm mt-1 mb-4">
                    Book your first test to see it here.
                  </p>
                  <Link to="/dashboard/book">
                    <Button size="sm">Book a Test</Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} onCancel={handleCancel} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
