import React from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../ui/cn'

interface BrandLogoProps {
  to?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  subtitle?: string
  className?: string
  imgClassName?: string
  onClick?: () => void
}

const sizeMap = {
  sm: 'h-7',
  md: 'h-8 sm:h-9',
  lg: 'h-12',
  xl: 'h-16',
} as const

/** Subtitles are shown in sentence case ("KHO TỰ QUẢN" -> "Kho tự quản"); product UI has no all-caps labels. */
const toSentenceCase = (value: string) => {
  if (value !== value.toLocaleUpperCase('vi')) return value
  const lower = value.toLocaleLowerCase('vi')
  return lower.charAt(0).toLocaleUpperCase('vi') + lower.slice(1)
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  to = '/',
  size = 'md',
  showText = true,
  subtitle = 'Kho tự quản thông minh',
  className = '',
  imgClassName = '',
  onClick,
}) => {
  const content = (
    <span className={cn('flex select-none items-center gap-3', className)} onClick={to ? undefined : onClick}>
      <img src="/logo.png" alt="Boxora" className={cn('w-auto shrink-0 object-contain', sizeMap[size], imgClassName)} />
      {showText && subtitle ? (
        <span className="hidden border-l border-line pl-3 text-xs font-medium leading-4 text-fg-subtle md:block">
          {toSentenceCase(subtitle)}
        </span>
      ) : null}
    </span>
  )

  if (to) {
    return (
      <Link to={to} onClick={onClick} className="inline-flex shrink-0 items-center rounded-md">
        {content}
      </Link>
    )
  }

  return content
}

export default BrandLogo
