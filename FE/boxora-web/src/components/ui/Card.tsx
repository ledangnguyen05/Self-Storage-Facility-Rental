import React from 'react'
import { cn } from '../../lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'subtle' | 'border-only'
  hoverLift?: boolean
}

export const Card: React.FC<CardProps> = ({
  variant = 'surface',
  hoverLift = false,
  className,
  children,
  ...props
}) => {
  const variantClasses = {
    surface: 'bg-[#FFFFFF] border border-[#E5E5E1] shadow-subtle',
    subtle: 'bg-[#F2F2EF] border border-[#E5E5E1]',
    'border-only': 'bg-transparent border border-[#E5E5E1]',
  }

  return (
    <div
      className={cn(
        'rounded-[12px] p-6 text-left transition-all duration-200',
        variantClasses[variant],
        hoverLift && 'hover:-translate-y-1 hover:border-[#D5D5D0] hover:shadow-elevated',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
