export interface TubeColorDef {
  name: string
  dot: string    // filled-circle bg class (Tailwind)
  ring: string   // ring color class for selected state
  badge: string  // pill bg+text for summary labels
  border: string // border class for selected button
}

export const TUBE_COLORS: TubeColorDef[] = [
  { name: 'Red',        dot: 'bg-red-500',    ring: 'ring-red-400',    badge: 'bg-red-100 text-red-800',       border: 'border-red-400' },
  { name: 'Lavender',   dot: 'bg-purple-300', ring: 'ring-purple-400', badge: 'bg-purple-100 text-purple-800', border: 'border-purple-400' },
  { name: 'Grey',       dot: 'bg-slate-400',  ring: 'ring-slate-400',  badge: 'bg-slate-200 text-slate-700',   border: 'border-slate-400' },
  { name: 'Black',      dot: 'bg-slate-800',  ring: 'ring-slate-700',  badge: 'bg-slate-800 text-white',       border: 'border-slate-700' },
  { name: 'Blue',       dot: 'bg-blue-500',   ring: 'ring-blue-400',   badge: 'bg-blue-100 text-blue-800',     border: 'border-blue-400' },
  { name: 'Green',      dot: 'bg-green-500',  ring: 'ring-green-400',  badge: 'bg-green-100 text-green-800',   border: 'border-green-400' },
  { name: 'Yellow',     dot: 'bg-yellow-400', ring: 'ring-yellow-400', badge: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-400' },
  { name: 'Gold',       dot: 'bg-amber-400',  ring: 'ring-amber-400',  badge: 'bg-amber-100 text-amber-800',   border: 'border-amber-400' },
  { name: 'Light Blue', dot: 'bg-sky-300',    ring: 'ring-sky-400',    badge: 'bg-sky-100 text-sky-800',       border: 'border-sky-400' },
]

export const PRIMARY_TUBE_COLORS = TUBE_COLORS.slice(0, 3)  // Red, Lavender, Grey
export const EXTRA_TUBE_COLORS   = TUBE_COLORS.slice(3)     // Black, Blue, Green, Yellow, Gold, Light Blue

export type TubeColorName = typeof TUBE_COLORS[number]['name']

export const TUBE_COLOR_NAMES: TubeColorName[] = TUBE_COLORS.map((c) => c.name)
