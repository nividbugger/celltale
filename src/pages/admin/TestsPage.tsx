import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Beaker, Search, Plus, Pencil, Trash2, X, FlaskConical } from 'lucide-react'
import { TUBE_COLORS, PRIMARY_TUBE_COLORS, EXTRA_TUBE_COLORS } from '../../lib/tubeColors'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { getAllTests, getAllPackages, getAllParameters } from '../../lib/firestore'
import { createTest, updateTest, deleteTest, toggleTestActive } from '../../lib/api'
import type { Test, TestParameter, Package, DiagnosticParameter } from '../../types'
import { formatParameterRefRange } from '../../types'

const CATEGORY_COLORS: Record<string, string> = {
  Hematology:     'bg-red-50 text-red-700',
  Biochemistry:   'bg-yellow-50 text-yellow-700',
  Thyroid:        'bg-blue-50 text-blue-700',
  Vitamins:       'bg-green-50 text-green-700',
  Hormones:       'bg-purple-50 text-purple-700',
  Serology:       'bg-indigo-50 text-indigo-700',
  Cardiac:        'bg-rose-50 text-rose-700',
  Coagulation:    'bg-orange-50 text-orange-700',
  'Tumor Markers':'bg-slate-100 text-slate-700',
  Urine:          'bg-cyan-50 text-cyan-700',
  Stool:          'bg-amber-50 text-amber-700',
}

// ─── Parameter Picker Modal ───────────────────────────────────────────────────

