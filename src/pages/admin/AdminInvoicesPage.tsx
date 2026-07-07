import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Plus, Pencil, Trash2, Printer, Settings2, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ClinicSettingsModal } from '../../components/admin/ClinicSettingsModal'
import { useAuth } from '../../contexts/AuthContext'
import { getAllInvoices, getClinicSettings, deleteInvoice } from '../../lib/firestore'
import { buildInvoiceHtml, invoiceTotals } from '../../lib/invoiceHtml'
import { DEFAULT_CLINIC_SETTINGS } from '../../types'
import type { ClinicSettings, Invoice } from '../../types'

export default function AdminInvoicesPage() {
  const { logOut } = useAuth()
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clinic, setClinic] = useState<ClinicSettings>(DEFAULT_CLINIC_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Invoice | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    const [invs, clinicSettings] = await Promise.all([getAllInvoices(), getClinicSettings()])
    setInvoices(invs)
    setClinic(clinicSettings)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleLogout() {
    await logOut()
    navigate('/')
  }

  function handlePrint(invoice: Invoice) {
    const html = buildInvoiceHtml(invoice, clinic)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await deleteInvoice(deleteConfirm.id)
      setInvoices((prev) => prev.filter((i) => i.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo />
          <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-700">
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Admin nav */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {[
            { to: '/admin', label: 'Dashboard' },
            { to: '/admin/appointments', label: 'Appointments' },
            { to: '/admin/patients', label: 'Patients' },
            { to: '/admin/packages', label: 'Packages' },
            { to: '/admin/invoices', label: 'Invoices' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-2 bg-white border rounded-full text-sm font-medium transition-colors ${
                l.to === '/admin/invoices'
                  ? 'border-teal-400 text-teal-600'
                  : 'border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="h-6 w-6 text-teal-600" /> Invoices
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Generate tax invoices for schools, camps, and other bulk clients.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Business Details
            </Button>
            <Button size="sm" onClick={() => navigate('/admin/invoices/new')}>
              <Plus className="h-4 w-4 mr-1" /> New Invoice
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : invoices.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No invoices yet</p>
              <p className="text-slate-400 text-sm mt-1 mb-4">
                Create your first invoice to bill a school, camp, or corporate client.
              </p>
              <Button size="sm" onClick={() => navigate('/admin/invoices/new')}>
                <Plus className="h-4 w-4 mr-1" /> New Invoice
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const { totalAmount } = invoiceTotals(invoice)
              return (
                <Card key={invoice.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900">
                            Invoice #{invoice.invoiceNumber}
                          </p>
                          <span className="text-slate-400 text-xs">
                            {format(new Date(invoice.date), 'dd MMM yyyy')}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-0.5">{invoice.billToName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900">
                          ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-slate-400 text-xs">{invoice.lineItems.length} items</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handlePrint(invoice)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/invoices/${invoice.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(invoice)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Footer />

      <ClinicSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        clinic={clinic}
        onSaved={setClinic}
      />

      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Invoice"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">
              Are you sure you want to delete{' '}
              <span className="font-bold text-slate-900">Invoice #{deleteConfirm.invoiceNumber}</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" loading={deleting} onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
