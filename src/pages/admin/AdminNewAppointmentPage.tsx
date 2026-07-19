import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Search, UserPlus, ChevronRight, CheckCircle, Plus, PackageOpen,
  ClipboardList, Barcode as BarcodeIcon,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { TestPicker } from '../../components/admin/TestPicker'
import { PackagePicker } from '../../components/admin/PackagePicker'
import { SamplePrintModal } from '../../components/admin/SamplePrintModal'
import { useAuth } from '../../contexts/AuthContext'
import { getAllPatients, getAllTests } from '../../lib/firestore'
import { usePackages } from '../../hooks/usePackages'
import {
  registerPatient,
  createAppointmentApi,
  getAppointmentApi,
  addPackagesToAppointment,
  removePackageFromAppointment,
  addTestsToAppointment,
  removeTestFromAppointment,
  getAppointmentSummary,
  setAppointmentCostOverride,
  confirmAppointment,
  generateSamples,
  type AppointmentSummary,
} from '../../lib/api'
import { TIME_SLOTS } from '../../types'
import type { User } from '../../types'
import { format } from 'date-fns'

type Step = 'patient' | 'creating' | 'tests' | 'done' | 'resuming'

const DEFAULT_COLLECTION_ADDRESS = 'CellTale Collection Centre'

