import React from 'react'
import { Check } from 'lucide-react'
import { cn } from './cn'

export type StepStatus = 'complete' | 'current' | 'upcoming'

export interface StepItem {
  id?: string
  label: React.ReactNode
  description?: React.ReactNode
  /** Overrides the status derived from `current`. */
  status?: StepStatus
}

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: StepItem[]
  /** Zero-based index of the current step. Earlier steps are complete. */
  current: number
}

/** Horizontal wizard progress (check-in, booking, return). Labels collapse to the current step on mobile. */
export function Stepper({ steps, current, className, ...props }: StepperProps) {
  return (
    <ol data-slot="stepper" className={cn('flex w-full items-center gap-2', className)} {...props}>
      {steps.map((step, index) => {
        const status: StepStatus = step.status ?? (index < current ? 'complete' : index === current ? 'current' : 'upcoming')
        const last = index === steps.length - 1
        return (
          <li
            key={step.id ?? index}
            aria-current={status === 'current' ? 'step' : undefined}
            className={cn('flex min-w-0 items-center gap-2', !last && 'flex-1')}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                status === 'complete' && 'border-accent bg-accent text-on-accent',
                status === 'current' && 'border-accent bg-accent-subtle text-accent-text',
                status === 'upcoming' && 'border-line-strong bg-surface text-fg-subtle',
              )}
            >
              {status === 'complete' ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn('min-w-0 flex-col', status === 'current' ? 'flex' : 'hidden sm:flex')}>
              <span
                className={cn(
                  'truncate text-sm font-medium',
                  status === 'upcoming' ? 'text-fg-subtle' : 'text-fg',
                )}
              >
                {step.label}
              </span>
              {step.description ? <span className="truncate text-xs text-fg-subtle">{step.description}</span> : null}
              <span className="sr-only">
                {status === 'complete' ? '(đã hoàn tất)' : status === 'current' ? '(bước hiện tại)' : '(chưa thực hiện)'}
              </span>
            </span>
            {!last ? (
              <span
                aria-hidden="true"
                className={cn('h-px min-w-4 flex-1', index < current ? 'bg-accent' : 'bg-line-strong')}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
