import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

/**
 * Stamp a "scan to view online" QR code onto the top-right corner of the first
 * page of an uploaded PDF report, returning the modified PDF as a Blob.
 *
 * Used for uploaded (pre-made) PDFs where we can't use our HTML report template
 * — we draw the QR directly onto the existing PDF bytes so the printed copy
 * carries the same scannable link as a generated report.
 */
export async function stampQrOnPdf(file: File | Blob, reportUrl: string): Promise<Blob> {
  const bytes = await file.arrayBuffer()
  const pdf = await PDFDocument.load(bytes)

  const qrPngDataUrl = await QRCode.toDataURL(reportUrl, { margin: 1, width: 300 })
  const qrImage = await pdf.embedPng(qrPngDataUrl)
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const page = pdf.getPages()[0]
  const { width, height } = page.getSize()

  const qrSize = 64
  const margin = 20
  const x = width - qrSize - margin
  const y = height - qrSize - margin

  // White backing so the QR stays scannable over any page content.
  const pad = 4
  page.drawRectangle({
    x: x - pad,
    y: y - pad - 10,
    width: qrSize + pad * 2,
    height: qrSize + pad * 2 + 10,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.8, 0.82, 0.86),
    borderWidth: 0.5,
  })
  page.drawImage(qrImage, { x, y, width: qrSize, height: qrSize })

  const caption = 'Scan to view online'
  const captionSize = 5
  const captionWidth = font.widthOfTextAtSize(caption, captionSize)
  page.drawText(caption, {
    x: x + (qrSize - captionWidth) / 2,
    y: y - 8,
    size: captionSize,
    font,
    color: rgb(0.39, 0.45, 0.55),
  })

  const saved = await pdf.save()
  // Copy into a fresh ArrayBuffer so the Blob type matches BlobPart exactly.
  return new Blob([saved.slice()], { type: 'application/pdf' })
}
