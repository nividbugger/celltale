import type { Appointment } from '../types'

/**
 * Human-readable package summary for an appointment, independent of whether the tests came
 * from one package, several packages, manual selection, or a mix — used anywhere the UI used
 * to show the (now legacy, singular) `packageName` field.
 */
export function describePackages(appt: Appointment): string {
  if (appt.packages.length > 0) {
    return appt.packages.map((p) => p.packageName).join(', ')
  }
  if (appt.packageName) return appt.packageName
  if (appt.manualTestIds.length > 0 || appt.resolvedTests.length > 0) return 'Selected Tests'
  return '—'
}

/** Total appointment cost, preferring the new snapshot total over the legacy single-package price. */
export function describeCost(appt: Appointment): number {
  if (appt.totalCost > 0) return appt.totalCost
  return appt.packagePrice ?? 0
}
