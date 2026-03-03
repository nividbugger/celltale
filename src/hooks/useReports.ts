import { useState, useEffect } from 'react'
import { getReportsByPatient } from '../lib/firestore'
import type { Report } from '../types'

export function usePatientReports(patientId: string | undefined) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    getReportsByPatient(patientId)
      .then(setReports)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [patientId])

  return { reports, loading, error }
}
