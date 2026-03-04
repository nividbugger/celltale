import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'
import logo2x from '../../assets/logo@2x.png'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  white?: boolean
}

export function BrandLogo({ size = 'md', white = false }: BrandLogoProps) {
  const heights = {
    sm: 'h-16',
    md: 'h-20',
    lg: 'h-28',
  }

  return (
    <Link to="/" className="flex items-center select-none">
      <img
        src={logo}
        srcSet={`${logo} 1x, ${logo2x} 2x`}
        alt="Cell Tale Diagnostics"
        width={366}
        height={151}
        className={`${heights[size]} w-auto object-contain`}
        style={{ imageRendering: 'auto' }}
      />
    </Link>
  )
}
