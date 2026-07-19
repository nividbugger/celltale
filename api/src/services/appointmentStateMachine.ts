import type { AppointmentStatus } from '../types'

/**
 * The appointment lifecycle, enforced server-side. Previously (`AdminAppointmentsPage.tsx`'s
 * free-form status <select>) any status could be set to any other status with zero validation.
 *
 * `SamplesGenerating` is a real, resumable state (not just a diagram nicety) — see
 * `generateSamplesForAppointment` in `sampleGeneration.ts`. It intentionally has no *outgoing*
 * transition to `SamplesGenerated` listed here because that transition only ever happens as
 * part of the atomic generation flow itself, never via a generic "advance status" call.
 *
 * `Deleted` is deliberately NOT modeled here — it's a cross-cutting soft-delete/hide action
 * (mirroring the pre-refactor `softDeleteAppointment` behavior, which unconditionally overwrote
 * whatever status existed), not a lifecycle step, so it's applied directly by the route layer
 * rather than validated against this map.
 */
export const LEGAL_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  Created: ['Confirmed', 'Cancelled'],
  Confirmed: ['SamplesGenerating', 'Cancelled'],
  SamplesGenerating: ['SamplesGenerated'],
  SamplesGenerated: ['SamplesCollected', 'Cancelled'],
  SamplesCollected: ['InLaboratory'],
  InLaboratory: ['ReportGenerated'],
  ReportGenerated: ['ReportUploaded'],
  ReportUploaded: ['Completed'],
}

export class IllegalTransitionError extends Error {
  constructor(from: AppointmentStatus, to: AppointmentStatus) {
    super(`Cannot transition appointment from '${from}' to '${to}'`)
    this.name = 'IllegalTransitionError'
  }
}

/** Throws IllegalTransitionError if `from -> to` is not a legal move. */
export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  const allowed = LEGAL_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new IllegalTransitionError(from, to)
  }
}

// Appointment `status` is a coarse, forward-only rollup of lab progress — individual
// `samples[].collectionStatus` is the real source of truth for what's physically happening to
// a given specimen, and the two are allowed to diverge. Concretely: if a sample is rejected
// after the appointment has already advanced past `SamplesCollected` (a redraw needed for one
// specimen while others proceed), the appointment status does NOT regress — callers must not
// attempt to walk `status` backward to accommodate a single sample's rejection.
