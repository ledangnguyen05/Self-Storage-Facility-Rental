import { useState } from 'react'
import { CalendarClock, CheckCircle2, CreditCard, ExternalLink, PenLine, RefreshCw } from 'lucide-react'
import { Alert, Badge, Button, DescriptionList, Modal, SkeletonText, Stepper, useToast } from '@/components/ui'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { getContractRenewalStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, formatPercent } from '@/lib/format'
import { contractService, OPEN_RENEWAL_STATUSES, type ContractRenewal } from '@/services/contractService'
import { isSafePaymentUrl, paymentService } from '@/services/paymentService'
import { pricingService } from '@/services/pricingService'
import type { RentalContract } from '@/types'
import { ChoiceCard } from '../components/ChoiceCard'
import { PaymentLinkPanel } from '../components/PaymentLinkPanel'
import { RENEWAL_MONTH_OPTIONS } from '../constants'
import { isOverdueContract } from '../lib/portal'

interface RenewalModalProps {
  contract: RentalContract
  onClose: () => void
  /** After a request, payment link or cancellation: reload contracts and payments. */
  onChanged: () => void
  /** Opens the in-app addendum signature (test environment). Replaces this dialog. */
  onSignInApp: (renewal: ContractRenewal, contract: RentalContract) => void
  /** Open request to show (when the contract list is not reloaded yet). */
  initialRenewal?: ContractRenewal
}

/**
 * Renewal of a contract: request (inside the facility renewal window, or any time while overdue),
 * sign the addendum and pay the renewal fee. The contract and its booking get the new end date once
 * both are done. All amounts come from the server (pricing quote + late fee of an overdue contract).
 */
export function RenewalModal({ contract, onClose, onChanged, onSignInApp, initialRenewal }: RenewalModalProps) {
  const [created, setCreated] = useState<ContractRenewal | null>(initialRenewal ?? null)
  const pending = useAsyncData(
    signal => (contract.pendingRenewalId ? contractService.getRenewal(contract.pendingRenewalId, { signal }) : Promise.resolve(null)),
    [contract.pendingRenewalId],
  )
  const current = created ?? pending.data ?? null

  if (contract.pendingRenewalId && pending.isLoading && !created) {
    return (
      <Modal open onClose={onClose} title="Gia hạn hợp đồng" size="md">
        <SkeletonText lines={4} />
      </Modal>
    )
  }
  if (current && (OPEN_RENEWAL_STATUSES.has(current.status) || created)) {
    return (
      <RenewalProgress
        contract={contract}
        initial={current}
        onClose={onClose}
        onChanged={onChanged}
        onSignInApp={renewal => onSignInApp(renewal, contract)}
      />
    )
  }
  return <RenewalRequest contract={contract} onClose={onClose} onCreated={renewal => { setCreated(renewal); onChanged() }} />
}

// ------------------------------------------------------------------ request

