import QRCode from 'qrcode'
import type { ClinicSettings, TestValue } from '../types'
import logoUrl from '../assets/logo.png'

export interface ReportPrintData {
  patientName: string
  packageName: string
  date: string
  testValues: TestValue[]
  summary?: string
  /** Absolute URL that opens this exact report online. When provided, it is
   *  rendered as a scannable QR code on the report. */
  reportUrl?: string
}

function groupByCategory(values: TestValue[]): Record<string, TestValue[]> {
  return values.reduce<Record<string, TestValue[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = []
    acc[v.category].push(v)
    return acc
  }, {})
}

export async function buildReportHtml(
  data: ReportPrintData,
  clinic: ClinicSettings,
  options?: { autoPrint?: boolean },
): Promise<string> {
  const grouped = groupByCategory(data.testValues)

  // Render the "scan to open this report" QR as an inline PNG data URI so it
  // survives printing / saving to PDF without any external request.
  const qrDataUrl = data.reportUrl
    ? await QRCode.toDataURL(data.reportUrl, { margin: 1, width: 240 })
    : ''

  const sections = Object.entries(grouped)
    .map(
      ([category, values]) => `
        <h3 class="category">${category}</h3>
        <table class="items">
          <thead>
            <tr>
              <th>Test</th>
              <th class="num">Result</th>
              <th>Unit</th>
              <th>Normal Range</th>
            </tr>
          </thead>
          <tbody>
            ${values
              .map(
                (v) => `
              <tr class="${v.isAbnormal ? 'abnormal' : ''}">
                <td>${v.name}</td>
                <td class="num">${v.value}</td>
                <td>${v.unit}</td>
                <td>${v.normalRange}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `,
    )
    .join('')

  const addressLines = clinic.addressLines.join('<br/>')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Report — ${data.patientName}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #1e293b;
    font-size: 12px;
    margin: 0;
  }
  h1.title {
    text-align: center;
    font-size: 22px;
    font-weight: 800;
    margin: 0 0 12px 0;
  }
  .box { border: 1px solid #334155; }
  .header-box {
    display: flex;
    align-items: flex-start;
    padding: 10px 14px;
    gap: 16px;
  }
  .header-box img.logo { height: 60px; }
  .qr-page {
    page-break-before: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 80vh;
    padding: 24px;
  }
  .qr-page h2 {
    font-size: 20px;
    font-weight: 800;
    margin: 0 0 8px 0;
  }
  .qr-page .qr-sub {
    font-size: 12px;
    color: #475569;
    max-width: 360px;
    line-height: 1.6;
    margin: 0 0 24px 0;
  }
  .qr-page .qr-frame {
    border: 1px solid #334155;
    padding: 16px;
    border-radius: 8px;
  }
  .qr-page .qr-frame img { width: 220px; height: 220px; display: block; }
  .qr-page .qr-url {
    font-size: 10px;
    color: #64748b;
    margin-top: 16px;
    word-break: break-all;
    max-width: 360px;
  }
  .clinic-name { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
  .clinic-meta { font-size: 11px; line-height: 1.5; }
  .clinic-meta-grid {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 11px;
  }
  .bill-row { display: flex; border-top: 1px solid #334155; }
  .bill-cell { flex: 1; padding: 8px 14px; font-size: 11px; }
  .bill-cell + .bill-cell { border-left: 1px solid #334155; }
  .bill-cell .label { font-weight: 700; margin-bottom: 4px; }
  .bill-cell .value { font-weight: 700; }
  h3.category {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #475569;
    margin: 16px 0 6px 0;
  }
  table.items { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.items th, table.items td {
    border: 1px solid #334155;
    padding: 6px 8px;
    text-align: left;
  }
  table.items th { background: #f1f5f9; font-weight: 700; }
  table.items td.num, table.items th.num { text-align: right; }
  tr.abnormal td { color: #b91c1c; font-weight: 700; }
  .summary-box {
    margin-top: 16px;
    border: 1px solid #334155;
    padding: 10px 14px;
    font-size: 11px;
  }
  .summary-box .label { font-weight: 700; margin-bottom: 4px; }
  .signatory {
    width: 260px;
    margin-left: auto;
    margin-top: 24px;
    border: 1px solid #334155;
    text-align: center;
  }
  .signatory .for-label {
    border-bottom: 1px solid #334155;
    padding: 6px 10px;
    text-align: left;
    font-weight: 700;
  }
  .signatory .sign-space { height: 50px; }
  .signatory .sig-label { padding: 6px 10px; font-size: 11px; }
</style>
</head>
<body>
  <h1 class="title">Test Report</h1>

  <div class="box">
    <div class="header-box">
      <img class="logo" src="${clinic.logoUrl ?? logoUrl}" alt="${clinic.name}" />
      <div style="flex:1;">
        <p class="clinic-name">${clinic.name}</p>
        <div class="clinic-meta">${addressLines}</div>
        <div class="clinic-meta-grid">
          <div>Phone: <strong>${clinic.phone}</strong></div>
          <div>Email: <strong>${clinic.email}</strong></div>
        </div>
      </div>
    </div>

    <div class="bill-row">
      <div class="bill-cell">
        <div class="label">Patient:</div>
        <div class="value">${data.patientName}</div>
      </div>
      <div class="bill-cell">
        <div class="label">Report Details:</div>
        <div>Package: <strong>${data.packageName}</strong></div>
        <div>Date: <strong>${data.date}</strong></div>
      </div>
    </div>
  </div>

  ${sections}

  ${
    data.summary
      ? `<div class="summary-box"><div class="label">Summary</div><div>${data.summary}</div></div>`
      : ''
  }

  <div class="signatory">
    <div class="for-label">For ${clinic.name}:</div>
    <div class="sign-space"></div>
    <div class="sig-label">Authorized Signatory</div>
  </div>

  ${
    qrDataUrl
      ? `<div class="qr-page">
    <h2>View this report online</h2>
    <p class="qr-sub">
      Scan the QR code below with your phone camera to open a digital copy of this
      report. No login is required &mdash; the link is unique to this report.
    </p>
    <div class="qr-frame">
      <img src="${qrDataUrl}" alt="Scan to view this report online" />
    </div>
    ${data.reportUrl ? `<div class="qr-url">${data.reportUrl}</div>` : ''}
  </div>`
      : ''
  }
  ${
    options?.autoPrint
      ? `<script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>`
      : ''
  }
</body>
</html>`
}
