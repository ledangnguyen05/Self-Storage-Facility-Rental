import React, { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'
import { cn } from './cn'
import { useModalBehavior } from './overlay'
import { Portal } from './Portal'

const sizeClasses = {
  sm: 'max-w-drawer-sm',
  md: 'max-w-drawer-md',
  lg: 'max-w-drawer-lg',
} as const

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  /** sm 320px, md 480px (default), lg 640px. Always full width on small screens. */
  size?: keyof typeof sizeClasses
  side?: 'right' | 'left'
  footer?: React.ReactNode
  children?: React.ReactNode
  initialFocusRef?: React.RefObject<HTMLElement | null>
  dismissible?: boolean
  hideCloseButton?: boolean
  /** Accessible name when there is no visible title. */
  'aria-label'?: string
  className?: string
  bodyClassName?: string
}

/** Side sheet for record details and long forms opened from a table row. Same a11y rules as Modal. */
export function Drawer(props: DrawerProps) {
  if (!props.open) return null
  return <DrawerPanel {...props} />
}

function DrawerPanel({
  open,
  onClose,
  title,
  description,
  size = 'md',
  side = 'right',
  footer,
  children,
  initialFocusRef,
  dismissible = true,
  hideCloseButton = false,
  className,
  bodyClassName,
  ...props
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const { backdropProps } = useModalBehavior({ open, onClose, dismissible, panelRef, initialFocusRef })
  const hasHeader = Boolean(title || description || !hideCloseButton)

  return (
    <Portal>
      <div className="fixed inset-0 z-200 bg-scrim animate-overlay-in" aria-hidden="true" />
      <div className={cn('fixed inset-0 z-200 flex', side === 'right' ? 'justify-end' : 'justify-start')} {...backdropProps}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          aria-label={title ? undefined : props['aria-label']}
          tabIndex={-1}
          data-slot="dialog"
          className={cn(
            'flex h-full w-full flex-col bg-overlay text-fg shadow-lg outline-none',
            side === 'right' ? 'border-l border-line animate-drawer-in' : 'border-r border-line animate-drawer-in-left',
            sizeClasses[size],
            className,
          )}
        >
          {hasHeader ? (
            <div className="flex shrink-0 items-start gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                {title ? (
                  <h2 id={titleId} className="text-base font-semibold text-fg">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              {!hideCloseButton ? (
                <IconButton icon={X} size="sm" aria-label="Đóng" onClick={onClose} disabled={!dismissible} className="-mr-1.5" />
              ) : null}
            </div>
          ) : null}
          <div className={cn('min-h-0 flex-1 overflow-y-auto p-5', bodyClassName)}>{children}</div>
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          ) : null}
        </div>
      </div>
    </Portal>
  )
}
