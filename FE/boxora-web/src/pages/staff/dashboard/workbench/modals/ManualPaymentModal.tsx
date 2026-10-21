import React, { useRef, useState } from 'react'
import { FileCheck2, Upload } from 'lucide-react'
import { Alert, Button, Field, Input, Modal, Tabs, cn, useToast } from '@/components/ui'
import { MANUAL_PAYMENT_METHOD_OPTIONS } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency } from '@/lib/format'
import { handoverService } from '@/services/handoverService'
import { DOCUMENT_ACCEPT, describeUploadError, formatFileSize, prepareUploadFile } from '../../utils/files'

export type ManualPaymentType = 'DEPOSIT' | 'RENTAL_FEE'
type ManualPaymentMethod = 'CASH' | 'BANK_TRANSFER'

interface ManualPaymentModalProps {
  open: boolean
  onClose: () => void
  bookingId: string
  bookingCode: string
  customerName: string
  paymentType: ManualPaymentType
  /** Outstanding amount from the backend, used as the suggested amount. */
  remaining: number
  onSaved: () => Promise<void> | void
}

const TITLES: Record<ManualPaymentType, string> = {
  DEPOSIT: 'Ghi nhận thu tiền cọc',
  RENTAL_FEE: 'Ghi nhận thu tiền thuê tháng đầu',
}

const METHOD_ITEMS = MANUAL_PAYMENT_METHOD_OPTIONS.map((option) => ({
  value: option.value as ManualPaymentMethod,
  label: option.label,
}))

export function ManualPaymentModal(props: ManualPaymentModalProps) {
  // Mounted only while open, so codes and amounts never carry over between payments.
  if (!props.open) return null
  return <ManualPaymentDialog {...props} />
}

const FORM_ID = 'manual-payment-form'

/** Smallest counter payment the backend accepts. */
const MIN_PAYMENT_AMOUNT = 1000

interface FormErrors {
  amount?: string
  voucher?: string
  reference?: string
  proof?: string
}

