import { useState, useRef, useEffect } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer, Download, FileText } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { usePatientReports } from '../../hooks/useReports'
import type { User } from '../../types'
import { format } from 'date-fns'

interface Props {
  isOpen: boolean
  onClose: () => void
  patient: User
}

export function PatientDetailModal({ isOpen, onClose, patient }: Props) {
  const [labelCount, setLabelCount] = useState(4)
  const svgRef = useRef<SVGSVGElement>(null)
  const { reports, loading: reportsLoading } = usePatientReports(patient.uid)

  const shortName = patient.name.slice(0, 5).toUpperCase()
  const labelName = patient.age !== undefined ? `${shortName} (${patient.age})` : shortName
  const registrationDate = patient.createdAt?.toDate ? format(patient.createdAt.toDate(), 'dd MMM yyyy') : '—'

  useEffect(() => {
    if (!isOpen || !svgRef.current) return
    JsBarcode(svgRef.current, patient.uid, {
      format: 'CODE128',
      width: 1.5,
      height: 40,
      displayValue: true,
      fontSize: 12,
      font: 'monospace',
      textMargin: 2,
      margin: 4,
    })
  }, [isOpen, patient.uid])

  function handlePrintBarcode() {
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(tempSvg, patient.uid, {
      format: 'CODE128',
      width: 1.5,
      height: 35,
      displayValue: true,
      fontSize: 10,
      font: 'monospace',
      textMargin: 1,
      margin: 2,
    })
    const barcodeSvg = tempSvg.outerHTML

    const labels = Array.from({ length: labelCount }, (_, i) => `
      <div class="label" ${i < labelCount - 1 ? 'style="break-after: page;"' : ''}>
        <div class="patient-name">${labelName}</div>
        ${barcodeSvg}
        <div class="date-text">${registrationDate} &middot; ${patient.phone}</div>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Patient Labels - ${labelName}</title>
  <style>
    @page { size: 51mm 25mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    .label {
      width: 51mm;
      height: 25mm;
      padding: 1mm 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .patient-name {
      font-size: 7pt;
      font-weight: bold;
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 1px;
    }
    .date-text {
      font-size: 6pt;
      color: #444;
      text-align: center;
      margin-top: 1px;
    }
    svg { display: block; margin: 0 auto; max-width: 46mm; }
  </style>
</head>
<body>
  ${labels}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Patient: ${patient.name}`} size="lg">
      <div className="space-y-6">
        {/* Patient Information */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Name</p>
            <p className="text-sm font-medium text-slate-900">{patient.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Phone</p>
            <p className="text-sm font-medium text-slate-900">{patient.phone}</p>
          </div>
          {patient.email && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Email</p>
              <p className="text-sm font-medium text-slate-900">{patient.email}</p>
            </div>
          )}
          {patient.age && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Age</p>
              <p className="text-sm font-medium text-slate-900">{patient.age}</p>
            </div>
          )}
          {patient.gender && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Gender</p>
              <p className="text-sm font-medium text-slate-900">{patient.gender}</p>
            </div>
          )}
          {patient.company && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Company</p>
              <p className="text-sm font-medium text-slate-900">{patient.company}</p>
            </div>
          )}
          {patient.additionalInfo && (
            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Additional Info</p>
              <p className="text-sm text-slate-900">{patient.additionalInfo}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Registered</p>
            <p className="text-sm font-medium text-slate-900">{registrationDate}</p>
          </div>
        </div>

        {/* Barcode Section */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Barcode</h3>
          <div className="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-lg">
            <svg ref={svgRef} />
            <p className="text-xs text-slate-500 mt-2">{patient.uid}</p>
          </div>
          <div className="mt-3 space-y-2">
            <label className="text-xs font-medium text-slate-700 block">Number of Labels</label>
            <select
              value={labelCount}
              onChange={(e) => setLabelCount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} label{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <Button size="sm" className="w-full" onClick={handlePrintBarcode}>
              <Printer className="h-4 w-4 mr-2" /> Print Barcode Labels
            </Button>
          </div>
        </div>

        {/* Reports Section */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Uploaded Reports</h3>
          {reportsLoading ? (
            <div className="text-center py-4 text-slate-500 text-sm">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">No reports uploaded yet</div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <a
                  key={report.id}
                  href={report.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Report</p>
                      <p className="text-xs text-slate-500">
                        {report.uploadedAt?.toDate
                          ? format(report.uploadedAt.toDate(), 'dd MMM yyyy')
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-slate-400" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
