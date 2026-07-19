/**
 * Seed script for the local Firebase emulator.
 * Run from the scripts/ directory: npx ts-node seed-emulator.ts
 *
 * Creates:
 *   - 1 admin user  (admin@celltale.dev / Admin@123)
 *   - 5 patients    (e.g. ravi@celltale.dev / Patient@123)
 *   - 8 lab tests
 *   - 3 packages
 *   - 6 appointments in various pipeline statuses
 *   - samples, invoices, and a report to match
 *   - clinic settings + counter documents
 */

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'

import * as admin from 'firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

admin.initializeApp({ projectId: 'celltalediagnostics-8f817' })
const db   = admin.firestore()
const auth = admin.auth()

const now      = new Date()
const daysAgo  = (n: number) => new Date(now.getTime() - n * 86_400_000)
const ts       = (d: Date) => Timestamp.fromDate(d)

// ─── IDs ─────────────────────────────────────────────────────────────────────

const TEST_IDS = {
  cbc:   'test-cbc',
  tsh:   'test-tsh',
  rbs:   'test-rbs',
  hba1c: 'test-hba1c',
  lipid: 'test-lipid',
  lft:   'test-lft',
  kft:   'test-kft',
  urine: 'test-urine',
}

const PKG_IDS = { basic: 'pkg-basic', economy: 'pkg-economy', advanced: 'pkg-advanced' }

const PATIENT_IDS = {
  ravi:   'patient-001',
  priya:  'patient-002',
  anand:  'patient-003',
  meena:  'patient-004',
  suresh: 'patient-005',
}

// ─── Auth users ──────────────────────────────────────────────────────────────

