/**
 * LIS middleware integration routes.
 *
 * Called by the Windows LIS service (not a browser), so:
 *   - No CSRF/session; authenticated by a shared API key in the Authorization header.
 *   - CORS is implicitly allowed for requests without an Origin header (server-to-server).
 */
import { Router, Request, Response } from 'express'
import * as admin from 'firebase-admin'
import { config } from '../config'
import { SampleDoc, TestDoc } from '../types'

const router = Router()

/** Reject requests whose Bearer token doesn't match LIS_API_KEY. */
function requireLisKey(req: Request, res: Response, next: () => void): void {
  const auth = req.headers['authorization'] ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!config.lisApiKey || token !== config.lisApiKey) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

// ─── GET /api/lis/order/:sampleId ─────────────────────────────────────────────
// Called by the LIS middleware when the analyzer sends a query (Q record) after
// scanning a tube barcode. The barcode value is the sample's own ID (S-YYYY-NNNNNN).
// We look up the sample doc, then the patient, and return demographics + ordered
// test codes so the analyzer can pre-populate its worklist without manual entry.
//
// Response (200 found):
//   { found: true, patientId, name, dob, age, gender, appointmentId, tests: [{code},...] }
//   dob is ISO 8601 (yyyy-MM-dd); used by LIS middleware for P record BirthDate.
// Response (200 not found):
//   { found: false }
router.get('/order/:sampleId', requireLisKey, async (req: Request, res: Response): Promise<void> => {
  const { sampleId } = req.params

  if (!sampleId || !/^S-\d{4}-\d{1,10}$/.test(sampleId)) {
    res.status(400).json({ error: 'Invalid sampleId' })
    return
  }

  try {
    const db = admin.firestore()

    // 1. Look up sample by its ID (which equals barcodeId by design)
    const sampleSnap = await db.doc(`samples/${sampleId}`).get()
    if (!sampleSnap.exists) {
      res.status(200).json({ found: false })
      return
    }
    const sample = sampleSnap.data() as SampleDoc

    // 2. Look up patient demographics
    const userSnap = await db.doc(`users/${sample.patientId}`).get()
    if (!userSnap.exists) {
      res.status(200).json({ found: false })
      return
    }
    const user = userSnap.data()!

    // Calculate age: prefer stored age, fall back to DOB
    let age: number | null = (user.age as number) ?? null
    if (!age && user.dob) {
      const dob = new Date(user.dob as string)
      const now = new Date()
      age = now.getFullYear() - dob.getFullYear() -
        (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
    }

    // 3. Fetch test docs for this sample to build the ordered test code list
    let tests: Array<{ code: string }> = []
    if (sample.testIds.length > 0) {
      const refs = sample.testIds.map(id => db.doc(`tests/${id}`))
      const testSnaps = await db.getAll(...refs)
      tests = testSnaps
        .filter(d => d.exists)
        .map(d => d.data() as TestDoc)
        .filter(t => typeof t.machineCode === 'string' && t.machineCode.length > 0)
        .map(t => ({ code: t.machineCode as string }))
    }

    res.status(200).json({
      found: true,
      patientId: sample.patientId,
      name: (user.name as string) ?? '',
      dob: (user.dob as string) ?? null,
      age,
      gender: (user.gender as string) ?? null,
      appointmentId: sample.appointmentId,
      tests,
    })
  } catch (err) {
    console.error('[GET /api/lis/order] error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── POST /api/lis/results ────────────────────────────────────────────────────
// Called by the LIS middleware after an analyzer completes a run. Results may
// arrive in multiple batches (e.g. chemistry panel in one call, hematology in
// another). Each call is merged into the single report for the appointment so
// partial fields fill incrementally.
//
// Request body (from RestApiAdapter.BuildResultPayload):
//   {
//     sampleId:    "S-2026-000042",
//     analyzerId:  "erba" | "sysmex",
//     completedAt: ISO 8601,
//     patient:     { id, name } | null,
//     results: [{ testCode, value, unit, flag, completedAt }, ...]
//   }
//
// Merge strategy: keyed by test name — new values overwrite stale ones so a
// rerun of the same test always wins. Unknown test codes (no machineCode match)
// are silently skipped.
router.post('/results', requireLisKey, async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>
  const { sampleId, results } = body

  if (typeof sampleId !== 'string' || !sampleId) {
    res.status(400).json({ error: 'sampleId is required' })
    return
  }
  if (!Array.isArray(results)) {
    res.status(400).json({ error: 'results must be an array' })
    return
  }

  try {
    const db = admin.firestore()

    // 1. Find sample
    const sampleSnap = await db.doc(`samples/${sampleId}`).get()
    if (!sampleSnap.exists) {
      res.status(404).json({ error: 'Sample not found' })
      return
    }
    const sample = sampleSnap.data() as SampleDoc
    console.log(`[lis/results] sample=${sampleId} appointmentId=${sample.appointmentId} patientId=${sample.patientId} testIds=${JSON.stringify(sample.testIds)}`)

    // 2. Build lookup maps for matching machine result codes to test documents.
    //    Primary:   param.machineCode → {test, param}   (exact per-parameter code, e.g. "WBC" → CBC param)
    //    Secondary: test.machineCode  → TestDoc          (whole-test fallback for single-param tests)
    //    Tertiary:  parameter.parameter (lowercased) → {test, param}  (name-based last-resort)
    interface ParamEntry { test: TestDoc; param: { parameter: string; unit: string; biologicalReference: string; machineCode?: string } }
    const paramByMachineCode = new Map<string, ParamEntry>()
    const testByMachineCode  = new Map<string, TestDoc>()
    const testByParamName    = new Map<string, ParamEntry>()

    if (sample.testIds.length > 0) {
      const refs = sample.testIds.map(id => db.doc(`tests/${id}`))
      const testSnaps = await db.getAll(...refs)
      for (const d of testSnaps) {
        if (!d.exists) continue
        const t = d.data() as TestDoc
        if (t.machineCode) testByMachineCode.set(t.machineCode, t)
        for (const p of t.parameters ?? []) {
          if (p.machineCode) paramByMachineCode.set(p.machineCode, { test: t, param: p })
          if (p.parameter)   testByParamName.set(p.parameter.toLowerCase(), { test: t, param: p })
        }
      }
    }
    console.log(`[lis/results] paramMachineCode keys: ${paramByMachineCode.size}, testMachineCode keys: ${testByMachineCode.size}, paramName keys: ${testByParamName.size}`)

    // 3. Map LIS results → TestValue objects (skip any with no machineCode match)
    interface LisResult { testCode: string; value?: string | null; unit?: string; flag?: string; referenceRange?: string | null }
    interface TestValue { category: string; name: string; value: string; unit: string; normalRange: string; isAbnormal: boolean }

    const incomingCodes = (results as LisResult[]).map(r => r.testCode)
    console.log(`[lis/results] incoming testCodes (${incomingCodes.length}): ${incomingCodes.slice(0, 10).join(', ')}${incomingCodes.length > 10 ? '…' : ''}`)

    const incoming: TestValue[] = []
    for (const r of results as LisResult[]) {
      let test: TestDoc | undefined
      let matchedParam: { parameter: string; unit: string; biologicalReference: string; machineCode?: string } | undefined

      // 1. Primary: param.machineCode match (e.g. "WBC" → CBC panel's WBC parameter)
      const paramEntry = paramByMachineCode.get(r.testCode)
      if (paramEntry) {
        test = paramEntry.test; matchedParam = paramEntry.param
      } else {
        // 2. Secondary: whole-test machineCode (single-param tests where test code == machine code)
        const testDirect = testByMachineCode.get(r.testCode)
        if (testDirect) {
          test = testDirect; matchedParam = testDirect.parameters?.[0]
        } else {
          // 3. Tertiary: match by parameter name as last resort
          const nameEntry = testByParamName.get(r.testCode.toLowerCase())
          if (nameEntry) { test = nameEntry.test; matchedParam = nameEntry.param }
        }
      }

      if (!test) continue
      incoming.push({
        category:    test.category ?? '',
        name:        matchedParam?.parameter ?? r.testCode,
        value:       r.value ?? '',
        unit:        r.unit || matchedParam?.unit || '',
        normalRange: r.referenceRange || matchedParam?.biologicalReference || '',
        isAbnormal:  r.flag !== 'Normal',
      })
    }
    console.log(`[lis/results] matched ${incoming.length}/${incomingCodes.length} results`)

    // 4. Find or create the single report for this appointment, merging partial results
    const now = admin.firestore.Timestamp.now()
    const reportQuery = await db
      .collection('reports')
      .where('appointmentId', '==', sample.appointmentId)
      .limit(1)
      .get()

    if (reportQuery.empty) {
      const reportRef = db.collection('reports').doc()
      await reportRef.set({
        appointmentId: sample.appointmentId,
        patientId:     sample.patientId,
        uploadedAt:    now,
        testValues:    incoming,
      })
      console.log(`[lis/results] created report ${reportRef.id} for appointment ${sample.appointmentId} with ${incoming.length} values`)
    } else {
      const reportDoc = reportQuery.docs[0]
      const existing = (reportDoc.data().testValues ?? []) as TestValue[]
      const byName = new Map(existing.map(tv => [tv.name, tv]))
      for (const tv of incoming) byName.set(tv.name, tv)
      await reportDoc.ref.update({ testValues: [...byName.values()] })
      console.log(`[lis/results] updated report ${reportDoc.id} for appointment ${sample.appointmentId}: ${existing.length} existing + ${incoming.length} incoming = ${byName.size} total`)
    }

    // 5. Advance appointment status on first results arrival
    const apptSnap = await db.doc(`appointments/${sample.appointmentId}`).get()
    if (apptSnap.exists) {
      const status = apptSnap.data()!.status as string
      if (['SamplesGenerated', 'SamplesCollected', 'InLaboratory'].includes(status)) {
        await apptSnap.ref.update({ status: 'ReportGenerated', updatedAt: now })
        console.log(`[lis/results] appointment ${sample.appointmentId} status → ReportGenerated`)
      } else {
        console.log(`[lis/results] appointment ${sample.appointmentId} status=${status} (no update needed)`)
      }
    } else {
      console.log(`[lis/results] appointment ${sample.appointmentId} not found`)
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[POST /api/lis/results] error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
