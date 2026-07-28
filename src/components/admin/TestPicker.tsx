import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { TUBE_COLORS } from '../../lib/tubeColors'
import type { Test } from '../../types'

function paramColors(test: Test): string[] {
  return [...new Set(test.parameters.map((p) => p.tubeColor).filter(Boolean) as string[])]
}

interface Props {
  selectedIds: string[]
  allTests: Test[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

/**
 * Search-and-chip test multiselect. Extracted from the inline `<Controller name="testIds">`
 * block that used to live in `AdminPackagesPage.tsx`'s `PackageForm` so the same UI can drive
 * both package editing and the appointment Test Selection screen's "Additional Tests" section.
 */
export function TestPicker({ selectedIds, allTests, onChange, disabled }: Props) {
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const selectedTests = selectedIds
    .map((id) => allTests.find((t) => t.id === id))
    .filter((t): t is Test => Boolean(t))
  const candidates = allTests.filter(
    (t) => !selectedIds.includes(t.id) && t.name.toLowerCase().includes(search.toLowerCase()),
  )

  function addTest(id: string) {
    onChange([...selectedIds, id])
    setSearch('')
  }

  function removeTest(id: string) {
    onChange(selectedIds.filter((v) => v !== id))
  }

  return (
    <div>
      {selectedTests.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTests.map((t) => {
            const colors = paramColors(t)
            return (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full pl-3 pr-1.5 py-1 text-xs font-medium"
              >
                {t.name}
                {colors.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    {colors.map((c) => {
                      const tc = TUBE_COLORS.find((x) => x.name === c)
                      return tc ? <span key={c} className={`w-2.5 h-2.5 rounded-full ${tc.dot}`} title={c} /> : null
                    })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeTest(t.id)}
                  className="p-0.5 rounded-full hover:bg-teal-100 text-teal-500 hover:text-teal-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 100)}
          placeholder={allTests.length === 0 ? 'No tests created yet' : 'Search tests by name...'}
          disabled={disabled || allTests.length === 0}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {dropdownOpen && candidates.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-50">
            {candidates.map((t) => {
              const colors = paramColors(t)
              return (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={() => addTest(t.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="text-sm text-slate-700">{t.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {colors.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        {colors.map((c) => {
                          const tc = TUBE_COLORS.find((x) => x.name === c)
                          return tc ? <span key={c} className={`w-2.5 h-2.5 rounded-full ${tc.dot}`} title={c} /> : null
                        })}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {t.parameters.length} param{t.parameters.length === 1 ? '' : 's'}
                      {t.cost != null ? ` · ₹${t.cost}` : ''}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {dropdownOpen && search && candidates.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-400">
            No matching tests
          </div>
        )}
      </div>
    </div>
  )
}
