import React from 'react'
import { cn } from './cn'

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

/** Shimmering placeholder. Size it with utilities: `<Skeleton className="h-4 w-32" />`. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton rounded-md', className)} {...props} />
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
}

/** A paragraph of skeleton lines; the last line is shorter. */
export function SkeletonText({ lines = 3, className, ...props }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-2', className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className={cn('skeleton h-3 rounded', index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}
