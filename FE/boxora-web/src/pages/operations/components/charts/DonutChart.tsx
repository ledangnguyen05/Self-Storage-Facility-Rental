import React from 'react'
import { cn } from '@/lib/utils'
import { getChartColor } from './chartColors'

export interface DonutSegment {
  key: string
  value: number
  /** Index into the chart palette (chart-1 … chart-6). */
  colorIndex: number
}

export interface DonutChartProps {
  segments: readonly DonutSegment[]
  /** Big number in the middle (usually the total). */
  centerValue: React.ReactNode
  centerLabel: string
  'aria-label': string
  className?: string
}

const SIZE = 160
const CENTER = SIZE / 2
const RADIUS = 64
const STROKE_WIDTH = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface Arc {
  key: string
  colorIndex: number
  length: number
  /** Distance from the 12 o'clock start, in stroke units. */
  start: number
}

/**
 * Ring chart. Every segment is its own dash on the same circle: it is as long as its share of the
 * total and starts where the previous one ended, so the arcs never overlap.
 */
export function DonutChart({ segments, centerValue, centerLabel, className, ...props }: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)

  const arcs = segments.reduce<Arc[]>((accumulated, segment) => {
    if (segment.value <= 0 || total <= 0) return accumulated
    const previous = accumulated[accumulated.length - 1]
    const start = previous ? previous.start + previous.length : 0
    accumulated.push({ key: segment.key, colorIndex: segment.colorIndex, length: (segment.value / total) * CIRCUMFERENCE, start })
    return accumulated
  }, [])

  return (
    <div className={cn('relative mx-auto size-40', className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={props['aria-label']} className="size-full -rotate-90">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth={STROKE_WIDTH} className="stroke-surface-3" />
        {arcs.map(arc => (
          <circle
            key={arc.key}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
            strokeDashoffset={-arc.start}
            className={getChartColor(arc.colorIndex).stroke}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold tabular-nums text-fg">{centerValue}</span>
        <span className="text-xs text-fg-subtle">{centerLabel}</span>
      </div>
    </div>
  )
}
