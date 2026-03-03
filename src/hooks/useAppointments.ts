import { useState, useEffect } from 'react'
import { getAppointmentsByPatient, getAllAppointments } from '../lib/firestore'
import type { Appointment } from '../types'

export function usePatientAppointments(patientId: string | undefined) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    getAppointmentsByPatient(patientId)
      .then(setAppointments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [patientId])

  return { appointments, loading, error, setAppointments }
}

export function useAllAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = () => {
    setLoading(true)
    getAllAppointments()
      .then(setAppointments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
  }, [])

  return { appointments, loading, error, refetch: fetchAll, setAppointments }
}
