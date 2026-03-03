import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../contexts/AuthContext'
import type { RegisterFormData } from '../../types'

const ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/operation-not-allowed': 'Email/Password sign-in is not enabled. Please contact support.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
}

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>()

  const password = watch('password')

  async function onSubmit(data: RegisterFormData) {
    setServerError('')
    try {
      await signUp(data.email, data.password, data.name, data.phone)
      navigate('/dashboard')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      const message = (err as { message?: string }).message ?? ''
      setServerError(ERROR_MAP[code] ?? `Registration failed. (${code || message})`)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo size="lg" />
          <h1 className="mt-6 text-2xl font-extrabold text-slate-900">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Start booking diagnostic tests today</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Full Name"
              type="text"
              placeholder="Ravi Kumar"
              error={errors.name?.message}
              {...register('name', {
                required: 'Name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
              })}
            />
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email',
                },
              })}
            />
            <Input
              label="Phone Number"
              type="tel"
              placeholder="9876543210"
              error={errors.phone?.message}
              helperText="Indian mobile number (10 digits)"
              {...register('phone', {
                required: 'Phone number is required',
                pattern: {
                  value: /^[6-9]\d{9}$/,
                  message: 'Enter a valid 10-digit Indian mobile number',
                },
              })}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Min. 8 characters"
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
              })}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (v) => v === password || 'Passwords do not match',
              })}
            />

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
