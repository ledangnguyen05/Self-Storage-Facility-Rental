import React, { useState } from 'react'
import { SupportTicketRecord, supportTicketService } from '../../services/supportTicketService'
import { getApiErrorMessage } from '../../lib/apiError'
import { getTicketStatusMeta } from '../../constants/statusMeta'
import { Alert, Badge, Button, DescriptionList, Field, Modal, Textarea, useToast } from '../ui'

interface TicketCloseConfirmModalProps {
  isOpen: boolean
  ticket: SupportTicketRecord | null
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

const FORM_ID = 'ticket-close-form'

export const TicketCloseConfirmModal: React.FC<TicketCloseConfirmModalProps> = ({ isOpen, ticket, onClose, onSuccess }) => {
  if (!isOpen || !ticket) return null
  return <TicketCloseDialog ticket={ticket} onClose={onClose} onSuccess={onSuccess} />
}

interface TicketCloseDialogProps {
  ticket: SupportTicketRecord
  onClose: () => void
  onSuccess: TicketCloseConfirmModalProps['onSuccess']
}

function TicketCloseDialog({ ticket, onClose, onSuccess }: TicketCloseDialogProps) {
  const toast = useToast()
  // Starts empty: only what the customer actually writes is sent as feedback.
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const statusMeta = getTicketStatusMeta(ticket.status)
  const isResolved = ticket.status === 'RESOLVED'
  const ticketCode = ticket.ticketCode || ticket.ticketNumber || ticket.id.slice(0, 8)
  const location = [ticket.unitCode ? `Kho ${ticket.unitCode}` : 'Khu vực chung', ticket.facilityName].filter(Boolean).join(' · ')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting || !isResolved) return

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      // An empty note falls back to the service's neutral default.
      await supportTicketService.closeTicket(ticket.id, feedback.trim() || undefined)
      try {
        await onSuccess()
      } catch {
        // The ticket is already closed: a failed list refresh must not look like a failed close.
      }
      toast.success('Đã đóng phiếu', `Phiếu ${ticketCode} đã được đóng.`)
      onClose()
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Không thể đóng phiếu sự cố. Trạng thái phiếu vẫn được giữ nguyên.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Xác nhận đóng phiếu"
      description={`Phiếu ${ticketCode}. Sau khi đóng, bạn có thể gửi yêu cầu hỗ trợ mới nếu phát sinh vấn đề khác.`}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting} disabled={!isResolved}>
            Đóng phiếu
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={event => void handleSubmit(event)} className="flex flex-col gap-4">
        {!isResolved ? (
          <Alert tone="warning" title="Chưa thể đóng phiếu">
            Chỉ đóng được phiếu khi sự cố ở trạng thái Đã xử lý. Trạng thái hiện tại: {statusMeta.label}.
          </Alert>
        ) : null}

        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Sự cố', value: ticket.title },
              { label: 'Vị trí', value: location },
              { label: 'Trạng thái', value: <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> },
              ...(ticket.resolutionNote
                ? [{ label: 'Kết quả xử lý', value: <span className="whitespace-pre-line text-left">{ticket.resolutionNote}</span> }]
                : []),
            ]}
          />
        </div>

        <Field label="Ý kiến của bạn" optional hint="Ý kiến này được gửi kèm khi đóng phiếu.">
          <Textarea
            rows={3}
            maxLength={500}
            value={feedback}
            onChange={event => setFeedback(event.target.value)}
            placeholder="Chia sẻ đánh giá về cách sự cố được xử lý"
            disabled={isSubmitting}
          />
        </Field>

        {errorMessage ? (
          <Alert tone="danger" title="Chưa đóng được phiếu">
            {errorMessage}
          </Alert>
        ) : null}
      </form>
    </Modal>
  )
}
