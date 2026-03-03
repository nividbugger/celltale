import { Activity } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  white?: boolean
}

export function BrandLogo({ size = 'md', white = false }: BrandLogoProps) {
  const sizes = {
    sm: { icon: 'h-5 w-5', text: 'text-lg' },
    md: { icon: 'h-6 w-6', text: 'text-xl' },
    lg: { icon: 'h-8 w-8', text: 'text-2xl' },
  }

  return (
    <Link to="/" className="flex items-center gap-2 select-none">
      <div className={`gradient-bg p-1.5 rounded-xl ${white ? 'opacity-90' : ''}`}>
        <Activity className={`${sizes[size].icon} text-white`} />
      </div>
      <span
        className={`font-extrabold tracking-tight ${sizes[size].text} ${
          white ? 'text-white' : 'gradient-text'
        }`}
      >
        Cell Tale
      </span>
    </Link>
  )
}
