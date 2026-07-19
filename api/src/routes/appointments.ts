import { Router, Response } from 'express'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireSelfOrAdmin, isAdminUser } from '../middleware/authz'
import { asyncHandler } from '../middleware/asyncHandler'
import { resolveTests } from '../services/testResolution'
import { deriveSamples, generateSamplesForAppointment } from '../services/sampleGeneration'
import { assertTransition, IllegalTransitionError } from '../services/appointmentStateMachine'
import type { AppointmentDoc, AppointmentPackageEntry, AppointmentStatus, PackageDoc, ResolvedTest, SampleType, TestDoc } from '../types'

const router = Router()

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ─── Shared lookups ─────────────────────────────────────────────────────────────

async function getAppointmentOr404(id: string, res: Response): Promise<AppointmentDoc | null> {
  const snap = await admin.firestore().collection('appointments').doc(id).get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Appointment not found' })
    return null
  }
  return { id: snap.id, ...snap.data() } as AppointmentDoc
}

async function getAllPackagesById(ids: string[]): Promise<Map<string, PackageDoc>> {
  const db = admin.firestore()
  const docs = await Promise.all(ids.map((id) => db.collection('packages').doc(id).get()))
  const map = new Map<string, PackageDoc>()
  docs.forEach((snap) => {
    if (snap.exists) map.set(snap.id, { id: snap.id, ...snap.data() } as PackageDoc)
  })
  return map
}

async function getAllTestsById(ids: string[]): Promise<Map<string, TestDoc>> {
  const db = admin.firestore()
  const docs = await Promise.all(ids.map((id) => db.collection('tests').doc(id).get()))
  const map = new Map<string, TestDoc>()
  docs.forEach((snap) => {
    if (snap.exists) map.set(snap.id, { id: snap.id, ...snap.data() } as TestDoc)
  })
  return map
}

/**
 * Computes the frozen sample-group list for an appointment from the packages' sampleGroups config.
 * Returns undefined when no package defines custom groups (fall back to auto-group by sampleType).
 */
function computeResolvedSampleGroups(
  packageEntries: AppointmentPackageEntry[],
  packagesById: Map<string, PackageDoc>,
  resolvedTests: ResolvedTest[],
): Array<{ label: string; testIds: string[]; sampleType: SampleType }> | undefined {
  const groups: Array<{ label: string; testIds: string[]; sampleType: SampleType }> = []

  for (const entry of packageEntries) {
    const pkg = packagesById.get(entry.packageId)
    if (!pkg?.sampleGroups || pkg.sampleGroups.length === 0) continue

    for (const group of pkg.sampleGroups) {
      const groupTestIds = resolvedTests
        .filter((rt) => rt.sourcePackageId === entry.packageId && group.testIds.includes(rt.testId))
        .map((rt) => rt.testId)
      if (groupTestIds.length === 0) continue

      const sampleType: SampleType =
        resolvedTests.find((rt) => rt.testId === groupTestIds[0])?.sampleType ?? 'blood'
      groups.push({ label: group.label, testIds: groupTestIds, sampleType })
    }
  }

  return groups.length > 0 ? groups : undefined
}

/**
 * Builds explicit sample groups from the admin's per-test tube colour assignment for manually
 * added tests. Mirrors computeResolvedSampleGroups but operates on the manualTubeColorMap
 * instead of package sampleGroups config.
 */
function buildManualTubeGroups(
  manualTubeColorMap: Record<string, string> | undefined,
  manualTestIds: string[],
  resolvedTests: ResolvedTest[],
): Array<{ label: string; testIds: string[]; sampleType: SampleType }> {
  if (!manualTubeColorMap || Object.keys(manualTubeColorMap).length === 0) return []
  const manualSet = new Set(manualTestIds)
  const byColor = new Map<string, string[]>()
  for (const [testId, colorName] of Object.entries(manualTubeColorMap)) {
    if (!manualSet.has(testId) || !colorName) continue
    const list = byColor.get(colorName) ?? []
    list.push(testId)
    byColor.set(colorName, list)
  }
  const groups: Array<{ label: string; testIds: string[]; sampleType: SampleType }> = []
  for (const [colorName, testIds] of byColor.entries()) {
    const sampleType = resolvedTests.find((rt) => testIds.includes(rt.testId))?.sampleType ?? 'blood'
    groups.push({ label: colorName, testIds, sampleType })
  }
  return groups
}

function respondAppointment(res: Response, status: number, appt: object): void {
  res.status(status).json({ ...appt, createdAt: null, updatedAt: null })
}

