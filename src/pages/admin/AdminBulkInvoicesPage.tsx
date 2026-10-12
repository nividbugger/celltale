import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  FileText,
  CheckSquare,
  Square,
  Printer,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronDown,
  Receipt,
  Pencil,
} from 'lucide-react'
import { format } from 'date-fns'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ClinicSettingsModal } from '../../components/admin/ClinicSettingsModal'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAllPatients,
  getAppointmentsByPatientIds,
  getAllBulkInvoices,
  markBulkInvoicePaid,
  getClinicSettings,
} from '../../lib/firestore'
import { createBulkInvoice, deleteBulkInvoiceApi, markBulkInvoicePaidApi } from '../../lib/api'
import type { BulkInvoiceLineItemInput } from '../../lib/api'
import { buildInvoiceHtml } from '../../lib/invoiceHtml'
import { DEFAULT_CLINIC_SETTINGS } from '../../types'
import type { Appointment, BulkInvoice, ClinicSettings, User } from '../../types'

const BILLABLE_STATUSES = new Set([
  'Confirmed',
  'SamplesGenerating',
  'SamplesGenerated',
  'SamplesCollected',
  'InLaboratory',
  'ReportGenerated',
  'ReportUploaded',
  'Completed',
])

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/patients', label: 'Patients' },
  { to: '/admin/packages', label: 'Packages' },
  { to: '/admin/invoices', label: 'Invoices' },
  { to: '/admin/bulk-invoices', label: 'Bulk Invoices' },
  { to: '/admin/tests', label: 'Tests' },
  { to: '/admin/parameters', label: 'Parameters' },
]

interface InvoicePreview {
  instituteName: string
  date: string
  lineItems: BulkInvoiceLineItemInput[]
  appointmentIds: string[]
}

function computeLineItems(appointments: Appointment[]): BulkInvoiceLineItemInput[] {
  const groups = new Map<string, { packageId: string; packageName: string; pricePerPatient: number; patientCount: number }>()
  let adHocCount = 0
  let adHocTotal = 0

  for (const appt of appointments) {
    if (appt.packages.length === 0) {
      adHocCount++
      adHocTotal += appt.totalCost
    } else {
      for (const pkg of appt.packages) {
        const existing = groups.get(pkg.packageId)
        if (existing) {
          existing.patientCount++
        } else {
          groups.set(pkg.packageId, {
            packageId: pkg.packageId,
            packageName: pkg.packageName,
            pricePerPatient: pkg.priceAtBooking,
            patientCount: 1,
          })
        }
      }
    }
  }

  const items: BulkInvoiceLineItemInput[] = Array.from(groups.values()).map((g) => ({
    packageId: g.packageId,
    packageName: g.packageName,
    patientCount: g.patientCount,
    pricePerPatient: g.pricePerPatient,
    totalAmount: g.patientCount * g.pricePerPatient,
  }))

  if (adHocCount > 0) {
    items.push({
      packageId: '__adhoc__',
      packageName: 'Lab Tests (Ad-hoc)',
      patientCount: adHocCount,
      pricePerPatient: Math.round(adHocTotal / adHocCount),
      totalAmount: adHocTotal,
    })
  }

  return items
}

function bulkInvoiceToInvoiceDraft(bulk: BulkInvoice) {
  return {
    id: bulk.id,
    invoiceNumber: bulk.invoiceNumber,
    date: bulk.date,
    billToName: bulk.instituteName,
    billToContact: undefined,
    lineItems: bulk.lineItems.map((li) => ({
      itemName: li.packageName,
      hsnSac: undefined,
      quantity: li.patientCount,
      pricePerUnit: li.pricePerPatient,
      discountPercent: 0,
    })),
    receivedAmount: bulk.isPaid ? bulk.totalAmount : 0,
  }
}

