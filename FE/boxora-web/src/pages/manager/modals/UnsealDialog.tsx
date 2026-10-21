import { useState, type FormEvent } from 'react'
import { Alert, Button, DescriptionList, Field, Input, Modal, Textarea } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { addDays, formatDateTime, toLocalISODate, todayISO } from '@/lib/format'
import { sealingService, type SealingRecordResponse } from '@/services/sealingService'

export interface UnsealTarget {
  sealingRecordId: string
  protocolNumber?: string | null
  unitCode?: string | null
  customerName?: string | null
  sealedAt?: string | null
}

interface UnsealDialogProps {
  open: boolean
  onClose: () => void
  target: UnsealTarget
  onUnsealed: (record: SealingRecordResponse) => void
}

const MAX_HOLD_DAYS = 30

/** "Gỡ niêm phong": closes the protocol and reopens tenant access. The unit stays occupied (goods are inside). */
export function UnsealDialog(props: UnsealDialogProps) {
  if (!props.open) return null
  return <UnsealForm {...props} />
}

function UnsealForm({ onClose, target, onUnsealed }: UnsealDialogProps) {
  const today = todayISO()
  const maxHold = toLocalISODate(addDays(new Date(), MAX_HOLD_DAYS))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [holdUntil, setHoldUntil] = useState(toLocalISODate(addDays(new Date(), 3)))
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reasonError = touched && !reason.trim() ? 'Nhập lý do gỡ niêm phong.' : undefined
  const holdError = touched && (!holdUntil || holdUntil < today || holdUntil > maxHold) ? 'Chọn ngày từ hôm nay đến tối đa 30 ngày tới.' : undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!reason.trim() || !holdUntil || holdUntil < today || holdUntil > maxHold) return
    setIsSubmitting(true)
    setError(null)
    try {
      const record = await sealingService.unseal(target.sealingRecordId, {
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        holdUntil,
      })
      onUnsealed(record)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể gỡ niêm phong.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      title={
        <>
          Gỡ niêm phong kho <span className="whitespace-nowrap">{target.unitCode ?? ''}</span>
        </>
      }
      description="Biên bản chuyển sang đã gỡ niêm phong, khách được cấp lại mã PIN/QR. Kho vẫn ở trạng thái đang thuê."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form="unseal-form" loading={isSubmitting}>
            Gỡ niêm phong
          </Button>
        </>
      }
    >
      <form id="unseal-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert tone="danger" title="Không thể gỡ niêm phong" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <DescriptionList
          items={[
            { label: 'Biên bản', value: target.protocolNumber ?? undefined, mono: true },
            { label: 'Khách thuê', value: target.customerName ?? undefined },
            { label: 'Niêm phong lúc', value: target.sealedAt ? formatDateTime(target.sealedAt) : undefined },
          ]}
        />
        <Field label="Lý do gỡ niêm phong" required error={reasonError} hint="Ví dụ: khách đã thanh toán đủ công nợ ngày hôm nay.">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} />
        </Field>
        <Field label="Ghi chú hiện trường" optional>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={1000} />
        </Field>
        <Field
          label="Giữ quyền truy cập đến ngày"
          required
          error={holdError}
          hint="Chỉ áp dụng nếu hợp đồng vẫn quá hạn sau khi gỡ niêm phong. Tối đa 30 ngày."
        >
          <Input type="date" min={today} max={maxHold} value={holdUntil} onChange={(event) => setHoldUntil(event.target.value)} className="w-48" />
        </Field>
      </form>
    </Modal>
  )
}
