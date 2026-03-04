import { useState, useEffect } from 'react'
import { getAllPackages } from '../lib/firestore'
import { PACKAGES as STATIC_PACKAGES } from '../types'
import type { Package } from '../types'

export function usePackages() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPackages = () => {
    setLoading(true)
    getAllPackages()
      .then((pkgs) => {
        // Fall back to static seed data if Firestore is empty
        setPackages(pkgs.length > 0 ? pkgs : STATIC_PACKAGES)
      })
      .catch((e) => {
        setError(e.message)
        setPackages(STATIC_PACKAGES)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  return { packages, loading, error, refetch: fetchPackages, setPackages }
}
