import type { ReactNode } from 'react'
import { Badge, DescriptionList, cn, type DescriptionItem } from '../../ui'

interface AppointmentPanelProps {
  title: string
  badge: string
  /** `accent` marks the proposed appointment. */
  emphasis?: boolean
  headline: ReactNode
  items: DescriptionItem[]
}

/** One side of the "current vs proposed appointment" comparison. */
export function AppointmentPanel({ title, badge, emphasis = false, headline, items }: AppointmentPanelProps) {
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-3 rounded-lg border p-4', emphasis ? 'border-accent-line bg-accent-subtle' : 'border-line bg-surface-2')}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <Badge tone={emphasis ? 'accent' : 'neutral'} size="sm">
          {badge}
        </Badge>
      </div>
      <p className="text-base font-semibold tabular-nums text-fg">{headline}</p>
      <DescriptionList layout="inline" items={items} />
    </section>
  )
}
