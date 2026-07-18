import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ClipboardCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAppointmentById,
  getReportByAppointmentId,
  getAllPackages,
  getAllTests,
  createReport,
  updateAppointmentStatus,
} from '../../lib/firestore'
import type { Appointment, Test, TestValue } from '../../types'

interface ReportRow {
  key: string
  testId: string
  category: string
  name: string
  unit: string
  normalRange: string
}

export default function AdminGenerateReportPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const { logOut } = useAuth()

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [alreadyExists, setAlreadyExists] = useState(false)
  const [tests, setTests] = useState<Test[]>([])
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [rowValues, setRowValues] = useState<Record<string, { value: string; isAbnormal: boolean }>>({})
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (!appointmentId) return
    Promise.all([
      getAppointmentById(appointmentId),
      getReportByAppointmentId(appointmentId),
      getAllPackages(),
      getAllTests(),
    ]).then(([appt, existingReport, pkgs, allTests]) => {
      setAppointment(appt)
      if (existingReport) setAlreadyExists(true)
      setTests(allTests)

      if (appt) {
        const pkg = pkgs.find((p) => p.id === appt.packageId)
        setSelectedTestIds(pkg?.testIds ?? [])
      }
      setLoading(false)
    })
  }, [appointmentId])

  const rows: ReportRow[] = useMemo(() => {
    return selectedTestIds.flatMap((testId) => {
      const test = tests.find((t) => t.id === testId)
      if (!test) return []
      return test.parameters.map((p, idx) => ({
        key: `${testId}-${idx}`,
        testId,
        category: test.name,
        name: p.parameter,
        unit: p.unit,
        normalRange: p.biologicalReference,
      }))
    })
  }, [selectedTestIds, tests])

  function toggleTest(testId: string) {
    setSelectedTestIds((prev) => {
      const isSelected = prev.includes(testId)
      if (isSelected) {
        setRowValues((rv) => {
          const next = { ...rv }
          for (const key of Object.keys(next)) {
            if (key.startsWith(`${testId}-`)) delete next[key]
          }
          return next
        })
        return prev.filter((id) => id !== testId)
      }
      return [...prev, testId]
    })
  }

  function updateRow(key: string, patch: Partial<{ value: string; isAbnormal: boolean }>) {
    setRowValues((rv) => ({
      ...rv,
      [key]: { value: rv[key]?.value ?? '', isAbnormal: rv[key]?.isAbnormal ?? false, ...patch },
    }))
  }

  async function handleSubmit() {
    if (!appointment || !appointmentId) return
    setServerError('')
    setSubmitting(true)
    try {
      const testValues: TestValue[] = rows.map((row) => ({
        category: row.category,
        name: row.name,
        unit: row.unit,
        normalRange: row.normalRange,
        value: rowValues[row.key]?.value ?? '',
        isAbnormal: rowValues[row.key]?.isAbnormal ?? false,
      }))

      await createReport({
        appointmentId,
        patientId: appointment.patientId,
        testValues,
        summary: summary.trim() || undefined,
        packageId: appointment.packageId || undefined,
        testIds: selectedTestIds,
      })
      await updateAppointmentStatus(appointmentId, 'Report Ready')
      navigate('/admin/appointments')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setServerError(`Failed to generate report: ${msg}`)
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logOut()
    window.location.href = '/'
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
        ) : alreadyExists ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-700 font-semibold text-lg">Report already exists</p>
              <p className="text-slate-500 text-sm mt-2">
                A report has already been submitted for this appointment.
              </p>
              <Link to="/admin/appointments" className="mt-4 inline-block">
                <Button>Back to Appointments</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-slate-900">Generate Report</h1>
              <p className="text-slate-500 text-sm mt-1">
                {appointment.patientName} · {appointment.packageName} · {appointment.date}
              </p>
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="py-5">
                  <h2 className="font-semibold text-slate-900 mb-3">Tests Included</h2>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {tests.length === 0 ? (
                      <p className="text-sm text-slate-400 px-3 py-3">No tests created yet.</p>
                    ) : (
                      tests.map((t) => {
                        const checked = selectedTestIds.includes(t.id)
                        return (
                          <label
                            key={t.id}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTest(t.id)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-slate-700 flex-1">{t.name}</span>
                            <span className="text-xs text-slate-400">
                              {t.parameters.length} parameter{t.parameters.length === 1 ? '' : 's'}
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {rows.length > 0 && (
                <Card>
                  <CardContent className="py-5">
                    <h2 className="font-semibold text-slate-900 mb-3">Enter Results</h2>
                    <div className="space-y-3">
                      {rows.map((row) => (
                        <div key={row.key} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{row.name}</p>
                              <p className="text-xs text-slate-400">
                                {row.category} · Normal range: {row.normalRange} {row.unit}
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
                              placeholder="Result value"
                              className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <span className="text-xs text-slate-400 w-16 shrink-0">{row.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                Generate Report & Notify Patient
              </Button>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
