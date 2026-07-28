import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FlaskConical, Search, Plus, Pencil, Trash2, Filter } from 'lucide-react'
import { TUBE_COLORS } from '../../lib/tubeColors'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { getAllParameters } from '../../lib/firestore'
import { createParameter, updateParameter, deleteParameter } from '../../lib/api'
import type { DiagnosticParameter } from '../../types'
import { formatParameterRefRange } from '../../types'

const ANALYZERS = ['sysmex', 'erba', 'generic']
const SEX_OPTIONS = ['ALL', 'M', 'F'] as const

const DISCIPLINE_COLORS: Record<string, string> = {
  Hematology:     'bg-red-50 text-red-700',
  Chemistry:      'bg-amber-50 text-amber-700',
  Lipids:         'bg-orange-50 text-orange-700',
  Diabetes:       'bg-pink-50 text-pink-700',
  Thyroid:        'bg-blue-50 text-blue-700',
  Coagulation:    'bg-indigo-50 text-indigo-700',
  Cardiac:        'bg-rose-50 text-rose-700',
  'Iron studies': 'bg-yellow-50 text-yellow-700',
  Inflammatory:   'bg-teal-50 text-teal-700',
  Vitamins:       'bg-green-50 text-green-700',
  'Tumor markers':'bg-slate-100 text-slate-700',
  Urinalysis:     'bg-cyan-50 text-cyan-700',
}

interface ParameterFormData {
  code: string
  analyzer: string
  loinc: string
  name: string
  discipline: string
  tubeColor: string
  additive: string
  unit: string
  refLow: string
  refHigh: string
  sex: 'ALL' | 'M' | 'F'
  refText: string
}

