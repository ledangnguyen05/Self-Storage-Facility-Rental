import React, { useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, CalendarDays, ExternalLink, FilePlus2, FileText, RefreshCw, Wallet } from 'lucide-react'
import { SignedFileLink } from '@/components/common/SignedFileLink'
import { Alert, Button, DescriptionList, useToast } from '@/components/ui'
import type { StatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency } from '@/lib/format'
import { handoverService, type HandoverPrerequisites, type PaymentRecordItem } from '@/services/handoverService'
import { getSigningMethodLabel, isCheckInReady } from '../checklist'
import { AmountSummary, ConditionCard } from '../components/ConditionCard'
import { IdentityConditionCard } from '../components/IdentityConditionCard'
import { PaymentHistoryList, type PaymentScope } from '../components/PaymentHistoryList'
import { ManualPaymentModal, type ManualPaymentType } from '../modals/ManualPaymentModal'
import { PaperContractModal } from '../modals/PaperContractModal'

interface PrerequisiteAuditStepProps {
  bookingId: string
  bookingCode: string
  unitCode: string
  customerName: string
  prerequisites: HandoverPrerequisites
  isRefreshing: boolean
  onReload: () => Promise<void>
  onPrerequisitesChange: (next: HandoverPrerequisites) => void
  /** Step 1 accepted by the backend: move to the inspection step. */
  onCompleted: () => void
}

const money = (value: number | null | undefined) => formatCurrency(value ?? 0)

const upper = (value: string | null | undefined) => String(value ?? '').toUpperCase()
const isPaidStatus = (status: string | null | undefined) => ['PAID', 'SUCCESS'].includes(upper(status))

/**
 * Payments behind one condition: counter payments of that type, plus the money paid online when booking (a single
 * BOOKING_PAYMENT covers the deposit and the first month, so it is listed under both).
 */
function paymentsFor(history: PaymentRecordItem[], scope: PaymentScope): PaymentRecordItem[] {
  return history.filter((item) => {
    const type = upper(item.paymentType)
    if (type === scope) return true
    return type === 'BOOKING_PAYMENT' && isPaidStatus(item.status) && (scope === 'RENTAL_FEE' || (item.depositPortion ?? 0) > 0)
  })
}

/** Bank transfers already recorded and waiting for confirmation: they count against what can still be recorded. */
function pendingTransfers(history: PaymentRecordItem[], scope: PaymentScope): number {
  return history
    .filter((item) => upper(item.paymentType) === scope && upper(item.status) === 'PENDING' && upper(item.paymentMethod) === 'BANK_TRANSFER')
    .reduce((sum, item) => sum + (item.amount || 0), 0)
}

function contractStatus(p: HandoverPrerequisites): StatusMeta {
  if (p.contractSigned) return { label: 'Đã ký và xác minh', tone: 'success' }
  if (String(p.contractVerificationStatus ?? '').toUpperCase() === 'PENDING_VERIFICATION') return { label: 'Chờ xác minh', tone: 'warning' }
  return { label: 'Chưa ký', tone: 'danger' }
}

function paymentStatus(satisfied: boolean, remaining: number | undefined, okLabel: string): StatusMeta {
  return satisfied ? { label: okLabel, tone: 'success' } : { label: `Thiếu ${money(remaining)}`, tone: 'danger' }
}

/** Why "Tiếp tục" is disabled, in plain words. The backend list wins when it has one. */
function blockingReasons(p: HandoverPrerequisites): string[] {
  if (p.missingPrerequisites && p.missingPrerequisites.length > 0) return p.missingPrerequisites
  const reasons: string[] = []
  if (!p.contractSigned) reasons.push('Hợp đồng thuê chưa được ký và xác minh.')
  if (!p.depositSatisfied) reasons.push(`Tiền cọc còn thiếu ${money(p.depositRemaining)}.`)
  if (!p.firstMonthRentSatisfied) reasons.push(`Tiền thuê tháng đầu còn thiếu ${money(p.firstMonthRentRemaining)}.`)
  if (!p.identityVerified) reasons.push('Chưa đối chiếu giấy tờ tùy thân gốc.')
  if (reasons.length === 0 && !p.eligibleForInspection) reasons.push('Hệ thống chưa cho phép chuyển sang nghiệm thu kho.')
  return reasons
}

