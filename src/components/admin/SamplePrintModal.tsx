import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { getAppointmentSamples, printSample, type SamplePrintPayload } from '../../lib/api'
import { getAppointmentById, getUserDocument } from '../../lib/firestore'
import { format, differenceInYears } from 'date-fns'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointmentId: string
}

/**
 * Replaces the pre-refactor `BarcodePrintModal`, which printed one barcode for the whole
 * appointment. One sample now = one barcode, so this renders/prints one label per sample
 * (e.g. one blood-sample label even though it satisfies CBC + LFT + HbA1c, plus a separate
 * urine-sample label if one was generated) instead of a single generic appointment barcode.
 */
export function SamplePrintModal({ isOpen, onClose, appointmentId }: Props) {
  const [labels, setLabels] = useState<SamplePrintPayload[]>([])
  const [patientAge, setPatientAge] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiesPerSample, setCopiesPerSample] = useState(1)
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({})

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError('')
    Promise.all([
      getAppointmentSamples(appointmentId).then((samples) =>
        Promise.all(samples.map((s) => printSample(s.id))),
      ),
      getAppointmentById(appointmentId).then((appt) =>
        appt ? getUserDocument(appt.patientId) : null,
      ),
    ])
      .then(([printPayloads, patient]) => {
        setLabels(printPayloads)
        if (patient?.dob) setPatientAge(differenceInYears(new Date(), new Date(patient.dob)))
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load samples'))
      .finally(() => setLoading(false))
  }, [isOpen, appointmentId])

  useEffect(() => {
    if (!isOpen) return
    for (const label of labels) {
      const el = svgRefs.current[label.sampleId]
      if (!el) continue
      JsBarcode(el, label.barcodeId, {
        format: 'CODE128',
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 12,
        font: 'monospace',
        textMargin: 2,
        margin: 4,
      })
    }
  }, [isOpen, labels])

  function handlePrint() {
    if (labels.length === 0) return

    const shortName = (label: SamplePrintPayload) => label.patientName.slice(0, 5).toUpperCase()
    const labelName = (label: SamplePrintPayload) =>
      patientAge !== null ? `${shortName(label)} (${patientAge})` : shortName(label)

    const renderLabel = (label: SamplePrintPayload) => {
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      JsBarcode(tempSvg, label.barcodeId, {
        format: 'CODE128',
        width: 1.5,
        height: 30,
        displayValue: true,
        fontSize: 9,
        font: 'monospace',
        textMargin: 1,
        margin: 2,
      })
      const formattedDate = label.date ? format(new Date(label.date), 'dd MMM yyyy') : ''
      return `
        <div class="label" style="break-after: page;">
          <div class="patient-name">${labelName(label)}</div>
          <div class="sample-type">${label.sampleType.toUpperCase()}</div>
          ${tempSvg.outerHTML}
          <div class="date-text">${formattedDate}${label.timeSlot ? ` &middot; ${label.timeSlot}` : ''}</div>
          <div class="tests-text">${label.testNames.join(', ')}</div>
        </div>
      `
    }

    const allLabels = labels.flatMap((label) =>
      Array.from({ length: copiesPerSample }, () => renderLabel(label)),
    ).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Sample Barcode Labels</title>
  <style>
    @page { size: 51mm 25mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    .label {
      width: 51mm; height: 25mm; padding: 1mm 2mm;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .patient-name { font-size: 7pt; font-weight: bold; text-align: center; white-space: nowrap; }
    .sample-type { font-size: 6pt; font-weight: bold; color: #0f766e; letter-spacing: 0.05em; }
    .date-text { font-size: 6pt; color: #444; text-align: center; margin-top: 1px; }
    .tests-text {
      font-size: 5pt; color: #666; text-align: center; max-width: 100%;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    svg { display: block; margin: 0 auto; max-width: 46mm; }
  </style>
</head>
<body>
  ${allLabels}
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Print Sample Barcode Labels" size="lg">
      <div className="space-y-4">
        {loading ? (
          <LoadingSpinner className="py-8" />
        ) : error ? (
          <div className="text-center py-8 text-red-500 text-sm">{error}</div>
        ) : labels.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No samples have been generated for this appointment yet.
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {labels.map((label) => (
                <div
                  key={label.sampleId}
                  className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl"
                >
                  <svg ref={(el) => { svgRefs.current[label.sampleId] = el }} />
                  <div className="text-sm min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 capitalize">{label.sampleType} sample</p>
                    <p className="text-xs text-slate-500 truncate">{label.testNames.join(', ')}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{label.barcodeId}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Copies per Sample</label>
              <select
                value={copiesPerSample}
                onChange={(e) => setCopiesPerSample(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n} cop{n > 1 ? 'ies' : 'y'} each</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> Print {labels.length * copiesPerSample} Label{labels.length * copiesPerSample > 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