function RenewalRequest({ contract, onClose, onCreated }: { contract: RentalContract; onClose: () => void; onCreated: (r: ContractRenewal) => void }) {
  const toast = useToast()
  const overdue = isOverdueContract(contract)
  const [months, setMonths] = useState<number>(overdue ? 1 : 3)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const renewable = contract.renewable !== false

  const quote = useAsyncData(
    signal =>
      pricingService.getQuote(
        { storageUnitId: contract.storageUnitId as string, rentalMonths: months, startDate: contract.endDate || undefined, renewal: true },
        { signal },
      ),
    [contract.storageUnitId, contract.endDate, months],
    { enabled: Boolean(contract.storageUnitId) && renewable },
  )
  const outstanding = useAsyncData(signal => paymentService.getContractOutstanding(contract.id, { signal }), [contract.id], {
    enabled: overdue && renewable,
  })
  const quoteReady = Boolean(quote.data) && !quote.error && !quote.isLoading && !quote.isRefreshing
  const estimate = quote.data
  const lateFee = outstanding.data?.lateFee ?? 0
  const discount = estimate?.discountAmount || 0

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const renewal = await contractService.requestRenewal(contract.id, months)
      toast.success('Đã tạo yêu cầu gia hạn', 'Tiếp theo: ký phụ lục và thanh toán phí gia hạn.')
      onCreated(renewal)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tạo yêu cầu gia hạn. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title="Gia hạn hợp đồng"
      description={`Kho ${contract.unitCode} · ${contract.facilityName ? formatFacilityName(contract.facilityName) : '—'}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Đóng
          </Button>
          <Button onClick={() => void submit()} loading={submitting} disabled={!renewable}>
            Tạo yêu cầu gia hạn
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Mã hợp đồng', value: contract.contractCode || '—', mono: true },
            { label: 'Thời hạn hiện tại', value: `${formatDate(contract.startDate)} – ${formatDate(contract.endDate)}` },
            { label: 'Giá thuê hiện tại', value: <span className="tabular-nums">{formatCurrency(contract.monthlyFee)} / tháng</span> },
          ]}
        />

        {!renewable ? (
          <Alert tone="info" icon={CalendarClock} title="Chưa thể gia hạn hôm nay">
            {contract.renewalBlockedReason || 'Hợp đồng hiện không thể gia hạn.'}
          </Alert>
        ) : (
          <>
            {overdue ? (
              <Alert tone="warning" title="Hợp đồng đang quá hạn">
                Thời hạn mới tính tiếp từ ngày {formatDate(contract.endDate)}. Phí gia hạn gồm tiền thuê kỳ mới và phí trễ hạn theo chính sách của cơ sở;
                quyền truy cập được mở lại khi bạn ký phụ lục và thanh toán.
              </Alert>
            ) : null}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-fg">Gia hạn thêm</legend>
              <div role="radiogroup" aria-label="Số tháng gia hạn" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RENEWAL_MONTH_OPTIONS.map(option => (
                  <ChoiceCard
                    key={option}
                    name="renewal-months"
                    value={String(option)}
                    checked={months === option}
                    onSelect={value => setMonths(Number(value))}
                    label={`${option} tháng`}
                  />
                ))}
              </div>
            </fieldset>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-fg">Phí gia hạn dự kiến</h3>
              {!contract.storageUnitId ? (
                <Alert tone="info" icon={null}>Phí gia hạn được hệ thống tính khi bạn tạo yêu cầu.</Alert>
              ) : quote.error ? (
                <Alert
                  tone="warning"
                  title="Không tải được báo giá gia hạn"
                  action={
                    <Button size="sm" variant="secondary" onClick={() => void quote.reload()}>
                      Thử lại
                    </Button>
                  }
                >
                  {getApiErrorMessage(quote.error)} Phí chính thức do hệ thống tính khi tạo yêu cầu.
                </Alert>
              ) : !quoteReady || !estimate ? (
                <div className="rounded-lg border border-line p-4" aria-busy="true">
                  <SkeletonText lines={3} />
                </div>
              ) : (
                <DescriptionList
                  layout="inline"
                  className="rounded-lg border border-line p-4"
                  items={[
                    {
                      label: `${estimate.rentalMonths} tháng × ${formatCurrency(estimate.monthlyPrice ?? estimate.monthlyRate)}`,
                      value: <span className="tabular-nums">{formatCurrency(estimate.subtotalRentalFee)}</span>,
                    },
                    {
                      label: estimate.discountPercentage ? `Chiết khấu kỳ hạn (${formatPercent(estimate.discountPercentage)})` : 'Chiết khấu kỳ hạn',
                      value: <span className="tabular-nums text-success">{discount > 0 ? `−${formatCurrency(discount)}` : formatCurrency(0)}</span>,
                    },
                    ...(overdue
                      ? [{ label: 'Phí trễ hạn (tính đến hôm nay)', value: <span className="tabular-nums">{outstanding.isLoading ? '…' : formatCurrency(lateFee)}</span> }]
                      : []),
                    {
                      label: <span className="font-medium text-fg">Tổng phí gia hạn</span>,
                      value: <span className="text-base font-semibold tabular-nums">{formatCurrency((estimate.totalRentalFee ?? 0) + (overdue ? lateFee : 0))}</span>,
                    },
                  ]}
                />
              )}
              <p className="text-dense text-fg-muted">Tiền cọc của hợp đồng gốc được giữ nguyên, không thu thêm khi gia hạn.</p>
            </section>
          </>
        )}

        {error ? (
          <Alert tone="danger" title="Chưa tạo được yêu cầu gia hạn" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------ progress (sign + pay)

interface RenewalProgressProps {
  contract: RentalContract
  initial: ContractRenewal
  onClose: () => void
  onChanged: () => void
  onSignInApp: (renewal: ContractRenewal) => void
}

function RenewalProgress({ contract, initial, onClose, onChanged, onSignInApp }: RenewalProgressProps) {
  const toast = useToast()
  const query = useAsyncData(signal => contractService.getRenewal(initial.id, { signal }), [initial.id], { initialData: initial })
  const renewal = query.data ?? initial
  const [paymentUrl, setPaymentUrl] = useState('')
  const [busy, setBusy] = useState<'pay' | 'sign' | 'cancel' | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = getContractRenewalStatusMeta(renewal.status)
  const signed = Boolean(renewal.signed ?? renewal.signedAt)
  const paid = Boolean(renewal.paid ?? (renewal.paymentStatus === 'PAID'))
  const completed = renewal.status === 'COMPLETED'
  const cancelled = renewal.status === 'CANCELLED'
  const simulated = Boolean(renewal.signingSimulated)
  const step = completed ? 3 : signed && paid ? 3 : signed || paid ? (signed ? 2 : 1) : 1

  const pay = async () => {
    setBusy('pay')
    setError(null)
    try {
      const payment = await contractService.createRenewalPayment(renewal.id)
      if (!isSafePaymentUrl(payment?.paymentUrl)) throw new Error('Cổng thanh toán trả về liên kết không hợp lệ.')
      setPaymentUrl(payment.paymentUrl)
      window.open(payment.paymentUrl, '_blank', 'noopener,noreferrer')
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tạo liên kết thanh toán phí gia hạn.'))
    } finally {
      setBusy(null)
    }
  }

  const sign = async () => {
    if (simulated) {
      onSignInApp(renewal)
      return
    }
    setBusy('sign')
    setError(null)
    try {
      const url = renewal.signingUrl || (await contractService.getRenewalSigningUrl(renewal.id))
      if (!url || !/^https:\/\//.test(url)) {
        if (url && url.includes('mockSignRenewalId=')) {
          onSignInApp(renewal)
          return
        }
        throw new Error('Liên kết ký phụ lục không hợp lệ.')
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không lấy được liên kết ký phụ lục.'))
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    setBusy('cancel')
    setError(null)
    try {
      await contractService.cancelRenewal(renewal.id)
      toast.success('Đã hủy yêu cầu gia hạn')
      onChanged()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể hủy yêu cầu gia hạn.'))
      setBusy(null)
    }
  }

  const footer = completed || cancelled ? (
    <Button onClick={onClose}>Đóng</Button>
  ) : (
    <>
      {!paid ? (
        confirmCancel ? (
          <Button variant="danger" className="sm:mr-auto" loading={busy === 'cancel'} onClick={() => void cancel()}>
            Xác nhận hủy yêu cầu
          </Button>
        ) : (
          <Button variant="ghost" className="sm:mr-auto" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
            Hủy yêu cầu
          </Button>
        )
      ) : null}
      <Button variant="secondary" leftIcon={RefreshCw} loading={query.isRefreshing} onClick={() => void query.reload()}>
        Kiểm tra trạng thái
      </Button>
      {!signed ? (
        <Button variant={paid ? 'primary' : 'secondary'} leftIcon={PenLine} loading={busy === 'sign'} disabled={busy !== null} onClick={() => void sign()}>
          Ký phụ lục
        </Button>
      ) : null}
      {!paid ? (
        <Button leftIcon={CreditCard} loading={busy === 'pay'} disabled={busy !== null} onClick={() => void pay()}>
          Thanh toán phí gia hạn
        </Button>
      ) : null}
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={busy === null}
      title={completed ? 'Đã gia hạn hợp đồng' : 'Yêu cầu gia hạn hợp đồng'}
      description={`Hợp đồng ${renewal.contractCode || contract.contractCode || '—'} · kho ${renewal.unitCode || contract.unitCode}`}
      size="md"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <Stepper
          current={step}
          steps={[
            { label: 'Gửi yêu cầu' },
            { label: 'Ký phụ lục', description: signed ? 'Đã ký' : undefined },
            { label: 'Thanh toán', description: paid ? 'Đã thanh toán' : undefined },
            { label: 'Hoàn tất' },
          ]}
        />
        {completed ? (
          <Alert tone="success" icon={CheckCircle2} title="Hợp đồng đã được gia hạn">
            Thời hạn thuê mới đến ngày {formatDate(renewal.newEndDate)}.
          </Alert>
        ) : cancelled ? (
          <Alert tone="neutral" title="Yêu cầu đã hủy">
            {renewal.cancelReason || 'Bạn có thể tạo yêu cầu gia hạn mới khi cần.'}
          </Alert>
        ) : (
          <Alert tone="info" icon={null}>
            Hợp đồng được gia hạn ngay khi phụ lục đã ký và phí gia hạn đã thanh toán. Sau khi thanh toán trên VNPay, bấm Kiểm tra trạng thái.
          </Alert>
        )}
        {simulated && !signed && !cancelled ? (
          <Alert tone="warning" title="Môi trường thử nghiệm">
            Hệ thống chưa kết nối DocuSeal: phụ lục được ký trong cổng Boxora và chữ ký được lưu trên hệ thống.
          </Alert>
        ) : null}
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Trạng thái', value: <Badge tone={status.tone}>{status.label}</Badge> },
            { label: 'Gia hạn thêm', value: `${renewal.cycleMonths} tháng` },
            { label: 'Hết hạn hiện tại', value: formatDate(renewal.oldEndDate || contract.endDate) },
            { label: 'Hết hạn mới', value: formatDate(renewal.newEndDate) },
            { label: 'Tiền thuê kỳ gia hạn', value: <span className="tabular-nums">{formatCurrency(renewal.rentalFeeAmount ?? renewal.renewalFee)}</span> },
            ...(Number(renewal.lateFeeAmount) > 0
              ? [{ label: 'Phí trễ hạn', value: <span className="tabular-nums">{formatCurrency(renewal.lateFeeAmount)}</span> }]
              : []),
            { label: <span className="font-medium text-fg">Tổng phí gia hạn</span>, value: <span className="font-semibold tabular-nums">{formatCurrency(renewal.renewalFee)}</span> },
          ]}
        />
        {paymentUrl && !paid ? (
          <div className="flex flex-col gap-2">
            <PaymentLinkPanel paymentUrl={paymentUrl} />
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-center text-sm text-accent-text">
              <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
              Mở lại trang thanh toán
            </a>
          </div>
        ) : null}
        {error ? (
          <Alert tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}