async function createAuthUser(
  uid: string, email: string, password: string, displayName: string, phone?: string,
) {
  try {
    await auth.deleteUser(uid)
  } catch { /* not found is fine */ }
  await auth.createUser({ uid, email, password, displayName, ...(phone ? { phoneNumber: phone } : {}) })
  console.log(`  auth  ${email}`)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const TESTS: Record<string, object> = {
  [TEST_IDS.cbc]: {
    testId: 'TEST-CBC0001', name: 'Complete Blood Count (CBC)', sampleType: 'blood', cost: 200,
    parameters: [
      { parameter: 'Hemoglobin',      unit: 'g/dL',       biologicalReference: '13.5-17.5 (M), 12.0-15.5 (F)' },
      { parameter: 'Total WBC Count', unit: '×10³/µL',    biologicalReference: '4.5-11.0' },
      { parameter: 'Platelet Count',  unit: '×10³/µL',    biologicalReference: '150-400' },
      { parameter: 'PCV/Hematocrit',  unit: '%',          biologicalReference: '41-53 (M), 36-46 (F)' },
    ],
  },
  [TEST_IDS.tsh]: {
    testId: 'TEST-TSH0001', name: 'Thyroid Stimulating Hormone (TSH)', sampleType: 'blood', cost: 300,
    parameters: [
      { parameter: 'TSH', unit: 'mIU/L', biologicalReference: '0.4-4.0' },
    ],
  },
  [TEST_IDS.rbs]: {
    testId: 'TEST-RBS0001', name: 'Random Blood Sugar (RBS)', sampleType: 'blood', cost: 150,
    parameters: [
      { parameter: 'RBS', unit: 'mg/dL', biologicalReference: '70-140' },
    ],
  },
  [TEST_IDS.hba1c]: {
    testId: 'TEST-HBA0001', name: 'HbA1c (Glycated Hemoglobin)', sampleType: 'blood', cost: 400,
    parameters: [
      { parameter: 'HbA1c', unit: '%', biologicalReference: '<5.7 (Normal), 5.7-6.4 (Pre-diabetic), ≥6.5 (Diabetic)' },
    ],
  },
  [TEST_IDS.lipid]: {
    testId: 'TEST-LIP0001', name: 'Lipid Profile', sampleType: 'blood', cost: 500,
    parameters: [
      { parameter: 'Total Cholesterol', unit: 'mg/dL', biologicalReference: '<200' },
      { parameter: 'HDL',               unit: 'mg/dL', biologicalReference: '>40 (M), >50 (F)' },
      { parameter: 'LDL',               unit: 'mg/dL', biologicalReference: '<100' },
      { parameter: 'Triglycerides',      unit: 'mg/dL', biologicalReference: '<150' },
    ],
  },
  [TEST_IDS.lft]: {
    testId: 'TEST-LFT0001', name: 'Liver Function Test (LFT)', sampleType: 'blood', cost: 600,
    parameters: [
      { parameter: 'Total Bilirubin', unit: 'mg/dL', biologicalReference: '0.2-1.2' },
      { parameter: 'SGOT (AST)',       unit: 'U/L',   biologicalReference: '10-40' },
      { parameter: 'SGPT (ALT)',        unit: 'U/L',   biologicalReference: '7-56' },
      { parameter: 'Serum Albumin',    unit: 'g/dL',  biologicalReference: '3.4-5.4' },
    ],
  },
  [TEST_IDS.kft]: {
    testId: 'TEST-KFT0001', name: 'Kidney Function Test (KFT)', sampleType: 'blood', cost: 400,
    parameters: [
      { parameter: 'Urea',       unit: 'mg/dL', biologicalReference: '7-20' },
      { parameter: 'Creatinine', unit: 'mg/dL', biologicalReference: '0.6-1.2 (M), 0.5-1.1 (F)' },
      { parameter: 'Uric Acid',  unit: 'mg/dL', biologicalReference: '3.4-7.0 (M), 2.4-6.0 (F)' },
    ],
  },
  [TEST_IDS.urine]: {
    testId: 'TEST-URN0001', name: 'Urine Routine & Microscopy', sampleType: 'urine', cost: 200,
    parameters: [
      { parameter: 'Colour',    unit: '',     biologicalReference: 'Pale Yellow' },
      { parameter: 'pH',        unit: '',     biologicalReference: '4.5-8.0' },
      { parameter: 'Protein',   unit: '',     biologicalReference: 'Negative' },
      { parameter: 'Glucose',   unit: '',     biologicalReference: 'Negative' },
    ],
  },
}

// ─── Packages ─────────────────────────────────────────────────────────────────

const PACKAGES: Record<string, object> = {
  [PKG_IDS.basic]: {
    name: 'Basic Screening Package', price: 1599, testCount: 30, isPopular: false, order: 0,
    testIds: [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs],
    color: 'bg-white border-slate-200', headerColor: 'text-slate-800',
    buttonColor: 'bg-slate-800 hover:bg-slate-700 text-white',
    consultations: ['Doctor', 'Dental', 'Eye'],
    summary: ['Blood-CBC (17 Parameters)', 'Thyroid (TSH)', 'Sugar (RBS)'],
    details: [],
  },
  [PKG_IDS.economy]: {
    name: 'Economy Disease Checkup', price: 2599, testCount: 42, isPopular: true, order: 1,
    testIds: [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs, TEST_IDS.hba1c, TEST_IDS.lipid],
    color: 'bg-blue-50 border-blue-200', headerColor: 'text-blue-700',
    buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    consultations: ['Doctor', 'Dental', 'Eye'],
    summary: ['Blood-CBC', 'Thyroid (T3, T4, TSH)', 'HbA1c', 'Lipid Profile'],
    details: [],
  },
  [PKG_IDS.advanced]: {
    name: 'Advanced Prevention', price: 3599, testCount: 56, isPopular: false, order: 2,
    testIds: [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs, TEST_IDS.hba1c, TEST_IDS.lipid, TEST_IDS.lft, TEST_IDS.kft, TEST_IDS.urine],
    color: 'bg-white border-slate-200', headerColor: 'text-slate-800',
    buttonColor: 'bg-slate-800 hover:bg-slate-700 text-white',
    consultations: ['Doctor', 'Dental', 'Eye'],
    summary: ['Full Blood Panel', 'Liver & Kidney', 'Lipid + HbA1c', 'Urine Routine'],
    details: [],
  },
}

// ─── Resolved-test snapshots (pre-computed, mirrors what confirm() would produce) ──

function bloodTests(pkgId: string, testIds: string[]): object[] {
  const defs: Record<string, { name: string; cost: number; sampleType: string }> = {
    [TEST_IDS.cbc]:   { name: 'Complete Blood Count (CBC)',        cost: 200, sampleType: 'blood' },
    [TEST_IDS.tsh]:   { name: 'Thyroid Stimulating Hormone (TSH)', cost: 300, sampleType: 'blood' },
    [TEST_IDS.rbs]:   { name: 'Random Blood Sugar (RBS)',          cost: 150, sampleType: 'blood' },
    [TEST_IDS.hba1c]: { name: 'HbA1c (Glycated Hemoglobin)',       cost: 400, sampleType: 'blood' },
    [TEST_IDS.lipid]: { name: 'Lipid Profile',                     cost: 500, sampleType: 'blood' },
    [TEST_IDS.lft]:   { name: 'Liver Function Test (LFT)',         cost: 600, sampleType: 'blood' },
    [TEST_IDS.kft]:   { name: 'Kidney Function Test (KFT)',        cost: 400, sampleType: 'blood' },
    [TEST_IDS.urine]: { name: 'Urine Routine & Microscopy',        cost: 200, sampleType: 'urine' },
  }
  return testIds.map(id => ({ testId: id, origin: 'package', sourcePackageId: pkgId, ...defs[id] }))
}

const RESOLVED = {
  basic:    bloodTests(PKG_IDS.basic,    [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs]),
  economy:  bloodTests(PKG_IDS.economy,  [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs, TEST_IDS.hba1c, TEST_IDS.lipid]),
  advanced: bloodTests(PKG_IDS.advanced, [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs, TEST_IDS.hba1c, TEST_IDS.lipid, TEST_IDS.lft, TEST_IDS.kft, TEST_IDS.urine]),
}

const COST = { basic: 650, economy: 1550, advanced: 2750 }

// ─── Patients ─────────────────────────────────────────────────────────────────

const PATIENTS: Record<string, Record<string, unknown>> = {
  [PATIENT_IDS.ravi]:   { uid: PATIENT_IDS.ravi,   name: 'Ravi Kumar',      phone: '9876543210', email: 'ravi@celltale.dev',   gender: 'Male',   age: 35, role: 'patient', createdAt: ts(daysAgo(30)) },
  [PATIENT_IDS.priya]:  { uid: PATIENT_IDS.priya,  name: 'Priya Sharma',    phone: '9876543211', email: 'priya@celltale.dev',  gender: 'Female', age: 28, role: 'patient', createdAt: ts(daysAgo(25)) },
  [PATIENT_IDS.anand]:  { uid: PATIENT_IDS.anand,  name: 'Anand Patel',     phone: '9876543212', email: 'anand@celltale.dev',  gender: 'Male',   age: 45, role: 'patient', createdAt: ts(daysAgo(20)) },
  [PATIENT_IDS.meena]:  { uid: PATIENT_IDS.meena,  name: 'Meena Krishnan',  phone: '9876543213', email: 'meena@celltale.dev',  gender: 'Female', age: 52, role: 'patient', createdAt: ts(daysAgo(15)) },
  [PATIENT_IDS.suresh]: { uid: PATIENT_IDS.suresh, name: 'Suresh Babu',     phone: '9876543214', email: 'suresh@celltale.dev', gender: 'Male',   age: 30, role: 'patient', createdAt: ts(daysAgo(12)) },
}

// ─── Appointments ─────────────────────────────────────────────────────────────

const APPOINTMENTS: Record<string, object> = {
  'appt-001': {
    patientId: PATIENT_IDS.ravi, patientName: 'Ravi Kumar', patientPhone: '9876543210',
    packages: [{ packageId: PKG_IDS.basic, packageName: 'Basic Screening Package', priceAtBooking: 1599 }],
    manualTestIds: [], resolvedTests: [], sampleIds: [], totalCost: 0,
    date: now.toISOString().slice(0, 10), timeSlot: '09:00 AM',
    collectionAddress: '12 Anna Nagar, Puducherry - 605001',
    status: 'Created', notes: 'Walk-in registration',
    createdAt: ts(daysAgo(0)), updatedAt: ts(daysAgo(0)),
  },
  'appt-002': {
    patientId: PATIENT_IDS.priya, patientName: 'Priya Sharma', patientPhone: '9876543211',
    packages: [{ packageId: PKG_IDS.economy, packageName: 'Economy Disease Checkup', priceAtBooking: 2599 }],
    manualTestIds: [], resolvedTests: RESOLVED.economy, sampleIds: [], totalCost: COST.economy,
    date: daysAgo(1).toISOString().slice(0, 10), timeSlot: '08:30 AM',
    collectionAddress: '45 MG Road, Puducherry - 605001',
    status: 'Confirmed',
    createdAt: ts(daysAgo(2)), updatedAt: ts(daysAgo(1)),
  },
  'appt-003': {
    patientId: PATIENT_IDS.anand, patientName: 'Anand Patel', patientPhone: '9876543212',
    packages: [{ packageId: PKG_IDS.advanced, packageName: 'Advanced Prevention', priceAtBooking: 3599 }],
    manualTestIds: [], resolvedTests: RESOLVED.advanced, sampleIds: ['samp-001', 'samp-002'], totalCost: COST.advanced,
    date: daysAgo(3).toISOString().slice(0, 10), timeSlot: '07:30 AM',
    collectionAddress: '7 Nehru Street, Puducherry - 605001',
    status: 'SamplesGenerated',
    createdAt: ts(daysAgo(5)), updatedAt: ts(daysAgo(3)),
  },
  'appt-004': {
    patientId: PATIENT_IDS.meena, patientName: 'Meena Krishnan', patientPhone: '9876543213',
    packages: [{ packageId: PKG_IDS.economy, packageName: 'Economy Disease Checkup', priceAtBooking: 2599 }],
    manualTestIds: [], resolvedTests: RESOLVED.economy, sampleIds: ['samp-003'], totalCost: COST.economy,
    date: daysAgo(5).toISOString().slice(0, 10), timeSlot: '10:00 AM',
    collectionAddress: '23 Romain Rolland Street, Puducherry - 605001',
    status: 'SamplesCollected',
    createdAt: ts(daysAgo(7)), updatedAt: ts(daysAgo(5)),
  },
  'appt-005': {
    patientId: PATIENT_IDS.suresh, patientName: 'Suresh Babu', patientPhone: '9876543214',
    packages: [{ packageId: PKG_IDS.basic, packageName: 'Basic Screening Package', priceAtBooking: 1599 }],
    manualTestIds: [], resolvedTests: RESOLVED.basic, sampleIds: ['samp-004'], totalCost: COST.basic,
    date: daysAgo(7).toISOString().slice(0, 10), timeSlot: '08:00 AM',
    collectionAddress: '56 Lal Bahadur Shastri Street, Puducherry - 605001',
    status: 'ReportUploaded', invoiceId: 'inv-001',
    createdAt: ts(daysAgo(9)), updatedAt: ts(daysAgo(7)),
  },
  'appt-006': {
    patientId: PATIENT_IDS.ravi, patientName: 'Ravi Kumar', patientPhone: '9876543210',
    packages: [{ packageId: PKG_IDS.economy, packageName: 'Economy Disease Checkup', priceAtBooking: 2599 }],
    manualTestIds: [], resolvedTests: RESOLVED.economy, sampleIds: ['samp-005'], totalCost: COST.economy,
    date: daysAgo(10).toISOString().slice(0, 10), timeSlot: '09:30 AM',
    collectionAddress: '12 Anna Nagar, Puducherry - 605001',
    status: 'Completed', invoiceId: 'inv-002',
    createdAt: ts(daysAgo(12)), updatedAt: ts(daysAgo(10)),
  },
}

// ─── Samples ─────────────────────────────────────────────────────────────────

const SAMPLES: Record<string, object> = {
  'samp-001': {
    appointmentId: 'appt-003', patientId: PATIENT_IDS.anand, sampleType: 'blood',
    testIds: [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs, TEST_IDS.hba1c, TEST_IDS.lipid, TEST_IDS.lft, TEST_IDS.kft],
    barcodeId: 'S-2026-000001', collectionStatus: 'pending',
    createdAt: ts(daysAgo(3)), updatedAt: ts(daysAgo(3)),
  },
  'samp-002': {
    appointmentId: 'appt-003', patientId: PATIENT_IDS.anand, sampleType: 'urine',
    testIds: [TEST_IDS.urine],
    barcodeId: 'S-2026-000002', collectionStatus: 'pending',
    createdAt: ts(daysAgo(3)), updatedAt: ts(daysAgo(3)),
  },
  'samp-003': {
    appointmentId: 'appt-004', patientId: PATIENT_IDS.meena, sampleType: 'blood',
    testIds: [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs, TEST_IDS.hba1c, TEST_IDS.lipid],
    barcodeId: 'S-2026-000003', collectionStatus: 'collected',
    collector: 'Dr. Anitha', collectionDatetime: ts(daysAgo(5)),
    createdAt: ts(daysAgo(5)), updatedAt: ts(daysAgo(5)),
  },
  'samp-004': {
    appointmentId: 'appt-005', patientId: PATIENT_IDS.suresh, sampleType: 'blood',
    testIds: [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs],
    barcodeId: 'S-2026-000004', collectionStatus: 'collected',
    collector: 'Dr. Anitha', collectionDatetime: ts(daysAgo(7)),
    createdAt: ts(daysAgo(7)), updatedAt: ts(daysAgo(7)),
  },
  'samp-005': {
    appointmentId: 'appt-006', patientId: PATIENT_IDS.ravi, sampleType: 'blood',
    testIds: [TEST_IDS.cbc, TEST_IDS.tsh, TEST_IDS.rbs, TEST_IDS.hba1c, TEST_IDS.lipid],
    barcodeId: 'S-2026-000005', collectionStatus: 'collected',
    collector: 'Dr. Anitha', collectionDatetime: ts(daysAgo(10)),
    createdAt: ts(daysAgo(10)), updatedAt: ts(daysAgo(10)),
  },
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

const INVOICES: Record<string, object> = {
  'inv-001': {
    invoiceNumber: 1, date: daysAgo(7).toISOString().slice(0, 10),
    billToName: 'Suresh Babu', billToContact: '9876543214',
    appointmentId: 'appt-005', patientId: PATIENT_IDS.suresh,
    lineItems: [{ itemName: 'Basic Screening Package', hsnSac: '999316', quantity: 1, pricePerUnit: 1599, discountPercent: 0 }],
    receivedAmount: 1599,
    createdAt: ts(daysAgo(7)), updatedAt: ts(daysAgo(7)),
  },
  'inv-002': {
    invoiceNumber: 2, date: daysAgo(10).toISOString().slice(0, 10),
    billToName: 'Ravi Kumar', billToContact: '9876543210',
    appointmentId: 'appt-006', patientId: PATIENT_IDS.ravi,
    lineItems: [{ itemName: 'Economy Disease Checkup', hsnSac: '999316', quantity: 1, pricePerUnit: 2599, discountPercent: 0 }],
    receivedAmount: 2599,
    createdAt: ts(daysAgo(10)), updatedAt: ts(daysAgo(10)),
  },
}

// ─── Reports ─────────────────────────────────────────────────────────────────

const REPORTS: Record<string, object> = {
  'rep-001': {
    appointmentId: 'appt-005', patientId: PATIENT_IDS.suresh,
    uploadedAt: ts(daysAgo(6)),
    summary: 'All parameters within normal range. Patient advised for follow-up in 6 months.',
    testValues: [
      { category: 'CBC',     name: 'Hemoglobin',      value: '14.2', unit: 'g/dL',    normalRange: '13.5-17.5', isAbnormal: false },
      { category: 'CBC',     name: 'Total WBC Count', value: '7800',  unit: '×10³/µL', normalRange: '4500-11000', isAbnormal: false },
      { category: 'CBC',     name: 'Platelet Count',  value: '220',   unit: '×10³/µL', normalRange: '150-400',   isAbnormal: false },
      { category: 'Thyroid', name: 'TSH',             value: '2.1',   unit: 'mIU/L',  normalRange: '0.4-4.0',   isAbnormal: false },
      { category: 'Sugar',   name: 'RBS',             value: '105',   unit: 'mg/dL',  normalRange: '70-140',    isAbnormal: false },
    ],
  },
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG: Record<string, object> = {
  invoiceCounter: { lastNumber: 2 },
  sampleCounter:  { year: 2026, seq: 5 },
  clinic: {
    name: 'Cell Tale Diagnostics',
    tagline: 'Every cell in you tells a story',
    addressLines: ['First Floor B-3 Industrial Estate Puducherry'],
    phone: '8838720883',
    email: 'celltalediagnostics@gmail.com',
    gstin: '34HCIPS0270R1ZW',
    state: '34-Puducherry',
    bankName: 'City Union Bank',
    bankAccountNumber: '510909010300011',
    bankIfsc: 'CIUB0000678',
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n=== Seeding Firebase emulator ===\n')

  // Auth users
  console.log('Creating auth users...')
  await createAuthUser('admin-seed', 'admin@celltale.dev',  'Admin@123',   'Admin',         undefined)
  await createAuthUser(PATIENT_IDS.ravi,   'ravi@celltale.dev',   'Patient@123', 'Ravi Kumar',    '+919876543210')
  await createAuthUser(PATIENT_IDS.priya,  'priya@celltale.dev',  'Patient@123', 'Priya Sharma',  '+919876543211')
  await createAuthUser(PATIENT_IDS.anand,  'anand@celltale.dev',  'Patient@123', 'Anand Patel',   '+919876543212')
  await createAuthUser(PATIENT_IDS.meena,  'meena@celltale.dev',  'Patient@123', 'Meena Krishnan','+919876543213')
  await createAuthUser(PATIENT_IDS.suresh, 'suresh@celltale.dev', 'Patient@123', 'Suresh Babu',   '+919876543214')

  // Admin Firestore doc
  await db.doc('users/admin-seed').set({
    uid: 'admin-seed', name: 'Admin', email: 'admin@celltale.dev',
    phone: '', role: 'admin', createdAt: ts(daysAgo(60)),
  })
  console.log('  firestore  users/admin-seed')

  // Batch-write everything else
  const batch = db.batch()

  const write = (col: string, id: string, data: object) => {
    batch.set(db.doc(`${col}/${id}`), {
      ...data,
      ...(col === 'tests' || col === 'packages' ? {
        createdAt: ts(daysAgo(30)), updatedAt: ts(daysAgo(30)),
      } : {}),
    })
    console.log(`  firestore  ${col}/${id}`)
  }

  console.log('\nWriting tests...')
  for (const [id, data] of Object.entries(TESTS)) write('tests', id, data)

  console.log('\nWriting packages...')
  for (const [id, data] of Object.entries(PACKAGES)) write('packages', id, data)

  console.log('\nWriting patients...')
  for (const [id, data] of Object.entries(PATIENTS)) write('users', id, data)

  console.log('\nWriting appointments...')
  for (const [id, data] of Object.entries(APPOINTMENTS)) write('appointments', id, data)

  console.log('\nWriting samples...')
  for (const [id, data] of Object.entries(SAMPLES)) write('samples', id, data)

  console.log('\nWriting invoices...')
  for (const [id, data] of Object.entries(INVOICES)) write('invoices', id, data)

  console.log('\nWriting reports...')
  for (const [id, data] of Object.entries(REPORTS)) write('reports', id, data)

  console.log('\nWriting config...')
  for (const [id, data] of Object.entries(CONFIG)) write('config', id, data)

  await batch.commit()

  console.log('\n✓ Done!\n')
  console.log('─────────────────────────────────────────')
  console.log('Admin login:    admin@celltale.dev  /  Admin@123')
  console.log('Patient login:  ravi@celltale.dev   /  Patient@123')
  console.log('               (same password for all 5 patients)')
  console.log('─────────────────────────────────────────')
  console.log('Appointments seeded:')
  console.log('  appt-001  Ravi Kumar      → Created')
  console.log('  appt-002  Priya Sharma    → Confirmed')
  console.log('  appt-003  Anand Patel     → SamplesGenerated')
  console.log('  appt-004  Meena Krishnan  → SamplesCollected')
  console.log('  appt-005  Suresh Babu     → ReportUploaded  (inv-001, rep-001)')
  console.log('  appt-006  Ravi Kumar      → Completed       (inv-002)')
  console.log('─────────────────────────────────────────\n')
}

seed().catch((err) => { console.error(err); process.exit(1) })
