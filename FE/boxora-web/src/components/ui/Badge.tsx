import React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'accent'
    | 'outline'
    | 'primary'
    | 'brand'
  size?: 'sm' | 'md'
  dot?: boolean
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  children,
  ...props
}) => {
  const variantStyles = {
    neutral:
      'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    success:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
    warning:
      'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
    danger:
      'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    info:
      'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50',
    accent:
      'bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50',
    outline:
      'bg-transparent text-slate-700 border border-slate-300 dark:text-slate-300 dark:border-slate-700',
    primary:
      'bg-blue-600 text-white border border-blue-600 shadow-2xs dark:bg-blue-600 dark:border-blue-500',
    brand:
      'bg-slate-900 text-white border border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100',
  }

  const dotStyles = {
    neutral: 'bg-slate-400 dark:bg-slate-500',
    success: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    danger: 'bg-rose-500 dark:bg-rose-400',
    info: 'bg-blue-500 dark:bg-blue-400',
    accent: 'bg-indigo-500 dark:bg-indigo-400',
    outline: 'bg-slate-400 dark:bg-slate-500',
    primary: 'bg-white',
    brand: 'bg-blue-400',
  }

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium rounded-md tracking-tight',
    md: 'text-xs px-2.5 py-1 font-medium rounded-md tracking-tight',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 shrink-0 transition-colors select-none font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])} />}
      {children}
    </span>
  )
}
