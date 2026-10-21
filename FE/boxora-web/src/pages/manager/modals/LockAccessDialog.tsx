import { useState, type FormEvent } from 'react'
import { Alert, Button, DescriptionList, Field, Modal, Textarea } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { overdueService, type LockoutResponse, type OverdueLedgerItem } from '@/services/overdueService'

interface LockAccessDialogProps {
  open: boolean
  onClose: () => void
  item: OverdueLedgerItem
  onLocked: (result: LockoutResponse) => void
}

/**
 * "Khóa truy cập": revokes the tenant PIN/QR and tells the tenant. While the manager's own access hold is still running
 * the lock needs an explicit written reason, because the tenant was promised access until the hold date.
 */
export function LockAccessDialog(props: LockAccessDialogProps) {
  if (!props.open) return null
  return <LockAccessForm {...props} />
}

function LockAccessForm({ onClose, item, onLocked }: LockAccessDialogProps) {
  const holdUntil = item.accessHoldUntil
  const overridesHold = Boolean(holdUntil)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const unit = item.unitCode ?? ''
  const reasonError = touched && overridesHold && !reason.trim() ? 'Nhập lý do khóa sớm.' : undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (overridesHold && !reason.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const fallback = `Quá hạn thanh toán ${formatNumber(item.daysOverdue)} ngày, tổng nợ ${formatCurrency(item.totalDebt)}`
      onLocked(await overdueService.lockoutContract(item.contractId, reason.trim() || fallback, overridesHold))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể khóa truy cập.'))
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
          Khóa truy cập kho <span className="whitespace-nowrap">{unit}</span>?
        </>
      }
      description="Thu hồi mã PIN/QR của khách và đánh dấu kho khóa do quá hạn."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" variant="danger" form="lock-access-form" loading={isSubmitting}>
            Khóa truy cập
          </Button>
        </>
      }
    >
      <form id="lock-access-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert tone="danger" title="Không thể khóa truy cập" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {overridesHold && holdUntil ? (
          <Alert tone="warning" title={`Bạn đang giữ quyền truy cập cho khách đến hết ngày ${formatDate(holdUntil)}`}>
            Khóa ngay nghĩa là rút lại quyền truy cập đã hứa trước hạn đó. Khách sẽ được báo là kho bị khóa sớm hơn thời hạn giữ.
          </Alert>
        ) : null}
        <DescriptionList
          items={[
            { label: 'Khách thuê', value: item.customerName ?? undefined },
            { label: 'Hợp đồng', value: item.contractCode, mono: true },
            { label: 'Quá hạn', value: `${formatNumber(item.daysOverdue)} ngày` },
            { label: 'Tổng nợ hiện tại', value: formatCurrency(item.totalDebt) },
          ]}
        />
        <Alert tone="info">
          Khách được báo ngay trong cổng khách hàng và qua email (nếu cơ sở đã cấu hình email). Hệ thống chưa kết nối khóa điện
          tử, nhân viên cần khóa kho tại chỗ nếu cơ sở dùng khóa cơ. Có thể mở lại bằng Mở khóa truy cập, hoặc tự động khi khách
          gia hạn.
        </Alert>
        <Field
          label={overridesHold ? 'Lý do khóa sớm' : 'Ghi chú nội bộ'}
          required={overridesHold}
          optional={!overridesHold}
          error={reasonError}
          hint={overridesHold ? 'Lý do được lưu vào nhật ký hoạt động của kho.' : 'Để trống để ghi số ngày quá hạn và tổng nợ.'}
        >
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={400} />
        </Field>
      </form>
    </Modal>
  )
}
