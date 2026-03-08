import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { getAppointmentById, createReport, getReportByAppointmentId } from '../../lib/firestore'
import { updateAppointmentStatus } from '../../lib/firestore'
import { uploadReportPDF } from '../../lib/storage'
import type { Appointment } from '../../types'

export default function AdminUploadReportPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const { logOut } = useAuth()

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [alreadyUploaded, setAlreadyUploaded] = useState(false)

  useEffect(() => {
    if (!appointmentId) return
    Promise.all([
      getAppointmentById(appointmentId),
      getReportByAppointmentId(appointmentId),
    ]).then(([appt, existingReport]) => {
      setAppointment(appt)
      if (existingReport) setAlreadyUploaded(true)
      setLoading(false)
    })
  }, [appointmentId])

  async function handleUpload() {
    if (!pdfFile || !appointment || !appointmentId) {
      setServerError('Please select a PDF file.')
      return
    }
    setServerError('')
    setSubmitting(true)
    try {
      const pdfUrl = await uploadReportPDF(appointmentId, pdfFile, setUploadProgress)
      await createReport({
        appointmentId,
        patientId: appointment.patientId,
        pdfUrl,
        testValues: [],
      })
      await updateAppointmentStatus(appointmentId, 'Report Ready')
      navigate('/admin/appointments')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setServerError(`Upload failed: ${msg}`)
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
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="flex gap-3 mb-8">
          <Link to="/admin/appointments">
            <Button variant="ghost" size="sm">← Back to Appointments</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : !appointment ? (
          <p className="text-slate-500">Appointment not found.</p>
        ) : alreadyUploaded ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-700 font-semibold text-lg">Report already uploaded</p>
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
              <h1 className="text-2xl font-extrabold text-slate-900">Upload Report</h1>
              <p className="text-slate-500 text-sm mt-1">
                {appointment.patientName} · {appointment.packageName} · {appointment.date}
              </p>
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="py-5">
                  <h2 className="font-semibold text-slate-900 mb-3">PDF Report</h2>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 cursor-pointer hover:border-teal-400 transition-colors">
                    <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
                    <p className="text-sm text-slate-600 font-medium">
                      {pdfFile ? pdfFile.name : 'Click to upload PDF'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PDF files only, max 10MB</p>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-3">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-bg transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{Math.round(uploadProgress)}%</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {serverError}
                </div>
              )}

              <Button
                size="lg"
                className="w-full"
                loading={submitting}
                disabled={!pdfFile}
                onClick={handleUpload}
              >
                <UploadCloud className="h-5 w-5 mr-2" />
                Upload Report & Notify Patient
              </Button>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
