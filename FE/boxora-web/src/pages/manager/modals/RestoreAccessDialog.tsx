import { useState, type FormEvent } from 'react'
import { Alert, Button, DescriptionList, Field, Input, Modal, Textarea } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { addDays, formatCurrency, formatNumber, toLocalISODate, todayISO } from '@/lib/format'
import { overdueService, type AccessRestorationResult } from '@/services/overdueService'

export interface RestoreAccessTarget {
  contractId: string
  contractCode?: string | null
  unitCode?: string | null
  customerName?: string | null
  daysOverdue?: number
  totalDebt?: number
}

interface RestoreAccessDialogProps {
  open: boolean
  onClose: () => void
  target: RestoreAccessTarget
  onRestored: (result: AccessRestorationResult) => void
}

const DEFAULT_HOLD_DAYS = 3
const MAX_HOLD_DAYS = 30

/**
 * "Mở khóa truy cập": reissues the tenant PIN/QR and reopens the unit. While the contract is still past its end date,
 * access is only held open until the chosen date; after that the nightly job may lock it again.
 */
export function RestoreAccessDialog(props: RestoreAccessDialogProps) {
  if (!props.open) return null
  return <RestoreAccessForm {...props} />
}

function RestoreAccessForm({ onClose, target, onRestored }: RestoreAccessDialogProps) {
  const today = todayISO()
  const maxHold = toLocalISODate(addDays(new Date(), MAX_HOLD_DAYS))
  const [reason, setReason] = useState('')
  const [holdUntil, setHoldUntil] = useState(toLocalISODate(addDays(new Date(), DEFAULT_HOLD_DAYS)))
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reasonError = touched && !reason.trim() ? 'Nhập lý do mở khóa.' : undefined
  const holdError = touched && (!holdUntil || holdUntil < today || holdUntil > maxHold) ? 'Chọn ngày từ hôm nay đến tối đa 30 ngày tới.' : undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!reason.trim() || !holdUntil || holdUntil < today || holdUntil > maxHold) return
    setIsSubmitting(true)
    setError(null)
    try {
      onRestored(await overdueService.restoreAccess(target.contractId, { reason: reason.trim(), holdUntil }))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể mở khóa truy cập.'))
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
          Mở khóa truy cập kho <span className="whitespace-nowrap">{target.unitCode ?? ''}</span>
        </>
      }
      description="Cấp lại mã PIN/QR cho khách và mở lại kho. Khách xem mã mới trong cổng khách hàng và được báo qua thông báo, email."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form="restore-access-form" loading={isSubmitting}>
            Mở khóa truy cập
          </Button>
        </>
      }
    >
      <form id="restore-access-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert tone="danger" title="Không thể mở khóa" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <DescriptionList
          items={[
            { label: 'Khách thuê', value: target.customerName ?? undefined },
            { label: 'Hợp đồng', value: target.contractCode ?? undefined, mono: true },
            { label: 'Quá hạn', value: target.daysOverdue !== undefined ? `${formatNumber(target.daysOverdue)} ngày` : undefined },
            { label: 'Tổng nợ hiện tại', value: target.totalDebt !== undefined ? formatCurrency(target.totalDebt) : undefined },
          ]}
        />
        <Alert tone="info">
          Nếu khách đã gia hạn, hợp đồng trở lại hiệu lực. Nếu vẫn còn nợ, hợp đồng giữ trạng thái quá hạn và quyền truy cập
          chỉ được giữ đến ngày bạn chọn bên dưới.
        </Alert>
        <Field label="Lý do mở khóa" required error={reasonError} hint="Ví dụ: khách đã thanh toán tại quầy, hẹn gia hạn trong tuần.">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} />
        </Field>
        <Field label="Giữ quyền truy cập đến ngày" required error={holdError} hint="Chỉ áp dụng khi hợp đồng còn quá hạn. Tối đa 30 ngày.">
          <Input type="date" min={today} max={maxHold} value={holdUntil} onChange={(event) => setHoldUntil(event.target.value)} className="w-48" />
        </Field>
      </form>
    </Modal>
  )
}
