import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import {
  createUserDocument,
  getUserDocument,
} from '../lib/firestore'
import type { User } from '../types'

interface AuthContextValue {
  currentUser: FirebaseUser | null
  userProfile: User | null
  loading: boolean
  isAdmin: boolean
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInGoogle: () => Promise<void>
  logOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signInGoogle() {
    const { user } = await signInWithPopup(auth, googleProvider)
    const existing = await getUserDocument(user.uid)
    if (!existing) {
      await createUserDocument(user.uid, {
        name: user.displayName ?? 'User',
        email: user.email ?? '',
        phone: user.phoneNumber ?? '',
      })
    }
    await loadProfile(user)
  }

  async function logOut() {
    await signOut(auth)
    setUserProfile(null)
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
