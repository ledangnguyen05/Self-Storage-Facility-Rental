import React from 'react'
import { Link } from 'react-router-dom'

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
    sm: { img: 'w-7 h-7 rounded-lg', title: 'text-base', sub: 'text-[8px]' },
    md: { img: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl', title: 'text-lg sm:text-xl', sub: 'text-[9px] sm:text-[10px]' },
    lg: { img: 'w-12 h-12 rounded-2xl', title: 'text-2xl', sub: 'text-[11px]' },
    xl: { img: 'w-16 h-16 rounded-3xl', title: 'text-3xl', sub: 'text-xs' },
  }

  const { img, title, sub } = sizeMap[size]

  const content = (
    <div className={`flex items-center gap-2.5 sm:gap-3 group select-none ${className}`} onClick={onClick}>
      <img
        src="/logo.png"
        alt="BOXORA Smart Storage"
        className={`${img} object-cover shadow-xs ring-1 ring-slate-900/10 group-hover:scale-95 transition-transform shrink-0 ${imgClassName}`}
      />
      {showText && (
        <div className="flex flex-col text-left leading-none">
          <span className={`font-headline font-black tracking-tight text-slate-900 ${title}`}>
            BOXORA<span className="text-cyan-600">.</span>
          </span>
          {subtitle && (
            <span className={`font-mono text-cyan-800/80 font-bold tracking-wider uppercase mt-1 ${sub}`}>
              {subtitle}
            </span>
          )}
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
