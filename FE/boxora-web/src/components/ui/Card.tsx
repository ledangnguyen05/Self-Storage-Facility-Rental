import React from 'react'
import { cn } from './cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a hover border for clickable cards. */
  interactive?: boolean
}

/** Bordered surface on the canvas. No shadow (DESIGN_SYSTEM §1.3). */
export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'min-w-0 rounded-lg border border-line bg-surface text-fg',
        interactive && 'cursor-pointer transition-colors hover:border-line-strong',
        className,
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Buttons or links aligned to the right of the title. */
  actions?: React.ReactNode
  /** Draws a divider under the header. */
  divider?: boolean
  /** Heading level for the title (default h3). */
  titleAs?: 'h2' | 'h3' | 'h4'
}

export function CardHeader({ title, description, actions, divider = false, titleAs: Title = 'h3', className, children, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4', divider ? 'border-b border-line pb-4' : 'pb-0', className)}
      {...props}
    >
      {title || description ? (
        <div className="min-w-0 flex-1">
          {title ? <Title className="text-base font-semibold text-fg">{title}</Title> : null}
          {description ? <p className="mt-0.5 text-dense text-fg-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3', className)}
      {...props}
    />
  )
}