// ─── POST /api/appointments ──────────────────────────────────────────────────
// Creates an empty draft appointment (status: 'Created'). Both the patient portal and the
// admin walk-in flow call this same endpoint — there is no separate "admin appointment" vs
// "patient appointment" creation path. Packages/tests are added in subsequent calls so the
// guided three-section Test Selection UI (packages / additional tests / summary) can drive the
// same appointment through multiple round trips before confirm().
router.post('/', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { patientId, date, timeSlot, collectionAddress, notes } = (req.body ?? {}) as Record<string, unknown>

  if (typeof patientId !== 'string' || !patientId.trim()) {
    res.status(400).json({ error: 'patientId is required' })
    return
  }
  if (!(await requireSelfOrAdmin(req, res, patientId))) return

  if (typeof date !== 'string' || !DATE_REGEX.test(date)) {
    res.status(400).json({ error: 'date must be in yyyy-MM-dd format' })
    return
  }
  if (typeof timeSlot !== 'string' || !timeSlot.trim()) {
    res.status(400).json({ error: 'timeSlot is required' })
    return
  }
  if (typeof collectionAddress !== 'string' || collectionAddress.trim().length < 5) {
    res.status(400).json({ error: 'collectionAddress must be at least 5 characters' })
    return
  }
  if (notes !== undefined && typeof notes !== 'string') {
    res.status(400).json({ error: 'notes must be a string' })
    return
  }

  const db = admin.firestore()
  const patientSnap = await db.doc(`users/${patientId}`).get()
  if (!patientSnap.exists) {
    res.status(404).json({ error: 'Patient not found' })
    return
  }
  const patient = patientSnap.data() as { name: string; phone: string }

  const now = FieldValue.serverTimestamp()
  const apptData = {
    patientId,
    patientName: patient.name,
    patientPhone: patient.phone,
    packages: [],
    manualTestIds: [],
    resolvedTests: [],
    sampleIds: [],
    totalCost: 0,
    date,
    timeSlot,
    collectionAddress: collectionAddress.trim(),
    status: 'Created' as AppointmentStatus,
    ...(notes ? { notes: notes.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const ref = await db.collection('appointments').add(apptData)
  respondAppointment(res, 201, { id: ref.id, ...apptData })
}))

// ─── GET /api/appointments/:id ───────────────────────────────────────────────
router.get('/:id', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return
  respondAppointment(res, 200, appt)
}))

