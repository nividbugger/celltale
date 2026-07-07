import type { ClinicSettings, Invoice, InvoiceLineItem } from '../types'
import { amountInWordsINR } from './numberToWords'
import logoUrl from '../assets/logo.png'

// Only the fields an invoice document/template actually needs — lets callers
// (e.g. a live editor preview) build one without fabricating server timestamps.
export type InvoiceDraft = Pick<
  Invoice,
  'id' | 'invoiceNumber' | 'date' | 'billToName' | 'billToContact' | 'lineItems' | 'receivedAmount'
>

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function lineItemAmount(item: InvoiceLineItem): {
  rawAmount: number
  discountAmount: number
  amount: number
} {
  const rawAmount = item.quantity * item.pricePerUnit
  const discountAmount = rawAmount * (item.discountPercent / 100)
  return { rawAmount, discountAmount, amount: rawAmount - discountAmount }
}

export function invoiceTotals(invoice: InvoiceDraft) {
  let totalQuantity = 0
  let totalDiscount = 0
  let totalAmount = 0
  for (const item of invoice.lineItems) {
    const { discountAmount, amount } = lineItemAmount(item)
    totalQuantity += item.quantity
    totalDiscount += discountAmount
    totalAmount += amount
  }
  const balance = totalAmount - invoice.receivedAmount
  return { totalQuantity, totalDiscount, totalAmount, balance }
}

export function buildInvoiceHtml(invoice: InvoiceDraft, clinic: ClinicSettings): string {
  const { totalQuantity, totalDiscount, totalAmount, balance } = invoiceTotals(invoice)

  const rows = invoice.lineItems
    .map((item, i) => {
      const { discountAmount, amount } = lineItemAmount(item)
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${item.itemName}</td>
          <td>${item.hsnSac ?? ''}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">₹ ${formatCurrency(item.pricePerUnit)}</td>
          <td class="num">₹ ${formatCurrency(discountAmount)} (${item.discountPercent}%)</td>
          <td class="num">₹ ${formatCurrency(amount)}</td>
        </tr>
      `
    })
    .join('')

  const addressLines = clinic.addressLines.join('<br/>')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${invoice.invoiceNumber}</title>
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
  table.layout {
    width: 100%;
    border-collapse: collapse;
  }
  .box {
    border: 1px solid #334155;
  }
  .header-box {
    display: flex;
    align-items: flex-start;
    padding: 10px 14px;
    gap: 16px;
  }
  .header-box img.logo { height: 60px; }
  .clinic-name {
    font-size: 22px;
    font-weight: 800;
    margin: 0 0 6px 0;
  }
  .clinic-meta { font-size: 11px; line-height: 1.5; }
  .clinic-meta-grid {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 11px;
  }
  .bill-row {
    display: flex;
    border-top: 1px solid #334155;
  }
  .bill-cell {
    flex: 1;
    padding: 8px 14px;
    font-size: 11px;
  }
  .bill-cell + .bill-cell { border-left: 1px solid #334155; }
  .bill-cell .label { font-weight: 700; margin-bottom: 4px; }
  .bill-cell .value { font-weight: 700; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 11px;
  }
  table.items th, table.items td {
    border: 1px solid #334155;
    padding: 6px 8px;
    text-align: left;
  }
  table.items th {
    background: #f1f5f9;
    font-weight: 700;
  }
  table.items td.num, table.items th.num { text-align: right; }
  tr.total-row td { font-weight: 700; background: #f8fafc; }
  table.summary {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-top: -1px;
  }
  table.summary td {
    border: 1px solid #334155;
    padding: 6px 10px;
  }
  table.summary td.label { font-weight: 700; width: 70%; }
  table.summary td.value { text-align: right; font-weight: 700; }
  .words-row td { font-weight: 400; }
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
  <h1 class="title">Tax Invoice</h1>

  <div class="box">
    <div class="header-box">
      <img class="logo" src="${clinic.logoUrl ?? logoUrl}" alt="${clinic.name}" />
      <div style="flex:1;">
        <p class="clinic-name">${clinic.name}</p>
        <div class="clinic-meta">
          ${clinic.bankName ? `Current account details:<br/>Bank Name - ${clinic.bankName}<br/>Acc number - ${clinic.bankAccountNumber}<br/>IFSC - ${clinic.bankIfsc}<br/>` : ''}
          ${addressLines}
        </div>
        <div class="clinic-meta-grid">
          <div>Phone: <strong>${clinic.phone}</strong></div>
          <div>Email: <strong>${clinic.email}</strong></div>
        </div>
        <div class="clinic-meta-grid">
          <div>GSTIN: <strong>${clinic.gstin}</strong></div>
          <div>State: <strong>${clinic.state}</strong></div>
        </div>
      </div>
    </div>

    <div class="bill-row">
      <div class="bill-cell">
        <div class="label">Bill To:</div>
        <div class="value">${invoice.billToName}</div>
        ${invoice.billToContact ? `<div>Contact No: <strong>${invoice.billToContact}</strong></div>` : ''}
      </div>
      <div class="bill-cell">
        <div class="label">Invoice Details:</div>
        <div>Invoice No.: <strong>${invoice.invoiceNumber}</strong></div>
        <div>Date: <strong>${formatDate(invoice.date)}</strong></div>
      </div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>#</th>
        <th>Item name</th>
        <th>HSN/ SAC</th>
        <th class="num">Quantity</th>
        <th class="num">Price/ Unit(₹)</th>
        <th class="num">Discount(₹)</th>
        <th class="num">Amount(₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3">Total</td>
        <td class="num">${totalQuantity}</td>
        <td class="num"></td>
        <td class="num">₹ ${formatCurrency(totalDiscount)}</td>
        <td class="num">₹ ${formatCurrency(totalAmount)}</td>
      </tr>
    </tbody>
  </table>

  <table class="summary">
    <tr>
      <td class="label">Sub Total</td>
      <td class="value">₹ ${formatCurrency(totalAmount)}</td>
    </tr>
    <tr>
      <td class="label">Total</td>
      <td class="value">₹ ${formatCurrency(totalAmount)}</td>
    </tr>
    <tr class="words-row">
      <td colspan="2"><strong>Invoice Amount in Words:</strong><br/>${amountInWordsINR(totalAmount)}</td>
    </tr>
    <tr>
      <td class="label">Received</td>
      <td class="value">₹ ${formatCurrency(invoice.receivedAmount)}</td>
    </tr>
    <tr>
      <td class="label">Balance</td>
      <td class="value">₹ ${formatCurrency(balance)}</td>
    </tr>
    <tr>
      <td class="label">You Saved</td>
      <td class="value">₹ ${formatCurrency(totalDiscount)}</td>
    </tr>
  </table>

  <div class="signatory">
    <div class="for-label">For ${clinic.name}:</div>
    <div class="sign-space"></div>
    <div class="sig-label">Authorized Signatory</div>
  </div>
</body>
</html>`
}
