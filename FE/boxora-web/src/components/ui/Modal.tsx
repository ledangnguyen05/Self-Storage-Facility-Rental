import React, { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'
import { cn } from './cn'
import { useModalBehavior } from './overlay'
import { Portal } from './Portal'

const sizeClasses = {
  sm: 'max-w-dialog-sm',
  md: 'max-w-dialog-md',
  lg: 'max-w-dialog-lg',
  xl: 'max-w-dialog-xl',
  full: 'h-full max-w-none',
} as const

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  /** sm 400px, md 560px (default), lg 720px, xl 960px, full = viewport minus 16px gutters. */
  size?: keyof typeof sizeClasses
  /** Buttons, right-aligned in the footer. Primary action last. */
  footer?: React.ReactNode
  children?: React.ReactNode
  /** Element focused on open. Defaults to the first form field, else the dialog. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  /** Allow Esc, backdrop click and the close button. Set false while saving. */
  dismissible?: boolean
  hideCloseButton?: boolean
  /** Accessible name when there is no visible title. */
  'aria-label'?: string
  /** Ids of custom title / description elements rendered in the body. */
  'aria-labelledby'?: string
  'aria-describedby'?: string
  /** Internal: ConfirmDialog renders an alertdialog. */
  role?: 'dialog' | 'alertdialog'
  className?: string
  bodyClassName?: string
}

/**
 * Centered dialog in a portal: focus trap, Esc to close, body scroll lock, focus
 * returns to the trigger. The body scrolls inside the panel. Do not nest modals.
 */
export function Modal(props: ModalProps) {
  if (!props.open) return null
  return <ModalPanel {...props} />
}

function ModalPanel({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  initialFocusRef,
  dismissible = true,
  hideCloseButton = false,
  role = 'dialog',
  className,
  bodyClassName,
  ...props
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const { backdropProps } = useModalBehavior({ open, onClose, dismissible, panelRef, initialFocusRef })
  const hasHeader = Boolean(title || description || !hideCloseButton)

  return (
    <Portal>
      <div className="fixed inset-0 z-200 bg-scrim animate-overlay-in" aria-hidden="true" />
      <div className="fixed inset-0 z-200 flex items-center justify-center p-2 sm:p-4" {...backdropProps}>
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={title ? titleId : props['aria-labelledby']}
          aria-describedby={description ? descriptionId : props['aria-describedby']}
          aria-label={title || props['aria-labelledby'] ? undefined : props['aria-label']}
          tabIndex={-1}
          data-slot="dialog"
          className={cn(
            'relative flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-line bg-overlay text-fg shadow-lg outline-none animate-dialog-in',
            sizeClasses[size],
            className,
          )}
        >
          {hasHeader ? (
            <div className={cn('flex shrink-0 items-start gap-4 px-5 pt-5', title || description ? 'pb-4' : 'pb-0')}>
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
                <IconButton
                  icon={X}
                  size="sm"
                  aria-label="Đóng"
                  onClick={onClose}
                  disabled={!dismissible}
                  className="-mr-1.5 -mt-1"
                />
              ) : null}
            </div>
          ) : null}
          {children !== undefined && children !== null ? (
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-5', !hasHeader && 'pt-5', bodyClassName)}>{children}</div>
          ) : null}
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          ) : null}
        </div>
      </div>
    </Portal>
  )
}