// ─── PATCH /api/appointments/:id ─────────────────────────────────────────────
// Pre-confirm only — once tests are resolved and frozen, scheduling details can still change,
// but that's a deliberate, narrow allowance; the test/sample selection itself is locked (see
// the dedicated /packages, /tests, /confirm routes and their own pre-confirm guards).
router.patch('/:id', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return
  if (appt.status !== 'Created') {
    res.status(409).json({ error: 'Appointment can only be edited before it is confirmed' })
    return
  }

  const { date, timeSlot, collectionAddress, notes } = (req.body ?? {}) as Record<string, unknown>
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  if (date !== undefined) {
    if (typeof date !== 'string' || !DATE_REGEX.test(date)) {
      res.status(400).json({ error: 'date must be in yyyy-MM-dd format' })
      return
    }
    updates.date = date
  }
  if (timeSlot !== undefined) {
    if (typeof timeSlot !== 'string' || !timeSlot.trim()) {
      res.status(400).json({ error: 'timeSlot must be a non-empty string' })
      return
    }
    updates.timeSlot = timeSlot
  }
  if (collectionAddress !== undefined) {
    if (typeof collectionAddress !== 'string' || collectionAddress.trim().length < 5) {
      res.status(400).json({ error: 'collectionAddress must be at least 5 characters' })
      return
    }
    updates.collectionAddress = collectionAddress.trim()
  }
  if (notes !== undefined) {
    if (typeof notes !== 'string') {
      res.status(400).json({ error: 'notes must be a string' })
      return
    }
    updates.notes = notes.trim()
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update(updates)
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── POST /api/appointments/:id/packages ─────────────────────────────────────
router.post('/:id/packages', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return
  if (appt.status !== 'Created') {
    res.status(409).json({ error: 'Packages can only be changed before the appointment is confirmed' })
    return
  }

  const { packageIds } = (req.body ?? {}) as Record<string, unknown>
  if (!Array.isArray(packageIds) || packageIds.some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: 'packageIds must be an array of strings' })
    return
  }

  const existingIds = new Set(appt.packages.map((p) => p.packageId))
  const newIds = (packageIds as string[]).filter((id) => !existingIds.has(id))
  const packagesById = await getAllPackagesById(newIds)

  const missing = newIds.filter((id) => !packagesById.has(id))
  if (missing.length > 0) {
    res.status(404).json({ error: `Unknown package id(s): ${missing.join(', ')}` })
    return
  }

  const additions = newIds.map((id) => {
    const pkg = packagesById.get(id) as PackageDoc & { price?: number }
    return { packageId: id, packageName: pkg.name, priceAtBooking: pkg.price ?? 0 }
  })

  if (additions.length === 0) {
    // Every requested id was already on the appointment — idempotent no-op.
    respondAppointment(res, 200, appt)
    return
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({
    // Atomic array append — a plain read-then-overwrite here would lose concurrent additions
    // (two quick "add package" clicks racing) since the second write's base array snapshot
    // wouldn't include the first's change yet.
    packages: FieldValue.arrayUnion(...additions),
    updatedAt: FieldValue.serverTimestamp(),
  })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── DELETE /api/appointments/:id/packages/:packageId ────────────────────────
router.delete('/:id/packages/:packageId', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return
  if (appt.status !== 'Created') {
    res.status(409).json({ error: 'Packages can only be changed before the appointment is confirmed' })
    return
  }

  const toRemove = appt.packages.find((p) => p.packageId === req.params.packageId)
  if (!toRemove) {
    res.status(404).json({ error: 'Package is not on this appointment' })
    return
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({
    packages: FieldValue.arrayRemove(toRemove),
    updatedAt: FieldValue.serverTimestamp(),
  })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── POST /api/appointments/:id/tests ────────────────────────────────────────
router.post('/:id/tests', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return
  if (appt.status !== 'Created') {
    res.status(409).json({ error: 'Tests can only be changed before the appointment is confirmed' })
    return
  }

  const { testIds } = (req.body ?? {}) as Record<string, unknown>
  if (!Array.isArray(testIds) || testIds.some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: 'testIds must be an array of strings' })
    return
  }

  const existing = new Set(appt.manualTestIds)
  const newIds = (testIds as string[]).filter((id) => !existing.has(id))
  const testsById = await getAllTestsById(newIds)
  const missing = newIds.filter((id) => !testsById.has(id))
  if (missing.length > 0) {
    res.status(404).json({ error: `Unknown test id(s): ${missing.join(', ')}` })
    return
  }

  if (newIds.length === 0) {
    // Every requested id was already on the appointment — idempotent no-op.
    respondAppointment(res, 200, appt)
    return
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({
    manualTestIds: FieldValue.arrayUnion(...newIds),
    updatedAt: FieldValue.serverTimestamp(),
  })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── DELETE /api/appointments/:id/tests/:testId ──────────────────────────────
router.delete('/:id/tests/:testId', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return
  if (appt.status !== 'Created') {
    res.status(409).json({ error: 'Tests can only be changed before the appointment is confirmed' })
    return
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({
    manualTestIds: FieldValue.arrayRemove(req.params.testId),
    updatedAt: FieldValue.serverTimestamp(),
  })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── GET /api/appointments/:id/summary ───────────────────────────────────────
// The unified "Packages / Additional Tests / Summary" payload the three-section UI renders.
// Pre-confirm, this is a LIVE preview computed from the current draft selection; post-confirm,
// it reflects the frozen `resolvedTests` snapshot — the two must never be computed by the same
// live re-derivation once frozen, or editing a test/package after booking could change what a
// historical appointment's summary shows.
router.get('/:id/summary', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return

  const db = admin.firestore()
  const packagesById = await getAllPackagesById(appt.packages.map((p) => p.packageId))

  let resolvedTests = appt.resolvedTests
  if (appt.status === 'Created') {
    const allTestIds = Array.from(
      new Set([
        ...appt.packages.flatMap((p) => packagesById.get(p.packageId)?.testIds ?? []),
        ...appt.manualTestIds,
      ]),
    )
    const testsById = await getAllTestsById(allTestIds)
    resolvedTests = resolveTests(
      appt.packages.map((p) => p.packageId),
      appt.manualTestIds,
      Array.from(packagesById.values()),
      Array.from(testsById.values()),
    )
  }

  const samplesSnap = await db.collection('samples').where('appointmentId', '==', appt.id).get()
  const computedCost = resolvedTests.reduce((sum, t) => sum + t.cost, 0)

  const previewSampleGroups = (() => {
    if (appt.status !== 'Created') return undefined
    const pkgGroups = computeResolvedSampleGroups(appt.packages, packagesById, resolvedTests)
    const manualGroups = buildManualTubeGroups(appt.manualTubeColorMap, appt.manualTestIds, resolvedTests)
    const all = [...(pkgGroups ?? []), ...manualGroups]
    return all.length > 0 ? all : undefined
  })()

  const testNameMap = new Map(resolvedTests.map((rt) => [rt.testId, rt.name]))
  const sampleDrafts = appt.status === 'Created' ? deriveSamples(resolvedTests, previewSampleGroups) : []
  const samplePreviews = sampleDrafts.map((draft, i) => ({
    sampleType: draft.sampleType,
    label: previewSampleGroups && i < previewSampleGroups.length ? previewSampleGroups[i].label : undefined,
    testNames: draft.testIds.map((id) => testNameMap.get(id) ?? id),
  }))

  res.json({
    packages: appt.packages,
    manualTestIds: appt.manualTestIds,
    resolvedTests,
    totalTests: resolvedTests.length,
    totalSamples: appt.status === 'Created' ? sampleDrafts.length : samplesSnap.size,
    computedCost,
    costOverride: appt.costOverride ?? null,
    estimatedCost: appt.costOverride ?? computedCost,
    samplePreviews,
    manualTubeColorMap: appt.manualTubeColorMap ?? {},
  })
}))

// ─── POST /api/appointments/:id/cost-override ────────────────────────────────
// Admin-only, pre-confirm — lets an admin quote a different price than the sum of resolvedTest
// costs (discount, bundling, negotiated rate) without needing to edit the underlying tests'
// prices, which would incorrectly affect every other appointment using them. `{amount: null}`
// clears the override back to the computed sum.
router.post('/:id/cost-override', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !(await isAdminUser(req.user.uid))) {
    res.status(403).json({ error: 'Forbidden: admin access required' })
    return
  }
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (appt.status !== 'Created') {
    res.status(409).json({ error: 'Cost can only be overridden before the appointment is confirmed' })
    return
  }

  const { amount } = (req.body ?? {}) as Record<string, unknown>
  if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
    res.status(400).json({ error: 'amount must be a non-negative number, or null to clear the override' })
    return
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({
    costOverride: amount,
    updatedAt: FieldValue.serverTimestamp(),
  })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── POST /api/appointments/:id/manual-tube-colors ───────────────────────────
// Admin-only, pre-confirm: sets the per-test tube colour map for manually added tests.
// { colorMap: Record<testId, colorName> } — empty string value means "no assignment (auto)".
router.post('/:id/manual-tube-colors', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !(await isAdminUser(req.user.uid))) {
    res.status(403).json({ error: 'Forbidden: admin access required' })
    return
  }
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (appt.status !== 'Created') {
    res.status(409).json({ error: 'Tube colour assignments can only be changed before the appointment is confirmed' })
    return
  }
  const { colorMap } = (req.body ?? {}) as Record<string, unknown>
  if (typeof colorMap !== 'object' || colorMap === null || Array.isArray(colorMap)) {
    res.status(400).json({ error: 'colorMap must be an object' })
    return
  }
  for (const [k, v] of Object.entries(colorMap)) {
    if (typeof v !== 'string') {
      res.status(400).json({ error: `colorMap["${k}"] must be a string` })
      return
    }
  }
  await admin.firestore().collection('appointments').doc(appt.id).update({
    manualTubeColorMap: colorMap,
    updatedAt: FieldValue.serverTimestamp(),
  })
  res.json({ ok: true })
}))

// ─── POST /api/appointments/:id/confirm ──────────────────────────────────────
router.post('/:id/confirm', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return

  try {
    assertTransition(appt.status, 'Confirmed')
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      res.status(409).json({ error: err.message })
      return
    }
    throw err
  }

  if (appt.packages.length === 0 && appt.manualTestIds.length === 0) {
    res.status(400).json({ error: 'Select at least one package or test before confirming' })
    return
  }

  const packagesById = await getAllPackagesById(appt.packages.map((p) => p.packageId))
  const allTestIds = Array.from(
    new Set([
      ...appt.packages.flatMap((p) => packagesById.get(p.packageId)?.testIds ?? []),
      ...appt.manualTestIds,
    ]),
  )
  const testsById = await getAllTestsById(allTestIds)
  const resolvedTests = resolveTests(
    appt.packages.map((p) => p.packageId),
    appt.manualTestIds,
    Array.from(packagesById.values()),
    Array.from(testsById.values()),
  )

  if (resolvedTests.length === 0) {
    res.status(400).json({ error: 'No tests could be resolved from the current selection' })
    return
  }

  // Respects a pre-confirm cost override (see /cost-override) — once frozen here, totalCost is
  // the actual quoted price, whichever of the two produced it, and confirm() is the last chance
  // to capture that: totalCost is never recomputed again after this point.
  const computedCost = resolvedTests.reduce((sum, t) => sum + t.cost, 0)
  const totalCost = appt.costOverride ?? computedCost
  const pkgSampleGroups = computeResolvedSampleGroups(appt.packages, packagesById, resolvedTests)
  const manualTubeGroups = buildManualTubeGroups(appt.manualTubeColorMap, appt.manualTestIds, resolvedTests)
  const allSampleGroups = [...(pkgSampleGroups ?? []), ...manualTubeGroups]
  const resolvedSampleGroups = allSampleGroups.length > 0 ? allSampleGroups : undefined

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({
    resolvedTests,
    ...(resolvedSampleGroups ? { resolvedSampleGroups } : {}),
    totalCost,
    status: 'Confirmed',
    updatedAt: FieldValue.serverTimestamp(),
  })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── POST /api/appointments/:id/generate-samples ─────────────────────────────
router.post('/:id/generate-samples', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return

  try {
    const result = await generateSamplesForAppointment(appt.id)
    res.json(result)
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      res.status(409).json({ error: err.message })
      return
    }
    console.error(`[POST /api/appointments/${appt.id}/generate-samples]`, err)
    res.status(500).json({ error: 'Failed to generate samples' })
  }
}))

