import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ClipboardCheck, AlertTriangle, RefreshCw, FlaskConical } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAppointmentById,
  getReportByAppointmentId,
  getAllTests,
  createReport,
  updateReport,
  subscribeToReportByAppointmentId,
} from '../../lib/firestore'
import { markReportUploaded } from '../../lib/api'
import { describePackages } from '../../lib/appointmentDisplay'
import type { Appointment, Test, TestValue } from '../../types'

interface ReportRow {
  key: string
  testId: string
  /** test.name — used as the section heading */
  testName: string
  /** p.parameter — the individual analyte name */
  paramName: string
  unit: string
  normalRange: string
}

/** Match LIS testValues to a form row.
 *  LIS writes name=test.name; manual entry writes name=p.parameter.
 *  Try parameter name first (exact), fall back to test name (LIS). */
function findMatch(testValues: TestValue[], testName: string, paramName: string): TestValue | undefined {
  return testValues.find((tv) => tv.name === paramName) ?? testValues.find((tv) => tv.name === testName)
}

function seedFromTestValues(
  testValues: TestValue[],
  rows: ReportRow[],
): Record<string, { value: string; isAbnormal: boolean }> {
  const seed: Record<string, { value: string; isAbnormal: boolean }> = {}
  for (const row of rows) {
    const match = findMatch(testValues, row.testName, row.paramName)
    if (match) seed[row.key] = { value: match.value, isAbnormal: match.isAbnormal }
  }
  return seed
}

