import { useState, useEffect } from 'react'
import { getAllPackages } from '../lib/firestore'
import type { Package } from '../types'

export function usePackages() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPackages = () => {
    setLoading(true)
    // No static fallback: packages shown to patients must exist in Firestore.
    // A fallback with hardcoded IDs would let patients select packages that the
    // booking API cannot validate, causing "Unknown package id" errors at checkout.
    getAllPackages()
      .then((pkgs) => setPackages(pkgs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  return { packages, loading, error, refetch: fetchPackages, setPackages }
}
