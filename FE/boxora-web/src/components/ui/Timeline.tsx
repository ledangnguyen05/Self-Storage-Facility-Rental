import React from 'react'
import { cn } from './cn'
import { renderIcon, type IconProp } from './icon'
import { toneSubtleBg, toneText, type Tone } from './tones'

export interface TimelineItem {
  id?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Already formatted time (use formatDateTime / formatRelativeTime). */
  time?: React.ReactNode
  icon?: IconProp
  tone?: Tone
  /** Extra content under the description (badges, links). */
  meta?: React.ReactNode
}

export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  items: TimelineItem[]
}

/** Vertical activity list for audit logs, ticket history and reschedule history. */
export function Timeline({ items, className, ...props }: TimelineProps) {
  return (
    <ol data-slot="timeline" className={cn('flex flex-col', className)} {...props}>
      {items.map((item, index) => {
        const last = index === items.length - 1
        const tone = item.tone ?? 'neutral'
        return (
          <li key={item.id ?? index} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? <span aria-hidden="true" className="absolute bottom-0 left-3 top-7 w-px -translate-x-1/2 bg-line" /> : null}
            <span
              className={cn(
                'relative flex size-6 shrink-0 items-center justify-center rounded-full border border-line',
                item.icon ? cn(toneSubtleBg[tone], toneText[tone]) : 'bg-surface',
              )}
            >
              {item.icon ? (
                renderIcon(item.icon, { size: 14 })
              ) : (
                <span aria-hidden="true" className={cn('size-2 rounded-full', item.tone ? toneText[tone] : 'text-fg-subtle', 'bg-current')} />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium text-fg">{item.title}</p>
                {item.time ? <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{item.time}</span> : null}
              </div>
              {item.description ? <div className="text-dense text-fg-muted">{item.description}</div> : null}
              {item.meta ? <div className="mt-1 flex flex-wrap items-center gap-1.5">{item.meta}</div> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
