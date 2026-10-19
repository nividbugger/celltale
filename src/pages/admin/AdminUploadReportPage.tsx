import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { UploadCloud, FileText, Trash2, X } from 'lucide-react'
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
  getReportsByAppointmentId,
  deleteReport,
} from '../../lib/firestore'
import { markReportUploaded } from '../../lib/api'
import { describePackages } from '../../lib/appointmentDisplay'
import { uploadReportPDF } from '../../lib/storage'
import { stampQrOnPdf } from '../../lib/pdfQr'
import type { Appointment, Report } from '../../types'

export default function AdminUploadReportPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const { logOut } = useAuth()

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [existingReports, setExistingReports] = useState<Report[]>([])
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!appointmentId) return
    void loadData()
  }, [appointmentId])

  async function loadData() {
    if (!appointmentId) return
    const [appt, reports] = await Promise.all([
      getAppointmentById(appointmentId),
      getReportsByAppointmentId(appointmentId),
    ])
    setAppointment(appt)
    setExistingReports(reports.filter((r) => r.pdfUrl))
    setLoading(false)
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    setPdfFiles((prev) => [...prev, ...Array.from(files)])
  }

  function removeFile(index: number) {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (pdfFiles.length === 0 || !appointment || !appointmentId) {
      setServerError('Please select at least one PDF file.')
      return
    }
    setServerError('')
    setSubmitting(true)
    try {
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i]
        const reportId = generateReportId()
        const reportUrl = `${window.location.origin}/r/${reportId}`

        let fileToUpload: File = file
        try {
          const stamped = await stampQrOnPdf(file, reportUrl)
          fileToUpload = new File([stamped], file.name, { type: 'application/pdf' })
        } catch (stampErr) {
          // If the PDF can't be parsed/stamped (e.g. corrupt or encrypted), fall
          // back to uploading the original — the QR still works from the app page.
          console.warn('Could not stamp QR onto PDF; uploading original.', stampErr)
        }

        const pdfUrl = await uploadReportPDF(appointmentId, fileToUpload, (pct) => {
          setUploadProgress(((i + pct / 100) / pdfFiles.length) * 100)
        })

        await createReport({
          id: reportId,
          appointmentId,
          patientId: appointment.patientId,
          pdfUrl,
          testValues: [],
        })
      }

      await markReportUploaded(appointmentId, appointment.status)

      setPdfFiles([])
      setUploadProgress(0)
      await loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setServerError(`Upload failed: ${msg}`)
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!reportToDelete) return
    setDeleting(true)
    try {
      await deleteReport(reportToDelete.id)
      setReportToDelete(null)
      await loadData()
    } finally {
      setDeleting(false)
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
              <h1 className="text-2xl font-extrabold text-slate-900">Upload Reports</h1>
              <p className="text-slate-500 text-sm mt-1">
                {appointment.patientName} · {describePackages(appointment)} · {appointment.date}
              </p>
            </div>

            <div className="space-y-6">
              {existingReports.length > 0 && (
                <Card>
                  <CardContent className="py-5">
                    <h2 className="font-semibold text-slate-900 mb-3">
                      Uploaded Reports ({existingReports.length})
                    </h2>
                    <div className="space-y-2">
                      {existingReports.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5"
                        >
                          <a
                            href={r.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-teal-700 min-w-0"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              Report uploaded{' '}
                              {r.uploadedAt?.toDate ? format(r.uploadedAt.toDate(), 'dd MMM yyyy, HH:mm') : ''}
                            </span>
                          </a>
                          <button
                            onClick={() => setReportToDelete(r)}
                            className="text-slate-400 hover:text-red-600 shrink-0"
                            aria-label="Delete report"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="py-5">
                  <h2 className="font-semibold text-slate-900 mb-3">Add PDF Report(s)</h2>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 cursor-pointer hover:border-teal-400 transition-colors">
                    <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
                    <p className="text-sm text-slate-600 font-medium">
                      Click to upload PDF(s), or add more later
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PDF files only, max 10MB each</p>
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => addFiles(e.target.files)}
                    />
                  </label>

                  {pdfFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {pdfFiles.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2 text-sm"
                        >
                          <span className="truncate text-slate-700">{f.name}</span>
                          <button
                            onClick={() => removeFile(i)}
                            disabled={submitting}
                            className="text-slate-400 hover:text-red-600 shrink-0"
                            aria-label="Remove file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

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
                disabled={pdfFiles.length === 0}
                onClick={handleUpload}
              >
                <UploadCloud className="h-5 w-5 mr-2" />
                {existingReports.length === 0
                  ? `Upload Report${pdfFiles.length > 1 ? 's' : ''} & Notify Patient`
                  : `Add Report${pdfFiles.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={!!reportToDelete}
        onClose={() => setReportToDelete(null)}
        title="Delete report?"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          This will remove this report PDF for <strong>{appointment?.patientName}</strong>. Its QR
          link will stop working. This can't be undone.
        </p>
        <div className="flex gap-3 mt-6">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => setReportToDelete(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button className="flex-1" loading={deleting} onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>

      <Footer />
    </div>
  )
}
