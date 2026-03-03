import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-100 bg-white shadow-sm ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`px-6 pt-6 pb-4 ${className}`}>{children}</div>
}

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`px-6 pb-6 ${className}`}>{children}</div>
}
