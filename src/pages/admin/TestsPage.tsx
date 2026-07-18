import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { Beaker, Search, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { getAllTests, getAllPackages } from '../../lib/firestore'
import { createTest, updateTest, deleteTest } from '../../lib/api'
import type { Test, TestParameter, Package } from '../../types'
import { format } from 'date-fns'

interface TestFormData {
  name: string
  parameters: TestParameter[]
  cost: string
}

function TestForm({
  test,
  onSave,
  onCancel,
}: {
  test: Test | null
  onSave: (t: Test) => void
  onCancel: () => void
}) {
  const isNew = test === null
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TestFormData>({
    defaultValues: test
      ? {
          name: test.name,
          parameters: test.parameters,
          cost: test.cost != null ? String(test.cost) : '',
        }
      : { name: '', parameters: [], cost: '' },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameters',
  })

  async function onSubmit(data: TestFormData) {
    setServerError('')
    try {
      if (data.parameters.length === 0) {
        setServerError('At least one parameter is required')
        return
      }

      let cost: number | undefined
      if (data.cost.trim() !== '') {
        cost = Number(data.cost)
        if (!Number.isFinite(cost) || cost < 0) {
          setServerError('Cost must be a non-negative number')
          return
        }
      }

      if (isNew) {
        const result = await createTest({
          name: data.name.trim(),
          parameters: data.parameters,
          cost,
        })
        const now = new Date()
        onSave({
          id: result.id,
          testId: result.testId,
          name: result.name,
          parameters: result.parameters,
          cost: result.cost,
          createdAt: { toDate: () => now } as any,
          updatedAt: { toDate: () => now } as any,
        })
      } else {
        const result = await updateTest(test.id, {
          name: data.name.trim(),
          parameters: data.parameters,
          cost,
        })
        const now = new Date()
        onSave({
          id: result.id,
          testId: result.testId,
          name: result.name,
          parameters: result.parameters,
          cost: result.cost,
          createdAt: test.createdAt,
          updatedAt: { toDate: () => now } as any,
        })
      }
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
        label="Test Name"
        placeholder="e.g. Blood Test"
        error={errors.name?.message}
        {...register('name', { required: 'Test name is required' })}
      />

      <Input
        label="Cost (₹) — optional"
        placeholder="e.g. 500"
        type="number"
        step="0.01"
        {...register('cost')}
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700">Parameters</label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ parameter: '', unit: '', biologicalReference: '' })}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Parameter
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">No parameters added yet. Click "Add Parameter" to configure test parameters.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-end p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Parameter Name</label>
                  <input
                    {...register(`parameters.${index}.parameter`, { required: 'Parameter name is required' })}
                    placeholder="e.g. hemoglobin"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Unit</label>
                  <input
                    {...register(`parameters.${index}.unit`, { required: 'Unit is required' })}
                    placeholder="e.g. g/dL"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Biological Reference</label>
                  <input
                    {...register(`parameters.${index}.biologicalReference`, { required: 'Reference is required' })}
                    placeholder="e.g. 12-16"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {isNew ? 'Create Test' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

export default function TestsPage() {
  const { logOut } = useAuth()
  const [tests, setTests] = useState<Test[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editTest, setEditTest] = useState<Test | 'new' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Test | null>(null)

  useEffect(() => {
    Promise.all([getAllTests(), getAllPackages()])
      .then(([t, p]) => {
        setTests(t)
        setPackages(p)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = tests.filter(
    (t) =>
      t.testId.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleLogout() {
    await logOut()
    window.location.href = '/'
  }

  function handleSaved(saved: Test) {
    setTests((prev) => {
      const exists = prev.find((t) => t.id === saved.id)
      return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]
    })
    setEditTest(null)
  }

  async function handleDelete(test: Test) {
    try {
      await deleteTest(test.id)
      setTests((prev) => prev.filter((t) => t.id !== test.id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete test:', err)
    }
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
                l.to === '/admin/tests'
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
            <Beaker className="h-6 w-6 text-teal-500" /> Tests
            <span className="text-slate-400 text-lg font-normal ml-1">({tests.length})</span>
          </h1>
          <Button size="sm" onClick={() => setEditTest('new')}>
            <Plus className="h-4 w-4 mr-1" /> Create Test
          </Button>
        </div>

        <div className="relative mb-5 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by test ID or name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Beaker className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {search ? 'No tests match your search' : 'No tests created yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                  <th className="text-left px-6 py-3 font-semibold">Test ID</th>
                  <th className="text-left px-6 py-3 font-semibold">Name</th>
                  <th className="text-left px-6 py-3 font-semibold">Parameters</th>
                  <th className="text-left px-6 py-3 font-semibold">Cost</th>
                  <th className="text-left px-6 py-3 font-semibold hidden lg:table-cell">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((test) => (
                  <tr key={test.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-teal-600 font-semibold">{test.testId}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">{test.name}</td>
                    <td className="px-6 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        {test.parameters.map((p, i) => (
                          <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">
                            {p.parameter} <span className="text-slate-500">({p.unit})</span>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {test.cost != null ? `₹${test.cost.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-500 hidden lg:table-cell">
                      {test.createdAt?.toDate
                        ? format(test.createdAt.toDate(), 'dd MMM yyyy')
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditTest(test)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteConfirm(test)}
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
        isOpen={editTest !== null}
        onClose={() => setEditTest(null)}
        title={editTest === 'new' ? 'Create Test' : `Edit: ${(editTest as Test)?.name}`}
        size="md"
      >
        {editTest !== null && (
          <TestForm
            test={editTest === 'new' ? null : (editTest as Test)}
            onSave={handleSaved}
            onCancel={() => setEditTest(null)}
          />
        )}
      </Modal>

      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Test"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-slate-600">
              Are you sure you want to delete the test <span className="font-semibold">{deleteConfirm.name}</span>?
            </p>
            {(() => {
              const usedIn = packages.filter((p) => (p.testIds ?? []).includes(deleteConfirm.id))
              return usedIn.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
                  Used in: {usedIn.map((p) => p.name).join(', ')} — deleting will not remove it
                  from those packages automatically.
                </div>
              ) : null
            })()}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
