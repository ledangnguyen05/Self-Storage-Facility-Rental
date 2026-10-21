import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge, cn } from '@/components/ui'
import type { StatusMeta } from '@/constants/statusMeta'
import { TONE_ICON } from '../../components/toneClasses'

interface ConditionCardProps {
  index: number
  title: string
  description?: React.ReactNode
  icon: LucideIcon
  status: StatusMeta
  /** Action row at the bottom of the card. */
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

/** One check-in condition: icon, title, status badge, details and its actions. */
export function ConditionCard({ index, title, description, icon: Icon, status, actions, children, className }: ConditionCardProps) {
  return (
    <section
      aria-label={`Điều kiện ${index}: ${title}`}
      className={cn('flex min-w-0 flex-col rounded-lg border border-line bg-surface', className)}
    >
      <div className="flex items-start gap-3 p-4">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', TONE_ICON[status.tone])}>
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-fg">
            <span className="text-fg-subtle tabular-nums">{index}.</span> {title}
          </h4>
          {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
        </div>
        <Badge tone={status.tone} dot className="shrink-0">
          {status.label}
        </Badge>
      </div>
      {children ? <div className="flex flex-1 flex-col gap-3 px-4 pb-4">{children}</div> : <div className="flex-1" />}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">{actions}</div>
      ) : null}
    </section>
  )
}

interface AmountSummaryProps {
  required?: number | null
  paid?: number | null
  remaining?: number | null
  format: (value: number | null | undefined) => string
}

/** Required / confirmed / outstanding amounts of a payment condition. */
export function AmountSummary({ required, paid, remaining, format }: AmountSummaryProps) {
  const outstanding = remaining ?? 0
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-md bg-surface-2 p-3">
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">Phải thu</dt>
        <dd className="truncate text-sm font-medium tabular-nums text-fg">{format(required)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">Đã xác nhận</dt>
        <dd className="truncate text-sm font-medium tabular-nums text-success">{format(paid)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">Còn thiếu</dt>
        <dd className={cn('truncate text-sm font-medium tabular-nums', outstanding > 0 ? 'text-danger' : 'text-fg')}>
          {format(remaining)}
        </dd>
      </div>
    </dl>
  )
}