export default function AdminGenerateReportPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const { logOut } = useAuth()

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [tests, setTests] = useState<Test[]>([])
  const [rowValues, setRowValues] = useState<Record<string, { value: string; isAbnormal: boolean }>>({})
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [existingReportId, setExistingReportId] = useState<string | null>(null)
  const [seededFromLis, setSeededFromLis] = useState(false)
  const [pendingLisValues, setPendingLisValues] = useState<TestValue[] | null>(null)

  // testIds fixed by the appointment — never changed by the admin.
  const [appointmentTestIds, setAppointmentTestIds] = useState<string[]>([])

  const initialLoadDone = useRef(false)
  const rowsRef = useRef<ReportRow[]>([])

  useEffect(() => {
    if (!appointmentId) return
    let unsubReport: (() => void) | null = null

    Promise.all([
      getAppointmentById(appointmentId),
      getReportByAppointmentId(appointmentId),
      getAllTests(),
    ]).then(([appt, existingReport, allTests]) => {
      setAppointment(appt)
      setTests(allTests)

      const testIds = appt ? appt.resolvedTests.map((t) => t.testId) : []
      setAppointmentTestIds(testIds)

      // Build rows eagerly so we can seed rowValues before the first render.
      const initialRows = buildRows(testIds, allTests)
      rowsRef.current = initialRows

      if (existingReport) {
        setExistingReportId(existingReport.id)
        if (existingReport.summary) setSummary(existingReport.summary)
        const seed = seedFromTestValues(existingReport.testValues, initialRows)
        if (Object.keys(seed).length > 0) {
          setRowValues(seed)
          setSeededFromLis(true)
        }
      }

      setLoading(false)
      initialLoadDone.current = true

      // Start real-time listener only after initial load to avoid double-seeding.
      unsubReport = subscribeToReportByAppointmentId(appointmentId, (report) => {
        if (!initialLoadDone.current) return
        if (!report) return
        setExistingReportId(report.id)
        setPendingLisValues(report.testValues)
      })
    })

    return () => { unsubReport?.() }
  }, [appointmentId])

  /** All parameter rows derived from the appointment's fixed test list. */
  const rows: ReportRow[] = useMemo(() => {
    const built = buildRows(appointmentTestIds, tests)
    rowsRef.current = built
    return built
  }, [appointmentTestIds, tests])

  /** Group rows by test name for display. */
  const groupedRows = useMemo(() => {
    const groups: { testName: string; rows: ReportRow[] }[] = []
    for (const row of rows) {
      const last = groups[groups.length - 1]
      if (last && last.testName === row.testName) {
        last.rows.push(row)
      } else {
        groups.push({ testName: row.testName, rows: [row] })
      }
    }
    return groups
  }, [rows])

  function updateRow(key: string, patch: Partial<{ value: string; isAbnormal: boolean }>) {
    setRowValues((rv) => ({
      ...rv,
      [key]: { value: rv[key]?.value ?? '', isAbnormal: rv[key]?.isAbnormal ?? false, ...patch },
    }))
  }

  function reloadFromLis() {
    if (!pendingLisValues) return
    const seed = seedFromTestValues(pendingLisValues, rowsRef.current)
    setRowValues(seed)
    setSeededFromLis(true)
    setPendingLisValues(null)
  }

  async function handleSubmit() {
    if (!appointment || !appointmentId) return
    setServerError('')
    setSubmitting(true)
    try {
      const testValues: TestValue[] = rows.map((row) => ({
        category: row.testName,
        name: row.paramName,
        unit: row.unit,
        normalRange: row.normalRange,
        value: rowValues[row.key]?.value ?? '',
        isAbnormal: rowValues[row.key]?.isAbnormal ?? false,
      }))

      if (existingReportId) {
        await updateReport(existingReportId, {
          testValues,
          summary: summary.trim() || undefined,
          testIds: appointmentTestIds,
        })
      } else {
        await createReport({
          appointmentId,
          patientId: appointment.patientId,
          testValues,
          summary: summary.trim() || undefined,
          testIds: appointmentTestIds,
        })
      }

      await markReportUploaded(appointmentId, appointment.status)
      navigate('/admin/appointments')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setServerError(`Failed to save report: ${msg}`)
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logOut()
    window.location.href = '/'
  }

  const filledCount = rows.filter((r) => (rowValues[r.key]?.value ?? '').trim() !== '').length

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

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="flex gap-3 mb-8">
          <Link to="/admin/appointments">
            <Button variant="ghost" size="sm">← Back to Appointments</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : !appointment ? (
          <p className="text-slate-500">Appointment not found.</p>
        ) : (
          <>
            <div className="mb-2">
              <h1 className="text-2xl font-extrabold text-slate-900">Report</h1>
              <p className="text-slate-500 text-sm mt-1">
                {appointment.patientName} · {describePackages(appointment)} · {appointment.date}
              </p>
            </div>

            {/* Fill progress */}
            {rows.length > 0 && (
              <p className="text-xs text-slate-400 mb-5">
                {filledCount} of {rows.length} parameter{rows.length === 1 ? '' : 's'} filled
              </p>
            )}

            {/* LIS pre-fill banner */}
            {seededFromLis && !pendingLisValues && (
              <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-800 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 shrink-0" />
                Values pre-filled from analyzer results. Review and confirm below.
              </div>
            )}

            {/* Real-time LIS update banner */}
            {pendingLisValues && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  New results received from the analyzer.
                </div>
                <button
                  onClick={reloadFromLis}
                  className="font-semibold underline underline-offset-2 shrink-0 hover:text-amber-900"
                >
                  Reload values
                </button>
              </div>
            )}

            <div className="space-y-4">
              {rows.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-slate-400 text-sm">
                    No tests with parameters found for this appointment.
                  </CardContent>
                </Card>
              ) : (
                groupedRows.map((group) => (
                  <Card key={group.testName}>
                    <CardContent className="py-4">
                      {/* Test name heading */}
                      <div className="flex items-center gap-2 mb-3">
                        <FlaskConical className="h-4 w-4 text-teal-600 shrink-0" />
                        <h2 className="font-semibold text-slate-900 text-sm">{group.testName}</h2>
                      </div>

                      <div className="space-y-3">
                        {group.rows.map((row) => {
                          const filled = (rowValues[row.key]?.value ?? '').trim() !== ''
                          return (
                            <div
                              key={row.key}
                              className={`rounded-xl border p-3 ${filled ? 'border-slate-200' : 'border-dashed border-slate-200'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{row.paramName}</p>
                                  <p className="text-xs text-slate-400">
                                    Normal range: {row.normalRange || '—'} {row.unit}
                                  </p>
                                </div>
                                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={rowValues[row.key]?.isAbnormal ?? false}
                                    onChange={(e) => updateRow(row.key, { isAbnormal: e.target.checked })}
                                    className="rounded border-slate-300 text-red-500 focus:ring-red-500"
                                  />
                                  Abnormal
                                </label>
                              </div>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  value={rowValues[row.key]?.value ?? ''}
                                  onChange={(e) => updateRow(row.key, { value: e.target.value })}
                                  placeholder="Not yet reported"
                                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-300"
                                />
                                <span className="text-xs text-slate-400 w-16 shrink-0">{row.unit}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              <Card>
                <CardContent className="py-5">
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    Summary (optional)
                  </label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={3}
                    placeholder="Clinical notes or overall interpretation…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-300"
                  />
                </CardContent>
              </Card>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {serverError}
                </div>
              )}

              <Button
                size="lg"
                className="w-full"
                loading={submitting}
                disabled={rows.length === 0}
                onClick={handleSubmit}
              >
                <ClipboardCheck className="h-5 w-5 mr-2" />
                {existingReportId ? 'Update & Confirm Report' : 'Confirm & Send Report'}
              </Button>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}

function buildRows(testIds: string[], allTests: Test[]): ReportRow[] {
  return testIds.flatMap((testId) => {
    const test = allTests.find((t) => t.id === testId)
    if (!test) return []
    return test.parameters.map((p, idx) => ({
      key: `${testId}-${idx}`,
      testId,
      testName: test.name,
      paramName: p.parameter,
      unit: p.unit,
      normalRange: p.biologicalReference,
    }))
  })
}
