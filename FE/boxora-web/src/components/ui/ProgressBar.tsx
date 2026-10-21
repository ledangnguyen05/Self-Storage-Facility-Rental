import React from 'react'
import { cn } from './cn'
import { toneSolidBg, type ToneWithAccent } from './tones'

export interface ProgressBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number
  max?: number
  tone?: ToneWithAccent
  /**
   * Picks the tone from the percentage instead of `tone`:
   * >= danger -> danger, >= warning -> warning, otherwise success.
   */
  thresholds?: { warning: number; danger: number }
  size?: 'sm' | 'md'
  label?: React.ReactNode
  /** Text at the right of the label row. `true` shows the rounded percentage. */
  valueLabel?: React.ReactNode | true
}

/** Occupancy / quota bar. */
export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  thresholds,
  size = 'md',
  label,
  valueLabel,
  className,
  ...props
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100))
  const resolvedTone: ToneWithAccent = thresholds
    ? percent >= thresholds.danger
      ? 'danger'
      : percent >= thresholds.warning
        ? 'warning'
        : 'success'
    : tone
  const valueText = valueLabel === true ? `${Math.round(percent)}%` : valueLabel

  return (
    <div data-slot="progress" className={cn('flex w-full flex-col gap-1.5', className)} {...props}>
      {label || valueText ? (
        <div className="flex items-baseline justify-between gap-3 text-dense">
          {label ? <span className="truncate text-fg-muted">{label}</span> : <span />}
          {valueText ? <span className="shrink-0 font-medium tabular-nums text-fg">{valueText}</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(safeMax, Math.max(0, value))}
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn('w-full overflow-hidden rounded-full bg-surface-3', size === 'sm' ? 'h-1.5' : 'h-2')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', toneSolidBg[resolvedTone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
