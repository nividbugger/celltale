import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isAdmin, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner className="min-h-screen" />
  }

  if (!currentUser) {
    return <Navigate to="/admin/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
