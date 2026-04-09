import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { assignBarcodeId, getUserDocument } from '../../lib/firestore'
import type { Appointment } from '../../types'
import { format, differenceInYears } from 'date-fns'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointment: Appointment
}

export function BarcodePrintModal({ isOpen, onClose, appointment }: Props) {
  const [barcodeId, setBarcodeId] = useState<string | null>(appointment.barcodeId ?? null)
  const [patientAge, setPatientAge] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [labelCount, setLabelCount] = useState(4)
  const svgRef = useRef<SVGSVGElement>(null)

  const shortName = appointment.patientName.slice(0, 5).toUpperCase()
  const labelName = patientAge !== null ? `${shortName} (${patientAge})` : shortName

  useEffect(() => {
    if (!isOpen) return
    // Fetch patient DOB for age calculation
    getUserDocument(appointment.patientId).then((user) => {
      if (user?.dob) {
        setPatientAge(differenceInYears(new Date(), new Date(user.dob)))
      }
    })
    if (barcodeId) return
    setLoading(true)
    assignBarcodeId(appointment.id)
      .then((id) => setBarcodeId(id))
      .finally(() => setLoading(false))
  }, [isOpen, appointment.id, appointment.patientId, barcodeId])

  useEffect(() => {
    if (!isOpen || !barcodeId || !svgRef.current) return
    JsBarcode(svgRef.current, barcodeId, {
      format: 'CODE128',
      width: 1.5,
      height: 40,
      displayValue: true,
      fontSize: 12,
      font: 'monospace',
      textMargin: 2,
      margin: 4,
    })
  }, [isOpen, barcodeId])

  const formattedDate = format(new Date(appointment.date), 'dd MMM yyyy')

  function handlePrint() {
    if (!barcodeId) return

    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(tempSvg, barcodeId, {
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
        <div class="date-text">${formattedDate} &middot; ${appointment.timeSlot}</div>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Barcode Labels - ${labelName}</title>
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
    <Modal isOpen={isOpen} onClose={onClose} title="Print Barcode Labels">
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Generating barcode ID...</div>
        ) : barcodeId ? (
          <>
            <div className="text-sm text-slate-600 space-y-1">
              <p><span className="text-slate-400">Patient:</span> <span className="font-medium text-slate-900">{appointment.patientName}</span></p>
              <p><span className="text-slate-400">Package:</span> {appointment.packageName}</p>
              <p><span className="text-slate-400">Date:</span> {formattedDate} &middot; {appointment.timeSlot}</p>
              <p><span className="text-slate-400">Barcode ID:</span> <span className="font-mono font-semibold text-slate-900">{barcodeId}</span></p>
            </div>

            <div className="flex justify-center p-4 bg-white border border-slate-200 rounded-xl">
              <svg ref={svgRef} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Number of Labels</label>
              <select
                value={labelCount}
                onChange={(e) => setLabelCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} label{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> Print Labels
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-red-500 text-sm">Failed to generate barcode ID.</div>
        )}
      </div>
    </Modal>
  )
}
