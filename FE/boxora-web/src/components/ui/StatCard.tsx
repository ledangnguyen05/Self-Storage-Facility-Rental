import React from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from './cn'
import { renderIcon, type IconProp } from './icon'
import { Skeleton } from './Skeleton'
import { toneSubtleBg, toneText, type Tone } from './tones'

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  label: React.ReactNode
  /** Already formatted value (use formatCurrency / formatNumber). */
  value: React.ReactNode
  icon?: IconProp
  /** Colours the icon tile (e.g. `danger` for overdue counts). */
  tone?: Tone
  /** Change vs. previous period, e.g. "+12%" or "−3". The sign picks the tone unless `deltaTone` is set. */
  delta?: React.ReactNode
  deltaTone?: 'success' | 'danger' | 'neutral'
  /** Secondary line, e.g. "so với tháng trước". */
  hint?: React.ReactNode
  loading?: boolean
}

function inferDeltaTone(delta: React.ReactNode): 'success' | 'danger' | 'neutral' {
  if (typeof delta !== 'string' && typeof delta !== 'number') return 'neutral'
  const text = String(delta).trim()
  if (text.startsWith('+')) return 'success'
  if (text.startsWith('-') || text.startsWith('−')) return 'danger'
  if (typeof delta === 'number') return delta > 0 ? 'success' : delta < 0 ? 'danger' : 'neutral'
  return 'neutral'
}

/** KPI tile. At most four per row (DESIGN_SYSTEM §4). */
export function StatCard({
  label,
  value,
  icon,
  tone,
  delta,
  deltaTone,
  hint,
  loading = false,
  className,
  onClick,
  ...props
}: StatCardProps) {
  const resolvedDeltaTone = deltaTone ?? inferDeltaTone(delta)
  const hasDelta = delta !== undefined && delta !== null && delta !== ''
  const interactive = Boolean(onClick)

  return (
    <div
      data-slot="stat-card"
      onClick={onClick}
      onKeyDown={
        interactive
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.currentTarget.click()
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4',
        interactive && 'cursor-pointer transition-colors hover:border-line-strong',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-dense font-medium text-fg-muted">{label}</span>
        {icon ? (
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md',
              tone ? cn(toneSubtleBg[tone], toneText[tone]) : 'bg-surface-2 text-fg-subtle',
            )}
          >
            {renderIcon(icon, { size: 20 })}
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="truncate text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</span>
          {hasDelta || hint ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
              {hasDelta ? (
                <span className={cn('inline-flex items-center gap-0.5 font-medium tabular-nums', toneText[resolvedDeltaTone])}>
                  {resolvedDeltaTone === 'success' ? <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                  {resolvedDeltaTone === 'danger' ? <ArrowDownRight size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                  {delta}
                </span>
              ) : null}
              {hint ? <span className="text-fg-subtle">{hint}</span> : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