function ManualPaymentDialog({ onClose, bookingId, bookingCode, customerName, paymentType, remaining, onSaved }: ManualPaymentModalProps) {
  const toast = useToast()
  const proofRef = useRef<HTMLInputElement>(null)
  const [method, setMethod] = useState<ManualPaymentMethod>('CASH')
  const [amount, setAmount] = useState(remaining > 0 ? String(Math.round(remaining)) : '')
  const [voucherCode, setVoucherCode] = useState('')
  const [referenceCode, setReferenceCode] = useState('')
  /** The receipt photo or scan; it is uploaded when the payment is saved. */
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)

  const amountValue = Number(amount)
  const label = paymentType === 'DEPOSIT' ? 'tiền cọc' : 'tiền thuê tháng đầu'

  const handleProof = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setProofFile(await prepareUploadFile(file))
      setErrors((current) => ({ ...current, proof: undefined }))
    } catch (err) {
      setProofFile(null)
      setErrors((current) => ({ ...current, proof: describeUploadError(err, getApiErrorMessage) }))
    }
  }

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    if (!amount.trim() || !Number.isFinite(amountValue)) next.amount = 'Nhập số tiền thu.'
    else if (Math.round(amountValue) < MIN_PAYMENT_AMOUNT) next.amount = `Số tiền tối thiểu ${formatCurrency(MIN_PAYMENT_AMOUNT)}.`
    else if (remaining > 0 && Math.round(amountValue) > Math.round(remaining)) {
      next.amount = `Không thu quá số còn thiếu (${formatCurrency(remaining)}).`
    }
    if (method === 'CASH' && !voucherCode.trim()) next.voucher = 'Nhập số phiếu thu đã cấp cho khách.'
    if (method === 'BANK_TRANSFER' && !referenceCode.trim()) next.reference = 'Nhập mã tham chiếu giao dịch ngân hàng.'
    if (method === 'BANK_TRANSFER' && !proofFile) next.proof = 'Đính kèm ảnh biên lai chuyển khoản để có căn cứ đối soát.'
    return next
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setIsSaving(true)
    try {
      // The receipt is stored as a file on the server; the payment keeps only its url.
      const proofDocumentUrl =
        method === 'BANK_TRANSFER' && proofFile ? (await handoverService.uploadEvidence(proofFile, bookingId)).fileUrl : undefined
      await handoverService.recordManualPayment({
        bookingId,
        paymentType,
        paymentMethod: method,
        amount: Math.round(amountValue),
        receiptVoucherCode: method === 'CASH' ? voucherCode.trim() : undefined,
        referenceCode: method === 'BANK_TRANSFER' ? referenceCode.trim() : undefined,
        proofDocumentUrl,
        notes: notes.trim() || undefined,
      })
      toast.success(
        method === 'CASH' ? `Đã thu ${formatCurrency(amountValue)} ${label}` : `Đã ghi nhận chuyển khoản ${formatCurrency(amountValue)}`,
        method === 'CASH' ? undefined : 'Giao dịch chờ đối chiếu tài khoản trước khi được tính vào số đã thu.',
      )
      onClose()
      await onSaved()
    } catch (err) {
      toast.error('Không ghi nhận được khoản thu', describeUploadError(err, getApiErrorMessage))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      dismissible={!isSaving}
      title={TITLES[paymentType]}
      description={`Đơn ${bookingCode || '—'} · ${customerName || 'Khách hàng'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSaving}>
            Ghi nhận khoản thu
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Hình thức thu</span>
          <Tabs
            variant="segmented"
            fullWidth
            aria-label="Hình thức thu"
            items={METHOD_ITEMS}
            value={method}
            onValueChange={(value) => {
              setMethod(value)
              setErrors({})
            }}
          />
        </div>

        <Field
          label="Số tiền thu (₫)"
          required
          error={errors.amount}
          hint={`Còn thiếu ${formatCurrency(remaining)}${amountValue > 0 ? ` · Đang nhập ${formatCurrency(amountValue)}` : ''}`}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_PAYMENT_AMOUNT}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular-nums"
          />
        </Field>

        {method === 'CASH' ? (
          <Field label="Số phiếu thu" required error={errors.voucher} hint="Mã in trên phiếu thu giấy đã giao cho khách.">
            <Input value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} className="font-mono" autoComplete="off" />
          </Field>
        ) : (
          <>
            <Field label="Mã tham chiếu ngân hàng" required error={errors.reference} hint="Mã giao dịch trên sao kê hoặc ủy nhiệm chi.">
              <Input
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                className="font-mono"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Ảnh biên lai chuyển khoản"
              required
              error={errors.proof}
              hint="Ảnh hoặc PDF sao kê, tối đa 10 MB. Tệp được tải lên khi bạn bấm ghi nhận."
            >
              <div>
                <input
                  ref={proofRef}
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={handleProof}
                />
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3',
                    proofFile ? 'border-success-line bg-success-subtle' : 'border-line-strong bg-surface-2',
                  )}
                >
                  {proofFile ? (
                    <FileCheck2 size={20} strokeWidth={1.75} className="shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Upload size={20} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden="true" />
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm text-fg">
                    {proofFile ? `${proofFile.name} (${formatFileSize(proofFile.size)})` : 'Chưa đính kèm'}
                  </p>
                  {proofFile ? (
                    <Button variant="ghost" size="sm" disabled={isSaving} onClick={() => setProofFile(null)}>
                      Gỡ tệp
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" disabled={isSaving} onClick={() => proofRef.current?.click()}>
                    {proofFile ? 'Đổi tệp' : 'Chọn tệp'}
                  </Button>
                </div>
              </div>
            </Field>
            <Alert tone="warning">
              Khoản chuyển khoản ở trạng thái chờ đối chiếu. Chỉ bấm “Xác nhận đã nhận tiền” sau khi thấy tiền về tài khoản.
            </Alert>
          </>
        )}

        <Field label="Ghi chú" optional>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Người nộp, ngân hàng chuyển…" />
        </Field>
      </form>
    </Modal>
  )
}
