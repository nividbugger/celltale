import { Timestamp } from 'firebase/firestore'

// ─── User ──────────────────────────────────────────────────────────────────

export type UserRole = 'patient' | 'admin'

export interface User {
  uid: string
  name: string
  email: string
  phone: string
  dob?: string
  address?: string
  role: UserRole
  createdAt: Timestamp
}

// ─── Appointments ─────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Sample Collected'
  | 'Report Ready'
  | 'Completed'
  | 'Cancelled'

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  packageId: string
  packageName: string
  packagePrice: number
  date: string
  timeSlot: string
  collectionAddress: string
  status: AppointmentStatus
  createdAt: Timestamp
  updatedAt: Timestamp
  notes?: string
}

// ─── Reports ──────────────────────────────────────────────────────────────

export interface TestValue {
  category: string
  name: string
  value: string
  unit: string
  normalRange: string
  isAbnormal: boolean
}

export interface Report {
  id: string
  appointmentId: string
  patientId: string
  uploadedAt: Timestamp
  pdfUrl: string
  testValues: TestValue[]
  summary?: string
}

// ─── Packages ─────────────────────────────────────────────────────────────

export interface PackageDetail {
  category: string
  text: string
}

export interface Package {
  id: string
  name: string
  price: number
  testCount: number
  isPopular: boolean
  color: string
  headerColor: string
  buttonColor: string
  consultations: string[]
  summary: string[]
  details: PackageDetail[]
  order: number
}

