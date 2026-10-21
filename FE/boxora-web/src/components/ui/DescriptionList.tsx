import React from 'react'
import { cn } from './cn'

export interface DescriptionItem {
  label: React.ReactNode
  /** Empty values (null, undefined, '') render as "—". */
  value: React.ReactNode
  /** Render the value in JetBrains Mono (codes, PINs, refs). */
  mono?: boolean
  /** Span every column. */
  full?: boolean
  key?: string
}

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: DescriptionItem[]
  columns?: 1 | 2 | 3
  /** `stacked`: label above value. `inline`: label left, value right (compact detail panels). */
  layout?: 'stacked' | 'inline'
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
} as const

const isEmpty = (value: React.ReactNode) => value === null || value === undefined || value === ''

/** Key/value grid for record details (drawers, detail pages). */
export function DescriptionList({ items, columns = 2, layout = 'stacked', className, ...props }: DescriptionListProps) {
  if (layout === 'inline') {
    return (
      <dl data-slot="description-list" className={cn('flex flex-col divide-y divide-line', className)} {...props}>
        {items.map((item, index) => (
          <div key={item.key ?? index} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-dense text-fg-muted">{item.label}</dt>
            <dd className={cn('min-w-0 text-right text-sm text-fg', item.mono && 'font-mono', isEmpty(item.value) && 'text-fg-subtle')}>
              {isEmpty(item.value) ? '—' : item.value}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl data-slot="description-list" className={cn('grid gap-x-6 gap-y-4', columnClasses[columns], className)} {...props}>
      {items.map((item, index) => (
        <div key={item.key ?? index} className={cn('flex min-w-0 flex-col gap-1', item.full && 'col-span-full')}>
          <dt className="text-dense text-fg-muted">{item.label}</dt>
          <dd className={cn('break-words text-sm text-fg', item.mono && 'font-mono', isEmpty(item.value) && 'text-fg-subtle')}>
            {isEmpty(item.value) ? '—' : item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
