import { useState, type FormEvent } from 'react'
import { Button, Field, Modal, Textarea } from '@/components/ui'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { TicketSummary } from '../components/TicketSummary'
import { getTicketCode } from '../ticketUtils'

interface ResolveTicketModalProps {
  ticket: SupportTicketRecord
  onClose: () => void
  onSubmit: (ticket: SupportTicketRecord, note: string) => Promise<boolean>
}

export function ResolveTicketModal({ ticket, onClose, onSubmit }: ResolveTicketModalProps) {
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const trimmed = note.trim()
  const error = touched && !trimmed ? 'Nhập kết quả kiểm tra và biện pháp đã xử lý.' : undefined

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
      title={`Báo hoàn tất ${getTicketCode(ticket)}`}
      description="Quản lý cơ sở sẽ nghiệm thu trước khi ticket được đóng."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form="resolve-ticket-form" loading={saving}>
            Báo hoàn tất
          </Button>
        </>
      }
    >
      <form id="resolve-ticket-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TicketSummary ticket={ticket} />
        <Field label="Kết quả kiểm tra và biện pháp xử lý" required error={error}>
          <Textarea
            rows={4}
            value={note}
            onChange={event => setNote(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Nguyên nhân, việc đã làm và kết quả kiểm tra lại. Ví dụ: đã thay pin khóa, cài lại mã PIN và thử mở thành công."
          />
        </Field>
      </form>
    </Modal>
  )
}
