import { useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Package } from '../../types'

interface Props {
  selectedIds: string[]
  allPackages: Package[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

/**
 * Search-and-chip package multiselect, mirroring `TestPicker` exactly (dropdown opens on
 * focus and shows every non-selected package immediately, filtering live as you type — not a
 * "type first" search box) so admins get the same interaction for both pickers on the
 * appointment Test Selection screen.
 */
export function PackagePicker({ selectedIds, allPackages, onChange, disabled }: Props) {
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const selectedPackages = selectedIds
    .map((id) => allPackages.find((p) => p.id === id))
    .filter((p): p is Package => Boolean(p))
  const candidates = allPackages.filter(
    (p) => !selectedIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase()),
  )

  function addPackage(id: string) {
    onChange([...selectedIds, id])
    setSearch('')
  }

  function removePackage(id: string) {
    onChange(selectedIds.filter((v) => v !== id))
  }

  return (
    <div>
      {selectedPackages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedPackages.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full pl-3 pr-1.5 py-1 text-xs font-medium"
            >
              {p.name}
              <span className="text-teal-400">· ₹{p.price}</span>
              <button
                type="button"
                onClick={() => removePackage(p.id)}
                className="p-0.5 rounded-full hover:bg-teal-100 text-teal-500 hover:text-teal-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
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
          placeholder={allPackages.length === 0 ? 'No packages created yet' : 'Search packages by name...'}
          disabled={disabled || allPackages.length === 0}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {dropdownOpen && candidates.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-50">
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => addPackage(p.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="text-sm text-slate-700">{p.name}</span>
                <span className="text-xs text-slate-400 shrink-0">₹{p.price}</span>
              </button>
            ))}
          </div>
        )}
        {dropdownOpen && search && candidates.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-400">
            No matching packages
          </div>
        )}
      </div>
    </div>
  )
}
