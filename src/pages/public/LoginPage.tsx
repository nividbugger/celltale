import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogIn, Phone, ShieldCheck } from 'lucide-react'
import { RecaptchaVerifier } from 'firebase/auth'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../contexts/AuthContext'
import { auth } from '../../lib/firebase'
import type { LoginFormData } from '../../types'

const ERROR_MAP: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/invalid-phone-number': 'Enter a valid 10-digit Indian mobile number.',
  'auth/invalid-verification-code': 'Incorrect code. Please try again.',
  'auth/code-expired': 'This code has expired. Please request a new one.',
  'auth/operation-not-allowed': 'Phone sign-in is not enabled yet. Please contact support.',
}

function mapFirebaseError(code: string): string {
  return ERROR_MAP[code] ?? 'Something went wrong. Please try again.'
}

type LoginTab = 'email' | 'phone'
type PhoneStep = 'enter-phone' | 'enter-otp' | 'complete-profile'

export default function LoginPage() {
  const { signIn, signInGoogle, sendOtp, confirmOtp, completePhoneProfile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/dashboard'

  const [tab, setTab] = useState<LoginTab>('email')
  const [serverError, setServerError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>()

  async function onSubmit(data: LoginFormData) {
    setServerError('')
    try {
      await signIn(data.email, data.password)
      navigate(isAdmin ? '/admin' : from, { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setServerError(mapFirebaseError(code))
    }
  }

  async function handleGoogle() {
    setServerError('')
    setGoogleLoading(true)
    try {
      await signInGoogle()
      navigate(isAdmin ? '/admin' : from, { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setServerError(mapFirebaseError(code))
    } finally {
      setGoogleLoading(false)
    }
  }

  // ─── Phone / OTP flow ───────────────────────────────────────────────────────

  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter-phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [profileName, setProfileName] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    }
  }, [])

  function getRecaptcha(): RecaptchaVerifier {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'phone-recaptcha-container', {
        size: 'invisible',
      })
    }
    return recaptchaRef.current
  }

  async function handleSendOtp() {
    setServerError('')
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setServerError('Enter a valid 10-digit Indian mobile number.')
      return
    }
    setPhoneLoading(true)
    try {
      await sendOtp(phone, getRecaptcha())
      setPhoneStep('enter-otp')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setServerError(mapFirebaseError(code))
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    } finally {
      setPhoneLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setServerError('')
    if (!/^\d{6}$/.test(otp)) {
      setServerError('Enter the 6-digit code sent to your phone.')
      return
    }
    setPhoneLoading(true)
    try {
      const { isNewProfile } = await confirmOtp(otp)
      if (isNewProfile) {
        setPhoneStep('complete-profile')
      } else {
        navigate(from, { replace: true })
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setServerError(mapFirebaseError(code))
    } finally {
      setPhoneLoading(false)
    }
  }

  async function handleCompleteProfile() {
    setServerError('')
    if (!profileName.trim()) {
      setServerError('Please enter your name.')
      return
    }
    setPhoneLoading(true)
    try {
      await completePhoneProfile(profileName.trim())
      navigate(from, { replace: true })
    } catch {
      setServerError('Could not complete your profile. Please try again.')
    } finally {
      setPhoneLoading(false)
    }
  }

  function resetPhoneFlow() {
    setPhoneStep('enter-phone')
    setOtp('')
    setServerError('')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo size="lg" />
          <h1 className="mt-6 text-2xl font-extrabold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your Cell Tale account</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-full p-1 mb-6">
            <button
              type="button"
              onClick={() => { setTab('email'); setServerError('') }}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                tab === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => { setTab('phone'); setServerError('') }}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                tab === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Phone
            </button>
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
              {serverError}
            </div>
          )}

          {tab === 'email' ? (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password', { required: 'Password is required' })}
                />

                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs text-slate-400 bg-white px-3">
                  or continue with
                </div>
              </div>

              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-full py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {googleLoading ? 'Signing in...' : 'Sign in with Google'}
              </button>
            </>
          ) : (
            <div className="space-y-5">
              {phoneStep === 'enter-phone' && (
                <>
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="9876543210"
                    helperText="We'll text you a one-time code"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                  <Button
                    className="w-full"
                    size="lg"
                    loading={phoneLoading}
                    onClick={handleSendOtp}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Send OTP
                  </Button>
                </>
              )}

              {phoneStep === 'enter-otp' && (
                <>
                  <Input
                    label="Enter OTP"
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    helperText={`Sent to +91 ${phone}`}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <Button
                    className="w-full"
                    size="lg"
                    loading={phoneLoading}
                    onClick={handleVerifyOtp}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Verify &amp; Sign In
                  </Button>
                  <div className="flex justify-between text-xs">
                    <button
                      type="button"
                      onClick={resetPhoneFlow}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      Change number
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Resend code
                    </button>
                  </div>
                </>
              )}

              {phoneStep === 'complete-profile' && (
                <>
                  <p className="text-sm text-slate-500">
                    We don't have a profile for this number yet — what's your name?
                  </p>
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="Ravi Kumar"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    size="lg"
                    loading={phoneLoading}
                    onClick={handleCompleteProfile}
                  >
                    Continue
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Invisible reCAPTCHA required by Firebase Phone Auth */}
          <div id="phone-recaptcha-container" />
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
