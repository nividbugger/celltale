import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import {
  Plus, Trash2, Pencil, ArrowUp, ArrowDown, PackageOpen, Save, RotateCcw
} from 'lucide-react'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { getAllPackages, savePackage, deletePackage, reorderPackages } from '../../lib/firestore'
import { PACKAGES as STATIC_PACKAGES } from '../../types'
import type { Package, PackageDetail } from '../../types'

// ─── Style presets ──────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  {
    label: 'Slate (default)',
    color: 'bg-white border-slate-200',
    headerColor: 'text-slate-800',
    buttonColor: 'bg-slate-800 hover:bg-slate-700 text-white',
  },
  {
    label: 'Blue (popular)',
    color: 'bg-blue-50 border-blue-200 shadow-blue-100',
    headerColor: 'text-blue-700',
    buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  {
    label: 'Teal',
    color: 'bg-teal-50 border-teal-200 shadow-teal-100',
    headerColor: 'text-teal-700',
    buttonColor: 'bg-teal-600 hover:bg-teal-700 text-white',
  },
  {
    label: 'Purple',
    color: 'bg-purple-50 border-purple-200 shadow-purple-100',
    headerColor: 'text-purple-700',
    buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  {
    label: 'Amber',
    color: 'bg-amber-50 border-amber-200 shadow-amber-100',
    headerColor: 'text-amber-700',
    buttonColor: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
]

// ─── Form types ─────────────────────────────────────────────────────────────

interface PackageFormData {
  id: string
  name: string
  price: number
  testCount: number
  isPopular: boolean
  colorPreset: number
  consultations: string
  summary: { value: string }[]
  details: PackageDetail[]
}

function toFormData(pkg: Package, presetIdx: number): PackageFormData {
  return {
    id: pkg.id,
    name: pkg.name,
    price: pkg.price,
    testCount: pkg.testCount,
    isPopular: pkg.isPopular,
    colorPreset: presetIdx,
    consultations: pkg.consultations.join(', '),
    summary: pkg.summary.map((v) => ({ value: v })),
    details: pkg.details,
  }
}

function fromFormData(data: PackageFormData, order: number): Package {
  const preset = COLOR_PRESETS[data.colorPreset] ?? COLOR_PRESETS[0]
  return {
    id: data.id.trim().toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    price: Number(data.price),
    testCount: Number(data.testCount),
    isPopular: data.isPopular,
    order,
    color: preset.color,
    headerColor: preset.headerColor,
    buttonColor: preset.buttonColor,
    consultations: data.consultations
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    summary: data.summary.map((s) => s.value).filter(Boolean),
    details: data.details.filter((d) => d.category && d.text),
  }
}

function detectPreset(pkg: Package): number {
  return COLOR_PRESETS.findIndex((p) => p.color === pkg.color) ?? 0
}

// ─── Package Form (inside Modal) ────────────────────────────────────────────

function PackageForm({
  pkg,
  existingIds,
  onSave,
  onCancel,
}: {
  pkg: Package | null
  existingIds: string[]
  onSave: (p: Package) => void
  onCancel: () => void
}) {
  const isNew = pkg === null
  const presetIdx = pkg ? Math.max(0, detectPreset(pkg)) : 0

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PackageFormData>({
    defaultValues: pkg
      ? toFormData(pkg, presetIdx)
      : {
          id: '',
          name: '',
          price: 0,
          testCount: 0,
          isPopular: false,
          colorPreset: 0,
          consultations: 'Doctor, Dental, Eye',
          summary: [{ value: '' }],
          details: [{ category: '', text: '' }],
        },
  })

  const {
    fields: summaryFields,
    append: appendSummary,
    remove: removeSummary,
  } = useFieldArray({ control, name: 'summary' })

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray({ control, name: 'details' })

  async function onSubmit(data: PackageFormData) {
    const order = pkg?.order ?? existingIds.length
    const result = fromFormData(data, order)
    await savePackage(result)
    onSave(result)
  }

  const selectedPreset = COLOR_PRESETS[watch('colorPreset')] ?? COLOR_PRESETS[0]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        {isNew && (
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">
              Package ID <span className="text-red-500">*</span>
            </label>
            <input
              {...register('id', {
                required: 'Required',
                validate: (v) =>
                  !existingIds.includes(v.toLowerCase()) || 'ID already exists',
              })}
              placeholder="e.g. premium"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {errors.id && <p className="text-red-500 text-xs mt-1">{errors.id.message}</p>}
          </div>
        )}
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">
            Package Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('name', { required: 'Required' })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">
            Price (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register('price', { required: 'Required', min: 1 })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">
            Total Tests
          </label>
          <input
            type="number"
            {...register('testCount', { min: 0 })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Popular toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <Controller
          control={control}
          name="isPopular"
          render={({ field }) => (
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              onClick={() => field.onChange(!field.value)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                field.value ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  field.value ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        />
        <span className="text-sm font-medium text-slate-700">Mark as Most Popular</span>
      </label>

      {/* Color preset */}
      <div>
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">
          Card Style
        </label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset, i) => (
            <label key={i} className="cursor-pointer">
              <input type="radio" value={i} {...register('colorPreset')} className="sr-only" />
              <span
                className={`inline-block px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${preset.color} ${
                  watch('colorPreset') == i
                    ? 'ring-2 ring-teal-500 ring-offset-1'
                    : ''
                }`}
              >
                {preset.label}
              </span>
            </label>
          ))}
        </div>
        <div
          className={`mt-2 h-8 rounded-xl border text-xs font-medium flex items-center px-3 ${selectedPreset.color} ${selectedPreset.headerColor}`}
        >
          Preview: {watch('name') || 'Package Name'}
        </div>
      </div>

      {/* Consultations */}
      <div>
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">
          Free Consultations (comma-separated)
        </label>
        <input
          {...register('consultations')}
          placeholder="Doctor, Dental, Eye"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Summary Points
          </label>
          <button
            type="button"
            onClick={() => appendSummary({ value: '' })}
            className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {summaryFields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                {...register(`summary.${i}.value`)}
                placeholder={`e.g. Blood-CBC (17 Parameters)`}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={() => removeSummary(i)}
                className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Details */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Test Details
          </label>
          <button
            type="button"
            onClick={() => appendDetail({ category: '', text: '' })}
            className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add Row
          </button>
        </div>
        <div className="space-y-3">
          {detailFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input
                  {...register(`details.${i}.category`)}
                  placeholder="E.g. BLOOD-CBC (17)"
                  className="col-span-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  {...register(`details.${i}.text`)}
                  placeholder="Comma-separated test names..."
                  className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                type="button"
                onClick={() => removeDetail(i)}
                className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors mt-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          {isNew ? 'Add Package' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPackagesPage() {
  const { logOut } = useAuth()
  const navigate = useNavigate()
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)
  const [editPkg, setEditPkg] = useState<Package | 'new' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Package | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const pkgs = await getAllPackages()
      setPackages(pkgs)
    } catch (err: any) {
      console.error('Failed to load packages:', err)
      setLoadError(err?.message ?? 'Failed to load packages. Check Firestore rules and console.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleLogout() {
    await logOut()
    navigate('/')
  }

  async function handleSeed() {
    setSeeding(true)
    setSeedError(null)
    try {
      for (const p of STATIC_PACKAGES) {
        await savePackage(p)
      }
      await load()
    } catch (err: any) {
      console.error('Seed failed:', err)
      setSeedError(err?.message ?? 'Seed failed. Check Firestore rules and console.')
    } finally {
      setSeeding(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await deletePackage(deleteConfirm.id)
      setPackages((prev) => prev.filter((p) => p.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleMove(idx: number, dir: -1 | 1) {
    const next = [...packages]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    const reordered = next.map((p, i) => ({ ...p, order: i }))
    setPackages(reordered)
    await reorderPackages(reordered)
  }

  function handleSaved(saved: Package) {
    setPackages((prev) => {
      const exists = prev.find((p) => p.id === saved.id)
      return exists
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [...prev, saved]
    })
    setEditPkg(null)
  }

  const existingIds = packages.map((p) => p.id)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <BrandLogo />
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-500">
              <a href="/admin" className="hover:text-slate-900">Dashboard</a>
              <a href="/admin/appointments" className="hover:text-slate-900">Appointments</a>
              <a href="/admin/patients" className="hover:text-slate-900">Patients</a>
              <span className="text-teal-600 font-semibold">Packages</span>
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <PackageOpen className="h-6 w-6 text-teal-600" /> Health Packages
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage the packages shown to patients on the landing and booking pages.
            </p>
          </div>
          <div className="flex gap-2">
            {packages.length === 0 && !loading && (
              <Button variant="outline" size="sm" loading={seeding} onClick={handleSeed}>
                <RotateCcw className="h-4 w-4 mr-1" /> Seed Defaults
              </Button>
            )}
            <Button size="sm" onClick={() => setEditPkg('new')}>
              <Plus className="h-4 w-4 mr-1" /> Add Package
            </Button>
          </div>
        </div>

        {/* Errors */}
        {loadError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <strong>Load error:</strong> {loadError}
          </div>
        )}
        {seedError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <strong>Seed error:</strong> {seedError}
          </div>
        )}

        {/* Package list */}
        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : packages.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <PackageOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No packages configured yet</p>
              <p className="text-slate-400 text-sm mt-1 mb-4">
                Click "Seed Defaults" to load the pre-built packages, or add one manually.
              </p>
              <Button size="sm" loading={seeding} onClick={handleSeed}>
                <RotateCcw className="h-4 w-4 mr-1" /> Seed Defaults
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg, idx) => (
              <Card key={pkg.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Order controls */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleMove(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 hover:bg-slate-100"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 1)}
                        disabled={idx === packages.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 hover:bg-slate-100"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Color swatch */}
                    <div className={`h-10 w-10 rounded-xl border shrink-0 ${pkg.color}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold text-sm ${pkg.headerColor}`}>{pkg.name}</p>
                        {pkg.isPopular && (
                          <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        ₹{pkg.price} &nbsp;·&nbsp; {pkg.testCount} tests &nbsp;·&nbsp; ID:{' '}
                        <code className="font-mono">{pkg.id}</code>
                      </p>
                    </div>

                    {/* Summary preview */}
                    <div className="hidden lg:block text-xs text-slate-500 max-w-xs truncate">
                      {pkg.summary.slice(0, 2).join(' · ')}
                      {pkg.summary.length > 2 && ' ...'}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditPkg(pkg)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleteConfirm(pkg)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Add / Edit modal */}
      <Modal
        isOpen={editPkg !== null}
        onClose={() => setEditPkg(null)}
        title={editPkg === 'new' ? 'Add New Package' : `Edit: ${(editPkg as Package)?.name}`}
        size="xl"
      >
        {editPkg !== null && (
          <PackageForm
            pkg={editPkg === 'new' ? null : (editPkg as Package)}
            existingIds={existingIds}
            onSave={handleSaved}
            onCancel={() => setEditPkg(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Package"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">
              Are you sure you want to delete{' '}
              <span className="font-bold text-slate-900">{deleteConfirm.name}</span>? This cannot
              be undone and will remove the package from the booking page.
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
