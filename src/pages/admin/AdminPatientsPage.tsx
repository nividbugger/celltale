import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Users, Search, UserPlus, Pencil, Eye, Trash2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { PatientBarcodePrintModal } from '../../components/admin/PatientBarcodePrintModal'
import { PatientDetailModal } from '../../components/admin/PatientDetailModal'
import { useAuth } from '../../contexts/AuthContext'
import { getAllPatients } from '../../lib/firestore'
import { registerPatient, updatePatient, deletePatient } from '../../lib/api'
import type { User } from '../../types'
import { format } from 'date-fns'

interface PatientFormData {
  name: string
  phone: string
  email: string
  company: string
  age: string
  gender: string
  additionalInfo: string
}

function PatientForm({
  patient,
  companyOptions,
  onSave,
  onCancel,
}: {
  patient: User | null
  companyOptions: string[]
  onSave: (p: User) => void
  onCancel: () => void
}) {
  const isNew = patient === null
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    defaultValues: patient
      ? {
          name: patient.name,
          phone: patient.phone,
          email: patient.email ?? '',
          company: patient.company ?? '',
          age: patient.age ? String(patient.age) : '',
          gender: patient.gender ?? '',
          additionalInfo: patient.additionalInfo ?? '',
        }
      : { name: '', phone: '', email: '', company: '', age: '', gender: '', additionalInfo: '' },
  })

  async function onSubmit(data: PatientFormData) {
    setServerError('')
    try {
      const payload = {
        name: data.name.trim(),
        phone: data.phone,
        email: data.email.trim() || undefined,
        company: data.company.trim() || undefined,
        age: data.age ? parseInt(data.age, 10) : undefined,
        gender: data.gender.trim() || undefined,
        additionalInfo: data.additionalInfo.trim() || undefined,
      }
      const record = isNew
        ? await registerPatient(payload)
        : await updatePatient(patient.uid, payload)
      onSave({
        uid: record.uid,
        name: record.name,
        phone: record.phone,
        email: record.email,
        company: record.company,
        age: record.age,
        gender: record.gender,
        additionalInfo: record.additionalInfo,
        role: 'patient',
        createdAt: patient?.createdAt as User['createdAt'],
      })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {serverError}
        </div>
      )}

      <Input
        label="Full Name"
        placeholder="Ravi Kumar"
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />
      <Input
        label="Phone Number"
        type="tel"
        placeholder="9876543210"
        helperText="Indian mobile number (10 digits) — used for phone/OTP login"
        error={errors.phone?.message}
        {...register('phone', {
          required: 'Phone number is required',
          pattern: {
            value: /^[6-9]\d{9}$/,
            message: 'Enter a valid 10-digit Indian mobile number',
          },
        })}
      />
      <Input
        label="Email (optional)"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email', {
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
        })}
      />
      <div>
        <Input
          label="Company / Organization (optional)"
          list="company-options"
          placeholder="e.g. St Joseph English Hr Sec School"
          {...register('company')}
        />
        <datalist id="company-options">
          {companyOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <Input
        label="Age (optional)"
        type="number"
        placeholder="25"
        error={errors.age?.message}
        {...register('age', {
          pattern: { value: /^\d+$/, message: 'Age must be a valid number' },
        })}
      />
      <Input
        label="Gender (optional)"
        placeholder="e.g. Male, Female, Other"
        {...register('gender')}
      />
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">Additional Information (optional)</label>
        <textarea
          {...register('additionalInfo')}
          rows={3}
          placeholder="Any additional notes or information"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {isNew ? 'Register Patient' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

function DeletePatientModal({
  patient,
  onClose,
  onDeleted,
}: {
  patient: User
  onClose: () => void
  onDeleted: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const canDelete = confirmText.trim() === patient.name.trim()

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await deletePatient(patient.uid)
      onDeleted()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete patient')
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Delete Patient" size="sm">
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-2.5">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            This permanently deletes <span className="font-semibold">{patient.name}</span>'s login
            account and every appointment, sample, and report tied to them. This cannot be
            undone. If they come in again, they'll be registered as a brand-new patient with no
            history.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">
            Type <span className="font-bold">{patient.name}</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            autoFocus
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700"
            disabled={!canDelete}
            loading={deleting}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete Permanently
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function AdminPatientsPage() {
  const { logOut } = useAuth()
  const [patients, setPatients] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editPatient, setEditPatient] = useState<User | 'new' | null>(null)
  const [showQRCode, setShowQRCode] = useState<User | null>(null)
  const [viewPatient, setViewPatient] = useState<User | null>(null)
  const [deletePatientTarget, setDeletePatient] = useState<User | null>(null)

  useEffect(() => {
    getAllPatients()
      .then(setPatients)
      .finally(() => setLoading(false))
  }, [])

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      (p.company ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const companyOptions = Array.from(
    new Set(patients.map((p) => p.company).filter((c): c is string => !!c)),
  ).sort()

  async function handleLogout() {
    await logOut()
    window.location.href = '/'
  }

  function handleSaved(saved: User) {
    setPatients((prev) => {
      const exists = prev.find((p) => p.uid === saved.uid)
      return exists ? prev.map((p) => (p.uid === saved.uid ? saved : p)) : [saved, ...prev]
    })
    setEditPatient(null)
    setShowQRCode(saved)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo />
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="flex gap-3 mb-8 flex-wrap">
          {[
            { to: '/admin', label: 'Dashboard' },
            { to: '/admin/appointments', label: 'Appointments' },
            { to: '/admin/patients', label: 'Patients' },
            { to: '/admin/packages', label: 'Packages' },
            { to: '/admin/invoices', label: 'Invoices' },
            { to: '/admin/tests', label: 'Tests' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                l.to === '/admin/patients'
                  ? 'bg-teal-100 text-teal-700 border border-teal-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-500" /> Patients
            <span className="text-slate-400 text-lg font-normal ml-1">({patients.length})</span>
          </h1>
          <Button size="sm" onClick={() => setEditPatient('new')}>
            <UserPlus className="h-4 w-4 mr-1" /> Register Patient
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-5 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone or company..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {search ? 'No patients match your search' : 'No patients registered yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                  <th className="text-left px-6 py-3 font-semibold">Name</th>
                  <th className="text-left px-6 py-3 font-semibold hidden sm:table-cell">Email</th>
                  <th className="text-left px-6 py-3 font-semibold hidden md:table-cell">Phone</th>
                  <th className="text-left px-6 py-3 font-semibold hidden md:table-cell">Company</th>
                  <th className="text-left px-6 py-3 font-semibold hidden lg:table-cell">
                    Registered
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((patient) => (
                  <tr key={patient.uid} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{patient.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600 hidden sm:table-cell">
                      {patient.email || '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-600 hidden md:table-cell">
                      {patient.phone || '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-600 hidden md:table-cell">
                      {patient.company || '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-500 hidden lg:table-cell">
                      {patient.createdAt?.toDate
                        ? format(patient.createdAt.toDate(), 'dd MMM yyyy')
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setViewPatient(patient)} title="View details">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditPatient(patient)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletePatient(patient)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
                          title="Delete patient"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Footer />

      <Modal
        isOpen={editPatient !== null}
        onClose={() => setEditPatient(null)}
        title={editPatient === 'new' ? 'Register Patient' : `Edit: ${(editPatient as User)?.name}`}
        size="md"
      >
        {editPatient !== null && (
          <PatientForm
            patient={editPatient === 'new' ? null : (editPatient as User)}
            companyOptions={companyOptions}
            onSave={handleSaved}
            onCancel={() => setEditPatient(null)}
          />
        )}
      </Modal>

      {showQRCode && <PatientBarcodePrintModal isOpen={showQRCode !== null} onClose={() => setShowQRCode(null)} patient={showQRCode} />}

      {viewPatient && <PatientDetailModal isOpen={viewPatient !== null} onClose={() => setViewPatient(null)} patient={viewPatient} />}

      {deletePatientTarget && (
        <DeletePatientModal
          patient={deletePatientTarget}
          onClose={() => setDeletePatient(null)}
          onDeleted={() => {
            setPatients((prev) => prev.filter((p) => p.uid !== deletePatientTarget.uid))
            setDeletePatient(null)
          }}
        />
      )}
    </div>
  )
}
