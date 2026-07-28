import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AdminRoute } from './components/layout/AdminRoute'

// Public pages
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/public/LoginPage'
import RegisterPage from './pages/public/RegisterPage'

// Patient pages
import DashboardPage from './pages/patient/DashboardPage'
import BookAppointmentPage from './pages/patient/BookAppointmentPage'
import AppointmentsPage from './pages/patient/AppointmentsPage'
import ReportsPage from './pages/patient/ReportsPage'
import ProfilePage from './pages/patient/ProfilePage'

// Admin pages
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage'
import AdminNewAppointmentPage from './pages/admin/AdminNewAppointmentPage'
import AdminUploadReportPage from './pages/admin/AdminUploadReportPage'
import AdminGenerateReportPage from './pages/admin/AdminGenerateReportPage'
import AdminPatientsPage from './pages/admin/AdminPatientsPage'
import AdminPackagesPage from './pages/admin/AdminPackagesPage'
import AdminInvoicesPage from './pages/admin/AdminInvoicesPage'
import AdminInvoiceEditorPage from './pages/admin/AdminInvoiceEditorPage'
import TestsPage from './pages/admin/TestsPage'
import ParametersPage from './pages/admin/ParametersPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Patient (protected) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/book"
            element={
              <ProtectedRoute>
                <BookAppointmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/appointments"
            element={
              <ProtectedRoute>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/appointments"
            element={
              <AdminRoute>
                <AdminAppointmentsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/appointments/new/:appointmentId?"
            element={
              <AdminRoute>
                <AdminNewAppointmentPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/upload-report/:appointmentId"
            element={
              <AdminRoute>
                <AdminUploadReportPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/generate-report/:appointmentId"
            element={
              <AdminRoute>
                <AdminGenerateReportPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/patients"
            element={
              <AdminRoute>
                <AdminPatientsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/packages"
            element={
              <AdminRoute>
                <AdminPackagesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invoices"
            element={
              <AdminRoute>
                <AdminInvoicesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invoices/:invoiceId"
            element={
              <AdminRoute>
                <AdminInvoiceEditorPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tests"
            element={
              <AdminRoute>
                <TestsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/parameters"
            element={
              <AdminRoute>
                <ParametersPage />
              </AdminRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
