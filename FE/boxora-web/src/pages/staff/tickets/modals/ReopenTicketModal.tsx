import { useState, type FormEvent } from 'react'
import { Button, Field, Modal, Textarea } from '@/components/ui'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { TicketSummary } from '../components/TicketSummary'
import { getTicketCode } from '../ticketUtils'

interface ReopenTicketModalProps {
  ticket: SupportTicketRecord
  onClose: () => void
  onSubmit: (ticket: SupportTicketRecord, reason: string) => Promise<boolean>
}

export function ReopenTicketModal({ ticket, onClose, onSubmit }: ReopenTicketModalProps) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const trimmed = reason.trim()
  const error = touched && !trimmed ? 'Nêu rõ điểm chưa đạt để nhân viên xử lý lại.' : undefined

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!trimmed) return
    setSaving(true)
    const ok = await onSubmit(ticket, trimmed)
    if (ok) onClose()
    else setSaving(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="md"
      title={`Yêu cầu xử lý lại ${getTicketCode(ticket)}`}
      description="Ticket quay lại trạng thái Mở lại và được giao cho nhân viên xử lý tiếp."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form="reopen-ticket-form" variant="danger" loading={saving}>
            Yêu cầu xử lý lại
          </Button>
        </>
      }
    >
      <form id="reopen-ticket-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TicketSummary ticket={ticket} />
        <Field label="Lý do chưa nghiệm thu" required error={error}>
          <Textarea
            rows={4}
            value={reason}
            onChange={event => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Nêu rõ điểm chưa đạt yêu cầu để nhân viên khắc phục."
          />
        </Field>
      </form>
    </Modal>
  )
}
