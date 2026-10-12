'use strict';

/**
 * Master catalog of medical lab tests for the CellTale diagnostic lab system.
 *
 * isActive is always false in the catalog — lab admins activate the tests
 * their facility actually offers.
 *
 * Tube color follows CLSI standards:
 *   Lavender (EDTA)   – CBC, HbA1c, Reticulocyte, Blood Group, G6PD, NT-proBNP
 *   Red (plain serum) – Thyroid, Hormones, Vit B12, Folic Acid, Serology, PSA, Beta-HCG
 *   Grey (fluoride)   – ALL glucose tests
 *   Yellow (SST)      – Biochemistry panels & individual biochem, Vit D, CRP, Troponins, Tumor Markers (AFP/CEA/CA series)
 *   Green (Li-hep)    – Electrolytes where K+ accuracy matters (Na, K, Cl)
 *   Blue (citrate)    – Coagulation (PT/INR, APTT, Fibrinogen, D-Dimer)
 *   Black (Westergren) – ESR
 *   null              – Urine and Stool tests
 */

const CATALOG = [

  // ═══════════════════════════════════════════════════════════════
  // HEMATOLOGY
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-cbc',
    machineCode: 'CBC',
    testId: 'CBC',
    name: 'Complete Blood Count',
    category: 'Hematology',
    sampleType: 'blood',
    tubeColor: 'Lavender',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'WBC (Total Leucocyte Count)', unit: '10³/µL',  biologicalReference: '4.0–11.0' },
      { parameter: 'RBC (Red Blood Cell Count)',  unit: '10⁶/µL',  biologicalReference: 'M:4.5–5.9  F:3.8–5.2' },
      { parameter: 'Hemoglobin',                 unit: 'g/dL',     biologicalReference: 'M:13.5–17.5  F:11.5–15.5' },
      { parameter: 'Hematocrit (PCV)',            unit: '%',        biologicalReference: 'M:40–52  F:36–47' },
      { parameter: 'MCV',                         unit: 'fL',       biologicalReference: '80–100' },
      { parameter: 'MCH',                         unit: 'pg',       biologicalReference: '27–33' },
      { parameter: 'MCHC',                        unit: 'g/dL',     biologicalReference: '31.5–36.5' },
      { parameter: 'RDW-CV',                      unit: '%',        biologicalReference: '11.5–14.5' },
      { parameter: 'Platelets',                   unit: '10³/µL',   biologicalReference: '150–400' },
      { parameter: 'Neutrophils',                 unit: '%',        biologicalReference: '40–70' },
      { parameter: 'Lymphocytes',                 unit: '%',        biologicalReference: '20–40' },
      { parameter: 'Monocytes',                   unit: '%',        biologicalReference: '2–10' },
      { parameter: 'Eosinophils',                 unit: '%',        biologicalReference: '1–6' },
      { parameter: 'Basophils',                   unit: '%',        biologicalReference: '0–2' },
    ],
  },

  {
    id: 'test-esr',
    machineCode: 'ESR',
    testId: 'ESR',
    name: 'Erythrocyte Sedimentation Rate',
    category: 'Hematology',
    sampleType: 'blood',
    tubeColor: 'Black',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'ESR', unit: 'mm/hr', biologicalReference: 'M:0–15  F:0–20' },
    ],
  },

  {
    id: 'test-retic',
    machineCode: 'RETIC',
    testId: 'RETIC',
    name: 'Reticulocyte Count',
    category: 'Hematology',
    sampleType: 'blood',
    tubeColor: 'Lavender',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Reticulocyte Count', unit: '%', biologicalReference: '0.5–2.5' },
    ],
  },

  {
    id: 'test-bg',
    machineCode: 'BG-Rh',
    testId: 'BG-Rh',
    name: 'Blood Group & Rh Factor',
    category: 'Hematology',
    sampleType: 'blood',
    tubeColor: 'Lavender',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Blood Group', unit: '', biologicalReference: 'A / B / AB / O' },
      { parameter: 'Rh Factor',   unit: '', biologicalReference: 'Positive / Negative' },
    ],
  },

  {
    id: 'test-g6pd',
    machineCode: 'G6PD',
    testId: 'G6PD',
    name: 'G6PD Screening',
    category: 'Hematology',
    sampleType: 'blood',
    tubeColor: 'Lavender',
    cost: 300,
    isActive: false,
    parameters: [
      { parameter: 'G6PD Activity', unit: '', biologicalReference: 'Normal / Deficient' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BIOCHEMISTRY
  // ═══════════════════════════════════════════════════════════════

  // ── Glycated Haemoglobin ──────────────────────────────────────

  {
    id: 'test-hba1c',
    machineCode: 'HbA1c',
    testId: 'HbA1c',
    name: 'Glycated Haemoglobin (HbA1c)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Lavender',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'HbA1c',
        unit: '%',
        biologicalReference: 'Normal:<5.7  Pre-diabetic:5.7–6.4  Diabetic:≥6.5',
      },
    ],
  },

  // ── Glucose ───────────────────────────────────────────────────

  {
    id: 'test-rbs',
    machineCode: 'GLU-R',
    testId: 'GLU-R',
    name: 'Glucose (Random)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Grey',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'Random Blood Glucose', unit: 'mg/dL', biologicalReference: '<200' },
    ],
  },

  {
    id: 'test-glu-f',
    machineCode: 'GLU',
    testId: 'GLU',
    name: 'Glucose (Fasting)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Grey',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'Fasting Blood Glucose', unit: 'mg/dL', biologicalReference: '70–100' },
    ],
  },

  {
    id: 'test-glu-pp',
    machineCode: 'GLU-PP',
    testId: 'GLU-PP',
    name: 'Glucose (Post-Prandial)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Grey',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'Post-Prandial Blood Glucose', unit: 'mg/dL', biologicalReference: '<140' },
    ],
  },

  // ── Lipid Profile (panel) ─────────────────────────────────────

  {
    id: 'test-lipid',
    machineCode: 'LIPID',
    testId: 'LIPID',
    name: 'Lipid Profile',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 500,
    isActive: false,
    parameters: [
      { parameter: 'Total Cholesterol',  unit: 'mg/dL', biologicalReference: '<200' },
      { parameter: 'HDL Cholesterol',    unit: 'mg/dL', biologicalReference: 'M:>40  F:>50' },
      { parameter: 'LDL Cholesterol',    unit: 'mg/dL', biologicalReference: '<130' },
      { parameter: 'VLDL Cholesterol',   unit: 'mg/dL', biologicalReference: '<30' },
      { parameter: 'Triglycerides',      unit: 'mg/dL', biologicalReference: '<150' },
    ],
  },

  // ── Individual Lipid Tests ────────────────────────────────────

  {
    id: 'test-chol',
    machineCode: 'CHOL',
    testId: 'CHOL',
    name: 'Total Cholesterol',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'Total Cholesterol', unit: 'mg/dL', biologicalReference: '<200' },
    ],
  },

  {
    id: 'test-hdl',
    machineCode: 'HDL-C',
    testId: 'HDL-C',
    name: 'HDL Cholesterol',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'HDL Cholesterol', unit: 'mg/dL', biologicalReference: 'M:>40  F:>50' },
    ],
  },

  {
    id: 'test-ldl',
    machineCode: 'LDL-C',
    testId: 'LDL-C',
    name: 'LDL Cholesterol',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'LDL Cholesterol (Friedewald)', unit: 'mg/dL', biologicalReference: '<130' },
    ],
  },

  {
    id: 'test-vldl',
    machineCode: 'VLDL',
    testId: 'VLDL',
    name: 'VLDL Cholesterol',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'VLDL Cholesterol', unit: 'mg/dL', biologicalReference: '<30' },
    ],
  },

  {
    id: 'test-tg',
    machineCode: 'TG',
    testId: 'TG',
    name: 'Triglycerides',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'Triglycerides', unit: 'mg/dL', biologicalReference: '<150' },
    ],
  },

  // ── Liver Function Test (panel) ───────────────────────────────

  {
    id: 'test-lft',
    machineCode: 'LFT',
    testId: 'LFT',
    name: 'Liver Function Test',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'Total Bilirubin',         unit: 'mg/dL', biologicalReference: '0.2–1.2' },
      { parameter: 'Direct Bilirubin',         unit: 'mg/dL', biologicalReference: '0.0–0.3' },
      { parameter: 'SGOT (AST)',               unit: 'U/L',   biologicalReference: '10–40' },
      { parameter: 'SGPT (ALT)',               unit: 'U/L',   biologicalReference: '7–56' },
      { parameter: 'ALP (Alkaline Phosphatase)', unit: 'U/L', biologicalReference: '44–147' },
      { parameter: 'Total Protein',            unit: 'g/dL',  biologicalReference: '6.0–8.3' },
      { parameter: 'Albumin',                  unit: 'g/dL',  biologicalReference: '3.5–5.2' },
    ],
  },

  // ── Individual Liver / Bilirubin Tests ────────────────────────

  {
    id: 'test-tbil',
    machineCode: 'TBIL',
    testId: 'TBIL',
    name: 'Total Bilirubin',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Total Bilirubin', unit: 'mg/dL', biologicalReference: '0.2–1.2' },
    ],
  },

  {
    id: 'test-dbil',
    machineCode: 'DBIL',
    testId: 'DBIL',
    name: 'Direct Bilirubin',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Direct Bilirubin', unit: 'mg/dL', biologicalReference: '0.0–0.3' },
    ],
  },

  {
    id: 'test-ibil',
    machineCode: 'IBIL',
    testId: 'IBIL',
    name: 'Indirect Bilirubin',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Indirect Bilirubin', unit: 'mg/dL', biologicalReference: '0.1–0.8' },
    ],
  },

  {
    id: 'test-ast',
    machineCode: 'AST',
    testId: 'AST',
    name: 'SGOT / AST',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'AST (SGOT)', unit: 'U/L', biologicalReference: '10–40' },
    ],
  },

  {
    id: 'test-alt',
    machineCode: 'ALT',
    testId: 'ALT',
    name: 'SGPT / ALT',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'ALT (SGPT)', unit: 'U/L', biologicalReference: '7–56' },
    ],
  },

  {
    id: 'test-alp',
    machineCode: 'ALP',
    testId: 'ALP',
    name: 'Alkaline Phosphatase',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'ALP', unit: 'U/L', biologicalReference: '44–147' },
    ],
  },

  {
    id: 'test-ggt',
    machineCode: 'GGT',
    testId: 'GGT',
    name: 'Gamma-GT (GGT)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'GGT', unit: 'U/L', biologicalReference: 'M:9–48  F:7–25' },
    ],
  },

  {
    id: 'test-tp',
    machineCode: 'TP',
    testId: 'TP',
    name: 'Total Protein',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Total Protein', unit: 'g/dL', biologicalReference: '6.0–8.3' },
    ],
  },

  {
    id: 'test-alb',
    machineCode: 'ALB',
    testId: 'ALB',
    name: 'Serum Albumin',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Albumin', unit: 'g/dL', biologicalReference: '3.5–5.2' },
    ],
  },

  // ── Kidney Function Test (panel) ──────────────────────────────

  {
    id: 'test-kft',
    machineCode: 'KFT',
    testId: 'KFT',
    name: 'Kidney Function Test',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'Urea',        unit: 'mg/dL', biologicalReference: '15–45' },
      { parameter: 'Creatinine',  unit: 'mg/dL', biologicalReference: 'M:0.7–1.3  F:0.5–1.1' },
      { parameter: 'Uric Acid',   unit: 'mg/dL', biologicalReference: 'M:3.5–7.2  F:2.6–6.0' },
    ],
  },

  // ── Individual Kidney / Renal Tests ──────────────────────────

  {
    id: 'test-urea',
    machineCode: 'UREA',
    testId: 'UREA',
    name: 'Blood Urea (BUN)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Blood Urea', unit: 'mg/dL', biologicalReference: '15–45' },
    ],
  },

  {
    id: 'test-crea',
    machineCode: 'CREA',
    testId: 'CREA',
    name: 'Creatinine',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Creatinine', unit: 'mg/dL', biologicalReference: 'M:0.7–1.3  F:0.5–1.1' },
    ],
  },

  {
    id: 'test-ua',
    machineCode: 'UA',
    testId: 'UA',
    name: 'Uric Acid',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'Uric Acid', unit: 'mg/dL', biologicalReference: 'M:3.5–7.2  F:2.6–6.0' },
    ],
  },

  // ── Electrolytes ──────────────────────────────────────────────

  {
    id: 'test-na',
    machineCode: 'Na',
    testId: 'Na',
    name: 'Serum Sodium',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Green',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Sodium', unit: 'mEq/L', biologicalReference: '136–145' },
    ],
  },

  {
    id: 'test-k',
    machineCode: 'K',
    testId: 'K',
    name: 'Serum Potassium',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Green',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Potassium', unit: 'mEq/L', biologicalReference: '3.5–5.1' },
    ],
  },

  {
    id: 'test-cl',
    machineCode: 'Cl',
    testId: 'Cl',
    name: 'Serum Chloride',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Green',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Chloride', unit: 'mEq/L', biologicalReference: '98–107' },
    ],
  },

  {
    id: 'test-ca',
    machineCode: 'Ca',
    testId: 'Ca',
    name: 'Serum Calcium',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Calcium', unit: 'mg/dL', biologicalReference: '8.5–10.5' },
    ],
  },

  {
    id: 'test-phos',
    machineCode: 'PHOS',
    testId: 'PHOS',
    name: 'Serum Phosphorus',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Phosphorus', unit: 'mg/dL', biologicalReference: '2.5–4.5' },
    ],
  },

  {
    id: 'test-mg',
    machineCode: 'Mg',
    testId: 'Mg',
    name: 'Serum Magnesium',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 100,
    isActive: false,
    parameters: [
      { parameter: 'Serum Magnesium', unit: 'mg/dL', biologicalReference: '1.7–2.2' },
    ],
  },

  // ── Enzymes ───────────────────────────────────────────────────

  {
    id: 'test-amy',
    machineCode: 'AMY',
    testId: 'AMY',
    name: 'Amylase',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Serum Amylase', unit: 'U/L', biologicalReference: '30–110' },
    ],
  },

  {
    id: 'test-lps',
    machineCode: 'LPS',
    testId: 'LPS',
    name: 'Lipase',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Serum Lipase', unit: 'U/L', biologicalReference: '<60' },
    ],
  },

  {
    id: 'test-ldh',
    machineCode: 'LDH',
    testId: 'LDH',
    name: 'Lactate Dehydrogenase',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'LDH', unit: 'U/L', biologicalReference: '135–225' },
    ],
  },

  {
    id: 'test-ck',
    machineCode: 'CK',
    testId: 'CK',
    name: 'CPK / CK Total',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'CK Total', unit: 'U/L', biologicalReference: 'M:38–174  F:26–140' },
    ],
  },

  // ── Iron Studies ──────────────────────────────────────────────

  {
    id: 'test-fe',
    machineCode: 'FE',
    testId: 'FE',
    name: 'Serum Iron',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Serum Iron', unit: 'mcg/dL', biologicalReference: 'M:65–175  F:50–170' },
    ],
  },

  {
    id: 'test-tibc',
    machineCode: 'TIBC',
    testId: 'TIBC',
    name: 'Total Iron Binding Capacity',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'TIBC', unit: 'mcg/dL', biologicalReference: '250–370' },
    ],
  },

  {
    id: 'test-ferr',
    machineCode: 'FERR',
    testId: 'FERR',
    name: 'Serum Ferritin',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 350,
    isActive: false,
    parameters: [
      { parameter: 'Serum Ferritin', unit: 'ng/mL', biologicalReference: 'M:20–250  F:10–120' },
    ],
  },

  // ── Inflammatory / Autoimmune Markers ─────────────────────────

  {
    id: 'test-crp',
    machineCode: 'CRP',
    testId: 'CRP',
    name: 'C-Reactive Protein (CRP)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'CRP', unit: 'mg/L', biologicalReference: '<6' },
    ],
  },

  {
    id: 'test-hscrp',
    machineCode: 'hsCRP',
    testId: 'hsCRP',
    name: 'High-Sensitivity CRP (hsCRP)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'hsCRP',
        unit: 'mg/L',
        biologicalReference: '<1.0 (low CV risk)  1.0–3.0 (average risk)  >3.0 (high risk)',
      },
    ],
  },

  {
    id: 'test-rf',
    machineCode: 'RF',
    testId: 'RF',
    name: 'Rheumatoid Factor (RF)',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Rheumatoid Factor', unit: 'IU/mL', biologicalReference: '<14' },
    ],
  },

  {
    id: 'test-aso',
    machineCode: 'ASO',
    testId: 'ASO',
    name: 'ASO Titre',
    category: 'Biochemistry',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'ASO Titre', unit: 'IU/mL', biologicalReference: '<200' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // THYROID
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-tsh',
    machineCode: 'TSH',
    testId: 'TSH',
    name: 'Thyroid Stimulating Hormone (TSH)',
    category: 'Thyroid',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 300,
    isActive: false,
    parameters: [
      { parameter: 'TSH', unit: 'mIU/L', biologicalReference: '0.4–4.0' },
    ],
  },

  {
    id: 'test-t3',
    machineCode: 'T3',
    testId: 'T3',
    name: 'Total T3 (Triiodothyronine)',
    category: 'Thyroid',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Total T3', unit: 'ng/mL', biologicalReference: '0.8–2.0' },
    ],
  },

  {
    id: 'test-t4',
    machineCode: 'T4',
    testId: 'T4',
    name: 'Total T4 (Thyroxine)',
    category: 'Thyroid',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Total T4', unit: 'mcg/dL', biologicalReference: '5.1–14.1' },
    ],
  },

  {
    id: 'test-ft3',
    machineCode: 'FT3',
    testId: 'FT3',
    name: 'Free T3',
    category: 'Thyroid',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 300,
    isActive: false,
    parameters: [
      { parameter: 'Free T3 (FT3)', unit: 'pg/mL', biologicalReference: '2.0–4.4' },
    ],
  },

  {
    id: 'test-ft4',
    machineCode: 'FT4',
    testId: 'FT4',
    name: 'Free T4',
    category: 'Thyroid',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 300,
    isActive: false,
    parameters: [
      { parameter: 'Free T4 (FT4)', unit: 'ng/dL', biologicalReference: '0.93–1.70' },
    ],
  },

  {
    id: 'test-antitpo',
    machineCode: 'Anti-TPO',
    testId: 'Anti-TPO',
    name: 'Anti-TPO Antibody',
    category: 'Thyroid',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 500,
    isActive: false,
    parameters: [
      { parameter: 'Anti-Thyroid Peroxidase Antibody', unit: 'IU/mL', biologicalReference: '<34' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // VITAMINS
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-vit-d',
    machineCode: 'VIT-D',
    testId: 'VIT-D',
    name: 'Vitamin D (25-OH)',
    category: 'Vitamins',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 800,
    isActive: false,
    parameters: [
      {
        parameter: 'Vitamin D (25-OH Cholecalciferol)',
        unit: 'ng/mL',
        biologicalReference: 'Deficient:<20  Insufficient:20–29  Sufficient:30–100',
      },
    ],
  },

  {
    id: 'test-vit-b12',
    machineCode: 'VIT-B12',
    testId: 'VIT-B12',
    name: 'Vitamin B12',
    category: 'Vitamins',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'Vitamin B12 (Cobalamin)', unit: 'pg/mL', biologicalReference: '200–900' },
    ],
  },

  {
    id: 'test-fol',
    machineCode: 'FOL',
    testId: 'FOL',
    name: 'Folic Acid',
    category: 'Vitamins',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'Folic Acid (Folate)', unit: 'ng/mL', biologicalReference: '2.7–17.0' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // HORMONES
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-prl',
    machineCode: 'PRL',
    testId: 'PRL',
    name: 'Prolactin',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'Prolactin',
        unit: 'ng/mL',
        biologicalReference: 'M:2.1–17.7  F (non-pregnant):2.8–29.2  F (pregnant):10–209',
      },
    ],
  },

  {
    id: 'test-fsh',
    machineCode: 'FSH',
    testId: 'FSH',
    name: 'FSH',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'FSH',
        unit: 'mIU/mL',
        biologicalReference: 'M:1.5–12.4  F-Follicular:3.5–12.5  F-Ovulatory:4.7–21.5  F-Luteal:1.7–7.7  F-Postmenopausal:25.8–134.8',
      },
    ],
  },

  {
    id: 'test-lh',
    machineCode: 'LH',
    testId: 'LH',
    name: 'LH',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'LH (Luteinising Hormone)',
        unit: 'mIU/mL',
        biologicalReference: 'M:1.7–8.6  F-Follicular:2.4–12.6  F-Ovulatory:14.0–95.6  F-Luteal:1.0–11.4  F-Postmenopausal:7.7–58.5',
      },
    ],
  },

  {
    id: 'test-testo',
    machineCode: 'TESTO',
    testId: 'TESTO',
    name: 'Testosterone (Total)',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 500,
    isActive: false,
    parameters: [
      { parameter: 'Total Testosterone', unit: 'ng/dL', biologicalReference: 'M:270–1070  F:15–70' },
    ],
  },

  {
    id: 'test-e2',
    machineCode: 'E2',
    testId: 'E2',
    name: 'Estradiol (E2)',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'Estradiol (E2)',
        unit: 'pg/mL',
        biologicalReference: 'M:10–40  F-Follicular:20–145  F-Ovulatory:112–430  F-Luteal:48–309  F-Postmenopausal:<59',
      },
    ],
  },

  {
    id: 'test-prog',
    machineCode: 'PROG',
    testId: 'PROG',
    name: 'Progesterone',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'Progesterone',
        unit: 'ng/mL',
        biologicalReference: 'M:0.2–1.4  F-Follicular:0.1–0.9  F-Luteal:1.8–23.9  F-Postmenopausal:<0.1',
      },
    ],
  },

  {
    id: 'test-cort',
    machineCode: 'CORT',
    testId: 'CORT',
    name: 'Cortisol (Morning)',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 500,
    isActive: false,
    parameters: [
      { parameter: 'Cortisol (AM, 08:00–09:00 h)', unit: 'mcg/dL', biologicalReference: '6.2–19.4' },
    ],
  },

  {
    id: 'test-ins',
    machineCode: 'INS',
    testId: 'INS',
    name: 'Insulin (Fasting)',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'Fasting Insulin', unit: 'mcIU/mL', biologicalReference: '2.6–24.9' },
    ],
  },

  {
    id: 'test-dheas',
    machineCode: 'DHEAS',
    testId: 'DHEAS',
    name: 'DHEA-Sulphate',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 600,
    isActive: false,
    parameters: [
      {
        parameter: 'DHEA-Sulphate',
        unit: 'mcg/dL',
        biologicalReference: 'M 18–29:280–640  M 30–39:120–520  M ≥40:45–335  F 18–29:145–395  F 30–39:98–340  F ≥40:60–230  F-Postmenopausal:32–240',
      },
    ],
  },

  {
    id: 'test-amh',
    machineCode: 'AMH',
    testId: 'AMH',
    name: 'Anti-Müllerian Hormone (AMH)',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 1500,
    isActive: false,
    parameters: [
      {
        parameter: 'Anti-Müllerian Hormone (AMH)',
        unit: 'ng/mL',
        biologicalReference: 'F 20–24:1.52–9.95  F 25–29:1.20–9.05  F 30–34:0.71–7.59  F 35–39:0.41–6.96  F 40–44:0.06–3.28  F >45:<1.0',
      },
    ],
  },

  {
    id: 'test-shbg',
    machineCode: 'SHBG',
    testId: 'SHBG',
    name: 'SHBG',
    category: 'Hormones',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'Sex Hormone Binding Globulin (SHBG)', unit: 'nmol/L', biologicalReference: 'M:16–50  F:17–124' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SEROLOGY
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-hbsag',
    machineCode: 'HBsAg',
    testId: 'HBsAg',
    name: 'HBsAg (Hepatitis B)',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 250,
    isActive: false,
    parameters: [
      { parameter: 'Hepatitis B Surface Antigen (HBsAg)', unit: '', biologicalReference: 'Non-reactive' },
    ],
  },

  {
    id: 'test-anti-hcv',
    machineCode: 'Anti-HCV',
    testId: 'Anti-HCV',
    name: 'Anti-HCV Antibody',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 300,
    isActive: false,
    parameters: [
      { parameter: 'Anti-HCV Antibody', unit: '', biologicalReference: 'Non-reactive' },
    ],
  },

  {
    id: 'test-hiv',
    machineCode: 'HIV',
    testId: 'HIV',
    name: 'HIV 1 & 2 Ag/Ab',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'HIV 1 & 2 Antigen / Antibody (4th Gen)', unit: '', biologicalReference: 'Non-reactive' },
    ],
  },

  {
    id: 'test-vdrl',
    machineCode: 'VDRL',
    testId: 'VDRL',
    name: 'VDRL / RPR (Syphilis)',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'VDRL / RPR', unit: '', biologicalReference: 'Non-reactive' },
    ],
  },

  {
    id: 'test-widal',
    machineCode: 'WIDAL',
    testId: 'WIDAL',
    name: 'Widal Test (Typhoid)',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'S. typhi O Antigen',   unit: 'titre', biologicalReference: '<1:80' },
      { parameter: 'S. typhi H Antigen',   unit: 'titre', biologicalReference: '<1:80' },
      { parameter: 'S. paratyphi A (AH)',  unit: 'titre', biologicalReference: '<1:80' },
      { parameter: 'S. paratyphi B (BH)',  unit: 'titre', biologicalReference: '<1:80' },
    ],
  },

  {
    id: 'test-den-ns1',
    machineCode: 'DEN-NS1',
    testId: 'DEN-NS1',
    name: 'Dengue NS1 Antigen',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'Dengue NS1 Antigen', unit: '', biologicalReference: 'Negative' },
    ],
  },

  {
    id: 'test-den-igm',
    machineCode: 'DEN-IgM',
    testId: 'DEN-IgM',
    name: 'Dengue IgM Antibody',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'Dengue IgM Antibody', unit: '', biologicalReference: 'Negative' },
    ],
  },

  {
    id: 'test-den-igg',
    machineCode: 'DEN-IgG',
    testId: 'DEN-IgG',
    name: 'Dengue IgG Antibody',
    category: 'Serology',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'Dengue IgG Antibody', unit: '', biologicalReference: 'Negative' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CARDIAC
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-ckmb',
    machineCode: 'CK-MB',
    testId: 'CK-MB',
    name: 'CK-MB (Cardiac)',
    category: 'Cardiac',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 300,
    isActive: false,
    parameters: [
      { parameter: 'CK-MB', unit: 'U/L', biologicalReference: '<25  (or <6% of total CK)' },
    ],
  },

  {
    id: 'test-tni',
    machineCode: 'TnI',
    testId: 'TnI',
    name: 'Troponin I (Cardiac)',
    category: 'Cardiac',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'Troponin I', unit: 'ng/mL', biologicalReference: '<0.04' },
    ],
  },

  {
    id: 'test-hstnt',
    machineCode: 'hsTnT',
    testId: 'hsTnT',
    name: 'Troponin T (High Sensitivity)',
    category: 'Cardiac',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 800,
    isActive: false,
    parameters: [
      { parameter: 'High-Sensitivity Troponin T (hsTnT)', unit: 'pg/mL', biologicalReference: '<14' },
    ],
  },

  {
    id: 'test-ntprobnp',
    machineCode: 'NT-proBNP',
    testId: 'NT-proBNP',
    name: 'NT-proBNP',
    category: 'Cardiac',
    sampleType: 'blood',
    tubeColor: 'Lavender',
    cost: 800,
    isActive: false,
    parameters: [
      {
        parameter: 'NT-proBNP',
        unit: 'pg/mL',
        biologicalReference: '<125 (age <75)  <450 (age ≥75)',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // COAGULATION
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-pt-inr',
    machineCode: 'PT-INR',
    testId: 'PT-INR',
    name: 'Prothrombin Time / INR',
    category: 'Coagulation',
    sampleType: 'blood',
    tubeColor: 'Blue',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Prothrombin Time (PT)', unit: 'sec', biologicalReference: '11–13' },
      { parameter: 'INR',                   unit: '',     biologicalReference: '0.8–1.2' },
    ],
  },

  {
    id: 'test-aptt',
    machineCode: 'APTT',
    testId: 'APTT',
    name: 'APTT',
    category: 'Coagulation',
    sampleType: 'blood',
    tubeColor: 'Blue',
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Activated Partial Thromboplastin Time (APTT)', unit: 'sec', biologicalReference: '25–35' },
    ],
  },

  {
    id: 'test-fib',
    machineCode: 'FIB',
    testId: 'FIB',
    name: 'Fibrinogen',
    category: 'Coagulation',
    sampleType: 'blood',
    tubeColor: 'Blue',
    cost: 400,
    isActive: false,
    parameters: [
      { parameter: 'Fibrinogen', unit: 'mg/dL', biologicalReference: '200–400' },
    ],
  },

  {
    id: 'test-ddimer',
    machineCode: 'D-DIM',
    testId: 'D-DIM',
    name: 'D-Dimer',
    category: 'Coagulation',
    sampleType: 'blood',
    tubeColor: 'Blue',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'D-Dimer', unit: 'mg/L FEU', biologicalReference: '<0.5' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // TUMOR MARKERS
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-psa',
    machineCode: 'PSA',
    testId: 'PSA',
    name: 'PSA Total',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 500,
    isActive: false,
    parameters: [
      { parameter: 'PSA Total', unit: 'ng/mL', biologicalReference: '<4.0' },
    ],
  },

  {
    id: 'test-fpsa',
    machineCode: 'fPSA',
    testId: 'fPSA',
    name: 'Free PSA (& Ratio)',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'Free PSA',              unit: 'ng/mL', biologicalReference: 'Interpreted with total PSA' },
      { parameter: 'Free/Total PSA Ratio',  unit: '%',     biologicalReference: '>25% (favours benign pattern)' },
    ],
  },

  {
    id: 'test-afp',
    machineCode: 'AFP',
    testId: 'AFP',
    name: 'Alpha-Fetoprotein (AFP)',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'AFP', unit: 'ng/mL', biologicalReference: '<7.0' },
    ],
  },

  {
    id: 'test-cea',
    machineCode: 'CEA',
    testId: 'CEA',
    name: 'CEA (Carcinoembryonic Ag)',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'CEA', unit: 'ng/mL', biologicalReference: '<5.0 (non-smoker)  <10.0 (smoker)' },
    ],
  },

  {
    id: 'test-ca125',
    machineCode: 'CA-125',
    testId: 'CA-125',
    name: 'Cancer Antigen 125',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'CA-125', unit: 'U/mL', biologicalReference: '<35' },
    ],
  },

  {
    id: 'test-ca199',
    machineCode: 'CA19-9',
    testId: 'CA19-9',
    name: 'Cancer Antigen 19-9',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'CA19-9', unit: 'U/mL', biologicalReference: '<37' },
    ],
  },

  {
    id: 'test-ca153',
    machineCode: 'CA15-3',
    testId: 'CA15-3',
    name: 'Cancer Antigen 15-3',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Yellow',
    cost: 600,
    isActive: false,
    parameters: [
      { parameter: 'CA15-3', unit: 'U/mL', biologicalReference: '<30' },
    ],
  },

  {
    id: 'test-bhcg',
    machineCode: 'b-HCG',
    testId: 'b-HCG',
    name: 'Beta-HCG (Quantitative)',
    category: 'Tumor Markers',
    sampleType: 'blood',
    tubeColor: 'Red',
    cost: 400,
    isActive: false,
    parameters: [
      {
        parameter: 'Beta-HCG (Quantitative)',
        unit: 'mIU/mL',
        biologicalReference: '<5 (non-pregnant)  Values rise exponentially with gestational age',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // URINE
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-urine',
    machineCode: 'URO',
    testId: 'URO',
    name: 'Urine Routine & Microscopy',
    category: 'Urine',
    sampleType: 'urine',
    tubeColor: null,
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Colour',              unit: '',      biologicalReference: 'Pale Yellow to Yellow' },
      { parameter: 'Appearance',          unit: '',      biologicalReference: 'Clear' },
      { parameter: 'pH',                  unit: '',      biologicalReference: '4.5–8.0' },
      { parameter: 'Specific Gravity',    unit: '',      biologicalReference: '1.005–1.030' },
      { parameter: 'Protein',             unit: '',      biologicalReference: 'Negative' },
      { parameter: 'Glucose',             unit: '',      biologicalReference: 'Negative' },
      { parameter: 'Ketones',             unit: '',      biologicalReference: 'Negative' },
      { parameter: 'Blood',               unit: '',      biologicalReference: 'Negative' },
      { parameter: 'Bilirubin',           unit: '',      biologicalReference: 'Negative' },
      { parameter: 'Urobilinogen',        unit: 'mg/dL', biologicalReference: '0.1–1.0' },
      { parameter: 'Nitrites',            unit: '',      biologicalReference: 'Negative' },
      { parameter: 'Leucocyte Esterase',  unit: '',      biologicalReference: 'Negative' },
      { parameter: 'WBC',                 unit: '/HPF',  biologicalReference: '0–5' },
      { parameter: 'RBC',                 unit: '/HPF',  biologicalReference: '0–2' },
      { parameter: 'Epithelial Cells',    unit: '/HPF',  biologicalReference: 'Few' },
      { parameter: 'Casts',               unit: '/LPF',  biologicalReference: 'Nil' },
      { parameter: 'Bacteria',            unit: '',      biologicalReference: 'Nil / Few' },
      { parameter: 'Crystals',            unit: '',      biologicalReference: 'Nil / Few' },
    ],
  },

  {
    id: 'test-microalb',
    machineCode: 'MALBUM',
    testId: 'MALBUM',
    name: 'Urine Microalbumin (Spot)',
    category: 'Urine',
    sampleType: 'urine',
    tubeColor: null,
    cost: 300,
    isActive: false,
    parameters: [
      { parameter: 'Microalbumin (Spot Urine)', unit: 'mg/L', biologicalReference: '<30' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // STOOL
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'test-stool-re',
    machineCode: 'STOOL-RE',
    testId: 'STOOL-RE',
    name: 'Stool Routine & Microscopy',
    category: 'Stool',
    sampleType: 'stool',
    tubeColor: null,
    cost: 150,
    isActive: false,
    parameters: [
      { parameter: 'Colour',       unit: '',     biologicalReference: 'Brown' },
      { parameter: 'Consistency',  unit: '',     biologicalReference: 'Formed' },
      { parameter: 'Mucus',        unit: '',     biologicalReference: 'Absent' },
      { parameter: 'Blood',        unit: '',     biologicalReference: 'Absent' },
      { parameter: 'Ova & Cysts',  unit: '',     biologicalReference: 'Not seen' },
      { parameter: 'WBC',          unit: '/HPF', biologicalReference: 'Nil' },
      { parameter: 'RBC',          unit: '/HPF', biologicalReference: 'Nil' },
      { parameter: 'Fat Globules', unit: '',     biologicalReference: 'Nil / Few' },
      { parameter: 'Bacteria',     unit: '',     biologicalReference: 'Normal flora' },
    ],
  },

  {
    id: 'test-obt',
    machineCode: 'OBT',
    testId: 'OBT',
    name: 'Stool Occult Blood Test',
    category: 'Stool',
    sampleType: 'stool',
    tubeColor: null,
    cost: 200,
    isActive: false,
    parameters: [
      { parameter: 'Occult Blood', unit: '', biologicalReference: 'Negative' },
    ],
  },

];

module.exports = { CATALOG };
