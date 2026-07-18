import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { format } from 'date-fns'
import { ArrowLeft, Plus, Trash2, Save, Printer } from 'lucide-react'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  createInvoice,
  updateInvoice,
  getInvoiceById,
  getNextInvoiceNumber,
  getClinicSettings,
  getAllTests,
} from '../../lib/firestore'
import { buildInvoiceHtml, invoiceTotals, lineItemAmount } from '../../lib/invoiceHtml'
import type { InvoiceDraft } from '../../lib/invoiceHtml'
import { DEFAULT_CLINIC_SETTINGS } from '../../types'
import type { ClinicSettings, Invoice, InvoiceLineItem, Test } from '../../types'

interface InvoiceFormData {
  date: string
  billToName: string
  billToContact: string
  receivedAmount: number
  lineItems: InvoiceLineItem[]
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1'

const BLANK_LINE_ITEM: InvoiceLineItem = {
  itemName: '',
  hsnSac: '',
  quantity: 1,
  pricePerUnit: 0,
  discountPercent: 0,
}

function defaultFormValues(): InvoiceFormData {
  return {
    date: format(new Date(), 'yyyy-MM-dd'),
    billToName: '',
    billToContact: '',
    receivedAmount: 0,
    lineItems: [BLANK_LINE_ITEM],
  }
}

function formValuesFromInvoice(invoice: Invoice): InvoiceFormData {
  return {
    date: invoice.date,
    billToName: invoice.billToName,
    billToContact: invoice.billToContact ?? '',
    receivedAmount: invoice.receivedAmount,
    lineItems: invoice.lineItems,
  }
}

export default function AdminInvoiceEditorPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const isNew = invoiceId === 'new'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clinic, setClinic] = useState<ClinicSettings>(DEFAULT_CLINIC_SETTINGS)
  const [invoiceNumber, setInvoiceNumber] = useState<number | null>(null)
  const [invoiceDbId, setInvoiceDbId] = useState<string | null>(isNew ? null : invoiceId ?? null)
  const [tests, setTests] = useState<Test[]>([])

  const { register, control, handleSubmit, reset } = useForm<InvoiceFormData>({
    defaultValues: defaultFormValues(),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const formValues = useWatch({ control })

  useEffect(() => {
    async function load() {
      const [clinicSettings, allTests] = await Promise.all([getClinicSettings(), getAllTests()])
      setClinic(clinicSettings)
      setTests(allTests)

      if (isNew) {
        const nextNumber = await getNextInvoiceNumber()
        setInvoiceNumber(nextNumber)
      } else if (invoiceId) {
        const invoice = await getInvoiceById(invoiceId)
        if (invoice) {
          setInvoiceNumber(invoice.invoiceNumber)
          setInvoiceDbId(invoice.id)
          reset(formValuesFromInvoice(invoice))
        }
      }
      setLoading(false)
    }
    load()
  }, [invoiceId, isNew, reset])

  const draftInvoice: InvoiceDraft = {
    id: invoiceDbId ?? '',
    invoiceNumber: invoiceNumber ?? 0,
    date: formValues.date || format(new Date(), 'yyyy-MM-dd'),
    billToName: formValues.billToName || '',
    billToContact: formValues.billToContact || undefined,
    receivedAmount: Number(formValues.receivedAmount) || 0,
    lineItems: (formValues.lineItems ?? []).map((item) => ({
      itemName: item?.itemName ?? '',
      hsnSac: item?.hsnSac ?? '',
      quantity: Number(item?.quantity) || 0,
      pricePerUnit: Number(item?.pricePerUnit) || 0,
      discountPercent: Number(item?.discountPercent) || 0,
    })),
  }

  const { totalAmount, totalDiscount, balance } = invoiceTotals(draftInvoice)
  const previewHtml = buildInvoiceHtml(draftInvoice, clinic)

  async function onSubmit(data: InvoiceFormData) {
    if (invoiceNumber === null) return
    setSaving(true)
    try {
      const payload = {
        invoiceNumber,
        date: data.date,
        billToName: data.billToName,
        billToContact: data.billToContact || undefined,
        receivedAmount: Number(data.receivedAmount) || 0,
        lineItems: data.lineItems.map((item) => ({
          itemName: item.itemName,
          hsnSac: item.hsnSac || undefined,
          quantity: Number(item.quantity) || 0,
          pricePerUnit: Number(item.pricePerUnit) || 0,
          discountPercent: Number(item.discountPercent) || 0,
        })),
      }
      if (invoiceDbId) {
        await updateInvoice(invoiceDbId, payload)
      } else {
        const newId = await createInvoice(payload)
        setInvoiceDbId(newId)
      }
      navigate('/admin/invoices')
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    const printHtml = buildInvoiceHtml(draftInvoice, clinic, { autoPrint: true })
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo />
          <button
            onClick={() => navigate('/admin/invoices')}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Invoices
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {invoiceDbId ? `Edit Invoice #${invoiceNumber}` : `New Invoice #${invoiceNumber ?? ''}`}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Fill in the bill-to details and line items — the preview on the right updates live.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print / PDF
            </Button>
            <Button size="sm" loading={saving} onClick={handleSubmit(onSubmit)}>
              <Save className="h-4 w-4 mr-1" /> Save Invoice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Card>
              <CardContent className="py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Bill To (Name)</label>
                    <input
                      {...register('billToName', { required: true })}
                      placeholder="e.g. St Joseph english hr sec school"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Contact No.</label>
                    <input {...register('billToContact')} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Invoice Date</label>
                    <input type="date" {...register('date', { required: true })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Received Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('receivedAmount', { valueAsNumber: true, min: 0 })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-5">
                <div className="flex items-center justify-between mb-3">
                  <label className={labelClass}>Line Items</label>
                  <div className="flex items-center gap-3">
                    {tests.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const test = tests.find((t) => t.id === e.target.value)
                          if (test) {
                            append({
                              itemName: test.name,
                              hsnSac: '',
                              quantity: 1,
                              pricePerUnit: test.cost ?? 0,
                              discountPercent: 0,
                            })
                          }
                          e.target.value = ''
                        }}
                        className="text-xs rounded-lg border border-slate-200 px-2 py-1 text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="" disabled>
                          + Add from Test
                        </option>
                        {tests.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} — ₹{t.cost ?? 0}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => append(BLANK_LINE_ITEM)}
                      className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Item
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {fields.map((field, i) => {
                    const item = formValues.lineItems?.[i]
                    const { amount } = lineItemAmount({
                      itemName: item?.itemName ?? '',
                      hsnSac: item?.hsnSac ?? '',
                      quantity: Number(item?.quantity) || 0,
                      pricePerUnit: Number(item?.pricePerUnit) || 0,
                      discountPercent: Number(item?.discountPercent) || 0,
                    })
                    return (
                      <div key={field.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            {...register(`lineItems.${i}.itemName`, { required: true })}
                            placeholder="Item name, e.g. Thyroid profile"
                            className={`${inputClass} flex-1`}
                          />
                          <input
                            {...register(`lineItems.${i}.hsnSac`)}
                            placeholder="HSN/SAC"
                            className={`${inputClass} w-24`}
                          />
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            disabled={fields.length === 1}
                            className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2 items-end">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
                            <input
                              type="number"
                              {...register(`lineItems.${i}.quantity`, { valueAsNumber: true, min: 0 })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Price/Unit (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              {...register(`lineItems.${i}.pricePerUnit`, { valueAsNumber: true, min: 0 })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Discount (%)</label>
                            <input
                              type="number"
                              {...register(`lineItems.${i}.discountPercent`, { valueAsNumber: true, min: 0, max: 100 })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Amount</label>
                            <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-700">
                              ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>You Saved (total discount)</span>
                    <span>₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Total</span>
                    <span>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Balance</span>
                    <span>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>

          {/* Live preview */}
          <div>
            <p className={labelClass}>Live Preview</p>
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              <iframe srcDoc={previewHtml} title="Invoice preview" className="w-full h-[900px]" />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
