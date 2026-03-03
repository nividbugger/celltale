import { useState } from 'react'
import { FileText, Download, AlertTriangle, Eye } from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Card, CardContent } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { usePatientReports } from '../../hooks/useReports'
import type { Report, TestValue } from '../../types'
import { format } from 'date-fns'

function groupByCategory(values: TestValue[]): Record<string, TestValue[]> {
  return values.reduce<Record<string, TestValue[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = []
    acc[v.category].push(v)
    return acc
  }, {})
}

function TestValueRow({ tv }: { tv: TestValue }) {
  return (
    <div
      className={`grid grid-cols-4 gap-2 py-2.5 px-3 rounded-xl text-sm ${
        tv.isAbnormal ? 'bg-red-50 text-red-800' : 'text-slate-700'
      }`}
    >
      <div className="flex items-center gap-1.5 col-span-1">
        {tv.isAbnormal && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        <span className="font-medium truncate">{tv.name}</span>
      </div>
      <div className="font-semibold">
        {tv.value} {tv.unit}
      </div>
      <div className="text-slate-500 col-span-2">{tv.normalRange}</div>
    </div>
  )
}

function ReportCard({ report }: { report: Report }) {
  const [modalOpen, setModalOpen] = useState(false)
  const abnormals = report.testValues.filter((t) => t.isAbnormal).length
  const grouped = groupByCategory(report.testValues)

  return (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-teal-50 p-2.5 rounded-2xl">
                <FileText className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  Report —{' '}
                  {report.uploadedAt?.toDate
                    ? format(report.uploadedAt.toDate(), 'dd MMM yyyy')
                    : '—'}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {report.testValues.length} tests
                  {abnormals > 0 && (
                    <span className="ml-2 text-red-600 font-semibold">
                      · {abnormals} abnormal
                    </span>
                  )}
                </p>
                {report.summary && (
                  <p className="text-slate-600 text-xs mt-1 italic">{report.summary}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-800"
              >
                <Eye className="h-4 w-4" /> Details
              </button>
              <a
                href={report.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-full hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Test Results" size="xl">
        {report.summary && (
          <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3 mb-5 text-sm text-teal-800">
            <strong>Summary:</strong> {report.summary}
          </div>
        )}
        {abnormals > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {abnormals} value{abnormals > 1 ? 's are' : ' is'} outside the normal range. Please
            consult a doctor.
          </div>
        )}

        <div className="space-y-5">
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
                  <TestValueRow key={i} tv={tv} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}

export default function ReportsPage() {
  const { userProfile } = useAuth()
  const { reports, loading } = usePatientReports(userProfile?.uid)

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold text-slate-900">My Reports</h1>

        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No reports yet</p>
              <p className="text-slate-400 text-sm mt-1">
                Your reports will appear here once uploaded by the lab.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
