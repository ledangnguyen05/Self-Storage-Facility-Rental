import { useRef, useState, type ReactNode } from 'react'
import { Banknote, CheckCircle2, FileUp, Landmark, Paperclip, ShieldCheck, XCircle } from 'lucide-react'
import { SignedFileLink } from '@/components/common/SignedFileLink'
import { Alert, Badge, Button, DescriptionList, Drawer, Field, Input, Textarea, Timeline, useToast } from '@/components/ui'
import { RefundBankFields } from '@/components/booking/RefundBankFields'
import { EMPTY_REFUND_BANK, validateRefundBank, type RefundBankErrors, type RefundBankValue } from '@/components/booking/refundBank'
import { buildRefundTimeline } from '@/components/booking/refundTimeline'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { getRefundStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { refundService, type RefundRequestItem } from '@/services/refundService'
import type { RefundPermissions } from './queues'

interface RefundDrawerProps {
  refund: RefundRequestItem | null
  permissions: RefundPermissions
  onClose: () => void
  /** Called with the updated refund after every action. */
  onUpdated: (refund: RefundRequestItem) => void
}

type Busy = 'approve' | 'reject' | 'bank' | 'evidence' | 'transfer' | 'process' | 'confirm' | 'reconcile' | null

/** Refund detail with the next lifecycle action for the current role. */
export function RefundDrawer({ refund, permissions, onClose, onUpdated }: RefundDrawerProps) {
  if (!refund) return null
  return <RefundDrawerBody key={refund.id} refund={refund} permissions={permissions} onClose={onClose} onUpdated={onUpdated} />
}

function RefundDrawerBody({ refund, permissions, onClose, onUpdated }: RefundDrawerProps & { refund: RefundRequestItem }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [reference, setReference] = useState('')
  const [editBank, setEditBank] = useState(false)
  const [bank, setBank] = useState<RefundBankValue>(EMPTY_REFUND_BANK)
  const [bankErrors, setBankErrors] = useState<RefundBankErrors>({})
  const [error, setError] = useState<string | null>(null)
  const status = String(refund.status).toUpperCase()
  const meta = getRefundStatusMeta(refund.status)

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<RefundRequestItem>, success: string): Promise<boolean> => {
    setBusy(kind)
    setError(null)
    try {
      const updated = await action()
      toast.success(success)
      setNote('')
      setReference('')
      onUpdated(updated)
      return true
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    } finally {
      setBusy(null)
    }
  }

  const saveBank = () => {
    const errors = validateRefundBank(bank, { required: true })
    setBankErrors(errors)
    if (Object.keys(errors).length > 0) return
    void run('bank', () => refundService.updateBankAccount(refund.id, bank), 'Đã lưu tài khoản nhận hoàn tiền').then(ok => {
      if (ok) setEditBank(false)
    })
  }

  const uploadEvidence = async (file: File | undefined) => {
    if (!file) return
    await run('evidence', () => refundService.uploadTransferEvidence(refund.id, file), 'Đã tải lên minh chứng chuyển khoản')
    if (fileRef.current) fileRef.current.value = ''
  }

  const bankEditable = status === 'PENDING_REVIEW' || status === 'APPROVED'
  const needsReference = !reference.trim()
  let actions: ReactNode = null

  if (status === 'PENDING_REVIEW' && permissions.review) {
    actions = (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-fg">Xét duyệt</h3>
        <Field label="Ghi chú duyệt" optional>
          <Textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} />
        </Field>
        <Field label="Lý do từ chối" hint="Bắt buộc khi từ chối; khách hàng sẽ nhận được lý do này.">
          <Textarea value={rejectionReason} maxLength={500} onChange={event => setRejectionReason(event.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="danger"
            leftIcon={XCircle}
            loading={busy === 'reject'}
            disabled={busy !== null || !rejectionReason.trim()}
            onClick={() =>
              void run('reject', () => refundService.reviewRefund(refund.id, { action: 'REJECT', rejectionReason: rejectionReason.trim() }), 'Đã từ chối yêu cầu hoàn tiền')
            }
          >
            Từ chối
          </Button>
          <Button
            leftIcon={ShieldCheck}
            loading={busy === 'approve'}
            disabled={busy !== null}
            onClick={() => void run('approve', () => refundService.reviewRefund(refund.id, { action: 'APPROVE', reviewNote: note.trim() || undefined }), 'Đã duyệt hoàn tiền')}
          >
            Duyệt hoàn tiền
          </Button>
        </div>
      </section>
    )
  } else if ((status === 'APPROVED' || status === 'PROCESSING_TRANSFER') && permissions.transfer) {
    const starting = status === 'APPROVED'
    actions = (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-fg">{starting ? 'Bắt đầu chuyển khoản' : 'Xác nhận đã chuyển tiền'}</h3>
        {refund.bankInfoMissing ? (
          <Alert tone="warning" icon={Landmark} title="Khách chưa cung cấp tài khoản nhận tiền">
            Liên hệ khách để lấy tài khoản ngân hàng đứng tên khách, hoặc nhập thay khách ở mục Tài khoản nhận.
          </Alert>
        ) : (
          <>
            <Field
              label={starting ? 'Mã lệnh / ủy nhiệm chi' : 'Mã giao dịch ngân hàng'}
              required
              hint={starting ? 'Số tham chiếu của lệnh chuyển khoản đã tạo trên ngân hàng.' : 'Mã giao dịch trên sao kê sau khi tiền đã chuyển.'}
            >
              <Input value={reference} maxLength={100} onChange={event => setReference(event.target.value)} className="font-mono" />
            </Field>
            <Field label="Ghi chú" optional>
              <Textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={event => void uploadEvidence(event.target.files?.[0])}
                />
                <Button variant="secondary" size="sm" leftIcon={FileUp} loading={busy === 'evidence'} disabled={busy !== null} onClick={() => fileRef.current?.click()}>
                  {refund.transferEvidenceUrl ? 'Thay minh chứng' : 'Tải minh chứng'}
                </Button>
              </div>
              <Button
                leftIcon={Banknote}
                loading={busy === 'transfer' || busy === 'process'}
                disabled={busy !== null || needsReference}
                onClick={() =>
                  starting
                    ? void run(
                        'transfer',
                        () => refundService.startTransfer(refund.id, { transferReference: reference.trim(), transferNotes: note.trim() || undefined }),
                        'Đã ghi nhận lệnh chuyển khoản',
                      )
                    : void run(
                        'process',
                        () => refundService.processRefund(refund.id, { transactionReference: reference.trim(), processNotes: note.trim() || undefined }),
                        'Đã xác nhận chuyển tiền, chờ khách xác nhận',
                      )
                }
              >
                {starting ? 'Bắt đầu chuyển khoản' : 'Xác nhận đã chuyển'}
              </Button>
            </div>
          </>
        )}
      </section>
    )
  } else if ((status === 'AWAITING_CUSTOMER_CONFIRMATION' || status === 'PROCESSED' || status === 'RECONCILED') && (permissions.transfer || permissions.reconcile)) {
    const awaiting = status !== 'RECONCILED'
    actions = (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-fg">{awaiting ? 'Chờ khách xác nhận' : 'Đối soát và đóng hồ sơ'}</h3>
        {awaiting ? (
          <p className="text-dense text-fg-muted">
            Khách xác nhận trong cổng khách hàng. Nếu khách xác nhận qua điện thoại hoặc tại quầy, bạn có thể ghi nhận thay khách.
          </p>
        ) : null}
        <Field label="Ghi chú" optional>
          <Textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {awaiting ? (
            <Button
              variant="secondary"
              leftIcon={CheckCircle2}
              loading={busy === 'confirm'}
              disabled={busy !== null}
              onClick={() =>
                void run('confirm', () => refundService.confirmCustomerReceived(refund.id, { confirmationNotes: note.trim() || 'Khách xác nhận với nhân viên' }), 'Đã ghi nhận khách đã nhận tiền')
              }
            >
              Ghi nhận khách đã nhận
            </Button>
          ) : null}
          {permissions.reconcile ? (
            <Button
              leftIcon={ShieldCheck}
              loading={busy === 'reconcile'}
              disabled={busy !== null}
              onClick={() => void run('reconcile', () => refundService.reconcileRefund(refund.id, { reconciliationNotes: note.trim() || undefined }), 'Đã đối soát và đóng hồ sơ')}
            >
              Đối soát và đóng hồ sơ
            </Button>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={busy === null}
      size="lg"
      title={`Hoàn tiền ${refund.requestCode}`}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          <span className="tabular-nums">{formatCurrency(refund.finalRefundAmount)}</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <DescriptionList
          columns={2}
          items={[
            { label: 'Khách hàng', value: refund.customerName },
            { label: 'Liên hệ', value: [refund.customerPhone, refund.customerEmail].filter(Boolean).join(' · ') || null },
            { label: 'Cơ sở', value: refund.facilityName ? formatFacilityName(refund.facilityName) : null },
            { label: 'Đơn / hợp đồng', value: [refund.bookingCode, refund.contractCode].filter(Boolean).join(' · ') || null, mono: true },
            { label: 'Số tiền yêu cầu', value: <span className="tabular-nums">{formatCurrency(refund.requestedAmount)}</span> },
            { label: 'Khấu trừ', value: <span className="tabular-nums">{formatCurrency(refund.deductionAmount)}</span> },
            { label: 'Số tiền hoàn', value: <span className="font-semibold tabular-nums">{formatCurrency(refund.finalRefundAmount)}</span> },
            { label: 'Hạn hoàn tiền', value: refund.refundSlaDays ? `${refund.refundSlaDays} ngày làm việc` : null },
            { label: 'Lý do', value: refund.reason, full: true },
          ]}
        />

        <section className="flex flex-col gap-2 rounded-lg border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">Tài khoản nhận</h3>
            {bankEditable && !editBank ? (
              <Button variant="ghost" size="sm" onClick={() => setEditBank(true)}>
                {refund.bankInfoMissing ? 'Nhập thay khách' : 'Sửa'}
              </Button>
            ) : null}
          </div>
          {editBank ? (
            <div className="flex flex-col gap-3">
              <RefundBankFields value={bank} onChange={setBank} errors={bankErrors} disabled={busy === 'bank'} required />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" disabled={busy === 'bank'} onClick={() => setEditBank(false)}>
                  Hủy
                </Button>
                <Button size="sm" loading={busy === 'bank'} onClick={saveBank}>
                  Lưu tài khoản
                </Button>
              </div>
            </div>
          ) : refund.bankInfoMissing ? (
            <p className="text-dense text-warning">Khách chưa cung cấp tài khoản nhận tiền.</p>
          ) : (
            <DescriptionList
              layout="inline"
              items={[
                { label: 'Ngân hàng', value: refund.bankName },
                { label: 'Số tài khoản', value: refund.bankAccountNumber, mono: true },
                { label: 'Chủ tài khoản', value: refund.bankAccountName },
                { label: 'Cập nhật', value: refund.bankInfoUpdatedAt ? formatDateTime(refund.bankInfoUpdatedAt) : null },
              ]}
            />
          )}
          {refund.transferEvidenceUrl ? (
            <SignedFileLink href={refund.transferEvidenceUrl} className="inline-flex items-center gap-1 text-sm text-accent-text">
              <Paperclip size={16} strokeWidth={1.75} aria-hidden="true" />
              Xem minh chứng chuyển khoản
            </SignedFileLink>
          ) : null}
        </section>

        {actions}
        {error ? (
          <Alert tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg">Tiến trình</h3>
          <Timeline items={buildRefundTimeline(refund, 'staff')} />
        </section>
      </div>
    </Drawer>
  )
}
