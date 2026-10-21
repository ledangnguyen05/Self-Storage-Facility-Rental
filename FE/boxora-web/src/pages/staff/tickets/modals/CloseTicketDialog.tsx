import { useState } from 'react'
import { ConfirmDialog, Field, Textarea } from '@/components/ui'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { getTicketCode } from '../ticketUtils'

const DEFAULT_NOTE = 'Quản lý cơ sở đã nghiệm thu hiện trường và xác nhận đóng ticket.'

interface CloseTicketDialogProps {
  ticket: SupportTicketRecord
  onClose: () => void
  onSubmit: (ticket: SupportTicketRecord, note: string) => Promise<boolean>
}

/** Facility manager signs off a resolved ticket. */
export function CloseTicketDialog({ ticket, onClose, onSubmit }: CloseTicketDialogProps) {
  const [note, setNote] = useState(DEFAULT_NOTE)

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Nghiệm thu và đóng ticket?"
      description={`Ticket ${getTicketCode(ticket)} sẽ chuyển sang Đã đóng. Hành động này xác nhận hiện trường đã được khắc phục hoàn tất.`}
      confirmLabel="Nghiệm thu và đóng"
      onConfirm={async () => {
        const ok = await onSubmit(ticket, note.trim() || DEFAULT_NOTE)
        if (ok) onClose()
      }}
    >
      <Field label="Ghi chú nghiệm thu" optional>
        <Textarea rows={3} value={note} onChange={event => setNote(event.target.value)} />
      </Field>
    </ConfirmDialog>
  )
}
