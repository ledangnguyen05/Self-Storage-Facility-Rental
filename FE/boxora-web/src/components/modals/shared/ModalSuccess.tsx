import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'

export interface ModalSuccessProps {
  title: ReactNode
  description?: ReactNode
  /** Result summary: a DescriptionList, notices, next steps. */
  children?: ReactNode
}

/**
 * The one success screen used inside modals (cancel, reschedule, booking).
 * Rendered in the modal body; the modal footer carries the "Đóng" button.
 */
export function ModalSuccess({ title, description, children }: ModalSuccessProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-5 pt-2 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-success-line bg-success-subtle text-success">
        <CircleCheck size={24} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {children ? <div className="flex w-full flex-col gap-4 text-left">{children}</div> : null}
    </div>
  )
}
