import { useState } from 'react'
import { Banknote, CheckCircle2, Landmark, PiggyBank } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader, ConfirmDialog, DescriptionList, EmptyState, Skeleton, Textarea, Timeline, useToast } from '@/components/ui'
import { RefundBankFields } from '@/components/booking/RefundBankFields'
import { EMPTY_REFUND_BANK, validateRefundBank, type RefundBankErrors, type RefundBankValue } from '@/components/booking/refundBank'
import { buildRefundTimeline } from '@/components/booking/refundTimeline'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { getRefundStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import { refundService, type RefundRequestItem } from '@/services/refundService'

interface RefundsCardProps {
  /** Bumped after a cancellation or payment so the list reloads. */
  refreshKey: number
}

const BANK_EDITABLE = new Set(['PENDING_REVIEW', 'APPROVED'])
const AWAITING_CONFIRMATION = new Set(['AWAITING_CUSTOMER_CONFIRMATION', 'PROCESSED'])

/** "Hoàn tiền của tôi": every refund with its status history, the bank account form and the receipt confirmation. */
export function RefundsCard({ refreshKey }: RefundsCardProps) {
  const query = useAsyncData(signal => refundService.getAll({ size: 50 }, { signal }).then(page => page.content), [refreshKey])
  const refunds = query.data ?? []

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Hoàn tiền"
        description="Khoản hoàn cọc khi hủy đơn, trả kho hoặc thanh toán sau khi đơn đã hủy."
        divider
      />
      <div className="flex flex-col gap-3 p-5">
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : query.error ? (
          <Alert
            tone="danger"
            title="Không tải được khoản hoàn tiền"
            action={
              <Button size="sm" variant="secondary" onClick={() => void query.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(query.error)}
          </Alert>
        ) : refunds.length === 0 ? (
          <EmptyState size="sm" icon={PiggyBank} title="Chưa có khoản hoàn tiền" description="Khoản hoàn cọc sẽ hiển thị tại đây khi phát sinh." />
        ) : (
          refunds.map(refund => <RefundItem key={refund.id} refund={refund} onChanged={() => void query.reload()} />)
        )}
      </div>
    </Card>
  )
}

function RefundItem({ refund, onChanged }: { refund: RefundRequestItem; onChanged: () => void }) {
  const toast = useToast()
  const status = getRefundStatusMeta(refund.status)
  const statusKey = String(refund.status).toUpperCase()
  const canEditBank = BANK_EDITABLE.has(statusKey)
  const [editing, setEditing] = useState(refund.bankInfoMissing && canEditBank)
  const [bank, setBank] = useState<RefundBankValue>(EMPTY_REFUND_BANK)
  const [errors, setErrors] = useState<RefundBankErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [note, setNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const saveBank = async () => {
    const nextErrors = validateRefundBank(bank, { required: true })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSaving(true)
    try {
      await refundService.updateBankAccount(refund.id, bank)
      toast.success('Đã lưu tài khoản nhận hoàn tiền')
      setEditing(false)
      onChanged()
    } catch (err) {
      toast.error('Không lưu được tài khoản', getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmReceived = async () => {
    try {
      await refundService.confirmCustomerReceived(refund.id, { confirmationNotes: note.trim() || undefined })
      toast.success('Đã xác nhận nhận tiền hoàn', 'Cảm ơn bạn đã xác nhận.')
      setConfirmOpen(false)
      onChanged()
    } catch (err) {
      toast.error('Không xác nhận được', getApiErrorMessage(err))
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-dense text-fg-muted">{refund.requestCode}</p>
          <p className="text-sm font-medium text-fg">
            {refund.unitCode ? `Kho ${refund.unitCode}` : 'Khoản hoàn tiền'}
            {refund.facilityName ? ` · ${formatFacilityName(refund.facilityName)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tabular-nums text-fg">{formatCurrency(refund.finalRefundAmount)}</span>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
      </div>

      <DescriptionList
        columns={2}
        items={[
          { label: 'Mã đơn', value: refund.bookingCode || '—', mono: Boolean(refund.bookingCode) },
          { label: 'Ngày tạo', value: formatDate(refund.createdAt) },
          ...(Number(refund.deductionAmount) > 0
            ? [{ label: 'Khấu trừ', value: <span className="tabular-nums">{formatCurrency(refund.deductionAmount)}</span> }]
            : []),
          {
            label: 'Tài khoản nhận',
            value: refund.bankInfoMissing ? (
              <span className="text-warning">Chưa cung cấp</span>
            ) : (
              <span>
                {refund.bankName} · <span className="font-mono">{refund.bankAccountNumber}</span>
              </span>
            ),
          },
          ...(refund.refundSlaDays ? [{ label: 'Thời hạn hoàn tiền', value: `${refund.refundSlaDays} ngày làm việc sau khi duyệt` }] : []),
        ]}
      />

      {statusKey === 'REJECTED' ? (
        <Alert tone="danger" title="Yêu cầu hoàn tiền bị từ chối">
          {refund.rejectionReason || 'Vui lòng liên hệ cơ sở để biết thêm chi tiết.'}
        </Alert>
      ) : null}

      {refund.bankInfoMissing && canEditBank && !editing ? (
        <Alert
          tone="warning"
          icon={Landmark}
          title="Cần tài khoản nhận hoàn tiền"
          action={
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Cung cấp tài khoản
            </Button>
          }
        >
          Cơ sở chỉ chuyển khoản sau khi bạn cung cấp tài khoản ngân hàng đứng tên bạn.
        </Alert>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-3">
          <RefundBankFields value={bank} onChange={setBank} errors={errors} disabled={saving} required />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Hủy
            </Button>
            <Button size="sm" leftIcon={Banknote} loading={saving} onClick={() => void saveBank()}>
              Lưu tài khoản
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="link" size="sm" onClick={() => setShowHistory(value => !value)} aria-expanded={showHistory}>
          {showHistory ? 'Ẩn tiến trình' : 'Xem tiến trình'}
        </Button>
        <div className="flex flex-wrap gap-2">
          {canEditBank && !refund.bankInfoMissing && !editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Đổi tài khoản nhận
            </Button>
          ) : null}
          {AWAITING_CONFIRMATION.has(statusKey) ? (
            <Button size="sm" leftIcon={CheckCircle2} onClick={() => setConfirmOpen(true)}>
              Xác nhận đã nhận tiền
            </Button>
          ) : null}
        </div>
      </div>

      {showHistory ? <Timeline items={buildRefundTimeline(refund, 'customer')} /> : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmReceived}
        title="Xác nhận đã nhận tiền hoàn?"
        description={`Bạn xác nhận đã nhận ${formatCurrency(refund.finalRefundAmount)}${refund.transactionReference ? ` (mã giao dịch ${refund.transactionReference})` : ''}. Hồ sơ hoàn tiền sẽ được chuyển sang đối soát.`}
        confirmLabel="Đã nhận tiền"
      >
        <Textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} placeholder="Ghi chú (không bắt buộc)" />
      </ConfirmDialog>
    </article>
  )
}
