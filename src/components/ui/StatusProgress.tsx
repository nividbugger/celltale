import type { AppointmentStatus } from '../../types'

const STEP_LABELS = ['Booked', 'Confirmed', 'Collected', 'Report', 'Done']
const STEP_STATUSES: AppointmentStatus[] = [
  'Pending',
  'Confirmed',
  'Sample Collected',
  'Report Ready',
  'Completed',
]

export function StatusProgress({ status }: { status: AppointmentStatus }) {
  const step = STEP_STATUSES.indexOf(status)

  if (status === 'Cancelled') {
    return (
      <div className="mt-3 flex items-center gap-2 bg-red-50 rounded-xl px-3 py-1.5">
        <div className="flex-1 h-1 bg-red-200 rounded-full" />
        <span className="text-[10px] font-semibold text-red-400 shrink-0">Cancelled</span>
      </div>
    )
  }

  if (step === -1) return null

  // Fill width formula: fills the track (which spans from center of dot 0 to center of dot 4)
  // Each dot is w-7 = 28px wide, so offset = fillPct * 28 / 100
  const fillPct = (step / (STEP_LABELS.length - 1)) * 100

  return (
    <div className="mt-3">
      {/* Dots + track */}
      <div className="relative flex items-center justify-between">
        {/* Track background — spans between dot centers */}
        <div className="absolute left-3.5 right-3.5 h-1 bg-slate-200 rounded-full" />
        {/* Track fill */}
        {step > 0 && (
          <div
            className="absolute left-3.5 h-1 gradient-bg rounded-full transition-all duration-700"
            style={{ width: `calc(${fillPct}% - ${fillPct * 0.28}px)` }}
          />
        )}
        {/* Step circles */}
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="relative z-10">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                i < step
                  ? 'gradient-bg text-white'
                  : i === step
                  ? 'gradient-bg text-white ring-2 ring-teal-200 ring-offset-2'
                  : 'bg-white border-2 border-slate-200 text-slate-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
          </div>
        ))}
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-2">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className={`text-[9px] font-semibold leading-tight ${
              i <= step ? 'text-teal-700' : 'text-slate-400'
            }`}
            style={{
              textAlign: i === 0 ? 'left' : i === STEP_LABELS.length - 1 ? 'right' : 'center',
              width: '20%',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
