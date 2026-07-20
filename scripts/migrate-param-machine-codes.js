'use strict'
// Populates machineCode on every test parameter that maps to a known analyzer output code.
// Sysmex XN-series hematology codes from actual machine output (2026-07-18/19).
// Erba XL-200 neutral codes from ErbaTestCodeMap.ToNeutral() verified against machine.
//
// Usage: $env:NODE_PATH="<repo>\api\node_modules"; node scripts/migrate-param-machine-codes.js

const admin = require('firebase-admin')

admin.initializeApp({ projectId: 'celltalediagnostics-8f817' })
const db = admin.firestore()

// Map from parameter name (lowercased) → machine code (neutral code sent to POST /api/lis/results)
const PARAM_CODE_MAP = {
  // ── Sysmex XN-series (hematology) — codes from machine output 2026-07-18/19 ─────────────
  'wbc (total leucocyte count)':  'WBC',
  'rbc (red blood cell count)':   'RBC',
  'hemoglobin':                   'HGB',
  'hematocrit (pcv)':             'HCT',
  'mcv':                          'MCV',
  'mch':                          'MCH',
  'mchc':                         'MCHC',
  'rdw-cv':                       'RDW-CV',
  'rdw-sd':                       'RDW-SD',
  'platelets':                    'PLT',
  'neutrophils':                  'NEUT%',
  'lymphocytes':                  'LYMPH%',
  'monocytes':                    'MONO%',
  'eosinophils':                  'EO%',
  'basophils':                    'BASO%',
  'neutrophils (abs)':            'NEUT#',
  'lymphocytes (abs)':            'LYMPH#',
  'monocytes (abs)':              'MONO#',
  'eosinophils (abs)':            'EO#',
  'basophils (abs)':              'BASO#',
  'immature granulocytes %':      'IG%',
  'immature granulocytes #':      'IG#',
  'pdw':                          'PDW',
  'mpv':                          'MPV',
  'p-lcr':                        'P-LCR',
  'pct':                          'PCT',
  'microrbc':                     'MICROR',
  'macrorbc':                     'MACROR',

  // ── Erba XL-200 chemistry — neutral codes from ErbaTestCodeMap.ToNeutral() ─────────────
  // Liver function
  'total bilirubin':              'TBIL',
  'direct bilirubin':             'DBIL',
  'sgot (ast)':                   'AST',
  'sgpt (alt)':                   'ALT',
  'alt (sgpt)':                   'ALT',
  'ast (sgot)':                   'AST',
  'alp (alkaline phosphatase)':   'ALP',
  'alp':                          'ALP',
  'ggt':                          'GGT',
  'total protein':                'TP',
  'albumin':                      'ALB',
  'serum albumin':                'ALB',
  // Kidney function
  'urea':                         'UREA',
  'blood urea':                   'UREA',
  'creatinine':                   'CREA',
  'serum creatinine':             'CREA',
  'uric acid':                    'UA',
  // Glucose
  'fasting blood glucose':        'GLU',
  'post-prandial blood glucose':  'GLU',
  'random blood glucose':         'GLU',
  // Lipids
  'total cholesterol':            'CHOL',
  'hdl cholesterol':              'HDL',
  'ldl cholesterol (friedewald)': 'LDL',
  'ldl cholesterol':              'LDL',
  'triglycerides':                'TRIG',
  // HbA1c & enzymes
  'hba1c':                        'HBA1C',
  'serum amylase':                'AMY',
  'ck total':                     'CK',
  'ck-mb':                        'CKMB',
  // Minerals & inflammation
  'serum calcium':                'CA',
  'crp':                          'CRP',
  'hscrp':                        'CRPHS',
  // Iron studies
  'serum iron':                   'FE',
  'serum ferritin':               'FERR',
  // Immunology
  'aso titre':                    'ASO',
}

async function main() {
  const snap = await db.collection('tests').get()
  console.log(`\n${snap.size} tests to scan\n`)

  let updatedTests = 0
  let updatedParams = 0

  for (const doc of snap.docs) {
    const d = doc.data()
    const params = d.parameters ?? []
    if (params.length === 0) continue

    let changed = false
    const newParams = params.map(p => {
      const code = PARAM_CODE_MAP[p.parameter?.toLowerCase?.()]
      if (code && p.machineCode !== code) {
        console.log(`  [${doc.id}] "${p.parameter}" → ${code}${p.machineCode ? ` (was: ${p.machineCode})` : ''}`)
        updatedParams++
        changed = true
        return { ...p, machineCode: code }
      }
      return p
    })

    if (changed) {
      await doc.ref.update({ parameters: newParams })
      updatedTests++
    }
  }

  console.log(`\nMigration complete: ${updatedTests} tests updated, ${updatedParams} parameters assigned machine codes`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
