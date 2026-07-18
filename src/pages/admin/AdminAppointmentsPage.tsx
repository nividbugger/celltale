import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle,
  FlaskConical,
  ClipboardCheck,
  Trash2,
  Barcode,
  Eye,
  Printer,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { useAllAppointments } from '../../hooks/useAppointments'
import {
  updateAppointmentStatus,
  softDeleteAppointment,
  getReportByAppointmentId,
  getClinicSettings,
} from '../../lib/firestore'
import { buildReportHtml } from '../../lib/reportHtml'
import { BarcodePrintModal } from '../../components/admin/BarcodePrintModal'
import { DEFAULT_CLINIC_SETTINGS } from '../../types'
import type { Appointment, AppointmentStatus, ClinicSettings, Report } from '../../types'
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

function AppointmentRow({
  appt,
  clinic,
  onUpdate,
}: {
  appt: Appointment
  clinic: ClinicSettings
  onUpdate: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [newStatus, setNewStatus] = useState<AppointmentStatus>(appt.status)
  const [notes, setNotes] = useState(appt.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

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

  async function handleDelete() {
    setDeleting(true)
    await softDeleteAppointment(appt.id)
    onUpdate()
    setDeleting(false)
    setDeleteConfirmOpen(false)
  }

  async function handleViewReport() {
    setReportModalOpen(true)
    if (!report) {
      setReportLoading(true)
      const found = await getReportByAppointmentId(appt.id)
      setReport(found)
      setReportLoading(false)
    }
  }

  function handlePrintReport() {
    if (!report) return
    if (report.pdfUrl) {
      window.open(report.pdfUrl, '_blank')
      return
    }
    const html = buildReportHtml(
      {
        patientName: appt.patientName,
        packageName: appt.packageName,
        date: format(new Date(appt.date), 'dd MMM yyyy'),
        testValues: report.testValues,
        summary: report.summary,
      },
      clinic,
      { autoPrint: true },
    )
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
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
                <>
                  <Link to={`/admin/upload-report/${appt.id}`}>
                    <Button size="sm" variant="outline">
                      <UploadCloud className="h-3.5 w-3.5 mr-1" /> Upload Report
                    </Button>
                  </Link>
                  <Link to={`/admin/generate-report/${appt.id}`}>
                    <Button size="sm" variant="outline">
                      <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Generate Report
                    </Button>
                  </Link>
                </>
              )}

              {/* View report button */}
              {(appt.status === 'Report Ready' || appt.status === 'Completed') && (
                <Button size="sm" onClick={handleViewReport}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> View Report
                </Button>
              )}

              {appt.status !== 'Deleted' && (
                <Button size="sm" variant="outline" onClick={() => setBarcodeModalOpen(true)}>
                  <Barcode className="h-3.5 w-3.5 mr-1" /> Barcode
                </Button>
              )}

              {appt.status !== 'Deleted' && (
                <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)}>
                  Edit
                </Button>
              )}

              {appt.status !== 'Deleted' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}

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

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Appointment">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete the appointment for <span className="font-semibold">{appt.patientName}</span> ({appt.packageName})?
          </p>
          <p className="text-xs text-slate-400">
            This is a soft delete — the appointment will move to the Deleted tab and can still be viewed.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" loading={deleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <BarcodePrintModal
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        appointment={appt}
      />

      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Report"
        size="xl"
      >
        {reportLoading ? (
          <LoadingSpinner className="py-12" />
        ) : !report ? (
          <p className="text-slate-500 text-sm">No report found for this appointment.</p>
        ) : (
          <div className="space-y-4">
            {report.pdfUrl ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-6 text-center">
                <p className="text-sm text-slate-600 mb-3">This report was uploaded as a PDF.</p>
                <Button onClick={handlePrintReport}>
                  <Printer className="h-4 w-4 mr-1" /> Open / Print PDF
                </Button>
              </div>
            ) : (
              <>
                {report.summary && (
                  <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3 text-sm text-teal-800">
                    <strong>Summary:</strong> {report.summary}
                  </div>
                )}
                {report.testValues.some((t) => t.isAbnormal) && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {report.testValues.filter((t) => t.isAbnormal).length} value(s) are outside the
                    normal range.
                  </div>
                )}
                <div className="space-y-5">
                  {Object.entries(
                    report.testValues.reduce<Record<string, typeof report.testValues>>((acc, v) => {
                      if (!acc[v.category]) acc[v.category] = []
                      acc[v.category].push(v)
                      return acc
                    }, {}),
                  ).map(([category, values]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        <div className="grid grid-cols-4 gap-2 px-3 py-1 text-xs text-slate-400 font-semibold uppercase">
                          <span>Test</span>
                          <span>Result</span>
                          <span className="col-span-2">Normal Range</span>
                        </div>
                        {values.map((tv, i) => (
                          <div
                            key={i}
                            className={`grid grid-cols-4 gap-2 py-2.5 px-3 rounded-xl text-sm ${
                              tv.isAbnormal ? 'bg-red-50 text-red-800' : 'text-slate-700'
                            }`}
                          >
                            <span className="font-medium truncate">{tv.name}</span>
                            <span className="font-semibold">
                              {tv.value} {tv.unit}
                            </span>
                            <span className="text-slate-500 col-span-2">{tv.normalRange}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Button onClick={handlePrintReport}>
                    <Printer className="h-4 w-4 mr-1" /> Print Report
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

type MainTab = 'active' | 'completed' | 'deleted'

export default function AdminAppointmentsPage() {
  const { logOut } = useAuth()
  const { appointments, loading, refetch } = useAllAppointments()
  const [mainTab, setMainTab] = useState<MainTab>('active')
  const [subFilter, setSubFilter] = useState<AppointmentStatus | 'All'>('All')
  const [clinic, setClinic] = useState<ClinicSettings>(DEFAULT_CLINIC_SETTINGS)

  useEffect(() => {
    getClinicSettings().then(setClinic)
  }, [])

  const activeAppointments = appointments.filter((a) => a.status !== 'Completed' && a.status !== 'Deleted')
  const completedAppointments = appointments.filter((a) => a.status === 'Completed')
  const deletedAppointments = appointments.filter((a) => a.status === 'Deleted')

  const displayed =
    mainTab === 'completed'
      ? completedAppointments
      : mainTab === 'deleted'
      ? deletedAppointments
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
            { to: '/admin/invoices', label: 'Invoices' },
            { to: '/admin/tests', label: 'Tests' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                l.to === '/admin/appointments'
                  ? 'bg-teal-100 text-teal-700 border border-teal-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600'
              }`}
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
          <button
            onClick={() => setMainTab('deleted')}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mainTab === 'deleted'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Deleted
            <span className="ml-2 text-xs font-bold text-slate-400">
              {deletedAppointments.length}
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
                {mainTab === 'completed'
                  ? 'No completed cases yet.'
                  : mainTab === 'deleted'
                  ? 'No deleted appointments.'
                  : 'No appointments found.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayed.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} clinic={clinic} onUpdate={refetch} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
