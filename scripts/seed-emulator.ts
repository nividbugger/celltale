/**
 * Seed script for the local Firebase emulator.
 * Run from the scripts/ directory: npx ts-node seed-emulator.ts
 *
 * Creates:
 *   - 1 admin user  (admin@celltale.dev / admin123)
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

const PKG_IDS = { basic: 'basic', economy: 'economy', advanced: 'advanced' }

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

// ─── Diagnostic Parameters ───────────────────────────────────────────────────
// Source: diagnostic_parameter_catalog.json v1.0.0
// "Yellow (urine cup)" normalised to "Yellow" (same colour, additive field clarifies context)

const DIAGNOSTIC_PARAMETERS = [
  { code: 'WBC',      analyzer: 'sysmex',  loinc: '6690-2',    name: 'White blood cell count',           discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 4.0,   refHigh: 11.0, sex: 'ALL', refText: null },
  { code: 'RBC',      analyzer: 'sysmex',  loinc: '789-8',     name: 'Red blood cell count',             discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*6/uL',     refLow: 4.5,   refHigh: 5.9,  sex: 'M',   refText: null },
  { code: 'RBC',      analyzer: 'sysmex',  loinc: '789-8',     name: 'Red blood cell count',             discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*6/uL',     refLow: 4.1,   refHigh: 5.1,  sex: 'F',   refText: null },
  { code: 'HGB',      analyzer: 'sysmex',  loinc: '718-7',     name: 'Hemoglobin',                       discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'g/dL',        refLow: 13.5,  refHigh: 17.5, sex: 'M',   refText: null },
  { code: 'HGB',      analyzer: 'sysmex',  loinc: '718-7',     name: 'Hemoglobin',                       discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'g/dL',        refLow: 12.0,  refHigh: 15.5, sex: 'F',   refText: null },
  { code: 'HCT',      analyzer: 'sysmex',  loinc: '4544-3',    name: 'Hematocrit',                       discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 41.0,  refHigh: 53.0, sex: 'M',   refText: null },
  { code: 'HCT',      analyzer: 'sysmex',  loinc: '4544-3',    name: 'Hematocrit',                       discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 36.0,  refHigh: 46.0, sex: 'F',   refText: null },
  { code: 'MCV',      analyzer: 'sysmex',  loinc: '787-2',     name: 'Mean corpuscular volume',          discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'fL',          refLow: 80.0,  refHigh: 100.0,sex: 'ALL', refText: null },
  { code: 'MCH',      analyzer: 'sysmex',  loinc: '785-6',     name: 'Mean corpuscular hemoglobin',      discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'pg',          refLow: 27.0,  refHigh: 33.0, sex: 'ALL', refText: null },
  { code: 'MCHC',     analyzer: 'sysmex',  loinc: '786-4',     name: 'MCH concentration',                discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'g/dL',        refLow: 32.0,  refHigh: 36.0, sex: 'ALL', refText: null },
  { code: 'RDW-SD',   analyzer: 'sysmex',  loinc: '21000-5',   name: 'RDW standard deviation',           discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'fL',          refLow: 37.0,  refHigh: 54.0, sex: 'ALL', refText: null },
  { code: 'RDW-CV',   analyzer: 'sysmex',  loinc: '788-0',     name: 'RDW coefficient of variation',     discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 11.5,  refHigh: 14.5, sex: 'ALL', refText: null },
  { code: 'PLT',      analyzer: 'sysmex',  loinc: '777-3',     name: 'Platelet count',                   discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 150.0, refHigh: 400.0,sex: 'ALL', refText: null },
  { code: 'MPV',      analyzer: 'sysmex',  loinc: '32623-1',   name: 'Mean platelet volume',             discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'fL',          refLow: 7.5,   refHigh: 11.5, sex: 'ALL', refText: null },
  { code: 'PDW',      analyzer: 'sysmex',  loinc: '32207-3',   name: 'Platelet distribution width',      discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: 'fL',          refLow: 9.0,   refHigh: 17.0, sex: 'ALL', refText: null },
  { code: 'PCT',      analyzer: 'sysmex',  loinc: '51637-7',   name: 'Plateletcrit',                     discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 0.17,  refHigh: 0.35, sex: 'ALL', refText: null },
  { code: 'P-LCR',    analyzer: 'sysmex',  loinc: '48386-7',   name: 'Platelet large cell ratio',        discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 13.0,  refHigh: 43.0, sex: 'ALL', refText: null },
  { code: 'NEUT%',    analyzer: 'sysmex',  loinc: '770-8',     name: 'Neutrophils percent',               discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 40.0,  refHigh: 70.0, sex: 'ALL', refText: null },
  { code: 'LYMPH%',   analyzer: 'sysmex',  loinc: '736-9',     name: 'Lymphocytes percent',               discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 20.0,  refHigh: 40.0, sex: 'ALL', refText: null },
  { code: 'MONO%',    analyzer: 'sysmex',  loinc: '5905-5',    name: 'Monocytes percent',                 discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 2.0,   refHigh: 8.0,  sex: 'ALL', refText: null },
  { code: 'EO%',      analyzer: 'sysmex',  loinc: '713-8',     name: 'Eosinophils percent',               discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 1.0,   refHigh: 4.0,  sex: 'ALL', refText: null },
  { code: 'BASO%',    analyzer: 'sysmex',  loinc: '706-2',     name: 'Basophils percent',                 discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 0.0,   refHigh: 1.0,  sex: 'ALL', refText: null },
  { code: 'NEUT#',    analyzer: 'sysmex',  loinc: '751-8',     name: 'Neutrophils absolute',              discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 2.0,   refHigh: 7.0,  sex: 'ALL', refText: null },
  { code: 'LYMPH#',   analyzer: 'sysmex',  loinc: '731-0',     name: 'Lymphocytes absolute',              discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 1.0,   refHigh: 3.0,  sex: 'ALL', refText: null },
  { code: 'MONO#',    analyzer: 'sysmex',  loinc: '742-7',     name: 'Monocytes absolute',                discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 0.2,   refHigh: 0.8,  sex: 'ALL', refText: null },
  { code: 'EO#',      analyzer: 'sysmex',  loinc: '711-2',     name: 'Eosinophils absolute',              discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 0.02,  refHigh: 0.5,  sex: 'ALL', refText: null },
  { code: 'BASO#',    analyzer: 'sysmex',  loinc: '704-7',     name: 'Basophils absolute',                discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 0.0,   refHigh: 0.1,  sex: 'ALL', refText: null },
  { code: 'IG%',      analyzer: 'sysmex',  loinc: '71695-1',   name: 'Immature granulocytes percent',     discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 0.0,   refHigh: 0.5,  sex: 'ALL', refText: null },
  { code: 'IG#',      analyzer: 'sysmex',  loinc: '53115-2',   name: 'Immature granulocytes absolute',    discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '10*3/uL',     refLow: 0.0,   refHigh: 0.03, sex: 'ALL', refText: null },
  { code: 'MICROR',   analyzer: 'sysmex',  loinc: null,        name: 'Microcytic ratio',                  discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 0.0,   refHigh: 3.0,  sex: 'ALL', refText: null },
  { code: 'MACROR',   analyzer: 'sysmex',  loinc: null,        name: 'Macrocytic ratio',                  discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 0.0,   refHigh: 5.0,  sex: 'ALL', refText: null },
  { code: 'ESR',      analyzer: 'generic', loinc: '30341-2',   name: 'Erythrocyte sedimentation rate',    discipline: 'Hematology',     tubeColor: 'Black',      additive: 'Sodium citrate',          unit: 'mm/hr',       refLow: 0.0,   refHigh: 20.0, sex: 'ALL', refText: null },
  { code: 'RETIC',    analyzer: 'generic', loinc: '17849-1',   name: 'Reticulocyte count',                discipline: 'Hematology',     tubeColor: 'Lavender',   additive: 'K2/K3 EDTA',              unit: '%',           refLow: 0.5,   refHigh: 2.5,  sex: 'ALL', refText: null },
  { code: 'GLU',      analyzer: 'erba',    loinc: '1558-6',    name: 'Glucose (fasting)',                 discipline: 'Chemistry',      tubeColor: 'Grey',       additive: 'Sodium fluoride / K oxalate', unit: 'mg/dL',   refLow: 70.0,  refHigh: 100.0,sex: 'ALL', refText: null },
  { code: 'GLUPP',    analyzer: 'erba',    loinc: '1521-4',    name: 'Glucose 2h postprandial',           discipline: 'Chemistry',      tubeColor: 'Grey',       additive: 'Sodium fluoride / K oxalate', unit: 'mg/dL',   refLow: 0.0,   refHigh: 140.0,sex: 'ALL', refText: null },
  { code: 'BUN',      analyzer: 'erba',    loinc: '3094-0',    name: 'Urea nitrogen (BUN)',               discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 7.0,   refHigh: 20.0, sex: 'ALL', refText: null },
  { code: 'CREA',     analyzer: 'erba',    loinc: '2160-0',    name: 'Creatinine',                        discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 0.7,   refHigh: 1.3,  sex: 'M',   refText: null },
  { code: 'CREA',     analyzer: 'erba',    loinc: '2160-0',    name: 'Creatinine',                        discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 0.6,   refHigh: 1.1,  sex: 'F',   refText: null },
  { code: 'UA',       analyzer: 'erba',    loinc: '3084-1',    name: 'Uric acid',                         discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 3.4,   refHigh: 7.0,  sex: 'M',   refText: null },
  { code: 'UA',       analyzer: 'erba',    loinc: '3084-1',    name: 'Uric acid',                         discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 2.4,   refHigh: 6.0,  sex: 'F',   refText: null },
  { code: 'NA',       analyzer: 'erba',    loinc: '2951-2',    name: 'Sodium',                            discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mmol/L',      refLow: 136.0, refHigh: 145.0,sex: 'ALL', refText: null },
  { code: 'K',        analyzer: 'erba',    loinc: '2823-3',    name: 'Potassium',                         discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mmol/L',      refLow: 3.5,   refHigh: 5.1,  sex: 'ALL', refText: null },
  { code: 'CL',       analyzer: 'erba',    loinc: '2075-0',    name: 'Chloride',                          discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mmol/L',      refLow: 98.0,  refHigh: 107.0,sex: 'ALL', refText: null },
  { code: 'CO2',      analyzer: 'erba',    loinc: '1963-8',    name: 'Bicarbonate',                       discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mmol/L',      refLow: 22.0,  refHigh: 29.0, sex: 'ALL', refText: null },
  { code: 'CA',       analyzer: 'erba',    loinc: '17861-6',   name: 'Calcium',                           discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 8.5,   refHigh: 10.5, sex: 'ALL', refText: null },
  { code: 'PHOS',     analyzer: 'erba',    loinc: '2777-1',    name: 'Phosphorus',                        discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 2.5,   refHigh: 4.5,  sex: 'ALL', refText: null },
  { code: 'MG',       analyzer: 'erba',    loinc: '19123-9',   name: 'Magnesium',                         discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 1.7,   refHigh: 2.2,  sex: 'ALL', refText: null },
  { code: 'TP',       analyzer: 'erba',    loinc: '2885-2',    name: 'Total protein',                     discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'g/dL',        refLow: 6.4,   refHigh: 8.3,  sex: 'ALL', refText: null },
  { code: 'ALB',      analyzer: 'erba',    loinc: '1751-7',    name: 'Albumin',                           discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'g/dL',        refLow: 3.5,   refHigh: 5.0,  sex: 'ALL', refText: null },
  { code: 'GLOB',     analyzer: 'erba',    loinc: '10834-0',   name: 'Globulin (calculated)',             discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'g/dL',        refLow: 2.0,   refHigh: 3.5,  sex: 'ALL', refText: null },
  { code: 'TBIL',     analyzer: 'erba',    loinc: '1975-2',    name: 'Total bilirubin',                   discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 0.1,   refHigh: 1.2,  sex: 'ALL', refText: null },
  { code: 'DBIL',     analyzer: 'erba',    loinc: '1968-7',    name: 'Direct bilirubin',                  discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 0.0,   refHigh: 0.3,  sex: 'ALL', refText: null },
  { code: 'AST',      analyzer: 'erba',    loinc: '1920-8',    name: 'AST (SGOT)',                        discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 10.0,  refHigh: 40.0, sex: 'ALL', refText: null },
  { code: 'ALT',      analyzer: 'erba',    loinc: '1742-6',    name: 'ALT (SGPT)',                        discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 7.0,   refHigh: 56.0, sex: 'ALL', refText: null },
  { code: 'ALP',      analyzer: 'erba',    loinc: '6768-6',    name: 'Alkaline phosphatase',              discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 44.0,  refHigh: 147.0,sex: 'ALL', refText: null },
  { code: 'GGT',      analyzer: 'erba',    loinc: '2324-2',    name: 'Gamma GT',                          discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 8.0,   refHigh: 61.0, sex: 'M',   refText: null },
  { code: 'GGT',      analyzer: 'erba',    loinc: '2324-2',    name: 'Gamma GT',                          discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 5.0,   refHigh: 36.0, sex: 'F',   refText: null },
  { code: 'LDH',      analyzer: 'erba',    loinc: '14804-9',   name: 'Lactate dehydrogenase',             discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 140.0, refHigh: 280.0,sex: 'ALL', refText: null },
  { code: 'AMY',      analyzer: 'erba',    loinc: '1798-8',    name: 'Amylase',                           discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 30.0,  refHigh: 110.0,sex: 'ALL', refText: null },
  { code: 'LIP',      analyzer: 'erba',    loinc: '3040-3',    name: 'Lipase',                            discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 10.0,  refHigh: 140.0,sex: 'ALL', refText: null },
  { code: 'CK',       analyzer: 'erba',    loinc: '2157-6',    name: 'Creatine kinase',                   discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 39.0,  refHigh: 308.0,sex: 'M',   refText: null },
  { code: 'CK',       analyzer: 'erba',    loinc: '2157-6',    name: 'Creatine kinase',                   discipline: 'Chemistry',      tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/L',         refLow: 26.0,  refHigh: 192.0,sex: 'F',   refText: null },
  { code: 'CHOL',     analyzer: 'erba',    loinc: '2093-3',    name: 'Total cholesterol',                 discipline: 'Lipids',         tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: null,  refHigh: 200.0,sex: 'ALL', refText: 'Desirable < 200' },
  { code: 'TRIG',     analyzer: 'erba',    loinc: '2571-8',    name: 'Triglycerides',                     discipline: 'Lipids',         tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: null,  refHigh: 150.0,sex: 'ALL', refText: 'Desirable < 150' },
  { code: 'HDL',      analyzer: 'erba',    loinc: '2085-9',    name: 'HDL cholesterol',                   discipline: 'Lipids',         tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 40.0,  refHigh: null, sex: 'ALL', refText: 'Desirable > 40' },
  { code: 'LDL',      analyzer: 'erba',    loinc: '13457-7',   name: 'LDL cholesterol (calculated)',      discipline: 'Lipids',         tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: null,  refHigh: 100.0,sex: 'ALL', refText: 'Optimal < 100' },
  { code: 'VLDL',     analyzer: 'erba',    loinc: '13458-5',   name: 'VLDL cholesterol (calculated)',     discipline: 'Lipids',         tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/dL',       refLow: 5.0,   refHigh: 40.0, sex: 'ALL', refText: null },
  { code: 'HBA1C',    analyzer: 'generic', loinc: '4548-4',    name: 'Hemoglobin A1c',                    discipline: 'Diabetes',       tubeColor: 'Lavender',   additive: 'EDTA (whole blood)',       unit: '%',           refLow: null,  refHigh: 5.7,  sex: 'ALL', refText: 'Normal < 5.7' },
  { code: 'INS',      analyzer: 'generic', loinc: '20448-7',   name: 'Insulin (fasting)',                 discipline: 'Diabetes',       tubeColor: 'Gold',       additive: 'SST',                     unit: 'uIU/mL',      refLow: 2.6,   refHigh: 24.9, sex: 'ALL', refText: null },
  { code: 'CPEP',     analyzer: 'generic', loinc: '1986-9',    name: 'C-peptide',                         discipline: 'Diabetes',       tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: 1.1,   refHigh: 4.4,  sex: 'ALL', refText: null },
  { code: 'TSH',      analyzer: 'generic', loinc: '3016-3',    name: 'TSH',                               discipline: 'Thyroid',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'uIU/mL',      refLow: 0.4,   refHigh: 4.0,  sex: 'ALL', refText: null },
  { code: 'FT4',      analyzer: 'generic', loinc: '3024-7',    name: 'Free T4',                           discipline: 'Thyroid',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/dL',       refLow: 0.8,   refHigh: 1.8,  sex: 'ALL', refText: null },
  { code: 'FT3',      analyzer: 'generic', loinc: '3051-0',    name: 'Free T3',                           discipline: 'Thyroid',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'pg/mL',       refLow: 2.3,   refHigh: 4.2,  sex: 'ALL', refText: null },
  { code: 'T4',       analyzer: 'generic', loinc: '3026-2',    name: 'Total T4',                          discipline: 'Thyroid',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'ug/dL',       refLow: 4.5,   refHigh: 12.0, sex: 'ALL', refText: null },
  { code: 'T3',       analyzer: 'generic', loinc: '3053-6',    name: 'Total T3',                          discipline: 'Thyroid',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/dL',       refLow: 80.0,  refHigh: 200.0,sex: 'ALL', refText: null },
  { code: 'PT',       analyzer: 'generic', loinc: '5902-2',    name: 'Prothrombin time',                  discipline: 'Coagulation',    tubeColor: 'Light Blue', additive: 'Sodium citrate 3.2%',     unit: 'sec',         refLow: 11.0,  refHigh: 13.5, sex: 'ALL', refText: null },
  { code: 'INR',      analyzer: 'generic', loinc: '6301-6',    name: 'INR',                               discipline: 'Coagulation',    tubeColor: 'Light Blue', additive: 'Sodium citrate 3.2%',     unit: 'ratio',       refLow: 0.8,   refHigh: 1.1,  sex: 'ALL', refText: null },
  { code: 'APTT',     analyzer: 'generic', loinc: '3173-2',    name: 'Activated partial thromboplastin time', discipline: 'Coagulation', tubeColor: 'Light Blue', additive: 'Sodium citrate 3.2%',   unit: 'sec',         refLow: 25.0,  refHigh: 35.0, sex: 'ALL', refText: null },
  { code: 'FIB',      analyzer: 'generic', loinc: '3255-7',    name: 'Fibrinogen',                        discipline: 'Coagulation',    tubeColor: 'Light Blue', additive: 'Sodium citrate 3.2%',     unit: 'mg/dL',       refLow: 200.0, refHigh: 400.0,sex: 'ALL', refText: null },
  { code: 'DDIMER',   analyzer: 'generic', loinc: '48065-7',   name: 'D-dimer',                           discipline: 'Coagulation',    tubeColor: 'Light Blue', additive: 'Sodium citrate 3.2%',     unit: 'ng/mL FEU',   refLow: null,  refHigh: 500.0,sex: 'ALL', refText: 'Normal < 500' },
  { code: 'TNI',      analyzer: 'generic', loinc: '10839-9',   name: 'Troponin I',                        discipline: 'Cardiac',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: null,  refHigh: 0.04, sex: 'ALL', refText: 'Normal < 0.04' },
  { code: 'TNT',      analyzer: 'generic', loinc: '6598-7',    name: 'Troponin T',                        discipline: 'Cardiac',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: null,  refHigh: 0.01, sex: 'ALL', refText: 'Normal < 0.01' },
  { code: 'CKMB',     analyzer: 'generic', loinc: '13969-1',   name: 'CK-MB',                             discipline: 'Cardiac',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: 0.0,   refHigh: 5.0,  sex: 'ALL', refText: null },
  { code: 'BNP',      analyzer: 'generic', loinc: '30934-4',   name: 'BNP',                               discipline: 'Cardiac',        tubeColor: 'Lavender',   additive: 'EDTA (assay dependent, verify)', unit: 'pg/mL', refLow: null,  refHigh: 100.0,sex: 'ALL', refText: 'Normal < 100' },
  { code: 'NTPROBNP', analyzer: 'generic', loinc: '33762-6',   name: 'NT-proBNP',                         discipline: 'Cardiac',        tubeColor: 'Gold',       additive: 'SST',                     unit: 'pg/mL',       refLow: null,  refHigh: 125.0,sex: 'ALL', refText: 'Normal < 125' },
  { code: 'FE',       analyzer: 'generic', loinc: '2498-4',    name: 'Serum iron',                        discipline: 'Iron studies',   tubeColor: 'Gold',       additive: 'SST',                     unit: 'ug/dL',       refLow: 60.0,  refHigh: 170.0,sex: 'ALL', refText: null },
  { code: 'FERR',     analyzer: 'generic', loinc: '2276-4',    name: 'Ferritin',                          discipline: 'Iron studies',   tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: 24.0,  refHigh: 336.0,sex: 'M',   refText: null },
  { code: 'FERR',     analyzer: 'generic', loinc: '2276-4',    name: 'Ferritin',                          discipline: 'Iron studies',   tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: 11.0,  refHigh: 307.0,sex: 'F',   refText: null },
  { code: 'TIBC',     analyzer: 'generic', loinc: '2500-7',    name: 'Total iron binding capacity',       discipline: 'Iron studies',   tubeColor: 'Gold',       additive: 'SST',                     unit: 'ug/dL',       refLow: 250.0, refHigh: 450.0,sex: 'ALL', refText: null },
  { code: 'TSAT',     analyzer: 'generic', loinc: '2502-3',    name: 'Transferrin saturation',            discipline: 'Iron studies',   tubeColor: 'Gold',       additive: 'SST',                     unit: '%',           refLow: 20.0,  refHigh: 50.0, sex: 'ALL', refText: null },
  { code: 'CRP',      analyzer: 'generic', loinc: '1988-5',    name: 'C-reactive protein',                discipline: 'Inflammatory',   tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/L',        refLow: null,  refHigh: 5.0,  sex: 'ALL', refText: 'Normal < 5' },
  { code: 'HSCRP',    analyzer: 'generic', loinc: '30522-7',   name: 'High-sensitivity CRP',              discipline: 'Inflammatory',   tubeColor: 'Gold',       additive: 'SST',                     unit: 'mg/L',        refLow: null,  refHigh: 3.0,  sex: 'ALL', refText: 'Low risk < 1, average 1-3, high > 3' },
  { code: 'VITD',     analyzer: 'generic', loinc: '1989-3',    name: 'Vitamin D 25-hydroxy',              discipline: 'Vitamins',       tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: 30.0,  refHigh: 100.0,sex: 'ALL', refText: 'Sufficient 30-100' },
  { code: 'VITB12',   analyzer: 'generic', loinc: '2132-9',    name: 'Vitamin B12',                       discipline: 'Vitamins',       tubeColor: 'Gold',       additive: 'SST',                     unit: 'pg/mL',       refLow: 200.0, refHigh: 900.0,sex: 'ALL', refText: null },
  { code: 'FOLATE',   analyzer: 'generic', loinc: '2284-8',    name: 'Folate (serum)',                    discipline: 'Vitamins',       tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: 3.0,   refHigh: 17.0, sex: 'ALL', refText: null },
  { code: 'PSA',      analyzer: 'generic', loinc: '2857-1',    name: 'Prostate specific antigen',         discipline: 'Tumor markers',  tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: null,  refHigh: 4.0,  sex: 'M',   refText: 'Normal < 4' },
  { code: 'CEA',      analyzer: 'generic', loinc: '2039-6',    name: 'Carcinoembryonic antigen',          discipline: 'Tumor markers',  tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: null,  refHigh: 3.0,  sex: 'ALL', refText: 'Non-smoker < 3' },
  { code: 'AFP',      analyzer: 'generic', loinc: '1834-1',    name: 'Alpha-fetoprotein',                 discipline: 'Tumor markers',  tubeColor: 'Gold',       additive: 'SST',                     unit: 'ng/mL',       refLow: null,  refHigh: 10.0, sex: 'ALL', refText: 'Normal < 10' },
  { code: 'CA125',    analyzer: 'generic', loinc: '10334-1',   name: 'CA 125',                            discipline: 'Tumor markers',  tubeColor: 'Gold',       additive: 'SST',                     unit: 'U/mL',        refLow: null,  refHigh: 35.0, sex: 'F',   refText: 'Normal < 35' },
  { code: 'UPH',      analyzer: 'generic', loinc: '5803-2',    name: 'Urine pH',                          discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'pH',          refLow: 4.5,   refHigh: 8.0,  sex: 'ALL', refText: null },
  { code: 'USG',      analyzer: 'generic', loinc: '5811-5',    name: 'Urine specific gravity',            discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'ratio',       refLow: 1.005, refHigh: 1.030,sex: 'ALL', refText: null },
  { code: 'UPRO',     analyzer: 'generic', loinc: '5804-0',    name: 'Urine protein',                     discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'qual',        refLow: null,  refHigh: null, sex: 'ALL', refText: 'Negative' },
  { code: 'UGLU',     analyzer: 'generic', loinc: '5792-7',    name: 'Urine glucose',                     discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'qual',        refLow: null,  refHigh: null, sex: 'ALL', refText: 'Negative' },
  { code: 'UKET',     analyzer: 'generic', loinc: '5797-6',    name: 'Urine ketones',                     discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'qual',        refLow: null,  refHigh: null, sex: 'ALL', refText: 'Negative' },
  { code: 'UBLD',     analyzer: 'generic', loinc: '5794-3',    name: 'Urine blood',                       discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'qual',        refLow: null,  refHigh: null, sex: 'ALL', refText: 'Negative' },
  { code: 'ULEU',     analyzer: 'generic', loinc: '5799-2',    name: 'Urine leukocyte esterase',          discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'qual',        refLow: null,  refHigh: null, sex: 'ALL', refText: 'Negative' },
  { code: 'UNIT',     analyzer: 'generic', loinc: '5802-4',    name: 'Urine nitrite',                     discipline: 'Urinalysis',     tubeColor: 'Yellow',     additive: 'None / boric acid',        unit: 'qual',        refLow: null,  refHigh: null, sex: 'ALL', refText: 'Negative' },
]

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
  await createAuthUser('admin-seed', 'admin@celltale.dev',  'admin123',   'Admin',         undefined)
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
      ...(col === 'tests' || col === 'packages' || col === 'diagnosticParameters' ? {
        createdAt: ts(daysAgo(30)), updatedAt: ts(daysAgo(30)),
      } : {}),
    })
    console.log(`  firestore  ${col}/${id}`)
  }

  console.log(`\nWriting ${DIAGNOSTIC_PARAMETERS.length} diagnostic parameters...`)
  for (let i = 0; i < DIAGNOSTIC_PARAMETERS.length; i++) {
    const p = DIAGNOSTIC_PARAMETERS[i]
    const docId = `param-${p.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${p.sex.toLowerCase()}-${i}`
    write('diagnosticParameters', docId, p)
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
  console.log('Admin login:    admin@celltale.dev  /  admin123')
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
