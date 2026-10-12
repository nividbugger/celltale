import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, AlertTriangle, Download } from 'lucide-react'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Card, CardContent } from '../../components/ui/Card'
import { getReportById } from '../../lib/firestore'
import type { Report, TestValue } from '../../types'
import { format } from 'date-fns'

function groupByCategory(values: TestValue[]): Record<string, TestValue[]> {
  return values.reduce<Record<string, TestValue[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = []
    acc[v.category].push(v)
    return acc
  }, {})
}

/**
 * Public, no-login view of a single report. Reached by scanning the QR code
 * printed on the physical report. The report id in the URL is an unguessable
 * Firestore token, so only someone holding a copy of the report can open it
 * (firestore.rules allows a single-doc `get` but not enumeration).
 */
export default function ReportViewPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!reportId) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    getReportById(reportId)
      .then((r) => {
        if (cancelled) return
        if (!r) {
          setNotFound(true)
        } else {
          setReport(r)
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reportId])

  const abnormals = report?.testValues.filter((t) => t.isAbnormal).length ?? 0
  const grouped = report ? groupByCategory(report.testValues) : {}

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <BrandLogo />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : notFound || !report ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold">Report not found</p>
              <p className="text-slate-400 text-sm mt-1">
                This report link is invalid or the report is no longer available.
              </p>
              <Link
                to="/"
                className="inline-block mt-5 text-sm font-semibold text-teal-600 hover:text-teal-800"
              >
                Go to homepage
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Test Report</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {report.uploadedAt?.toDate
                    ? format(report.uploadedAt.toDate(), 'dd MMM yyyy')
                    : '—'}
                  {report.testValues.length > 0 && <> · {report.testValues.length} tests</>}
                  {abnormals > 0 && (
                    <span className="ml-1 text-red-600 font-semibold">
                      · {abnormals} abnormal
                    </span>
                  )}
                </p>
              </div>
              {report.pdfUrl && (
                <a
                  href={report.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold bg-slate-900 text-white px-3 py-2 rounded-full hover:bg-slate-800 shrink-0"
                >
                  <Download className="h-3.5 w-3.5" /> Open / Download PDF
                </a>
              )}
            </div>

            {/* Uploaded PDF reports: embed the PDF directly so scanning the QR
                shows the actual report file. */}
            {report.pdfUrl && report.testValues.length === 0 && (
              <Card>
                <CardContent className="p-0 overflow-hidden rounded-2xl">
                  <iframe
                    src={report.pdfUrl}
                    title="Report PDF"
                    className="w-full h-[80vh] border-0"
                  />
                </CardContent>
              </Card>
            )}

            {report.summary && (
              <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3 text-sm text-teal-800">
                <strong>Summary:</strong> {report.summary}
              </div>
            )}

            {abnormals > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {abnormals} value{abnormals > 1 ? 's are' : ' is'} outside the normal range.
                Please consult a doctor.
              </div>
            )}

            {report.testValues.length > 0 && (
            <Card>
              <CardContent className="py-5 space-y-5">
                {Object.entries(grouped).map(([category, values]) => (
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
                          <div className="flex items-center gap-1.5 col-span-1">
                            {tv.isAbnormal && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            )}
                            <span className="font-medium truncate">{tv.name}</span>
                          </div>
                          <div className="font-semibold">
                            {tv.value} {tv.unit}
                          </div>
                          <div className="text-slate-500 col-span-2">{tv.normalRange}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            )}

            <p className="flex items-center gap-1.5 text-xs text-slate-400 justify-center pt-2">
              <FileText className="h-3.5 w-3.5" />
              Verified diagnostic report
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
