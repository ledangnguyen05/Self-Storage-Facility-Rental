import React from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from './cn'

const spinnerSizes = { xs: 12, sm: 14, md: 16, lg: 20 } as const

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: keyof typeof spinnerSizes
  /** Screen-reader text. Pass an empty string when the parent already announces loading. */
  label?: string
}

/** Inline loading indicator for buttons and small areas. Never use it as a page loader. */
export function Spinner({ size = 'md', label = 'Đang tải', className, ...props }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex shrink-0 items-center', className)} {...props}>
      <LoaderCircle size={spinnerSizes[size]} strokeWidth={2} className="animate-spin" aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
