/**
 * Seed the local Firebase emulator.
 * Run from the api/ directory: node seed-emulator.js
 */

process.env.FIRESTORE_EMULATOR_HOST  = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'

const admin = require('firebase-admin')
const { Timestamp } = require('firebase-admin/firestore')
const { CATALOG } = require('./catalog/tests')

admin.initializeApp({ projectId: 'celltalediagnostics-8f817' })
const db   = admin.firestore()
const auth = admin.auth()

const now     = new Date()
const ago     = (n) => new Date(now.getTime() - n * 86_400_000)
const ts      = (d) => Timestamp.fromDate(d)

// ─── IDs ─────────────────────────────────────────────────────────────────────

const T = {
  cbc:   'test-cbc',
  tsh:   'test-tsh',
  rbs:   'test-rbs',
  hba1c: 'test-hba1c',
  lipid: 'test-lipid',
  lft:   'test-lft',
  kft:   'test-kft',
  urine: 'test-urine',
}

const PKG = { basic: 'basic', economy: 'economy', advanced: 'advanced' }

const PID = {
  ravi:   'patient-001',
  priya:  'patient-002',
  anand:  'patient-003',
  meena:  'patient-004',
  suresh: 'patient-005',
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function upsertAuthUser(uid, email, password, displayName, phone) {
  try { await auth.deleteUser(uid) } catch {}
  await auth.createUser({ uid, email, password, displayName, ...(phone ? { phoneNumber: phone } : {}) })
  console.log(`  auth  ${email}`)
}

// ─── Build test data from catalog ────────────────────────────────────────────

const CATALOG_MAP = Object.fromEntries(CATALOG.map((t) => [t.id, t]))

// Tests that are active in the emulator (used by seed packages/appointments)
const ACTIVE_IN_EMULATOR = new Set(Object.values(T))

// ─── Resolved-test snapshots ──────────────────────────────────────────────────

const TEST_META = Object.fromEntries(
  Object.values(T).map((id) => {
    const c = CATALOG_MAP[id]
    return [id, { name: c.name, cost: c.cost, sampleType: c.sampleType }]
  }),
)

const resolve = (pkgId, ids) =>
  ids.map(id => ({ testId: id, origin: 'package', sourcePackageId: pkgId, ...TEST_META[id] }))

const RESOLVED = {
  basic:    resolve(PKG.basic,    [T.cbc, T.tsh, T.rbs]),
  economy:  resolve(PKG.economy,  [T.cbc, T.tsh, T.rbs, T.hba1c, T.lipid]),
  advanced: resolve(PKG.advanced, [T.cbc, T.tsh, T.rbs, T.hba1c, T.lipid, T.lft, T.kft, T.urine]),
}

const COST = { basic: 650, economy: 1550, advanced: 2750 }

// ─── Data ─────────────────────────────────────────────────────────────────────

// Build all test documents from catalog, marking the 8 demo tests as active
const ALL_TESTS = CATALOG.reduce((acc, entry) => {
  const { id, ...fields } = entry
  acc[id] = {
    ...fields,
    isActive: ACTIVE_IN_EMULATOR.has(id),
    createdAt: ts(ago(30)),
    updatedAt: ts(ago(30)),
  }
  return acc
}, {})

const PACKAGES = {
  [PKG.basic]: {
    id: PKG.basic,
    name: 'Basic Screening Package', price: 1599, testCount: 30, isPopular: false, order: 0,
    testIds: [T.cbc, T.tsh, T.rbs],
    color: 'bg-white border-slate-200', headerColor: 'text-slate-800',
    buttonColor: 'bg-slate-800 hover:bg-slate-700 text-white',

    summary: ['Blood-CBC (17 Parameters)', 'Thyroid (TSH)', 'Sugar (RBS)', 'Vitals (6)'],
    details: [],
  },
  [PKG.economy]: {
    id: PKG.economy,
    name: 'Economy Disease Checkup', price: 2599, testCount: 42, isPopular: true, order: 1,
    testIds: [T.cbc, T.tsh, T.rbs, T.hba1c, T.lipid],
    color: 'bg-blue-50 border-blue-200', headerColor: 'text-blue-700',
    buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',

    summary: ['Blood-CBC (17 Parameters)', 'Thyroid (T3, T4, TSH)', 'HbA1c + Lipid Profile', 'Sugar (RBS)'],
    details: [],
  },
  [PKG.advanced]: {
    id: PKG.advanced,
    name: 'Advanced Prevention', price: 3599, testCount: 56, isPopular: false, order: 2,
    testIds: [T.cbc, T.tsh, T.rbs, T.hba1c, T.lipid, T.lft, T.kft, T.urine],
    color: 'bg-white border-slate-200', headerColor: 'text-slate-800',
    buttonColor: 'bg-slate-800 hover:bg-slate-700 text-white',

    summary: ['Full Blood Panel', 'Liver & Kidney Function', 'Lipid + HbA1c', 'Urine Routine'],
    details: [],
  },
}

const PATIENTS = {
  [PID.ravi]:   { uid: PID.ravi,   name: 'Ravi Kumar',     phone: '9876543210', email: 'ravi@celltale.dev',   gender: 'Male',   age: 35, role: 'patient', createdAt: ts(ago(30)) },
  [PID.priya]:  { uid: PID.priya,  name: 'Priya Sharma',   phone: '9876543211', email: 'priya@celltale.dev',  gender: 'Female', age: 28, role: 'patient', createdAt: ts(ago(25)) },
  [PID.anand]:  { uid: PID.anand,  name: 'Anand Patel',    phone: '9876543212', email: 'anand@celltale.dev',  gender: 'Male',   age: 45, role: 'patient', createdAt: ts(ago(20)) },
  [PID.meena]:  { uid: PID.meena,  name: 'Meena Krishnan', phone: '9876543213', email: 'meena@celltale.dev',  gender: 'Female', age: 52, role: 'patient', createdAt: ts(ago(15)) },
  [PID.suresh]: { uid: PID.suresh, name: 'Suresh Babu',    phone: '9876543214', email: 'suresh@celltale.dev', gender: 'Male',   age: 30, role: 'patient', createdAt: ts(ago(12)) },
}

const APPOINTMENTS = {
  'appt-001': {
    patientId: PID.ravi, patientName: 'Ravi Kumar', patientPhone: '9876543210',
    packages: [{ packageId: PKG.basic, packageName: 'Basic Screening Package', priceAtBooking: 1599 }],
    manualTestIds: [], resolvedTests: [], sampleIds: [], totalCost: 0,
    date: now.toISOString().slice(0, 10), timeSlot: '09:00 AM',
    collectionAddress: '12 Anna Nagar, Puducherry - 605001',
    status: 'Created', notes: 'Walk-in registration',
    createdAt: ts(ago(0)), updatedAt: ts(ago(0)),
  },
  'appt-002': {
    patientId: PID.priya, patientName: 'Priya Sharma', patientPhone: '9876543211',
    packages: [{ packageId: PKG.economy, packageName: 'Economy Disease Checkup', priceAtBooking: 2599 }],
    manualTestIds: [], resolvedTests: RESOLVED.economy, sampleIds: [], totalCost: COST.economy,
    date: ago(1).toISOString().slice(0, 10), timeSlot: '08:30 AM',
    collectionAddress: '45 MG Road, Puducherry - 605001',
    status: 'Confirmed',
    createdAt: ts(ago(2)), updatedAt: ts(ago(1)),
  },
  'appt-003': {
    patientId: PID.anand, patientName: 'Anand Patel', patientPhone: '9876543212',
    packages: [{ packageId: PKG.advanced, packageName: 'Advanced Prevention', priceAtBooking: 3599 }],
    manualTestIds: [], resolvedTests: RESOLVED.advanced, sampleIds: ['samp-001', 'samp-002'], totalCost: COST.advanced,
    date: ago(3).toISOString().slice(0, 10), timeSlot: '07:30 AM',
    collectionAddress: '7 Nehru Street, Puducherry - 605001',
    status: 'SamplesGenerated',
    createdAt: ts(ago(5)), updatedAt: ts(ago(3)),
  },
  'appt-004': {
    patientId: PID.meena, patientName: 'Meena Krishnan', patientPhone: '9876543213',
    packages: [{ packageId: PKG.economy, packageName: 'Economy Disease Checkup', priceAtBooking: 2599 }],
    manualTestIds: [], resolvedTests: RESOLVED.economy, sampleIds: ['samp-003'], totalCost: COST.economy,
    date: ago(5).toISOString().slice(0, 10), timeSlot: '10:00 AM',
    collectionAddress: '23 Romain Rolland Street, Puducherry - 605001',
    status: 'SamplesCollected',
    createdAt: ts(ago(7)), updatedAt: ts(ago(5)),
  },
  'appt-005': {
    patientId: PID.suresh, patientName: 'Suresh Babu', patientPhone: '9876543214',
    packages: [{ packageId: PKG.basic, packageName: 'Basic Screening Package', priceAtBooking: 1599 }],
    manualTestIds: [], resolvedTests: RESOLVED.basic, sampleIds: ['samp-004'], totalCost: COST.basic,
    date: ago(7).toISOString().slice(0, 10), timeSlot: '08:00 AM',
    collectionAddress: '56 LB Shastri Street, Puducherry - 605001',
    status: 'ReportUploaded', invoiceId: 'inv-001',
    createdAt: ts(ago(9)), updatedAt: ts(ago(7)),
  },
  'appt-006': {
    patientId: PID.ravi, patientName: 'Ravi Kumar', patientPhone: '9876543210',
    packages: [{ packageId: PKG.economy, packageName: 'Economy Disease Checkup', priceAtBooking: 2599 }],
    manualTestIds: [], resolvedTests: RESOLVED.economy, sampleIds: ['samp-005'], totalCost: COST.economy,
    date: ago(10).toISOString().slice(0, 10), timeSlot: '09:30 AM',
    collectionAddress: '12 Anna Nagar, Puducherry - 605001',
    status: 'Completed', invoiceId: 'inv-002',
    createdAt: ts(ago(12)), updatedAt: ts(ago(10)),
  },
}

const SAMPLES = {
  'samp-001': {
    appointmentId: 'appt-003', patientId: PID.anand, sampleType: 'blood',
    testIds: [T.cbc, T.tsh, T.rbs, T.hba1c, T.lipid, T.lft, T.kft],
    barcodeId: 'S-2026-000001', collectionStatus: 'pending',
    createdAt: ts(ago(3)), updatedAt: ts(ago(3)),
  },
  'samp-002': {
    appointmentId: 'appt-003', patientId: PID.anand, sampleType: 'urine',
    testIds: [T.urine],
    barcodeId: 'S-2026-000002', collectionStatus: 'pending',
    createdAt: ts(ago(3)), updatedAt: ts(ago(3)),
  },
  'samp-003': {
    appointmentId: 'appt-004', patientId: PID.meena, sampleType: 'blood',
    testIds: [T.cbc, T.tsh, T.rbs, T.hba1c, T.lipid],
    barcodeId: 'S-2026-000003', collectionStatus: 'collected',
    collector: 'Dr. Anitha', collectionDatetime: ts(ago(5)),
    createdAt: ts(ago(5)), updatedAt: ts(ago(5)),
  },
  'samp-004': {
    appointmentId: 'appt-005', patientId: PID.suresh, sampleType: 'blood',
    testIds: [T.cbc, T.tsh, T.rbs],
    barcodeId: 'S-2026-000004', collectionStatus: 'collected',
    collector: 'Dr. Anitha', collectionDatetime: ts(ago(7)),
    createdAt: ts(ago(7)), updatedAt: ts(ago(7)),
  },
  'samp-005': {
    appointmentId: 'appt-006', patientId: PID.ravi, sampleType: 'blood',
    testIds: [T.cbc, T.tsh, T.rbs, T.hba1c, T.lipid],
    barcodeId: 'S-2026-000005', collectionStatus: 'collected',
    collector: 'Dr. Anitha', collectionDatetime: ts(ago(10)),
    createdAt: ts(ago(10)), updatedAt: ts(ago(10)),
  },
}

const INVOICES = {
  'inv-001': {
    invoiceNumber: 1, date: ago(7).toISOString().slice(0, 10),
    billToName: 'Suresh Babu', billToContact: '9876543214',
    appointmentId: 'appt-005', patientId: PID.suresh,
    lineItems: [{ itemName: 'Basic Screening Package', hsnSac: '999316', quantity: 1, pricePerUnit: 1599, discountPercent: 0 }],
    receivedAmount: 1599,
    createdAt: ts(ago(7)), updatedAt: ts(ago(7)),
  },
  'inv-002': {
    invoiceNumber: 2, date: ago(10).toISOString().slice(0, 10),
    billToName: 'Ravi Kumar', billToContact: '9876543210',
    appointmentId: 'appt-006', patientId: PID.ravi,
    lineItems: [{ itemName: 'Economy Disease Checkup', hsnSac: '999316', quantity: 1, pricePerUnit: 2599, discountPercent: 0 }],
    receivedAmount: 2599,
    createdAt: ts(ago(10)), updatedAt: ts(ago(10)),
  },
}

const REPORTS = {
  'rep-001': {
    appointmentId: 'appt-005', patientId: PID.suresh,
    uploadedAt: ts(ago(6)),
    summary: 'All parameters within normal range. Patient advised for follow-up in 6 months.',
    testValues: [
      { category: 'CBC',     name: 'Hemoglobin',      value: '14.2', unit: 'g/dL',    normalRange: '13.5-17.5', isAbnormal: false },
      { category: 'CBC',     name: 'Total WBC Count', value: '7800',  unit: '×10³/µL', normalRange: '4500-11000', isAbnormal: false },
      { category: 'CBC',     name: 'Platelet Count',  value: '220',   unit: '×10³/µL', normalRange: '150-400',   isAbnormal: false },
      { category: 'Thyroid', name: 'TSH',             value: '2.1',   unit: 'mIU/L',  normalRange: '0.4-4.0',   isAbnormal: false },
      { category: 'Sugar',   name: 'RBS',             value: '105',   unit: 'mg/dL',  normalRange: '70-140',    isAbnormal: false },
    ],
    testIds: [T.cbc, T.tsh, T.rbs],
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n=== Seeding Firebase emulator ===\n')

  console.log('Creating auth users...')
  await upsertAuthUser('admin-seed',   'admin@celltale.dev',   'Admin@123',   'Admin')
  await upsertAuthUser(PID.ravi,   'ravi@celltale.dev',   'Patient@123', 'Ravi Kumar',     '+919876543210')
  await upsertAuthUser(PID.priya,  'priya@celltale.dev',  'Patient@123', 'Priya Sharma',   '+919876543211')
  await upsertAuthUser(PID.anand,  'anand@celltale.dev',  'Patient@123', 'Anand Patel',    '+919876543212')
  await upsertAuthUser(PID.meena,  'meena@celltale.dev',  'Patient@123', 'Meena Krishnan', '+919876543213')
  await upsertAuthUser(PID.suresh, 'suresh@celltale.dev', 'Patient@123', 'Suresh Babu',    '+919876543214')

  const batch = db.batch()
  const set = (col, id, data) => {
    batch.set(db.doc(`${col}/${id}`), data)
    console.log(`  ${col}/${id}`)
  }

  // Admin Firestore profile
  console.log('\nWriting admin profile...')
  set('users', 'admin-seed', { uid: 'admin-seed', name: 'Admin', email: 'admin@celltale.dev', phone: '', role: 'admin', createdAt: ts(ago(60)) })

  console.log('\nWriting tests (catalog)...')
  for (const [id, data] of Object.entries(ALL_TESTS)) set('tests', id, data)

  console.log('\nWriting packages...')
  for (const [id, data] of Object.entries(PACKAGES)) set('packages', id, data)

  console.log('\nWriting patients...')
  for (const [id, data] of Object.entries(PATIENTS)) set('users', id, data)

  console.log('\nWriting appointments...')
  for (const [id, data] of Object.entries(APPOINTMENTS)) set('appointments', id, data)

  console.log('\nWriting samples...')
  for (const [id, data] of Object.entries(SAMPLES)) set('samples', id, data)

  console.log('\nWriting invoices...')
  for (const [id, data] of Object.entries(INVOICES)) set('invoices', id, data)

  console.log('\nWriting reports...')
  for (const [id, data] of Object.entries(REPORTS)) set('reports', id, data)

  console.log('\nWriting config...')
  set('config', 'invoiceCounter', { lastNumber: 2 })
  set('config', 'sampleCounter',  { year: 2026, seq: 5 })
  set('config', 'clinic', {
    name: 'Cell Tale Diagnostics', tagline: 'Every cell in you tells a story',
    addressLines: ['First Floor B-3 Industrial Estate Puducherry'],
    phone: '8838720883', email: 'celltalediagnostics@gmail.com',
    gstin: '34HCIPS0270R1ZW', state: '34-Puducherry',
    bankName: 'City Union Bank', bankAccountNumber: '510909010300011', bankIfsc: 'CIUB0000678',
  })

  await batch.commit()

  console.log('\n✓ Seed complete!\n')
  console.log('─────────────────────────────────────────────────────')
  console.log('Admin login :   admin@celltale.dev   /  Admin@123')
  console.log('Patient login:  ravi@celltale.dev    /  Patient@123')
  console.log('               (all 5 patients share Patient@123)')
  console.log('─────────────────────────────────────────────────────')
  console.log('Appointments:')
  console.log('  appt-001  Ravi Kumar      Today        Created')
  console.log('  appt-002  Priya Sharma    Yesterday    Confirmed')
  console.log('  appt-003  Anand Patel     3 days ago   SamplesGenerated')
  console.log('  appt-004  Meena Krishnan  5 days ago   SamplesCollected')
  console.log('  appt-005  Suresh Babu     7 days ago   ReportUploaded  + invoice + report')
  console.log('  appt-006  Ravi Kumar      10 days ago  Completed       + invoice')
  console.log('─────────────────────────────────────────────────────\n')
}

seed().catch(err => { console.error(err); process.exit(1) })