function ParameterForm({
  param,
  onSave,
  onCancel,
}: {
  param: DiagnosticParameter | null
  onSave: (p: DiagnosticParameter) => void
  onCancel: () => void
}) {
  const isNew = param === null
  const [serverError, setServerError] = useState('')

  const existingDisciplines = Object.keys(DISCIPLINE_COLORS)
  const isCustomDisc = param?.discipline != null && !existingDisciplines.includes(param.discipline)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ParameterFormData>({
    defaultValues: param
      ? {
          code: param.code,
          analyzer: param.analyzer,
          loinc: param.loinc ?? '',
          name: param.name,
          discipline: isCustomDisc ? '' : param.discipline,
          tubeColor: param.tubeColor,
          additive: param.additive ?? '',
          unit: param.unit,
          refLow: param.refLow !== null ? String(param.refLow) : '',
          refHigh: param.refHigh !== null ? String(param.refHigh) : '',
          sex: param.sex,
          refText: param.refText ?? '',
        }
      : { code: '', analyzer: 'generic', loinc: '', name: '', discipline: '', tubeColor: '', additive: '', unit: '', refLow: '', refHigh: '', sex: 'ALL', refText: '' },
  })

  const [disciplineMode, setDisciplineMode] = useState<'select' | 'custom'>(isCustomDisc ? 'custom' : 'select')
  const [customDisciplineVal, setCustomDisciplineVal] = useState(isCustomDisc ? param!.discipline : '')
  const watchedColor = watch('tubeColor')
  const watchedSex = watch('sex')

  async function onSubmit(data: ParameterFormData) {
    setServerError('')
    const discipline = disciplineMode === 'custom' ? customDisciplineVal.trim() : data.discipline
    if (!discipline) {
      setServerError('Discipline is required')
      return
    }

    const payload = {
      code: data.code.trim().toUpperCase(),
      analyzer: data.analyzer,
      loinc: data.loinc.trim() || null,
      name: data.name.trim(),
      discipline,
      tubeColor: data.tubeColor,
      additive: data.additive.trim(),
      unit: data.unit.trim(),
      refLow: data.refLow.trim() !== '' ? Number(data.refLow) : null,
      refHigh: data.refHigh.trim() !== '' ? Number(data.refHigh) : null,
      sex: data.sex,
      refText: data.refText.trim() || null,
    }

    const toParam = (result: typeof payload & { id?: string }, id: string, createdAt: any, updatedAt: any): import('../../types').DiagnosticParameter => ({
      id,
      code: result.code,
      analyzer: result.analyzer,
      loinc: result.loinc ?? null,
      name: result.name,
      discipline: result.discipline,
      tubeColor: result.tubeColor,
      additive: result.additive ?? '',
      unit: result.unit,
      refLow: result.refLow ?? null,
      refHigh: result.refHigh ?? null,
      sex: result.sex,
      refText: result.refText ?? null,
      createdAt,
      updatedAt,
    })

    try {
      const now = new Date()
      if (isNew) {
        const result = await createParameter(payload)
        onSave(toParam(payload, result.id, { toDate: () => now } as any, { toDate: () => now } as any))
      } else {
        await updateParameter(param!.id, payload)
        onSave(toParam(payload, param!.id, param!.createdAt, { toDate: () => now } as any))
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

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Code"
          placeholder="e.g. WBC"
          error={errors.code?.message}
          {...register('code', { required: 'Code is required' })}
          className="uppercase"
        />
        <Input
          label="LOINC"
          placeholder="e.g. 6690-2"
          {...register('loinc')}
        />
      </div>

      <Input
        label="Parameter Name"
        placeholder="e.g. White blood cell count"
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Discipline <span className="text-red-400">*</span>
          </label>
          <select
            value={disciplineMode === 'custom' ? '__other__' : watch('discipline')}
            onChange={(e) => {
              if (e.target.value === '__other__') {
                setDisciplineMode('custom')
                setValue('discipline', '')
              } else {
                setDisciplineMode('select')
                setValue('discipline', e.target.value)
              }
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">— Select —</option>
            {existingDisciplines.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value="__other__">Enter new…</option>
          </select>
          {disciplineMode === 'custom' && (
            <input
              type="text"
              value={customDisciplineVal}
              onChange={(e) => setCustomDisciplineVal(e.target.value)}
              placeholder="e.g. Microbiology"
              autoFocus
              className="mt-2 w-full rounded-xl border border-teal-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Analyzer <span className="text-red-400">*</span>
          </label>
          <select
            {...register('analyzer', { required: 'Analyzer is required' })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            {ANALYZERS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2">
          Tube Color <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {TUBE_COLORS.map((c) => (
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

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Additive"
          placeholder="e.g. K2/K3 EDTA"
          {...register('additive')}
        />
        <Input
          label="Unit"
          placeholder="e.g. 10*3/uL"
          error={errors.unit?.message}
          {...register('unit', { required: 'Unit is required' })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2">Sex</label>
        <div className="flex gap-2">
          {SEX_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue('sex', s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                watchedSex === s
                  ? 'bg-teal-100 text-teal-700 border-teal-300'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              {s === 'ALL' ? 'All' : s === 'M' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Ref Low"
          placeholder="e.g. 4.0"
          type="number"
          step="any"
          {...register('refLow')}
        />
        <Input
          label="Ref High"
          placeholder="e.g. 11.0"
          type="number"
          step="any"
          {...register('refHigh')}
        />
      </div>

      <Input
        label="Ref Text (optional — overrides computed range)"
        placeholder="e.g. Normal < 5.7"
        {...register('refText')}
      />

      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {isNew ? 'Add Parameter' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/patients', label: 'Patients' },
  { to: '/admin/packages', label: 'Packages' },
  { to: '/admin/invoices', label: 'Invoices' },
  { to: '/admin/tests', label: 'Tests' },
  { to: '/admin/parameters', label: 'Parameters' },
]

export default function ParametersPage() {
  const { logOut } = useAuth()
  const [params, setParams] = useState<DiagnosticParameter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDiscipline, setFilterDiscipline] = useState('')
  const [filterSex, setFilterSex] = useState<'ALL' | 'M' | 'F' | ''>('')
  const [editParam, setEditParam] = useState<DiagnosticParameter | 'new' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DiagnosticParameter | null>(null)

  useEffect(() => {
    getAllParameters()
      .then(setParams)
      .finally(() => setLoading(false))
  }, [])

  const disciplines = [...new Set(params.map((p) => p.discipline))].sort()

  const filtered = params.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.discipline.toLowerCase().includes(q) ||
      (p.loinc ?? '').includes(q)
    const matchDisc = !filterDiscipline || p.discipline === filterDiscipline
    const matchSex = !filterSex || p.sex === filterSex
    return matchSearch && matchDisc && matchSex
  })

  async function handleLogout() {
    await logOut()
    window.location.href = '/'
  }

  function handleSaved(saved: DiagnosticParameter) {
    setParams((prev) => {
      const exists = prev.find((p) => p.id === saved.id)
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]
    })
    setEditParam(null)
  }

  async function handleDelete(p: DiagnosticParameter) {
    try {
      await deleteParameter(p.id)
      setParams((prev) => prev.filter((x) => x.id !== p.id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete parameter:', err)
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
                l.to === '/admin/parameters'
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
            <FlaskConical className="h-6 w-6 text-teal-500" /> Parameters
            <span className="text-slate-400 text-lg font-normal ml-1">({params.length})</span>
          </h1>
          <Button size="sm" onClick={() => setEditParam('new')}>
            <Plus className="h-4 w-4 mr-1" /> Add Parameter
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or LOINC…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">All Disciplines</option>
            {disciplines.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <div className="flex gap-1 items-center">
            <Filter className="h-4 w-4 text-slate-400 mr-1" />
            {(['', 'ALL', 'M', 'F'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterSex(s as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filterSex === s
                    ? 'bg-teal-100 text-teal-700 border-teal-300'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {s === '' ? 'Any Sex' : s === 'ALL' ? 'Both' : s === 'M' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FlaskConical className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {search || filterDiscipline || filterSex
                  ? 'No parameters match your filters'
                  : 'No parameters in the catalog yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                  <th className="text-left px-4 py-3 font-semibold">Code</th>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Discipline</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Analyzer</th>
                  <th className="text-left px-4 py-3 font-semibold">Tube</th>
                  <th className="text-left px-4 py-3 font-semibold">Unit</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Sex</th>
                  <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Reference</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => {
                  const tc = TUBE_COLORS.find((c) => c.name === p.tubeColor)
                  const discColor = DISCIPLINE_COLORS[p.discipline] ?? 'bg-slate-100 text-slate-600'
                  const refRange = formatParameterRefRange(p)
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-teal-600 font-semibold text-xs">
                        {p.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${discColor}`}>
                          {p.discipline}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-slate-500 font-mono">{p.analyzer}</span>
                      </td>
                      <td className="px-4 py-3">
                        {tc ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${tc.badge}`}>
                            <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
                            {tc.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">{p.tubeColor}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-mono">{p.unit}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.sex === 'M' ? 'bg-blue-50 text-blue-700' :
                          p.sex === 'F' ? 'bg-pink-50 text-pink-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {p.sex === 'ALL' ? 'Both' : p.sex === 'M' ? 'Male' : 'Female'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs hidden xl:table-cell max-w-[200px] truncate">
                        {refRange || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditParam(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteConfirm(p)}
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
        isOpen={editParam !== null}
        onClose={() => setEditParam(null)}
        title={editParam === 'new' ? 'Add Parameter' : `Edit: ${(editParam as DiagnosticParameter)?.name}`}
        size="lg"
      >
        {editParam !== null && (
          <ParameterForm
            param={editParam === 'new' ? null : (editParam as DiagnosticParameter)}
            onSave={handleSaved}
            onCancel={() => setEditParam(null)}
          />
        )}
      </Modal>

      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Parameter"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteConfirm.name}</span>{' '}
              (<span className="font-mono text-teal-600">{deleteConfirm.code}</span>)?
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Any tests that include this parameter will retain their existing data but the catalog link will be broken.
            </p>
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
