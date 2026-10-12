/** Minimal shape needed to describe an appointment's tests in an email — mirrors
 * `src/lib/appointmentDisplay.ts` on the frontend side, duplicated rather than shared since no
 * shared-types package exists across the functions/api/src package boundaries in this repo. */
interface AppointmentLike {
  packages?: Array<{ packageName: string }>
  packageName?: string
  manualTestIds?: string[]
  resolvedTests?: unknown[]
}

/** Human-readable package summary for an appointment email, independent of whether the tests
 * came from one package, several packages, manual selection, or a mix. */
export function describePackages(appt: AppointmentLike): string {
  if (appt.packages && appt.packages.length > 0) {
    return appt.packages.map((p) => p.packageName).join(', ')
  }
  if (appt.packageName) return appt.packageName
  if ((appt.manualTestIds?.length ?? 0) > 0 || (appt.resolvedTests?.length ?? 0) > 0) {
    return 'your selected tests'
  }
  return 'your selected tests'
}