export function PrerequisiteAuditStep({
  bookingId,
  bookingCode,
  unitCode,
  customerName,
  prerequisites: p,
  isRefreshing,
  onReload,
  onPrerequisitesChange,
  onCompleted,
}: PrerequisiteAuditStepProps) {
  const toast = useToast()
  const [paperOpen, setPaperOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<ManualPaymentType | null>(null)
  const [isVerifyingContract, setIsVerifyingContract] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  const ready = isCheckInReady(p)
  const reasons = useMemo(() => (ready ? [] : blockingReasons(p)), [p, ready])
  const history = p.paymentHistory ?? []
  // What can still be recorded at the desk: the server refuses money beyond it, so the button disappears when it is zero.
  const depositToRecord = p.depositSatisfied ? 0 : Math.max(0, (p.depositRemaining ?? p.requiredDeposit ?? 0) - pendingTransfers(history, 'DEPOSIT'))
  const rentToRecord = p.firstMonthRentSatisfied
    ? 0
    : Math.max(0, (p.firstMonthRentRemaining ?? p.requiredFirstMonthRent ?? 0) - pendingTransfers(history, 'RENTAL_FEE'))
  const contract = contractStatus(p)
  const isPendingVerification = String(p.contractVerificationStatus ?? '').toUpperCase() === 'PENDING_VERIFICATION'

  const verifyContract = async () => {
    setIsVerifyingContract(true)
    try {
      await handoverService.verifyPaperContract(bookingId, 'Nhân viên đã kiểm tra chữ ký và con dấu trên bản giấy.')
      toast.success('Đã xác minh hợp đồng giấy')
      await onReload()
    } catch (err) {
      toast.error('Không xác minh được hợp đồng', getApiErrorMessage(err))
    } finally {
      setIsVerifyingContract(false)
    }
  }

  const complete = async () => {
    setIsCompleting(true)
    try {
      await handoverService.completeStep1(bookingId)
      await onReload()
      onCompleted()
    } catch (err) {
      toast.error('Chưa thể chuyển sang nghiệm thu', getApiErrorMessage(err))
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">Cả bốn điều kiện phải đạt trước khi nghiệm thu kho và cấp mã PIN.</p>
        <Button variant="secondary" size="sm" leftIcon={RefreshCw} loading={isRefreshing} onClick={() => void onReload()}>
          Đối soát lại
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ConditionCard
          index={1}
          title="Hợp đồng thuê"
          description={getSigningMethodLabel(p.contractSigningMethod)}
          icon={FileText}
          status={contract}
          actions={
            <>
              <Button variant="secondary" size="sm" leftIcon={FilePlus2} onClick={() => setPaperOpen(true)}>
                {p.paperContractUrl ? 'Cập nhật bản scan' : 'Hợp đồng giấy'}
              </Button>
              {isPendingVerification ? (
                <Button size="sm" leftIcon={BadgeCheck} loading={isVerifyingContract} onClick={verifyContract}>
                  Xác minh hợp đồng
                </Button>
              ) : null}
            </>
          }
        >
          <DescriptionList
            columns={1}
            layout="inline"
            items={[
              { label: 'Mã hợp đồng', value: p.contractCode || '—', mono: true },
              { label: 'Nơi lưu bản gốc', value: p.paperOriginalLocation || '—' },
              { label: 'Người xác minh', value: p.paperVerifiedByName || '—' },
              {
                label: 'Bản scan',
                value: p.paperContractUrl ? (
                  <SignedFileLink href={p.paperContractUrl} className="inline-flex items-center gap-1 text-accent-text hover:underline">
                    Xem tệp <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                  </SignedFileLink>
                ) : (
                  '—'
                ),
              },
            ]}
          />
        </ConditionCard>

        <ConditionCard
          index={2}
          title="Tiền cọc"
          description="Hoàn lại khi trả kho, sau khi trừ các khoản phát sinh."
          icon={Wallet}
          status={paymentStatus(p.depositSatisfied, p.depositRemaining, 'Đủ cọc')}
          actions={
            depositToRecord > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setPaymentType('DEPOSIT')}>
                Ghi nhận thu cọc
              </Button>
            ) : null
          }
        >
          <AmountSummary required={p.requiredDeposit} paid={p.depositPaid} remaining={p.depositRemaining} format={money} />
          <PaymentHistoryList payments={paymentsFor(history, 'DEPOSIT')} scope="DEPOSIT" onChanged={onReload} />
        </ConditionCard>

        <ConditionCard
          index={3}
          title="Tiền thuê tháng đầu"
          description="Theo dõi riêng với tiền cọc."
          icon={CalendarDays}
          status={paymentStatus(p.firstMonthRentSatisfied, p.firstMonthRentRemaining, 'Đã thu đủ')}
          actions={
            rentToRecord > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setPaymentType('RENTAL_FEE')}>
                Ghi nhận thu tiền thuê
              </Button>
            ) : null
          }
        >
          <AmountSummary
            required={p.requiredFirstMonthRent}
            paid={p.firstMonthRentPaid}
            remaining={p.firstMonthRentRemaining}
            format={money}
          />
          <PaymentHistoryList payments={paymentsFor(history, 'RENTAL_FEE')} scope="RENTAL_FEE" onChanged={onReload} />
        </ConditionCard>

        <IdentityConditionCard bookingId={bookingId} prerequisites={p} onVerified={onPrerequisitesChange} />
      </div>

      {!ready ? (
        <Alert tone="warning" title="Chưa thể nghiệm thu kho">
          <ul className="list-disc space-y-0.5 pl-4">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <p className="mr-auto text-sm text-fg-muted">
          {ready ? 'Đủ 4/4 điều kiện. Có thể chuyển sang nghiệm thu kho.' : 'Hoàn tất các điều kiện còn thiếu để tiếp tục.'}
        </p>
        <Button rightIcon={ArrowRight} disabled={!ready} loading={isCompleting} onClick={complete}>
          Tiếp tục nghiệm thu
        </Button>
      </div>

      <PaperContractModal
        open={paperOpen}
        onClose={() => setPaperOpen(false)}
        bookingId={bookingId}
        bookingCode={bookingCode}
        unitCode={unitCode}
        prerequisites={p}
        onSaved={onReload}
      />
      <ManualPaymentModal
        open={paymentType !== null}
        onClose={() => setPaymentType(null)}
        bookingId={bookingId}
        bookingCode={bookingCode}
        customerName={customerName}
        paymentType={paymentType ?? 'DEPOSIT'}
        remaining={paymentType === 'RENTAL_FEE' ? rentToRecord : depositToRecord}
        onSaved={onReload}
      />
    </div>
  )
}
