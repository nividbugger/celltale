import React, { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
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
  Plus,
  Truck,
  PackageCheck,
  Pencil,
  Receipt,
  Upload,
  XCircle,

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
import { getReportByAppointmentId, getClinicSettings } from '../../lib/firestore'
import { describePackages, describeCost } from '../../lib/appointmentDisplay'
import {
  confirmAppointment,
  generateSamples,
  cancelAppointment,
  setAppointmentStatus,
  deleteAppointmentApi,
  updateAppointmentApi,
  getAppointmentSamples,
  collectSample,
  type SampleRecord,
} from '../../lib/api'
import { buildReportHtml } from '../../lib/reportHtml'
import { SamplePrintModal } from '../../components/admin/SamplePrintModal'
import { DEFAULT_CLINIC_SETTINGS, TIME_SLOTS } from '../../types'
import type { Appointment, AppointmentStatus, ClinicSettings, Report } from '../../types'
import { format } from 'date-fns'

const ACTIVE_STATUSES: AppointmentStatus[] = [
  'Created',
  'Confirmed',
  'SamplesGenerating',
  'SamplesGenerated',
  'SamplesCollected',
  'InLaboratory',
  'ReportGenerated',
  'ReportUploaded',
  'Cancelled',
]

// ─── Collect Samples modal ────────────────────────────────────────────────────

function CollectSamplesModal({
  isOpen,
  onClose,
  appointmentId,
  onCollected,
}: {
  isOpen: boolean
  onClose: () => void
  appointmentId: string
  onCollected: () => void
}) {
  const [samples, setSamples] = useState<SampleRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [collector, setCollector] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function refetch() {
    setLoading(true)
    try {
      setSamples(await getAppointmentSamples(appointmentId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, appointmentId])

  async function handleCollect(sampleId: string) {
    if (!collector.trim()) {
      setError('Enter the collector\'s name first')
      return
    }
    setError('')
    setBusyId(sampleId)
    try {
      await collectSample(sampleId, collector.trim())
      await refetch()
      onCollected()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark sample collected')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Samples">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Collector Name</label>
          <input
            type="text"
            value={collector}
            onChange={(e) => setCollector(e.target.value)}
            placeholder="Phlebotomist name"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        {loading ? (
          <LoadingSpinner className="py-8" />
        ) : (
          <div className="space-y-2">
            {samples.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-900 capitalize">{s.sampleType} sample</p>
                  <p className="text-xs font-mono text-slate-400">{s.barcodeId}</p>
                </div>
                {s.collectionStatus === 'collected' ? (
                  <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Collected
                  </span>
                ) : s.collectionStatus === 'rejected' ? (
                  <span className="text-xs font-semibold text-red-500">Rejected</span>
                ) : (
                  <Button size="sm" loading={busyId === s.id} onClick={() => handleCollect(s.id)}>
                    Mark Collected
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  )
}

// ─── Icon button helpers ──────────────────────────────────────────────────────

function IconBtn({
  label, onClick, loading, disabled, danger, teal, children,
}: {
  label: string
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  danger?: boolean
  teal?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
          danger
            ? 'border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50'
            : teal
            ? 'border-teal-200 text-teal-600 hover:text-teal-800 hover:bg-teal-50'
            : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </div>
  )
}

function IconLink({
  label, to, danger, teal, green, children,
}: {
  label: string
  to: string
  danger?: boolean
  teal?: boolean
  green?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative group">
      <Link
        to={to}
        className={`p-1.5 rounded-lg border transition-colors inline-flex items-center ${
          danger
            ? 'border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50'
            : teal
            ? 'border-teal-200 text-teal-600 hover:text-teal-800 hover:bg-teal-50'
            : green
            ? 'border-green-200 text-green-600 hover:text-green-800 hover:bg-green-50'
            : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        {children}
      </Link>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </div>
  )
}

// ─── Appointment row ──────────────────────────────────────────────────────────

function AppointmentRow({
  appt,
  clinic,
  onUpdate,
  initialExpanded,
}: {
  appt: Appointment
  clinic: ClinicSettings
  onUpdate: () => void
  initialExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(initialExpanded ?? false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialExpanded && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [initialExpanded])
  const [advancing, setAdvancing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editDate, setEditDate] = useState(appt.date)
  const [editTimeSlot, setEditTimeSlot] = useState(appt.timeSlot)
  const [editAddress, setEditAddress] = useState(appt.collectionAddress)
  const [editNotes, setEditNotes] = useState(appt.notes ?? '')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const packageLabel = describePackages(appt)
  const cost = describeCost(appt)

  async function withAction(fn: () => Promise<void>) {
    setActionError('')
    setAdvancing(true)
    try {
      await fn()
      onUpdate()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    await deleteAppointmentApi(appt.id)
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
        packageName: packageLabel,
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

  // Primary quick-action per status — mirrors the server-enforced state machine, never sets a
  // status the backend wouldn't itself accept as the next legal hop.
  function renderPrimaryAction() {
    switch (appt.status) {
      case 'Created':
        if (appt.packages.length === 0 && appt.manualTestIds.length === 0) {
          return <IconLink label="Select Tests" to={`/admin/appointments/new/${appt.id}`} teal><Plus className="h-4 w-4" /></IconLink>
        }
        return <IconBtn label="Confirm & Generate Samples" teal loading={advancing} onClick={() => withAction(async () => { await confirmAppointment(appt.id); await generateSamples(appt.id) })}><CheckCircle className="h-4 w-4" /></IconBtn>
      case 'Confirmed':
      case 'SamplesGenerating':
        return <IconBtn label="Generate Samples" teal loading={advancing} onClick={() => withAction(async () => { await generateSamples(appt.id) })}><FlaskConical className="h-4 w-4" /></IconBtn>
      case 'SamplesGenerated':
        return <IconBtn label="Collect Samples" teal onClick={() => setCollectOpen(true)}><PackageCheck className="h-4 w-4" /></IconBtn>
      case 'SamplesCollected':
        return <IconBtn label="Send to Lab" teal loading={advancing} onClick={() => withAction(async () => { await setAppointmentStatus(appt.id, 'InLaboratory') })}><Truck className="h-4 w-4" /></IconBtn>
      case 'ReportUploaded':
        return <IconBtn label="Mark Complete" teal loading={advancing} onClick={() => withAction(async () => { await setAppointmentStatus(appt.id, 'Completed') })}><CheckCircle className="h-4 w-4" /></IconBtn>
      default:
        return null
    }
  }

  const canEdit =
    appt.status === 'Created' ||
    appt.status === 'Confirmed' ||
    appt.status === 'SamplesGenerating' ||
    appt.status === 'SamplesGenerated'

  async function handleEditSave() {
    if (!editDate || !editTimeSlot || editAddress.trim().length < 5) {
      setEditError('Date, time slot, and address (min 5 chars) are required')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      await updateAppointmentApi(appt.id, {
        date: editDate,
        timeSlot: editTimeSlot,
        collectionAddress: editAddress.trim(),
        notes: editNotes.trim() || undefined,
      })
      setEditOpen(false)
      onUpdate()
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setEditSaving(false)
    }
  }

  const canCancel = appt.status === 'Created' || appt.status === 'Confirmed' || appt.status === 'SamplesGenerated'
  const canGenerateReport =
    appt.status === 'SamplesCollected' || appt.status === 'InLaboratory' || appt.status === 'ReportGenerated'
  const canViewReport = appt.status === 'ReportUploaded' || appt.status === 'Completed'

  return (
    <>
      <div ref={rowRef}>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">{appt.patientName}</h3>
                <StatusBadge status={appt.status} />
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                {packageLabel} · {format(new Date(appt.date), 'dd MMM yyyy')} · {appt.timeSlot}
              </p>
              <p className="text-slate-400 text-xs">{appt.patientPhone}</p>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {/* Workflow progression */}
              {renderPrimaryAction()}

              {/* Barcodes */}
              {appt.status !== 'Created' && appt.status !== 'Deleted' && (
                <IconBtn label="Barcodes" onClick={() => setPrintOpen(true)}><Barcode className="h-4 w-4" /></IconBtn>
              )}

              {/* Report actions */}
              {canGenerateReport && (
                <>
                  <IconLink label="Upload Report" to={`/admin/upload-report/${appt.id}`}><Upload className="h-4 w-4" /></IconLink>
                  <IconLink label="Generate Report" to={`/admin/generate-report/${appt.id}`}><ClipboardCheck className="h-4 w-4" /></IconLink>
                </>
              )}
              {canViewReport && (
                <IconBtn label="View Report" onClick={handleViewReport}><Eye className="h-4 w-4" /></IconBtn>
              )}

              {/* Invoice */}
              {appt.status !== 'Created' && appt.status !== 'Cancelled' && appt.status !== 'Deleted' && (
                appt.invoiceId
                  ? <IconLink label="View Invoice" to={`/admin/invoices/${appt.invoiceId}`} green><Eye className="h-3.5 w-3.5" /><Receipt className="h-3.5 w-3.5" /></IconLink>
                  : <IconLink label="Create Invoice" to={`/admin/invoices/new?appointmentId=${appt.id}`} teal><Plus className="h-3.5 w-3.5" /><Receipt className="h-3.5 w-3.5" /></IconLink>
              )}

              {/* Edit Tests */}
              {(appt.status === 'Confirmed' || appt.status === 'SamplesGenerating' || appt.status === 'SamplesGenerated') && (
                <IconLink label="Edit Tests" to={`/admin/appointments/new/${appt.id}`}><FlaskConical className="h-4 w-4" /></IconLink>
              )}

              {/* Edit appointment */}
              {canEdit && (
                <IconBtn label="Edit" onClick={() => {
                  setEditDate(appt.date)
                  setEditTimeSlot(appt.timeSlot)
                  setEditAddress(appt.collectionAddress)
                  setEditNotes(appt.notes ?? '')
                  setEditError('')
                  setEditOpen(true)
                }}><Pencil className="h-4 w-4" /></IconBtn>
              )}

              {/* Cancel */}
              {canCancel && (
                <IconBtn label="Cancel" danger onClick={() => withAction(async () => { await cancelAppointment(appt.id) })}><XCircle className="h-4 w-4" /></IconBtn>
              )}

              {/* Delete */}
              {appt.status !== 'Deleted' && (
                <IconBtn label="Delete" danger onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="h-4 w-4" /></IconBtn>
              )}

              {/* Expand */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors ml-1"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {actionError && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{actionError}</p>
          )}

          {expanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Cost</p>
                <p className="font-medium">₹{cost}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Booked On</p>
                <p className="font-medium">
                  {appt.createdAt?.toDate ? format(appt.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400">Collection Address</p>
                <p className="font-medium">{appt.collectionAddress}</p>
              </div>
              {appt.resolvedTests.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">Tests ({appt.resolvedTests.length})</p>
                  <p className="font-medium">{appt.resolvedTests.map((t) => t.name).join(', ')}</p>
                </div>
              )}
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
      </div>

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Appointment">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete the appointment for <span className="font-semibold">{appt.patientName}</span> ({packageLabel})?
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

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Appointment">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Date</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Time Slot</label>
            <select
              value={editTimeSlot}
              onChange={(e) => setEditTimeSlot(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Collection Address</label>
            <textarea
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Notes (optional)</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes…"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
          {editError && <p className="text-red-500 text-xs">{editError}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" loading={editSaving} onClick={handleEditSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <SamplePrintModal isOpen={printOpen} onClose={() => setPrintOpen(false)} appointmentId={appt.id} />

      <CollectSamplesModal
        isOpen={collectOpen}
        onClose={() => setCollectOpen(false)}
        appointmentId={appt.id}
        onCollected={onUpdate}
      />

      <Modal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} title="Report" size="xl">
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
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight') ?? undefined

  useEffect(() => {
    getClinicSettings().then(setClinic)
  }, [])

  useEffect(() => {
    if (!highlightId || appointments.length === 0) return
    const appt = appointments.find((a) => a.id === highlightId)
    if (!appt) return
    if (appt.status === 'Completed') setMainTab('completed')
    else if (appt.status === 'Deleted') setMainTab('deleted')
    else { setMainTab('active'); setSubFilter('All') }
  }, [highlightId, appointments])

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
            { to: '/admin/parameters', label: 'Parameters' },
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
          <div className="flex gap-2">
            <Link to="/admin/appointments/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New Walk-In
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
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
              <AppointmentRow key={appt.id} appt={appt} clinic={clinic} onUpdate={refetch} initialExpanded={appt.id === highlightId} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
