import React from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from './cn'
import { renderIcon, type IconProp } from './icon'
import { toneSoft, toneText, type Tone } from './tones'

const defaultIcons: Record<Tone, IconProp> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
}

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: Tone
  title?: React.ReactNode
  /** Override the tone icon, or pass `null` to hide it. */
  icon?: IconProp | null
  /** Inline action, e.g. `<Button size="sm" variant="secondary">Thử lại</Button>`. */
  action?: React.ReactNode
  onDismiss?: () => void
}

/** Inline callout for page or section level messages (errors with Retry, warnings, notes). */
export function Alert({ tone = 'info', title, icon, action, onDismiss, className, children, ...props }: AlertProps) {
  const resolvedIcon = icon === undefined ? defaultIcons[tone] : icon
  const urgent = tone === 'danger' || tone === 'warning'
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      data-slot="alert"
      className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', toneSoft[tone], className)}
      {...props}
    >
      {resolvedIcon ? <span className={cn('mt-0.5 shrink-0', toneText[tone])}>{renderIcon(resolvedIcon, { size: 16 })}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium text-fg">{title}</p> : null}
        {children ? <div className={cn('text-fg-muted', title ? 'mt-0.5' : undefined)}>{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2 self-center">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="-m-1 flex size-6 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
        >
          <X size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