// ─── GET /api/appointments/:id/samples ───────────────────────────────────────
router.get('/:id/samples', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return

  const snap = await admin.firestore().collection('samples').where('appointmentId', '==', appt.id).get()
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: null, updatedAt: null })))
}))

// ─── POST /api/appointments/:id/cancel ───────────────────────────────────────
// Blocks cancellation once ANY sample has actually been collected — once real biological
// material exists, silently cancelling the appointment would orphan a physical specimen in
// the lab with no appointment left to track it against.
router.post('/:id/cancel', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return
  if (!(await requireSelfOrAdmin(req, res, appt.patientId))) return

  try {
    assertTransition(appt.status, 'Cancelled')
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      res.status(409).json({ error: err.message })
      return
    }
    throw err
  }

  if (appt.status === 'SamplesGenerated') {
    const collectedSnap = await admin
      .firestore()
      .collection('samples')
      .where('appointmentId', '==', appt.id)
      .where('collectionStatus', '==', 'collected')
      .limit(1)
      .get()
    if (!collectedSnap.empty) {
      res.status(409).json({ error: 'Cannot cancel — at least one sample has already been collected' })
      return
    }
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({ status: 'Cancelled', updatedAt: FieldValue.serverTimestamp() })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── POST /api/appointments/:id/status ───────────────────────────────────────
// Generic transition endpoint for the tail of the pipeline that has no extra business logic
// beyond the flip itself (lab intake / report progress / completion). Admin-only. Deliberately
// excludes 'SamplesGenerating'/'SamplesGenerated' (must go through /generate-samples, which
// actually creates the sample docs) and 'Cancelled' (must go through /cancel, which carries
// the collected-sample guard) — this endpoint could otherwise be used to bypass both.
const GENERIC_STATUS_TARGETS: AppointmentStatus[] = [
  'InLaboratory',
  'ReportGenerated',
  'ReportUploaded',
  'Completed',
]

router.post('/:id/status', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !(await isAdminUser(req.user.uid))) {
    res.status(403).json({ error: 'Forbidden: admin access required' })
    return
  }
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return

  const { status } = (req.body ?? {}) as Record<string, unknown>
  if (typeof status !== 'string' || !GENERIC_STATUS_TARGETS.includes(status as AppointmentStatus)) {
    res.status(400).json({ error: `status must be one of: ${GENERIC_STATUS_TARGETS.join(', ')}` })
    return
  }

  try {
    assertTransition(appt.status, status as AppointmentStatus)
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      res.status(409).json({ error: err.message })
      return
    }
    throw err
  }

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── POST /api/appointments/:id/delete ───────────────────────────────────────
// Soft-delete — mirrors the pre-refactor `softDeleteAppointment` behavior exactly (an
// unconditional overwrite to 'Deleted', regardless of current status). Admin-only.
router.post('/:id/delete', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !(await isAdminUser(req.user.uid))) {
    res.status(403).json({ error: 'Forbidden: admin access required' })
    return
  }
  const appt = await getAppointmentOr404(req.params.id, res)
  if (!appt) return

  const ref = admin.firestore().collection('appointments').doc(appt.id)
  await ref.update({ status: 'Deleted', updatedAt: FieldValue.serverTimestamp() })
  const updated = await ref.get()
  respondAppointment(res, 200, { id: updated.id, ...updated.data() })
}))

export default router
