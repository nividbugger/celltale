import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

/**
 * Append a "scan to view this report online" page to the end of an uploaded PDF
 * report, returning the modified PDF as a Blob.
 *
 * Used for uploaded (pre-made) PDFs where we can't use our HTML report template.
 * We add a dedicated final page (rather than stamping over existing content) so
 * the printed copy carries the same scannable link as a generated report.
 */
export async function stampQrOnPdf(file: File | Blob, reportUrl: string): Promise<Blob> {
  const bytes = await file.arrayBuffer()
  const pdf = await PDFDocument.load(bytes)

  const qrPngDataUrl = await QRCode.toDataURL(reportUrl, { margin: 1, width: 400 })
  const qrImage = await pdf.embedPng(qrPngDataUrl)
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)

  // Match the size of the first page so the appended page looks consistent;
  // fall back to A4 if the document somehow has no pages.
  const firstPage = pdf.getPages()[0]
  const pageWidth = firstPage ? firstPage.getWidth() : 595.28
  const pageHeight = firstPage ? firstPage.getHeight() : 841.89
  const page = pdf.addPage([pageWidth, pageHeight])

  const center = pageWidth / 2
  const ink = rgb(0.12, 0.16, 0.23)
  const sub = rgb(0.28, 0.33, 0.41)
  const muted = rgb(0.39, 0.45, 0.55)

  function drawCentered(text: string, y: number, size: number, font = bodyFont, color = ink) {
    const w = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: center - w / 2, y, size, font, color })
  }

  // Title
  drawCentered('View this report online', pageHeight * 0.72, 22, titleFont, ink)

  // Subtitle (wrapped onto two lines)
  drawCentered(
    'Scan the QR code below with your phone camera to open a digital',
    pageHeight * 0.72 - 32,
    12,
    bodyFont,
    sub,
  )
  drawCentered(
    'copy of this report. No login is required.',
    pageHeight * 0.72 - 50,
    12,
    bodyFont,
    sub,
  )

  // QR with a thin bordered frame
  const qrSize = 220
  const framePad = 16
  const qrX = center - qrSize / 2
  const qrY = pageHeight * 0.32
  page.drawRectangle({
    x: qrX - framePad,
    y: qrY - framePad,
    width: qrSize + framePad * 2,
    height: qrSize + framePad * 2,
    borderColor: rgb(0.2, 0.25, 0.33),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  })
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  // Link text under the QR
  drawCentered(reportUrl, qrY - 36, 9, bodyFont, muted)

  const saved = await pdf.save()
  // Copy into a fresh ArrayBuffer so the Blob type matches BlobPart exactly.
  return new Blob([saved.slice()], { type: 'application/pdf' })
}