export default function AdminBulkInvoicesPage() {
  const { logOut } = useAuth()
  const navigate = useNavigate()

  const [patients, setPatients] = useState<User[]>([])
  const [selectedInstitute, setSelectedInstitute] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [bulkInvoices, setBulkInvoices] = useState<BulkInvoice[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [clinic, setClinic] = useState<ClinicSettings>(DEFAULT_CLINIC_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [loadingPatients, setLoadingPatients] = useState(true)
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<BulkInvoice | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Preview modal state
  const [preview, setPreview] = useState<InvoicePreview | null>(null)

  const institutes = useMemo(
    () => [...new Set(patients.map((p) => p.company).filter(Boolean))].sort() as string[],
    [patients],
  )

  const institutePatientIds = useMemo(() => {
    if (!selectedInstitute) return []
    return patients.filter((p) => p.company === selectedInstitute).map((p) => p.uid)
  }, [patients, selectedInstitute])

  const pendingAppointments = useMemo(
    () => appointments.filter((a) => BILLABLE_STATUSES.has(a.status) && !a.bulkInvoiceId),
    [appointments],
  )

  const instituteInvoices = useMemo(
    () => bulkInvoices.filter((inv) => inv.instituteName === selectedInstitute),
    [bulkInvoices, selectedInstitute],
  )

  const allSelected =
    pendingAppointments.length > 0 && selectedIds.size === pendingAppointments.length

  const previewTotal = useMemo(
    () => (preview?.lineItems ?? []).reduce((s, li) => s + li.patientCount * li.pricePerPatient, 0),
    [preview],
  )

  useEffect(() => {
    async function load() {
      setLoadingPatients(true)
      const [pts, settings] = await Promise.all([getAllPatients(), getClinicSettings()])
      setPatients(pts)
      setClinic(settings)
      setLoadingPatients(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedInstitute) {
      setAppointments([])
      setSelectedIds(new Set())
      setBulkInvoices([])
      return
    }
    async function loadInstituteData() {
      setLoadingAppointments(true)
      setSelectedIds(new Set())
      const [appts, invs] = await Promise.all([
        getAppointmentsByPatientIds(institutePatientIds),
        getAllBulkInvoices(),
      ])
      setAppointments(appts)
      setBulkInvoices(invs)
      setLoadingAppointments(false)
    }
    loadInstituteData()
  }, [selectedInstitute, institutePatientIds])

  async function handleLogout() {
    await logOut()
    navigate('/')
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingAppointments.map((a) => a.id)))
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Open preview modal — computes line items client-side for review/editing
  function handleOpenPreview() {
    if (!selectedInstitute || selectedIds.size === 0) return
    const selected = pendingAppointments.filter((a) => selectedIds.has(a.id))
    setPreview({
      instituteName: selectedInstitute,
      date: new Date().toISOString().slice(0, 10),
      lineItems: computeLineItems(selected),
      appointmentIds: selected.map((a) => a.id),
    })
  }

  function updatePreviewField(field: 'instituteName' | 'date', value: string) {
    setPreview((p) => p ? { ...p, [field]: value } : p)
  }

  function updateLineItemPrice(index: number, rawValue: string) {
    const price = parseFloat(rawValue)
    setPreview((p) => {
      if (!p) return p
      const lineItems = p.lineItems.map((li, i) =>
        i === index
          ? { ...li, pricePerPatient: isNaN(price) ? 0 : price, totalAmount: li.patientCount * (isNaN(price) ? 0 : price) }
          : li,
      )
      return { ...p, lineItems }
    })
  }

  function updateLineItemName(index: number, value: string) {
    setPreview((p) => {
      if (!p) return p
      const lineItems = p.lineItems.map((li, i) => (i === index ? { ...li, packageName: value } : li))
      return { ...p, lineItems }
    })
  }

  async function handleConfirmGenerate() {
    if (!preview) return
    setGenerating(true)
    try {
      await createBulkInvoice({
        instituteName: preview.instituteName,
        date: preview.date,
        appointmentIds: preview.appointmentIds,
        lineItems: preview.lineItems,
      })
      setPreview(null)
      const [appts, invs] = await Promise.all([
        getAppointmentsByPatientIds(institutePatientIds),
        getAllBulkInvoices(),
      ])
      setAppointments(appts)
      setBulkInvoices(invs)
      setSelectedIds(new Set())
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate invoice')
    } finally {
      setGenerating(false)
    }
  }

  async function handleMarkPaid(invoice: BulkInvoice) {
    setMarkingPaid(invoice.id)
    try {
      await markBulkInvoicePaidApi(invoice.id)
      await markBulkInvoicePaid(invoice.id)
      setBulkInvoices((prev) =>
        prev.map((inv) => (inv.id === invoice.id ? { ...inv, isPaid: true } : inv)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark as paid')
    } finally {
      setMarkingPaid(null)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await deleteBulkInvoiceApi(deleteConfirm.id)
      const [appts, invs] = await Promise.all([
        getAppointmentsByPatientIds(institutePatientIds),
        getAllBulkInvoices(),
      ])
      setAppointments(appts)
      setBulkInvoices(invs)
      setDeleteConfirm(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete invoice')
    } finally {
      setDeleting(false)
    }
  }

  function handlePrint(invoice: BulkInvoice) {
    const draft = bulkInvoiceToInvoiceDraft(invoice)
    const html = buildInvoiceHtml(draft, clinic, { autoPrint: true })
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo />
          <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-700">
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Nav */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {ADMIN_NAV.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-2 bg-white border rounded-full text-sm font-medium transition-colors ${
                l.to === '/admin/bulk-invoices'
                  ? 'border-teal-400 text-teal-600'
                  : 'border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-teal-600" /> Bulk Invoices
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Generate consolidated invoices for institutes by package and patient count.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            Business Details
          </Button>
        </div>

        {/* Institute selector */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" /> Select Institute
            </label>
            {loadingPatients ? (
              <LoadingSpinner className="py-4" />
            ) : institutes.length === 0 ? (
              <p className="text-slate-400 text-sm">
                No institutes found. Add patients with a company name to get started.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={selectedInstitute}
                  onChange={(e) => setSelectedInstitute(e.target.value)}
                  className="w-full sm:w-80 appearance-none border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">— Choose an institute —</option>
                  {institutes.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            )}
          </CardContent>
        </Card>

        {selectedInstitute && (
          <>
            {/* Pending appointments */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800">
                  Pending Appointments
                  {pendingAppointments.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({pendingAppointments.length})
                    </span>
                  )}
                </h2>
                {pendingAppointments.length > 0 && (
                  <Button
                    size="sm"
                    disabled={selectedIds.size === 0}
                    onClick={handleOpenPreview}
                  >
                    <Receipt className="h-4 w-4 mr-1.5" />
                    Generate Invoice ({selectedIds.size})
                  </Button>
                )}
              </div>

              {loadingAppointments ? (
                <LoadingSpinner className="py-12" />
              ) : pendingAppointments.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 font-medium text-sm">No pending appointments</p>
                    <p className="text-slate-400 text-xs mt-1">
                      All appointments for {selectedInstitute} have been invoiced.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left w-10">
                          <button onClick={toggleAll} className="text-slate-400 hover:text-teal-600">
                            {allSelected ? (
                              <CheckSquare className="h-4 w-4 text-teal-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Patient</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Package(s)</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingAppointments.map((appt) => {
                        const checked = selectedIds.has(appt.id)
                        return (
                          <tr
                            key={appt.id}
                            onClick={() => toggleOne(appt.id)}
                            className={`cursor-pointer transition-colors ${
                              checked ? 'bg-teal-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-4 py-3">
                              {checked ? (
                                <CheckSquare className="h-4 w-4 text-teal-600" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-300" />
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">{appt.patientName}</td>
                            <td className="px-4 py-3 text-slate-500">
                              {format(new Date(appt.date), 'dd MMM yyyy')}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {appt.packages.length > 0
                                ? appt.packages.map((p) => p.packageName).join(', ')
                                : <span className="text-slate-400 italic">Ad-hoc tests</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              ₹{appt.totalCost.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {appt.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Generated bulk invoices */}
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-3">
                Generated Invoices
                {instituteInvoices.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({instituteInvoices.length})
                  </span>
                )}
              </h2>

              {instituteInvoices.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No invoices generated yet for {selectedInstitute}.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {instituteInvoices.map((invoice) => (
                    <Card key={invoice.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-slate-900">
                                Invoice #{invoice.invoiceNumber}
                              </p>
                              <span className="text-slate-400 text-xs">
                                {format(new Date(invoice.date), 'dd MMM yyyy')}
                              </span>
                              {invoice.isPaid ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                  <CheckCircle2 className="h-3 w-3" /> Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                  <Clock className="h-3 w-3" /> Unpaid
                                </span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              {invoice.lineItems.map((li, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className="font-medium">{li.packageName}</span>
                                  <span className="text-slate-400">×</span>
                                  <span>{li.patientCount} patient{li.patientCount !== 1 ? 's' : ''}</span>
                                  <span className="text-slate-400">@</span>
                                  <span>₹{li.pricePerPatient.toLocaleString('en-IN')}</span>
                                  <span className="text-slate-400">=</span>
                                  <span className="font-semibold text-slate-800">
                                    ₹{li.totalAmount.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {invoice.paidAt && (
                              <p className="text-xs text-slate-400 mt-1">
                                Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-slate-900 text-base">
                                ₹{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-slate-400">
                                {invoice.appointmentIds.length} appointment{invoice.appointmentIds.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handlePrint(invoice)}>
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {!invoice.isPaid && (
                              <Button
                                size="sm"
                                loading={markingPaid === invoice.id}
                                onClick={() => handleMarkPaid(invoice)}
                                className="bg-green-600 hover:bg-green-700 text-white border-0"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                              </Button>
                            )}
                            <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(invoice)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!selectedInstitute && !loadingPatients && institutes.length > 0 && (
          <div className="text-center py-20">
            <Building2 className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Select an institute to view pending appointments</p>
          </div>
        )}
      </div>

      <Footer />

      <ClinicSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        clinic={clinic}
        onSaved={setClinic}
      />

      {/* ── Invoice preview / edit modal ── */}
      <Modal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title="Review Invoice"
        size="lg"
      >
        {preview && (
          <div className="space-y-5">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Invoice To</label>
                <input
                  type="text"
                  value={preview.instituteName}
                  onChange={(e) => updatePreviewField('instituteName', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={preview.date}
                  onChange={(e) => updatePreviewField('date', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>

            {/* Line items */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Line Items — edit package name or rate if needed
              </p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Package</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Patients</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Rate (₹)</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.lineItems.map((li, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={li.packageName}
                            onChange={(e) => updateLineItemName(i, e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center font-medium text-slate-700">
                          {li.patientCount}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={li.pricePerPatient}
                            onChange={(e) => updateLineItemPrice(i, e.target.value)}
                            className="w-28 ml-auto block border border-slate-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          ₹{(li.patientCount * li.pricePerPatient).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-700 text-sm">
                        Grand Total
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                        ₹{previewTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {preview.appointmentIds.length} appointment{preview.appointmentIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPreview(null)}>
                Back
              </Button>
              <Button className="flex-1" loading={generating} onClick={handleConfirmGenerate}>
                <Receipt className="h-4 w-4 mr-1.5" /> Generate Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Bulk Invoice"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">
              Delete{' '}
              <span className="font-bold text-slate-900">Invoice #{deleteConfirm.invoiceNumber}</span>?
              This will restore the {deleteConfirm.appointmentIds.length} linked appointment
              {deleteConfirm.appointmentIds.length !== 1 ? 's' : ''} to pending status so they can be
              re-invoiced.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" loading={deleting} onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