function timeSlotToMinutes(slot: string): number {
  const [time, meridiem] = slot.split(' ')
  const [hourStr, minStr] = time.split(':')
  let hours = parseInt(hourStr, 10)
  const minutes = parseInt(minStr, 10)
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

/** Walk-in patients are collected right now, at the desk — rather than making the admin pick
 * a date/time slot that's already true, default to today and whichever slot is closest to the
 * current wall-clock time (clamped to the slot list's range outside opening hours). */
function nearestTimeSlot(now: Date): string {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return TIME_SLOTS.reduce((closest, slot) =>
    Math.abs(timeSlotToMinutes(slot) - nowMinutes) < Math.abs(timeSlotToMinutes(closest) - nowMinutes)
      ? slot
      : closest,
  )
}

// ─── Step 1: Patient ──────────────────────────────────────────────────────────

function PatientStep({ onSelect }: { onSelect: (p: User) => void }) {
  const [patients, setPatients] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAllPatients().then(setPatients).finally(() => setLoading(false))
  }, [])

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      (p.email ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  async function handleRegister() {
    setError('')
    if (!name.trim()) return setError('Name is required')
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit Indian mobile number')
    setRegistering(true)
    try {
      const record = await registerPatient({ name: name.trim(), phone, email: email.trim() || undefined })
      onSelect({
        uid: record.uid,
        name: record.name,
        phone: record.phone,
        email: record.email,
        role: 'patient',
        createdAt: null as unknown as User['createdAt'],
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register patient')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-slate-900">Search Existing Patient</h2>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {loading ? (
        <LoadingSpinner className="py-8" />
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-4">No patients match your search.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.uid}
                onClick={() => onSelect(p)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.phone}{p.email ? ` · ${p.email}` : ''}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))
          )}
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        {!showRegister ? (
          <Button variant="outline" className="w-full" onClick={() => setShowRegister(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Register New Patient
          </Button>
        ) : (
          <div className="space-y-3 bg-slate-50 rounded-xl p-4">
            <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Kumar" />
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              helperText="10-digit Indian mobile number"
            />
            <Input
              label="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowRegister(false)}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" loading={registering} onClick={handleRegister}>
                Register &amp; Continue
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 2: Auto-create the appointment ─────────────────────────────────────
// Walk-in patients are standing at the desk being collected right now — a date/time-slot
// picker just re-asks something already true. Default to today, the nearest time slot to the
// current wall-clock time, and the collection centre's own address; all three stay editable
// later via PATCH /appointments/:id (pre-confirm) if a specific case genuinely needs it.

function CreatingStep({
  patient,
  onCreated,
  onError,
}: {
  patient: User
  onCreated: (appointmentId: string) => void
  onError: (message: string) => void
}) {
  useEffect(() => {
    const now = new Date()
    createAppointmentApi({
      patientId: patient.uid,
      date: format(now, 'yyyy-MM-dd'),
      timeSlot: nearestTimeSlot(now),
      collectionAddress: DEFAULT_COLLECTION_ADDRESS,
    })
      .then((appt) => onCreated(appt.id))
      .catch((err: unknown) => onError(err instanceof Error ? err.message : 'Failed to create appointment'))
    // Runs once per mount — re-triggering on prop identity changes would create duplicate drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <LoadingSpinner className="py-16" />
}

// ─── Step 3: Test Selection (Packages / Additional Tests / Summary) ─────────

function TestSelectionStep({
  appointmentId,
  onConfirmed,
}: {
  appointmentId: string
  onConfirmed: (sampleIds: string[]) => void
}) {
  const { packages } = usePackages()
  const [allTests, setAllTests] = useState<import('../../types').Test[]>([])
  const [summary, setSummary] = useState<AppointmentSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [costDraft, setCostDraft] = useState('')
  const [editingCost, setEditingCost] = useState(false)

  useEffect(() => {
    getAllTests().then(setAllTests)
  }, [])

  async function refetchSummary() {
    setSummary(await getAppointmentSummary(appointmentId))
  }

  useEffect(() => {
    refetchSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId])

  async function handlePackagesChange(newIds: string[]) {
    if (!summary) return
    const prev = summary.packages.map((p) => p.packageId)
    const added = newIds.filter((id) => !prev.includes(id))
    const removed = prev.filter((id) => !newIds.includes(id))
    setBusy(true)
    setError('')
    try {
      if (added.length > 0) await addPackagesToAppointment(appointmentId, added)
      for (const id of removed) await removePackageFromAppointment(appointmentId, id)
      await refetchSummary()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update packages')
    } finally {
      setBusy(false)
    }
  }

  async function handleTestsChange(newIds: string[]) {
    if (!summary) return
    const prev = summary.manualTestIds
    const added = newIds.filter((id) => !prev.includes(id))
    const removed = prev.filter((id) => !newIds.includes(id))
    setBusy(true)
    setError('')
    try {
      if (added.length > 0) await addTestsToAppointment(appointmentId, added)
      for (const id of removed) await removeTestFromAppointment(appointmentId, id)
      await refetchSummary()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update tests')
    } finally {
      setBusy(false)
    }
  }

  function startEditingCost() {
    if (!summary) return
    setCostDraft(String(summary.estimatedCost))
    setEditingCost(true)
  }

  async function handleSaveCost() {
    const trimmed = costDraft.trim()
    const amount = trimmed === '' ? null : Number(trimmed)
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      setError('Cost must be a non-negative number')
      return
    }
    setBusy(true)
    setError('')
    try {
      await setAppointmentCostOverride(appointmentId, amount)
      await refetchSummary()
      setEditingCost(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update cost')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await confirmAppointment(appointmentId)
      const { sampleIds } = await generateSamples(appointmentId)
      onConfirmed(sampleIds)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm appointment')
      setBusy(false)
    }
  }

  if (!summary) return <LoadingSpinner className="py-16" />

  return (
    <div className="space-y-6">
      {/* Section 1: Packages */}
      <Card>
        <CardContent className="py-5">
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-teal-600" /> Packages
          </h2>
          <PackagePicker
            selectedIds={summary.packages.map((p) => p.packageId)}
            allPackages={packages}
            onChange={handlePackagesChange}
            disabled={busy}
          />
        </CardContent>
      </Card>

      {/* Section 2: Additional Tests */}
      <Card>
        <CardContent className="py-5">
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-teal-600" /> Additional Tests
          </h2>
          <TestPicker selectedIds={summary.manualTestIds} allTests={allTests} onChange={handleTestsChange} disabled={busy} />
        </CardContent>
      </Card>

      {/* Section 3: Summary */}
      <Card>
        <CardContent className="py-5">
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-teal-600" /> Summary
          </h2>
          {summary.resolvedTests.length === 0 ? (
            <p className="text-sm text-slate-400">Add a package or test to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {summary.resolvedTests.map((t) => (
                <span key={t.testId} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
                  ✓ {t.name}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs text-slate-400">Total Tests</p>
              <p className="text-xl font-extrabold text-slate-900">{summary.totalTests}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Samples</p>
              <p className="text-xl font-extrabold text-slate-900">{summary.totalSamples}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                Estimated Cost
                {summary.costOverride !== null && (
                  <span className="text-teal-500 font-semibold" title={`Computed from tests: ₹${summary.computedCost}`}>
                    (overridden)
                  </span>
                )}
              </p>
              {editingCost ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-teal-600 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={costDraft}
                    onChange={(e) => setCostDraft(e.target.value)}
                    autoFocus
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCost}
                    disabled={busy}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-800"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCost(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditingCost}
                  className="text-xl font-extrabold text-teal-600 hover:underline decoration-dashed underline-offset-4"
                  title="Click to override"
                >
                  ₹{summary.estimatedCost}
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <Button
        size="lg"
        className="w-full"
        loading={busy}
        disabled={summary.resolvedTests.length === 0}
        onClick={handleConfirm}
      >
        Confirm Appointment &amp; Generate Samples
      </Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminNewAppointmentPage() {
  const { logOut } = useAuth()
  const navigate = useNavigate()
  const { appointmentId: resumeId } = useParams<{ appointmentId?: string }>()
  const [step, setStep] = useState<Step>(resumeId ? 'resuming' : 'patient')
  const [patient, setPatient] = useState<User | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [sampleIds, setSampleIds] = useState<string[]>([])
  const [printOpen, setPrintOpen] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [createError, setCreateError] = useState('')

  // Resuming an appointment that was auto-created after patient selection but never made it
  // through test selection — otherwise it's permanently stuck showing "select at least one
  // package or test" with no way back into the picker.
  useEffect(() => {
    if (!resumeId) return
    getAppointmentApi(resumeId)
      .then((appt) => {
        if (appt.status !== 'Created') {
          setResumeError(`This appointment is already ${appt.status} — nothing left to select.`)
          return
        }
        setAppointmentId(appt.id)
        setStep('tests')
      })
      .catch((err: unknown) => {
        setResumeError(err instanceof Error ? err.message : 'Could not load this appointment')
      })
  }, [resumeId])

  async function handleLogout() {
    await logOut()
    navigate('/')
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

      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="flex gap-3 mb-6">
          <Link to="/admin/appointments">
            <Button variant="ghost" size="sm">← Back to Appointments</Button>
          </Link>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-6">New Walk-In Appointment</h1>

        {step === 'resuming' && (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              {resumeError ? (
                <>
                  <p className="text-red-600 text-sm">{resumeError}</p>
                  <Button variant="outline" onClick={() => navigate('/admin/appointments')}>
                    Back to Appointments
                  </Button>
                </>
              ) : (
                <LoadingSpinner />
              )}
            </CardContent>
          </Card>
        )}

        {step === 'patient' && (
          <PatientStep
            onSelect={(p) => {
              setPatient(p)
              setStep('creating')
            }}
          />
        )}

        {step === 'creating' && patient && (
          createError ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <p className="text-red-600 text-sm">{createError}</p>
                <Button variant="outline" onClick={() => setStep('patient')}>
                  Back
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CreatingStep
              patient={patient}
              onCreated={(id) => {
                setAppointmentId(id)
                setStep('tests')
              }}
              onError={setCreateError}
            />
          )
        )}

        {step === 'tests' && appointmentId && (
          <TestSelectionStep
            appointmentId={appointmentId}
            onConfirmed={(ids) => {
              setSampleIds(ids)
              setStep('done')
            }}
          />
        )}

        {step === 'done' && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-slate-900 font-semibold text-lg">Appointment Confirmed</p>
              <p className="text-slate-500 text-sm">
                {sampleIds.length} sample{sampleIds.length === 1 ? '' : 's'} generated and ready to collect.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" onClick={() => navigate('/admin/appointments')}>
                  Back to Appointments
                </Button>
                <Button onClick={() => setPrintOpen(true)}>
                  <BarcodeIcon className="h-4 w-4 mr-2" /> Print Barcode Labels
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />

      {appointmentId && (
        <SamplePrintModal isOpen={printOpen} onClose={() => setPrintOpen(false)} appointmentId={appointmentId} />
      )}
    </div>
  )
}
