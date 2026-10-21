import { useState, type FormEvent } from 'react'
import { Button, Field, Modal, Textarea, useToast } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { supportTicketService, type SupportTicketRecord } from '@/services/supportTicketService'

interface ReopenTicketModalProps {
  ticket: SupportTicketRecord
  onClose: () => void
  onReopened: () => void | Promise<void>
}

/** Asks the facility to handle a resolved ticket again, with the customer's reason. */
export function ReopenTicketModal({ ticket, onClose, onReopened }: ReopenTicketModalProps) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const code = ticket.ticketCode || ticket.id.slice(0, 8).toUpperCase()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = reason.trim()
    if (!text) {
      setError('Vui lòng cho biết vì sao sự cố cần được xử lý lại.')
      return
    }
    setSubmitting(true)
    try {
      await supportTicketService.reopenTicket(ticket.id, text)
      toast.success('Đã gửi yêu cầu xử lý lại', `Phiếu ${code} đã được mở lại.`)
      await onReopened()
      onClose()
    } catch (err) {
      toast.error('Không thể yêu cầu xử lý lại', getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title="Yêu cầu xử lý lại"
      description={`Phiếu ${code} · ${ticket.title}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" form="reopen-ticket-form" loading={submitting}>
            Gửi yêu cầu
          </Button>
        </>
      }
    >
      <form id="reopen-ticket-form" onSubmit={submit} noValidate>
        <Field label="Lý do" required error={error} hint="Mô tả điều chưa được khắc phục hoặc vấn đề mới phát sinh.">
          <Textarea
            rows={4}
            value={reason}
            onChange={event => {
              setReason(event.target.value)
              if (error) setError(null)
            }}
            placeholder="Ví dụ: khóa vẫn báo lỗi sau lần mở đầu tiên."
          />
        </Field>
      </form>
    </Modal>
  )
}
