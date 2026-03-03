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

export interface Package {
  id: string
  name: string
  price: number
  description: string
  tests: string[]
  popular?: boolean
}

export const PACKAGES: Package[] = [
  {
    id: 'basic-health',
    name: 'Basic Health Check',
    price: 499,
    description: 'Essential screening for a quick health overview',
    tests: ['CBC', 'Blood Glucose (Fasting)', 'Urine Routine', 'Blood Pressure'],
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Health Package',
    price: 1299,
    description: 'Full-body check covering all major organ systems',
    tests: [
      'CBC with Differential',
      'Lipid Profile',
      'Liver Function Test (LFT)',
      'Kidney Function Test (KFT)',
      'Thyroid Profile (T3, T4, TSH)',
      'Blood Glucose (Fasting & PP)',
      'Urine Routine & Microscopy',
    ],
    popular: true,
  },
  {
    id: 'diabetes-care',
    name: 'Diabetes Care Panel',
    price: 799,
    description: 'Targeted monitoring for diabetes management',
    tests: [
      'Blood Glucose Fasting',
      'Blood Glucose Post Prandial',
      'HbA1c',
      'Insulin Fasting',
      'Urine Microalbumin',
      'Kidney Function Test',
    ],
  },
  {
    id: 'cardiac-care',
    name: 'Cardiac Risk Assessment',
    price: 999,
    description: 'Advanced cardiovascular risk profiling',
    tests: [
      'Lipid Profile',
      'Homocysteine',
      'hs-CRP',
      'ECG',
      'Blood Pressure',
      'Blood Glucose',
      'CBC',
    ],
  },
  {
    id: 'womens-health',
    name: "Women's Wellness Package",
    price: 1499,
    description: 'Comprehensive panel tailored for women',
    tests: [
      'CBC',
      'Thyroid Profile',
      'Vitamin D',
      'Vitamin B12',
      'Iron Studies',
      'Calcium',
      'Pap Smear (optional)',
      'Hormone Panel (FSH, LH, Estradiol)',
    ],
  },
  {
    id: 'senior-care',
    name: 'Senior Citizen Package',
    price: 1799,
    description: 'Complete geriatric health evaluation',
    tests: [
      'CBC with Differential',
      'Lipid Profile',
      'LFT',
      'KFT',
      'Thyroid Profile',
      'Blood Glucose (Fasting & PP)',
      'HbA1c',
      'Vitamin D & B12',
      'Calcium & Phosphorus',
      'PSA (for males)',
      'ECG',
      'Urine Routine',
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
