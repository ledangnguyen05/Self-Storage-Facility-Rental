import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { formatCompactVnd, type ChartMonth, type RevenueStream } from '../../lib/paymentStats'
import { getChartColor } from './chartColors'

export interface BarStream {
  key: RevenueStream
  label: string
  colorIndex: number
}

export interface StackedBarChartProps {
  months: readonly ChartMonth[]
  /** Bottom-to-top order of the stacked segments. */
  streams: readonly BarStream[]
  /** Month whose breakdown is on show: the hovered or focused column, otherwise the pinned one. */
  activeKey: string | null
  /** Month pinned by a click (or Enter / Space); shown again when the pointer leaves. */
  selectedKey: string | null
  /** Hover / focus preview; `null` when the pointer or focus leaves the columns. */
  onActiveChange: (monthKey: string | null) => void
  /** Click on a column. The parent decides whether it pins or unpins the month. */
  onSelect: (monthKey: string) => void
  'aria-label': string
}

/** Height of the plot area in px. */
const PLOT_HEIGHT = 192
/** Room kept above the tallest bar for its value label. */
const LABEL_SPACE = 28
const GRID_LINE_COUNT = 4
const COLUMN_MIN_WIDTH = 56

/**
 * Stacked column chart, one column per month. Columns are toggle buttons: hover or focus previews a month,
 * a click (or Enter / Space) pins it so the breakdown stays after the pointer leaves.
 */
export function StackedBarChart({ months, streams, activeKey, selectedKey, onActiveChange, onSelect, ...props }: StackedBarChartProps) {
  const max = Math.max(...months.map(month => month.total), 1)

  return (
    <div className="overflow-x-auto">
      <div role="group" aria-label={props['aria-label']} className="relative" style={{ minWidth: months.length * COLUMN_MIN_WIDTH }}>
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
          {Array.from({ length: GRID_LINE_COUNT }, (_, index) => (
            <div
              key={index}
              className="absolute inset-x-0 border-t border-line"
              style={{ top: (index / (GRID_LINE_COUNT - 1)) * PLOT_HEIGHT }}
            />
          ))}
        </div>

        <div className="relative flex gap-2" onMouseLeave={() => onActiveChange(null)}>
          {months.map(month => {
            const barHeight = Math.max(3, Math.round((month.total / max) * (PLOT_HEIGHT - LABEL_SPACE)))
            return (
              <button
                key={month.monthKey}
                type="button"
                onMouseEnter={() => onActiveChange(month.monthKey)}
                onFocus={() => onActiveChange(month.monthKey)}
                onBlur={() => onActiveChange(null)}
                onClick={() => onSelect(month.monthKey)}
                aria-label={`${month.label}: ${formatCurrency(month.total)}`}
                aria-pressed={selectedKey === month.monthKey}
                className={cn(
                  'flex flex-1 cursor-pointer flex-col items-center rounded-md px-1 pb-1.5 transition-colors',
                  selectedKey === month.monthKey ? 'bg-accent-subtle' : activeKey === month.monthKey && 'bg-surface-2',
                )}
                style={{ minWidth: COLUMN_MIN_WIDTH - 8 }}
              >
                <span className="flex w-full flex-col items-center justify-end" style={{ height: PLOT_HEIGHT }}>
                  <span className="mb-1 text-xs font-medium tabular-nums text-fg-muted">{formatCompactVnd(month.total)}</span>
                  <span className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: barHeight }}>
                    {streams.map(stream => {
                      const value = month.byStream[stream.key]
                      if (value <= 0) return null
                      return <span key={stream.key} className={cn('block w-full', getChartColor(stream.colorIndex).bg)} style={{ height: `${(value / month.total) * 100}%` }} />
                    })}
                  </span>
                </span>
                <span className="mt-1.5 text-xs tabular-nums text-fg-subtle">{month.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
