import React from 'react'
import { cn } from '../../lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'subtle' | 'border-only' | 'elevated'
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
    surface:
      'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs',
    subtle:
      'bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80',
    'border-only':
      'bg-transparent border border-slate-200 dark:border-slate-800',
    elevated:
      'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md',
  }

  return (
    <div
      className={cn(
        'rounded-xl p-5 sm:p-6 text-left transition-all duration-200 text-slate-900 dark:text-slate-100',
        variantClasses[variant],
        hoverLift && 'hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
