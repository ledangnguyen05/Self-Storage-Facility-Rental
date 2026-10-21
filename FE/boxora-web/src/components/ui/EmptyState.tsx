import React from 'react'
import { Inbox } from 'lucide-react'
import { cn } from './cn'
import { renderIcon, type IconProp } from './icon'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: IconProp
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary next step, e.g. a Button. */
  action?: React.ReactNode
  /** `sm` for popovers and table cells, `md` for cards and pages. */
  size?: 'sm' | 'md'
}

export function EmptyState({ icon = Inbox, title, description, action, size = 'md', className, ...props }: EmptyStateProps) {
  const small = size === 'sm'
  return (
    <div
      data-slot="empty-state"
      className={cn('flex flex-col items-center justify-center text-center', small ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12', className)}
      {...props}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-subtle',
          small ? 'size-9' : 'size-12',
        )}
      >
        {renderIcon(icon, { size: small ? 18 : 24 })}
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn('font-medium text-fg', small ? 'text-sm' : 'text-base')}>{title}</p>
        {description ? <p className="text-dense text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  )
}
