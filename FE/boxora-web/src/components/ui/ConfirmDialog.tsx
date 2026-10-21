import React, { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp, TriangleAlert } from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  /** Called by Cancel, Esc and the backdrop (not while loading). */
  onClose: () => void
  /** May return a promise; the confirm button shows a spinner until it settles. Close the dialog yourself on success. */
  onConfirm: () => void | Promise<unknown>
  title: React.ReactNode
  /** Name the consequence: "Hợp đồng HD-0012 sẽ bị hủy và không thể khôi phục." */
  description?: React.ReactNode
  confirmLabel?: React.ReactNode
  cancelLabel?: React.ReactNode
  /** `danger` for destructive or irreversible actions. */
  tone?: 'danger' | 'primary'
  /** External loading flag (in addition to the automatic one for async onConfirm). */
  loading?: boolean
  /** Extra content between the description and the buttons (e.g. a reason field). */
  children?: React.ReactNode
  confirmDisabled?: boolean
}

/** role="alertdialog" confirmation. Initial focus goes to Cancel. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'primary',
  loading = false,
  children,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [pending, setPending] = useState(false)
  const mounted = useRef(true)
  const busy = loading || pending

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const handleConfirm = async () => {
    const result = onConfirm()
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setPending(true)
      try {
        await result
      } finally {
        if (mounted.current) setPending(false)
      }
    }
  }

  const danger = tone === 'danger'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      role="alertdialog"
      hideCloseButton
      dismissible={!busy}
      initialFocusRef={cancelRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => void handleConfirm()} loading={busy} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            danger ? 'bg-danger-subtle text-danger' : 'bg-accent-subtle text-accent-text',
          )}
        >
          {danger ? <TriangleAlert size={18} strokeWidth={1.75} /> : <CircleHelp size={18} strokeWidth={1.75} />}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 id={titleId} className="text-base font-semibold text-fg">
            {title}
          </h2>
          {description ? (
            <div id={descriptionId} className="mt-1 text-sm text-fg-muted">
              {description}
            </div>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </Modal>
  )
}