export const PACKAGES: Package[] = [
  {
    id: 'basic',
    name: 'Basic Screening Package',
    price: 1599,
    testCount: 30,
    isPopular: false,
    order: 0,
    color: 'bg-white border-slate-200',
    headerColor: 'text-slate-800',
    buttonColor: 'bg-slate-800 hover:bg-slate-700 text-white',
    consultations: ['Doctor', 'Dental', 'Eye'],
    summary: [
      'Blood-CBC (17 Parameters)',
      'Thyroid (1 Parameter: TSH)',
      'Kidney & Liver (4 Parameters)',
      'Heart (Total Cholesterol)',
      'Sugar (RBS) & Vitals (6)',
    ],
    details: [
      { category: 'BLOOD-CBC (17)', text: 'Hemoglobin, Total WBC Count, Neutrophils, Lymphocytes, Eosinophils, Basophils, Monocytes, PCV, Hematocrit, Total RBC Count, Platelet Count, MCV, MCH, MCHC, RDW-CV, RDW-SD, PDW' },
      { category: 'THYROID (1)', text: 'TSH' },
      { category: 'SUGAR (1)', text: 'Random Blood Sugar (RBS)' },
      { category: 'KIDNEY (2)', text: 'Urea, Creatinine' },
      { category: 'LIVER (2)', text: 'Total Protein, Serum Albumin' },
      { category: 'HEART (1)', text: 'Total Cholesterol' },
      { category: 'VITALS (6)', text: 'Height, Weight, BMI, SpO2, Pulse, Blood Pressure' },
    ],
  },
  {
    id: 'economy',
    name: 'Economy Disease Checkup',
    price: 2599,
    testCount: 42,
    isPopular: true,
    order: 1,
    color: 'bg-blue-50 border-blue-200 shadow-blue-100',
    headerColor: 'text-blue-700',
    buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    consultations: ['Doctor', 'Dental', 'Eye'],
    summary: [
      'Blood-CBC (17 Parameters)',
      'Thyroid (3 Parameters: T3, T4, TSH)',
      'Kidney (3) & Liver (5)',
      'Heart Lipid Profile (4 Parameters)',
      'Body Electrolytes (2) & Sugar (2)',
    ],
    details: [
      { category: 'BLOOD-CBC (17)', text: 'Hemoglobin, Total WBC Count, Neutrophils, Lymphocytes, Eosinophils, Basophils, Monocytes, PCV, Hematocrit, Total RBC Count, Platelet Count, MCV, MCH, MCHC, RDW-CV, RDW-SD, PDW' },
      { category: 'THYROID (3)', text: 'TSH, HYPOTHYROIDISM/HYPERTHYROIDISM - T3, T4' },
      { category: 'SUGAR (2)', text: 'Random Blood Sugar (RBS), HbA1c' },
      { category: 'KIDNEY (3)', text: 'Urea, Creatinine, Uric Acid' },
      { category: 'LIVER (5)', text: 'Total Protein, Serum Albumin, Total Bilirubin, Direct Bilirubin, Indirect Bilirubin' },
      { category: 'HEART (4)', text: 'Total Cholesterol, HDL, LDL, Triglycerides' },
      { category: 'BODY ELECTROLYTES (2)', text: 'Sodium, Potassium' },
      { category: 'VITALS (6)', text: 'Height, Weight, BMI, SpO2, Pulse, Blood Pressure' },
    ],
  },
  {
    id: 'advanced',
    name: 'Advanced Prevention',
    price: 3599,
    testCount: 56,
    isPopular: false,
    order: 2,
    color: 'bg-white border-slate-200',
    headerColor: 'text-slate-800',
    buttonColor: 'bg-slate-800 hover:bg-slate-700 text-white',
    consultations: ['Doctor', 'Dental', 'Eye'],
    summary: [
      'Anemia Profile (Iron, B12)',
      'Full Liver Profile (11 Parameters)',
      'Complete Heart Profile (7 Parameters)',
      'Bone Strength (Calcium, Vit D)',
      'Extended Electrolytes (3 Parameters)',
    ],
    details: [
      { category: 'BLOOD-CBC (17)', text: 'Hemoglobin, Total WBC Count, Neutrophils, Lymphocytes, Eosinophils, Basophils, Monocytes, PCV, Hematocrit, Total RBC Count, Platelet Count, MCV, MCH, MCHC, RDW-CV, RDW-SD, PDW' },
      { category: 'ANEMIA PROFILE (2)', text: 'Iron Study, Vitamin B12' },
      { category: 'THYROID (3)', text: 'TSH, HYPOTHYROIDISM/HYPERTHYROIDISM - T3, T4' },
      { category: 'SUGAR (2)', text: 'Random Blood Sugar (RBS), HbA1c' },
      { category: 'KIDNEY (3)', text: 'Urea, Creatinine, Uric Acid' },
      { category: 'LIVER (11)', text: 'Total Protein, Serum Albumin, Total Bilirubin, Direct Bilirubin, Indirect Bilirubin, SGOT, SGPT, GGT, ALP, Globulin, A/G Ratio' },
      { category: 'HEART (7)', text: 'Total Cholesterol, HDL, LDL, Triglycerides, VLDL, Non-HDL, VLDL Ratios' },
      { category: 'BODY ELECTROLYTES (3)', text: 'Sodium, Potassium, Chloride' },
      { category: 'BONE STRENGTH (2)', text: 'Calcium, Vitamin D' },
      { category: 'VITALS (6)', text: 'Height, Weight, BMI, SpO2, Pulse, Blood Pressure' },
    ],
  },
]

// ─── Time Slots ───────────────────────────────────────────────────────────

export const TIME_SLOTS: string[] = [
  '07:00 AM',
  '07:30 AM',
  '08:00 AM',
  '08:30 AM',
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '01:00 PM',
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
  '05:30 PM',
  '06:00 PM',
]

// ─── Status Colors ────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  'Sample Collected': 'bg-indigo-100 text-indigo-800',
  'Report Ready': 'bg-teal-100 text-teal-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
}

// ─── Form Data Types ──────────────────────────────────────────────────────

export interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  phone: string
}

export interface LoginFormData {
  email: string
  password: string
}

export interface BookingFormData {
  packageId: string
  date: string
  timeSlot: string
  collectionAddress: string
  notes?: string
}

export interface ProfileFormData {
  name: string
  phone: string
  dob?: string
  address?: string
}

export interface UploadReportFormData {
  summary?: string
  testValues: TestValue[]
}