function ParameterPickerModal({
  catalog,
  selectedIds,
  onSelect,
  onClose,
}: {
  catalog: DiagnosticParameter[]
  selectedIds: Set<string>
  onSelect: (param: DiagnosticParameter) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [filterDiscipline, setFilterDiscipline] = useState('')

  const disciplines = [...new Set(catalog.map((p) => p.discipline))].sort()

  const filtered = catalog.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    const matchDisc = !filterDiscipline || p.discipline === filterDiscipline
    return matchSearch && matchDisc
  })

  return (
    <div className="flex flex-col max-h-[70vh]">
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filterDiscipline}
          onChange={(e) => setFilterDiscipline(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        >
          <option value="">All</option>
          {disciplines.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="overflow-y-auto flex-1 rounded-xl border border-slate-100">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No parameters found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                <th className="text-left px-4 py-2.5 font-semibold">Code</th>
                <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold">Tube</th>
                <th className="text-left px-4 py-2.5 font-semibold">Unit</th>
                <th className="text-left px-4 py-2.5 font-semibold">Reference</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => {
                const tc = TUBE_COLORS.find((c) => c.name === p.tubeColor)
                const refRange = formatParameterRefRange(p)
                const alreadyAdded = selectedIds.has(p.id)
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 ${alreadyAdded ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-teal-600 font-semibold text-xs">
                      {p.code}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">{p.name}
                      {p.sex !== 'ALL' && (
                        <span className="ml-1 text-xs text-slate-400">({p.sex})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {tc ? (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${tc.badge}`}>
                          <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
                          {tc.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{p.tubeColor}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{p.unit}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[140px] truncate">{refRange}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => onSelect(p)}
                        className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${
                          alreadyAdded
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                        }`}
                      >
                        {alreadyAdded ? 'Added' : 'Add'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="pt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

// ─── Test Form ────────────────────────────────────────────────────────────────

interface TestFormData {
  name: string
  cost: string
  tubeColor: string
}

function TestForm({
  test,
  categories,
  catalog,
  onSave,
  onCancel,
}: {
  test: Test | null
  categories: string[]
  catalog: DiagnosticParameter[]
  onSave: (t: Test) => void
  onCancel: () => void
}) {
  const isNew = test === null
  const [serverError, setServerError] = useState('')
  const [isActive, setIsActive] = useState(test ? test.isActive !== false : true)
  const [selectedParams, setSelectedParams] = useState<TestParameter[]>(test?.parameters ?? [])
  const [pickerOpen, setPickerOpen] = useState(false)

  const existingCategory = test?.category ?? ''
  const isCustom = existingCategory !== '' && !categories.includes(existingCategory)
  const [categoryMode, setCategoryMode] = useState<'select' | 'custom'>(isCustom ? 'custom' : 'select')
  const [selectedCategory, setSelectedCategory] = useState(isCustom ? '' : existingCategory)
  const [customCategory, setCustomCategory] = useState(isCustom ? existingCategory : '')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TestFormData>({
    defaultValues: test
      ? {
          name: test.name,
          cost: test.cost != null ? String(test.cost) : '',
          tubeColor: test.tubeColor ?? '',
        }
      : { name: '', cost: '', tubeColor: '' },
  })

  const watchedColor = watch('tubeColor')

  // IDs of already-selected parameters (to grey them out in the picker)
  const selectedParamIds = new Set(
    selectedParams.map((p) => p.parameterId).filter(Boolean) as string[],
  )

  function handlePickParameter(param: DiagnosticParameter) {
    const tp: TestParameter = {
      parameterId: param.id,
      parameter: param.name,
      machineCode: param.code,
      unit: param.unit,
      biologicalReference: formatParameterRefRange(param),
      tubeColor: param.tubeColor,
    }
    setSelectedParams((prev) => [...prev, tp])
  }

  function removeParam(index: number) {
    setSelectedParams((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(data: TestFormData) {
    setServerError('')
    try {
      if (selectedParams.length === 0) {
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

      const tubeColor = data.tubeColor || undefined
      const category = (categoryMode === 'custom' ? customCategory.trim() : selectedCategory) || undefined

      if (isNew) {
        const result = await createTest({
          name: data.name.trim(),
          category,
          parameters: selectedParams,
          cost,
          tubeColor,
        })
        if (!isActive) await toggleTestActive(result.id, false)
        const now = new Date()
        onSave({
          id: result.id,
          testId: result.testId,
          name: result.name,
          category: result.category,
          parameters: result.parameters,
          cost: result.cost,
          tubeColor: result.tubeColor,
          isActive,
          createdAt: { toDate: () => now } as any,
          updatedAt: { toDate: () => now } as any,
        })
      } else {
        const result = await updateTest(test.id, {
          name: data.name.trim(),
          category: category ?? null,
          parameters: selectedParams,
          cost,
          tubeColor: tubeColor ?? null,
        })
        if (isActive !== (test.isActive !== false)) await toggleTestActive(test.id, isActive)
        const now = new Date()
        onSave({
          id: result.id,
          testId: result.testId,
          name: result.name,
          category: result.category,
          parameters: result.parameters,
          cost: result.cost,
          tubeColor: result.tubeColor,
          isActive,
          createdAt: test.createdAt,
          updatedAt: { toDate: () => now } as any,
        })
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {serverError}
          </div>
        )}

        <Input
          label="Test Name"
          placeholder="e.g. Complete Blood Count"
          error={errors.name?.message}
          {...register('name', { required: 'Test name is required' })}
        />

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Category <span className="text-slate-400 font-normal text-xs">— optional</span>
          </label>
          <select
            value={categoryMode === 'custom' ? '__other__' : selectedCategory}
            onChange={(e) => {
              if (e.target.value === '__other__') {
                setCategoryMode('custom')
                setSelectedCategory('')
              } else {
                setCategoryMode('select')
                setSelectedCategory(e.target.value)
              }
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">— None —</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__other__">Enter new category…</option>
          </select>
          {categoryMode === 'custom' && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Microbiology"
              autoFocus
              className="mt-2 w-full rounded-xl border border-teal-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Status</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isActive ? 'Visible in booking and package selection' : 'Hidden from booking and package selection'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              isActive
                ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </button>
        </div>

        <Input
          label="Cost (₹) — optional"
          placeholder="e.g. 500"
          type="number"
          step="0.01"
          {...register('cost')}
        />

        {/* Tube colour */}
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">
            Standard Tube Colour
            <span className="text-slate-400 font-normal ml-1 text-xs">(used to auto-assign tests in packages)</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRIMARY_TUBE_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => setValue('tubeColor', watchedColor === c.name ? '' : c.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  watchedColor === c.name
                    ? `${c.badge} ${c.border} border-2 shadow-sm`
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${c.dot}`} />
                {c.name}
              </button>
            ))}
            <span className="w-px h-5 bg-slate-200 mx-1" />
            {EXTRA_TUBE_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => setValue('tubeColor', watchedColor === c.name ? '' : c.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  watchedColor === c.name
                    ? `${c.badge} ${c.border} border-2 shadow-sm`
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${c.dot}`} />
                {c.name}
              </button>
            ))}
            {watchedColor && (
              <button
                type="button"
                onClick={() => setValue('tubeColor', '')}
                className="text-xs text-slate-400 hover:text-red-500 ml-1 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Parameters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">
              Parameters
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({selectedParams.length} selected)
              </span>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
            >
              <FlaskConical className="h-3 w-3 mr-1" /> Pick from Catalog
            </Button>
          </div>

          {selectedParams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
              <FlaskConical className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No parameters selected</p>
              <p className="text-xs text-slate-300 mt-1">Click "Pick from Catalog" to add</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Code</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 w-24">Tube</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 w-24">Unit</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Reference</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedParams.map((p, i) => {
                    const tc = TUBE_COLORS.find((c) => c.name === p.tubeColor)
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-teal-600 font-semibold text-xs">
                          {p.machineCode ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-800">{p.parameter}</td>
                        <td className="px-3 py-2">
                          {tc ? (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${tc.badge}`}>
                              <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
                              {tc.name}
                            </span>
                          ) : p.tubeColor ? (
                            <span className="text-xs text-slate-400">{p.tubeColor}</span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 font-mono">{p.unit}</td>
                        <td className="px-3 py-2 text-xs text-slate-500 max-w-[140px] truncate">
                          {p.biologicalReference || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeParam(i)}
                            className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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

      <Modal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Pick Parameters from Catalog"
        size="xl"
      >
        <ParameterPickerModal
          catalog={catalog}
          selectedIds={selectedParamIds}
          onSelect={handlePickParameter}
          onClose={() => setPickerOpen(false)}
        />
      </Modal>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/patients', label: 'Patients' },
  { to: '/admin/packages', label: 'Packages' },
  { to: '/admin/invoices', label: 'Invoices' },
  { to: '/admin/tests', label: 'Tests' },
  { to: '/admin/parameters', label: 'Parameters' },
]

export default function TestsPage() {
  const { logOut } = useAuth()
  const [tests, setTests] = useState<Test[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [catalog, setCatalog] = useState<DiagnosticParameter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editTest, setEditTest] = useState<Test | 'new' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Test | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getAllTests(), getAllPackages(), getAllParameters()])
      .then(([t, p, c]) => {
        setTests(t)
        setPackages(p)
        setCatalog(c)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = tests.filter(
    (t) =>
      (t.machineCode ?? t.testId).toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.category ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const activeCount = tests.filter((t) => t.isActive !== false).length
  const existingCategories = [...new Set([
    ...Object.keys(CATEGORY_COLORS),
    ...(tests.map((t) => t.category).filter(Boolean) as string[]),
  ])].sort()

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

  async function handleToggleActive(test: Test) {
    const next = test.isActive === false
    setTogglingId(test.id)
    try {
      await toggleTestActive(test.id, next)
      setTests((prev) => prev.map((t) => (t.id === test.id ? { ...t, isActive: next } : t)))
    } catch (err) {
      console.error('Failed to toggle test active status:', err)
    } finally {
      setTogglingId(null)
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
          {ADMIN_NAV.map((l) => (
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
            {!loading && (
              <span className="text-sm font-normal text-teal-600 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-0.5">
                {activeCount} active
              </span>
            )}
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
                  <th className="text-left px-4 py-3 font-semibold">Active</th>
                  <th className="text-left px-4 py-3 font-semibold">Code</th>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold">Tube</th>
                  <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Parameters</th>
                  <th className="text-left px-4 py-3 font-semibold">Cost</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((test) => {
                  const isActive = test.isActive !== false
                  const tc = TUBE_COLORS.find((c) => c.name === test.tubeColor)
                  const catColor = CATEGORY_COLORS[test.category ?? ''] ?? 'bg-slate-100 text-slate-600'
                  return (
                    <tr key={test.id} className={`hover:bg-slate-50 ${!isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          disabled={togglingId === test.id}
                          onClick={() => handleToggleActive(test)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                            isActive
                              ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-teal-600 font-semibold text-xs">
                        {test.machineCode ?? test.testId}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{test.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {test.category ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
                            {test.category}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tc ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${tc.badge}`}>
                            <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
                            {tc.name}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden xl:table-cell">
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          {test.parameters.slice(0, 3).map((p, i) => (
                            <span key={i} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                              {p.machineCode ?? p.parameter}
                            </span>
                          ))}
                          {test.parameters.length > 3 && (
                            <span className="text-slate-400 text-xs">+{test.parameters.length - 3}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {test.cost != null ? `₹${test.cost.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
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
                  )
                })}
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
        size="lg"
      >
        {editTest !== null && (
          <TestForm
            test={editTest === 'new' ? null : (editTest as Test)}
            categories={existingCategories}
            catalog={catalog}
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
