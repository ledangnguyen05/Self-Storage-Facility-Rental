import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

interface BrandLogoProps {
  to?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  subtitle?: string
  className?: string
  imgClassName?: string
  onClick?: () => void
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  to = '/',
  size = 'md',
  showText = true,
  subtitle = 'KHO TỰ QUẢN THÔNG MINH',
  className = '',
  imgClassName = '',
  onClick,
}) => {
  const sizeMap = {
    sm: { img: 'h-7 w-auto', sub: 'text-[8px]' },
    md: { img: 'h-9 sm:h-10 w-auto', sub: 'text-[9px] sm:text-[10px]' },
    lg: { img: 'h-12 sm:h-14 w-auto', sub: 'text-[11px]' },
    xl: { img: 'h-16 sm:h-20 w-auto', sub: 'text-xs' },
  }

  const { t } = useLanguage()
  const { img, sub } = sizeMap[size]

  const content = (
    <div className={`flex items-center gap-2.5 sm:gap-3 group select-none ${className}`} onClick={onClick}>
      <img
        src="/logo.png"
        alt="BOXORA Smart Storage"
        className={`${img} object-contain group-hover:scale-105 transition-transform shrink-0 ${imgClassName}`}
      />
      {showText && subtitle && (
        <div className="hidden md:flex flex-col text-left leading-none">
          <span className={`font-mono text-blue-800/80 font-bold tracking-wider uppercase ${sub}`}>
            {t(subtitle)}
          </span>
        </div>
      )}
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center">
        {content}
      </Link>
    )
  }

  return content
}

export default BrandLogo
