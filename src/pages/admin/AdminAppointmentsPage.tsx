import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UploadCloud, ChevronDown, ChevronUp, RefreshCw, CheckCircle, FlaskConical, ClipboardCheck } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { useAllAppointments } from '../../hooks/useAppointments'
import { updateAppointmentStatus } from '../../lib/firestore'
import type { Appointment, AppointmentStatus } from '../../types'
import { format } from 'date-fns'

const ACTIVE_STATUSES: AppointmentStatus[] = [
  'Pending',
  'Confirmed',
  'Sample Collected',
  'Report Ready',
  'Cancelled',
]

const NEXT_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  Pending: 'Confirmed',
  Confirmed: 'Sample Collected',
  'Sample Collected': 'Report Ready',
  'Report Ready': 'Completed',
}

const NEXT_STATUS_LABEL: Partial<Record<AppointmentStatus, string>> = {
  Pending: 'Confirm',
  Confirmed: 'Mark Collected',
  'Sample Collected': 'Mark Report Ready',
  'Report Ready': 'Mark Complete',
}

const NEXT_STATUS_ICON: Partial<Record<AppointmentStatus, typeof CheckCircle>> = {
  Pending: CheckCircle,
  Confirmed: FlaskConical,
  'Sample Collected': UploadCloud,
  'Report Ready': ClipboardCheck,
}

function AppointmentRow({ appt, onUpdate }: { appt: Appointment; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [newStatus, setNewStatus] = useState<AppointmentStatus>(appt.status)
  const [notes, setNotes] = useState(appt.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const nextStatus = NEXT_STATUS[appt.status]
  const nextLabel = NEXT_STATUS_LABEL[appt.status]
  const NextIcon = NEXT_STATUS_ICON[appt.status]

  async function handleAdvance() {
    if (!nextStatus) return
    setAdvancing(true)
    await updateAppointmentStatus(appt.id, nextStatus)
    onUpdate()
    setAdvancing(false)
  }

  async function handleSave() {
    setSaving(true)
    await updateAppointmentStatus(appt.id, newStatus, notes || undefined)
    onUpdate()
    setSaving(false)
    setModalOpen(false)
  }

  return (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">{appt.patientName}</h3>
                <StatusBadge status={appt.status} />
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                {appt.packageName} · {format(new Date(appt.date), 'dd MMM yyyy')} · {appt.timeSlot}
              </p>
              <p className="text-slate-400 text-xs">{appt.patientPhone}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {/* Quick advance button */}
              {nextStatus && nextLabel && NextIcon && appt.status !== 'Sample Collected' && (
                <Button size="sm" loading={advancing} onClick={handleAdvance}>
                  <NextIcon className="h-3.5 w-3.5 mr-1" />
                  {nextLabel}
                </Button>
              )}

              {/* Upload report button */}
              {(appt.status === 'Confirmed' || appt.status === 'Sample Collected') && (
                <Link to={`/admin/upload-report/${appt.id}`}>
                  <Button size="sm" variant="outline">
                    <UploadCloud className="h-3.5 w-3.5 mr-1" /> Upload Report
                  </Button>
                </Link>
              )}

              <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)}>
                Edit
              </Button>

              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Price</p>
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
              <div className="col-span-2">
                <p className="text-xs text-slate-400">Collection Address</p>
                <p className="font-medium">{appt.collectionAddress}</p>
              </div>
              {appt.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">Notes</p>
                  <p className="font-medium">{appt.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Edit Appointment">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as AppointmentStatus)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {(['Pending', 'Confirmed', 'Sample Collected', 'Report Ready', 'Completed', 'Cancelled'] as AppointmentStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Internal Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes visible only to admin..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

type MainTab = 'active' | 'completed'

export default function AdminAppointmentsPage() {
  const { logOut } = useAuth()
  const { appointments, loading, refetch } = useAllAppointments()
  const [mainTab, setMainTab] = useState<MainTab>('active')
  const [subFilter, setSubFilter] = useState<AppointmentStatus | 'All'>('All')

  const activeAppointments = appointments.filter((a) => a.status !== 'Completed')
  const completedAppointments = appointments.filter((a) => a.status === 'Completed')

  const displayed =
    mainTab === 'completed'
      ? completedAppointments
      : subFilter === 'All'
      ? activeAppointments
      : activeAppointments.filter((a) => a.status === subFilter)

  async function handleLogout() {
    await logOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo />
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Logout
          </button>
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

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">Appointments</h1>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-5 w-fit">
          <button
            onClick={() => setMainTab('active')}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mainTab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Active Cases
            <span className="ml-2 text-xs font-bold text-teal-600">
              {activeAppointments.length}
            </span>
          </button>
          <button
            onClick={() => setMainTab('completed')}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mainTab === 'completed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Completed
            <span className="ml-2 text-xs font-bold text-green-600">
              {completedAppointments.length}
            </span>
          </button>
        </div>

        {/* Sub-filters for active tab */}
        {mainTab === 'active' && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
            {(['All', ...ACTIVE_STATUSES] as (AppointmentStatus | 'All')[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSubFilter(tab)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  subFilter === tab
                    ? 'gradient-bg text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {tab}
                {tab !== 'All' && (
                  <span className="ml-1.5 opacity-70">
                    ({activeAppointments.filter((a) => a.status === tab).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : displayed.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-slate-500 font-medium">
                {mainTab === 'completed' ? 'No completed cases yet.' : 'No appointments found.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayed.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} onUpdate={refetch} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
