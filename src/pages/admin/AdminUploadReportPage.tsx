import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { Plus, Trash2, UploadCloud } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { getAppointmentById, createReport, getReportByAppointmentId } from '../../lib/firestore'
import { updateAppointmentStatus } from '../../lib/firestore'
import { uploadReportPDF } from '../../lib/storage'
import { PACKAGES, type Appointment, type UploadReportFormData } from '../../types'

export default function AdminUploadReportPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const { logOut } = useAuth()

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [serverError, setServerError] = useState('')
  const [alreadyUploaded, setAlreadyUploaded] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UploadReportFormData>({
    defaultValues: { summary: '', testValues: [] },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'testValues',
  })

  useEffect(() => {
    if (!appointmentId) return
    Promise.all([
      getAppointmentById(appointmentId),
      getReportByAppointmentId(appointmentId),
    ]).then(([appt, existingReport]) => {
      setAppointment(appt)
      if (existingReport) {
        setAlreadyUploaded(true)
      } else if (appt) {
        const pkg = PACKAGES.find((p) => p.id === appt.packageId)
        if (pkg) {
          replace(
            pkg.tests.map((t) => ({
              category: pkg.name,
              name: t,
              value: '',
              unit: '',
              normalRange: '',
              isAbnormal: false,
            })),
          )
        }
      }
      setLoading(false)
    })
  }, [appointmentId, replace])

  async function onSubmit(data: UploadReportFormData) {
    if (!pdfFile || !appointment || !appointmentId) {
      setServerError('Please select a PDF file.')
      return
    }
    setServerError('')
    try {
      const pdfUrl = await uploadReportPDF(appointmentId, pdfFile, setUploadProgress)
      await createReport({
        appointmentId,
        patientId: appointment.patientId,
        pdfUrl,
        testValues: data.testValues,
        summary: data.summary || undefined,
      })
      await updateAppointmentStatus(appointmentId, 'Report Ready')
      navigate('/admin/appointments')
    } catch (e) {
      setServerError('Upload failed. Please try again.')
      console.error(e)
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
                {appointment.patientName} · {appointment.packageName} ·{' '}
                {appointment.date}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* PDF Upload */}
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

              {/* Summary */}
              <Card>
                <CardContent className="py-5">
                  <h2 className="font-semibold text-slate-900 mb-3">Summary (optional)</h2>
                  <textarea
                    {...register('summary')}
                    rows={3}
                    placeholder="Overall interpretation or notes for the patient..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </CardContent>
              </Card>

              {/* Test Values */}
              <Card>
                <CardContent className="py-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-900">Test Values</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({
                          category: '',
                          name: '',
                          value: '',
                          unit: '',
                          normalRange: '',
                          isAbnormal: false,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="border border-slate-100 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase">
                            Test #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Category"
                            placeholder="e.g. Blood Count"
                            {...register(`testValues.${index}.category` as const)}
                          />
                          <Input
                            label="Test Name"
                            placeholder="e.g. Hemoglobin"
                            {...register(`testValues.${index}.name` as const, {
                              required: true,
                            })}
                          />
                          <Input
                            label="Value"
                            placeholder="e.g. 13.5"
                            {...register(`testValues.${index}.value` as const, {
                              required: true,
                            })}
                          />
                          <Input
                            label="Unit"
                            placeholder="e.g. g/dL"
                            {...register(`testValues.${index}.unit` as const)}
                          />
                          <Input
                            label="Normal Range"
                            placeholder="e.g. 12.0 - 17.0"
                            className="col-span-2"
                            {...register(`testValues.${index}.normalRange` as const)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Controller
                            control={control}
                            name={`testValues.${index}.isAbnormal`}
                            render={({ field: f }) => (
                              <input
                                type="checkbox"
                                id={`abnormal-${index}`}
                                checked={f.value}
                                onChange={f.onChange}
                                className="h-4 w-4 rounded text-red-500 border-slate-300"
                              />
                            )}
                          />
                          <label
                            htmlFor={`abnormal-${index}`}
                            className="text-sm text-slate-600"
                          >
                            Mark as abnormal
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {fields.length === 0 && (
                    <p className="text-slate-400 text-sm text-center py-4">
                      No test values added yet. Click "Add Row" to start.
                    </p>
                  )}
                </CardContent>
              </Card>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={isSubmitting}
                disabled={!pdfFile}
              >
                <UploadCloud className="h-5 w-5 mr-2" />
                Upload Report & Notify Patient
              </Button>
            </form>
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
