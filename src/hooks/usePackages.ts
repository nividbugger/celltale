import { useState, useEffect } from 'react'
import { getAllPackages } from '../lib/firestore'
import type { Package } from '../types'

export function usePackages() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPackages = () => {
    setLoading(true)
    setError(null)
    getAllPackages()
      .then(setPackages)
      .catch((e) => {
        setError(e.message)
        setPackages([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  return { packages, loading, error, refetch: fetchPackages, setPackages }
}
