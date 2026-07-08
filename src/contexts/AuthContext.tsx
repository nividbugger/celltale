import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type ConfirmationResult,
  type RecaptchaVerifier,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import {
  createUserDocument,
  getUserDocument,
} from '../lib/firestore'
import { queueEmail } from '../lib/emailQueue'
import type { User } from '../types'

interface AuthContextValue {
  currentUser: FirebaseUser | null
  userProfile: User | null
  loading: boolean
  isAdmin: boolean
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInGoogle: () => Promise<void>
  sendOtp: (phone: string, recaptchaVerifier: RecaptchaVerifier) => Promise<void>
  confirmOtp: (code: string) => Promise<{ isNewProfile: boolean }>
  completePhoneProfile: (name: string, email?: string) => Promise<void>
  logOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const confirmationResultRef = useRef<ConfirmationResult | null>(null)

  const isAdmin = userProfile?.role === 'admin'

  async function loadProfile(user: FirebaseUser) {
    const profile = await getUserDocument(user.uid)
    setUserProfile(profile)
  }

  async function signUp(email: string, password: string, name: string, phone: string) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(user, { displayName: name })
    await createUserDocument(user.uid, { name, email, phone })
    await loadProfile(user)
    // Queue welcome email (processed by GitHub Actions worker)
    queueEmail('welcome', email, { patientName: name }).catch(() => {})
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signInGoogle() {
    const { user } = await signInWithPopup(auth, googleProvider)
    const existing = await getUserDocument(user.uid)
    if (!existing) {
      const name = user.displayName ?? 'User'
      const email = user.email ?? ''
      await createUserDocument(user.uid, { name, email, phone: user.phoneNumber ?? '' })
      // Queue welcome email for new Google sign-up
      queueEmail('welcome', email, { patientName: name }).catch(() => {})
    }
    await loadProfile(user)
  }

  async function logOut() {
    await signOut(auth)
    setUserProfile(null)
  }

  /** Sends an OTP to the given 10-digit Indian mobile number. */
  async function sendOtp(phone: string, recaptchaVerifier: RecaptchaVerifier) {
    confirmationResultRef.current = await signInWithPhoneNumber(auth, `+91${phone}`, recaptchaVerifier)
  }

  /**
   * Confirms the OTP code, completing sign-in. Firebase resolves the phone
   * number to whichever Auth user already owns it — so if an admin
   * pre-registered this number, `isNewProfile` will be false and the admin's
   * data is already in Firestore under this same uid.
   */
  async function confirmOtp(code: string): Promise<{ isNewProfile: boolean }> {
    if (!confirmationResultRef.current) {
      throw new Error('No OTP was requested. Please request a new code.')
    }
    const { user } = await confirmationResultRef.current.confirm(code)
    confirmationResultRef.current = null
    const existing = await getUserDocument(user.uid)
    if (existing) {
      await loadProfile(user)
    }
    return { isNewProfile: !existing }
  }

  /** Creates the Firestore profile for a brand-new phone sign-up (no admin record existed). */
  async function completePhoneProfile(name: string, email?: string) {
    const user = auth.currentUser
    if (!user) throw new Error('Not signed in.')
    const phone = (user.phoneNumber ?? '').replace(/^\+91/, '')
    await createUserDocument(user.uid, { name, phone, email })
    await loadProfile(user)
  }

  async function refreshProfile() {
    if (currentUser) await loadProfile(currentUser)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true)
      setCurrentUser(user)
      if (user) {
        try {
          await loadProfile(user)
        } catch {
          // Firestore read failed (e.g. rules not published yet) — still unblock the app
        }
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value: AuthContextValue = {
    currentUser,
    userProfile,
    loading,
    isAdmin,
    signUp,
    signIn,
    signInGoogle,
    sendOtp,
    confirmOtp,
    completePhoneProfile,
    logOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
