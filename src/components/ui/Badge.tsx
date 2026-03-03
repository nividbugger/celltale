import React from 'react'
import type { AppointmentStatus } from '../../types'
import { STATUS_COLORS } from '../../types'

interface StatusBadgeProps {
  status: AppointmentStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[status]} ${className}`}
    >
      {status}
    </span>
  )
}

interface BadgeProps {
  children: React.ReactNode
  className?: string
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  )
}
