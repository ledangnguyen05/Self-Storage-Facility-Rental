import React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'outline' | 'primary' | 'brand'
  size?: 'sm' | 'md'
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const variantStyles = {
    neutral: 'bg-[#F2F2EF] text-[#555555] border border-[#E5E5E1]',
    success: 'bg-[#EAF7F0] text-[#168A55] border border-[#168A55]/20',
    warning: 'bg-[#FFF6E5] text-[#B7791F] border border-[#B7791F]/20',
    danger: 'bg-[#FDECEC] text-[#D64545] border border-[#D64545]/20',
    info: 'bg-[#EDF3FF] text-[#3269D8] border border-[#3269D8]/20',
    accent: 'bg-[#EAF0FF] text-[#2457FF] border border-[#2457FF]/20',
    outline: 'bg-transparent text-[#111111] border border-[#D5D5D0]',
    primary: 'bg-[#2457FF] text-white border border-[#2457FF]',
    brand: 'bg-[#111111] text-white border border-[#111111]',
  }

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium rounded-[4px] tracking-wide uppercase',
    md: 'text-[12px] px-2.5 py-1 font-medium rounded-[6px]',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 shrink-0 transition-colors select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
