import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { getAppointmentSamples, printSample, type SamplePrintPayload } from '../../lib/api'
import { getAppointmentById, getUserDocument } from '../../lib/firestore'
import { differenceInYears } from 'date-fns'

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
      getAppointmentById(appointmentId),
      getAppointmentSamples(appointmentId),
    ])
      .then(([appt, sampleRecords]) => {
        type ApptWithGroups = { resolvedSampleGroups?: Array<{ label: string; testIds: string[] }> }
        const groups = (appt as unknown as ApptWithGroups).resolvedSampleGroups

        return Promise.all([
          Promise.all(
            sampleRecords.map((s) =>
              printSample(s.id).then((payload) => {
                if (payload.tubeColor) return payload
                const match = groups?.find((g) => s.testIds.some((id) => g.testIds.includes(id)))
                return { ...payload, tubeColor: match?.label ?? '' }
              }),
            ),
          ),
          appt ? getUserDocument(appt.patientId) : Promise.resolve(null),
        ])
      })
      .then(([printPayloads, patient]) => {
        setLabels(printPayloads)
        if (patient?.dob) setPatientAge(differenceInYears(new Date(), new Date(patient.dob)))
        else if (typeof patient?.age === 'number') setPatientAge(patient.age)
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

    const subIdLine = (label: SamplePrintPayload) => {
      const namePart = label.patientName.slice(0, 7).toUpperCase()
      const agePart = patientAge !== null ? String(patientAge) : ''
      const colorPart = label.tubeColor ?? ''
      return [namePart, agePart, colorPart].filter(Boolean).join(' | ')
    }

    const renderLabel = (label: SamplePrintPayload) => {
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      JsBarcode(tempSvg, label.barcodeId, {
        format: 'CODE128',
        width: 1.5,
        height: 35,
        displayValue: true,
        fontSize: 9,
        font: 'monospace',
        textMargin: 1,
        margin: 2,
      })
      return `
        <div class="label" style="break-after: page;">
          ${tempSvg.outerHTML}
          <div class="sub-id-text">${subIdLine(label)}</div>
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
    .sub-id-text { font-size: 7pt; font-weight: bold; font-family: monospace; text-align: center; letter-spacing: 0.04em; margin-top: 1px; }
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
                    <p className="text-xs font-mono text-slate-400">{label.barcodeId}</p>
                    <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                      {[
                        label.patientName.slice(0, 7).toUpperCase(),
                        patientAge !== null ? String(patientAge) : '',
                        label.tubeColor ?? '',
                      ].filter(Boolean).join(' | ')}
                    </p>
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
