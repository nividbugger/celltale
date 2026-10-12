import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { UploadCloud, AlertTriangle, FileText } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAppointmentById,
  createReport,
  generateReportId,
  getReportByAppointmentId,
  setReportPdfUrl,
} from '../../lib/firestore'
import { markReportUploaded } from '../../lib/api'
import { describePackages } from '../../lib/appointmentDisplay'
import { uploadReportPDF } from '../../lib/storage'
import { stampQrOnPdf } from '../../lib/pdfQr'
import type { Appointment, Report } from '../../types'

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
  const [existingReport, setExistingReport] = useState<Report | null>(null)
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)

  useEffect(() => {
    if (!appointmentId) return
    Promise.all([
      getAppointmentById(appointmentId),
      getReportByAppointmentId(appointmentId),
    ]).then(([appt, report]) => {
      setAppointment(appt)
      setExistingReport(report)
      setLoading(false)
    })
  }, [appointmentId])

  async function handleUpload() {
    if (!pdfFile || !appointment || !appointmentId) {
      setServerError('Please select a PDF file.')
      return
    }
    setConfirmReplaceOpen(false)
    setServerError('')
    setSubmitting(true)
    try {
      // When replacing, keep the existing report id so previously shared/printed
      // QR links (/r/<id>) keep working; otherwise reserve a fresh id up front.
      const reportId = existingReport ? existingReport.id : generateReportId()
      const reportUrl = `${window.location.origin}/r/${reportId}`

      let fileToUpload: File = pdfFile
      try {
        const stamped = await stampQrOnPdf(pdfFile, reportUrl)
        fileToUpload = new File([stamped], pdfFile.name, { type: 'application/pdf' })
      } catch (stampErr) {
        // If the PDF can't be parsed/stamped (e.g. corrupt or encrypted), fall
        // back to uploading the original — the QR still works from the app page.
        console.warn('Could not stamp QR onto PDF; uploading original.', stampErr)
      }

      const pdfUrl = await uploadReportPDF(appointmentId, fileToUpload, setUploadProgress)

      if (existingReport) {
        // Replace the PDF on the existing report; status stays as-is.
        await setReportPdfUrl(existingReport.id, pdfUrl)
      } else {
        await createReport({
          id: reportId,
          appointmentId,
          patientId: appointment.patientId,
          pdfUrl,
          testValues: [],
        })
        await markReportUploaded(appointmentId, appointment.status)
      }
      navigate('/admin/appointments')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setServerError(`Upload failed: ${msg}`)
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmitClick() {
    if (existingReport) {
      setConfirmReplaceOpen(true)
    } else {
      void handleUpload()
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
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-slate-900">
                {existingReport ? 'Replace Report' : 'Upload Report'}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {appointment.patientName} · {describePackages(appointment)} · {appointment.date}
              </p>
            </div>

            <div className="space-y-6">
              {existingReport && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    A report is already uploaded for this appointment. Uploading a new PDF will
                    <strong> replace</strong> what the patient sees. The report link and any QR
                    codes already printed will keep working.
                    {existingReport.pdfUrl && (
                      <a
                        href={existingReport.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-amber-900"
                      >
                        <FileText className="h-3.5 w-3.5" /> View current report
                      </a>
                    )}
                  </div>
                </div>
              )}

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
                onClick={handleSubmitClick}
              >
                <UploadCloud className="h-5 w-5 mr-2" />
                {existingReport ? 'Replace Report' : 'Upload Report & Notify Patient'}
              </Button>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={confirmReplaceOpen}
        onClose={() => setConfirmReplaceOpen(false)}
        title="Replace report?"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          This will replace the current report PDF for{' '}
          <strong>{appointment?.patientName}</strong>. The patient will see the new file the next
          time they open the report. This can't be undone.
        </p>
        <div className="flex gap-3 mt-6">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => setConfirmReplaceOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button className="flex-1" loading={submitting} onClick={handleUpload}>
            Replace Report
          </Button>
        </div>
      </Modal>

      <Footer />
    </div>
  )
}
