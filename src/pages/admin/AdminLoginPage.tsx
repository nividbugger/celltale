import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Shield, LogIn } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import type { LoginFormData } from '../../types'

const ERROR_MAP: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Invalid credentials.',
  'auth/invalid-credential': 'Invalid credentials.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled.',
}

export default function AdminLoginPage() {
  const { signIn, isAdmin, loading, currentUser } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (!loading && currentUser && isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [loading, currentUser, isAdmin, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>()

  async function onSubmit(data: LoginFormData) {
    setServerError('')
    try {
      await signIn(data.email, data.password)
      navigate('/admin', { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setServerError(ERROR_MAP[code] ?? 'Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 gradient-bg rounded-2xl mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Admin Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Cell Tale Diagnostics — Staff Access Only</p>
        </div>

        <div className="bg-slate-800 rounded-3xl border border-slate-700 p-8">
          {serverError && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3 mb-6">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1">Email</label>
              <input
                type="email"
                placeholder="admin@celltalediagnostics.com"
                className="w-full rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Invalid email',
                  },
                })}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In to Admin Panel
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Patient portal?{' '}
          <a href="/login" className="text-slate-500 hover:text-slate-300 transition-colors">
            Sign in here
          </a>
        </p>
      </div>
    </div>
  )
}
