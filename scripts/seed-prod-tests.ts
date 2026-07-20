/**
 * Production test seed script.
 * Deletes all documents in the `tests` collection, then re-seeds the 8 standard
 * lab tests.
 *
 * Run from the scripts/ directory:
 *   npx ts-node seed-prod-tests.ts
 *
 * Requires production credentials — either GOOGLE_APPLICATION_CREDENTIALS pointing
 * to a service account key, or gcloud application-default credentials.
 * Do NOT set FIRESTORE_EMULATOR_HOST; this script targets production.
 */

import * as admin from 'firebase-admin'

admin.initializeApp({ projectId: 'celltalediagnostics-8f817' })
const db = admin.firestore()

// ─── Test definitions ─────────────────────────────────────────────────────────

const TESTS: Record<string, object> = {
  'test-cbc': {
    testId: 'TEST-CBC0001', name: 'Complete Blood Count (CBC)', sampleType: 'blood', cost: 200,
    parameters: [
      { parameter: 'Hemoglobin',      unit: 'g/dL',    biologicalReference: '13.5-17.5 (M), 12.0-15.5 (F)' },
      { parameter: 'Total WBC Count', unit: '×10³/µL', biologicalReference: '4.5-11.0' },
      { parameter: 'Platelet Count',  unit: '×10³/µL', biologicalReference: '150-400' },
      { parameter: 'PCV/Hematocrit',  unit: '%',       biologicalReference: '41-53 (M), 36-46 (F)' },
    ],
  },
  'test-tsh': {
    testId: 'TEST-TSH0001', name: 'Thyroid Stimulating Hormone (TSH)', sampleType: 'blood', cost: 300,
    parameters: [
      { parameter: 'TSH', unit: 'mIU/L', biologicalReference: '0.4-4.0' },
    ],
  },
  'test-rbs': {
    testId: 'TEST-RBS0001', name: 'Random Blood Sugar (RBS)', sampleType: 'blood', cost: 150,
    parameters: [
      { parameter: 'RBS', unit: 'mg/dL', biologicalReference: '70-140' },
    ],
  },
  'test-hba1c': {
    testId: 'TEST-HBA0001', name: 'HbA1c (Glycated Hemoglobin)', sampleType: 'blood', cost: 400,
    parameters: [
      { parameter: 'HbA1c', unit: '%', biologicalReference: '<5.7 (Normal), 5.7-6.4 (Pre-diabetic), ≥6.5 (Diabetic)' },
    ],
  },
  'test-lipid': {
    testId: 'TEST-LIP0001', name: 'Lipid Profile', sampleType: 'blood', cost: 500,
    parameters: [
      { parameter: 'Total Cholesterol', unit: 'mg/dL', biologicalReference: '<200' },
      { parameter: 'HDL',               unit: 'mg/dL', biologicalReference: '>40 (M), >50 (F)' },
      { parameter: 'LDL',               unit: 'mg/dL', biologicalReference: '<100' },
      { parameter: 'Triglycerides',      unit: 'mg/dL', biologicalReference: '<150' },
    ],
  },
  'test-lft': {
    testId: 'TEST-LFT0001', name: 'Liver Function Test (LFT)', sampleType: 'blood', cost: 600,
    parameters: [
      { parameter: 'Total Bilirubin', unit: 'mg/dL', biologicalReference: '0.2-1.2' },
      { parameter: 'SGOT (AST)',       unit: 'U/L',   biologicalReference: '10-40' },
      { parameter: 'SGPT (ALT)',        unit: 'U/L',   biologicalReference: '7-56' },
      { parameter: 'Serum Albumin',    unit: 'g/dL',  biologicalReference: '3.4-5.4' },
    ],
  },
  'test-kft': {
    testId: 'TEST-KFT0001', name: 'Kidney Function Test (KFT)', sampleType: 'blood', cost: 400,
    parameters: [
      { parameter: 'Urea',       unit: 'mg/dL', biologicalReference: '7-20' },
      { parameter: 'Creatinine', unit: 'mg/dL', biologicalReference: '0.6-1.2 (M), 0.5-1.1 (F)' },
      { parameter: 'Uric Acid',  unit: 'mg/dL', biologicalReference: '3.4-7.0 (M), 2.4-6.0 (F)' },
    ],
  },
  'test-urine': {
    testId: 'TEST-URN0001', name: 'Urine Routine & Microscopy', sampleType: 'urine', cost: 200,
    parameters: [
      { parameter: 'Colour',    unit: '', biologicalReference: 'Pale Yellow' },
      { parameter: 'pH',        unit: '', biologicalReference: '4.5-8.0' },
      { parameter: 'Protein',   unit: '', biologicalReference: 'Negative' },
      { parameter: 'Glucose',   unit: '', biologicalReference: 'Negative' },
    ],
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== Seeding production tests collection ===\n')

  // 1. Delete all existing test documents
  console.log('Deleting existing tests...')
  const existing = await db.collection('tests').listDocuments()
  if (existing.length > 0) {
    for (let i = 0; i < existing.length; i += 500) {
      const batch = db.batch()
      existing.slice(i, i + 500).forEach((ref: admin.firestore.DocumentReference) => batch.delete(ref))
      await batch.commit()
    }
    console.log(`  deleted ${existing.length} documents`)
  } else {
    console.log('  collection was empty')
  }

  // 2. Write new test documents
  console.log('\nWriting tests...')
  const now = admin.firestore.Timestamp.now()
  const batch = db.batch()
  for (const [id, data] of Object.entries(TESTS)) {
    batch.set(db.doc(`tests/${id}`), { ...data, createdAt: now, updatedAt: now })
    console.log(`  tests/${id}`)
  }
  await batch.commit()

  console.log('\n✓ Done! Seeded 8 tests into production.\n')
}

run().catch(err => { console.error(err); process.exit(1) })
