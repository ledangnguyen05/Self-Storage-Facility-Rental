import { useState } from 'react'
import {
  CalendarClock,
  ChevronDown,
  CreditCard,
  FileText,
  KeyRound,
  LifeBuoy,
  LogOut,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  DescriptionList,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
  Skeleton,
  cn,
} from '@/components/ui'
import { getContractStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { formatCurrency, formatDate } from '@/lib/format'
import { paymentService } from '@/services/paymentService'
import type { Booking, RentalContract } from '@/types'
import type { UnitPinState } from '../hooks/useUnitPin'
import { isOverdueContract, isPendingCheckIn, unitKey } from '../lib/portal'
import { CheckInQr } from './CheckInQr'
import { UnitAccessPanel } from './UnitAccessPanel'

export interface UnitCardActions {
  /** Opens the renewal dialog (new request, or the open request when there is one). */
  onRenew: (contract: RentalContract) => void
  onPayOutstanding: (contract: RentalContract) => void
  onMoveOut: (contract: RentalContract, booking?: Booking) => void
  onChangePin: (contract: RentalContract) => void
  onViewContract: (contract: RentalContract) => void
  onReschedule: (booking: Booking) => void
  onCancelBooking: (booking: Booking) => void
  onReportIssue: (contract: RentalContract) => void
  onViewPolicy: (contract: RentalContract) => void
  onTogglePin: (contract: RentalContract) => void
  onRetryPin: (contract: RentalContract) => void
}

interface UnitCardProps extends UnitCardActions {
  contract: RentalContract
  /** The booking behind the contract. */
  booking?: Booking
  pin: UnitPinState
  highlighted: boolean
  onClearHighlight: () => void
  /** Bumped by the page after a payment so the balance reloads. */
  refreshKey?: number
}

const RETURNING = new Set(['CHECKOUT_REQUESTED', 'INSPECTED'])

export function UnitCard({ contract, booking, pin, highlighted, onClearHighlight, refreshKey = 0, ...actions }: UnitCardProps) {
  const status = getContractStatusMeta(contract.status)
  const overdue = isOverdueContract(contract)
  const pendingBooking = booking && isPendingCheckIn(booking) ? booking : undefined
  const bookingStatus = (booking?.status ?? contract.bookingStatus ?? '').toUpperCase()
  const returning = RETURNING.has(bookingStatus)
  const bookingCode = booking?.bookingCode || contract.bookingCode || ''
  const [showCode, setShowCode] = useState(false)

  const balance = useAsyncData(signal => paymentService.getContractOutstanding(contract.id, { signal }), [contract.id, contract.endDate, refreshKey])
  const outstanding = balance.data
  const dueNow = outstanding?.totalDueNow ?? 0
  const canPay = Boolean(outstanding?.canPayOnline) && (dueNow > 0 || (outstanding?.remainingTermMonths ?? 0) > 0)
  const hasPendingRenewal = Boolean(contract.pendingRenewalId)
  const canRenew = hasPendingRenewal || contract.renewable !== false

  let debtValue
  if (balance.isLoading) debtValue = <Skeleton className="h-4 w-28" />
  else if (balance.error || !outstanding) debtValue = <span className="text-fg-muted">Chưa tải được công nợ</span>
  else if (dueNow > 0)
    debtValue = <span className="font-medium tabular-nums text-danger">{formatCurrency(dueNow)} đến hạn</span>
  else
    debtValue = (
      <span className="text-fg-muted">
        Không có khoản đến hạn{outstanding.nextRentDueDate ? ` · kỳ tới ${formatDate(outstanding.nextRentDueDate)}` : ''}
      </span>
    )

  return (
    <Card
      id={`unit-card-${unitKey(contract.unitCode)}`}
      className={cn('flex flex-col scroll-mt-24', highlighted && 'border-accent ring-1 ring-accent')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-base font-semibold text-fg">Kho {contract.unitCode}</h3>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {returning ? <Badge tone="info">Đang trả kho</Badge> : null}
            {highlighted ? (
              <span className="inline-flex items-center gap-0.5">
                <Badge tone="accent">Đang xem</Badge>
                <IconButton icon={X} size="sm" aria-label="Bỏ đánh dấu kho" onClick={onClearHighlight} />
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-dense text-fg-muted">
            {contract.facilityName || '—'} · Hợp đồng <span className="font-mono">{contract.contractCode || '—'}</span>
          </p>
        </div>
        <DropdownMenu
          aria-label={`Quản lý kho ${contract.unitCode}`}
          trigger={
            <Button variant="secondary" size="sm" rightIcon={ChevronDown}>
              Quản lý
            </Button>
          }
        >
          <DropdownMenuItem
            icon={RefreshCw}
            disabled={!canRenew || returning}
            description={!canRenew ? contract.renewalBlockedReason || undefined : hasPendingRenewal ? 'Tiếp tục yêu cầu đang mở' : undefined}
            onSelect={() => actions.onRenew(contract)}
          >
            Gia hạn hợp đồng
          </DropdownMenuItem>
          <DropdownMenuItem icon={CreditCard} disabled={!canPay} onSelect={() => actions.onPayOutstanding(contract)}>
            Thanh toán tiền thuê
          </DropdownMenuItem>
          <DropdownMenuItem icon={KeyRound} onSelect={() => actions.onChangePin(contract)}>
            Đổi mã PIN
          </DropdownMenuItem>
          <DropdownMenuItem icon={FileText} onSelect={() => actions.onViewContract(contract)}>
            Xem hợp đồng
          </DropdownMenuItem>
          {pendingBooking ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={CalendarClock} onSelect={() => actions.onReschedule(pendingBooking)}>
                Dời lịch nhận kho
              </DropdownMenuItem>
              <DropdownMenuItem icon={XCircle} tone="danger" onSelect={() => actions.onCancelBooking(pendingBooking)}>
                Hủy đặt kho
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={LogOut}
            disabled={returning || !contract.bookingId}
            description={returning ? 'Đã gửi yêu cầu' : undefined}
            onSelect={() => actions.onMoveOut(contract, booking)}
          >
            Yêu cầu trả kho
          </DropdownMenuItem>
          <DropdownMenuItem icon={LifeBuoy} onSelect={() => actions.onReportIssue(contract)}>
            Báo sự cố
          </DropdownMenuItem>
          <DropdownMenuItem icon={ShieldCheck} onSelect={() => actions.onViewPolicy(contract)}>
            Chính sách cơ sở
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {overdue ? (
          <Alert tone="danger" title="Hợp đồng quá hạn">
            Hợp đồng đã hết hạn ngày {formatDate(contract.endDate)}
            {outstanding && outstanding.overdueDays > 0 ? ` (${outstanding.overdueDays} ngày)` : ''}. Quyền truy cập có thể bị tạm khóa cho đến khi
            bạn gia hạn hoặc thanh toán công nợ.
            {canPay || canRenew ? (
              // Under the text (not beside it) so the message keeps the full width on phones.
              <div className="mt-3 flex flex-wrap gap-2">
                {canPay ? (
                  <Button size="sm" variant="secondary" onClick={() => actions.onPayOutstanding(contract)}>
                    Thanh toán công nợ
                  </Button>
                ) : null}
                {canRenew ? (
                  <Button size="sm" variant="secondary" onClick={() => actions.onRenew(contract)}>
                    Gia hạn
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Alert>
        ) : null}

        {returning ? (
          <Alert tone="info" title="Đang xử lý trả kho">
            Cơ sở đã nhận yêu cầu trả kho. Hãy mang CCCD đến quầy đúng hẹn để kiểm tra kho và quyết toán tiền cọc.
          </Alert>
        ) : null}

        {hasPendingRenewal && !returning ? (
          <Alert
            tone="warning"
            title="Yêu cầu gia hạn chưa hoàn tất"
            action={
              <Button size="sm" variant="secondary" onClick={() => actions.onRenew(contract)}>
                Ký phụ lục / thanh toán
              </Button>
            }
          >
            Ký phụ lục và thanh toán phí gia hạn để thời hạn mới có hiệu lực.
          </Alert>
        ) : !overdue && !returning && contract.renewable === false && contract.renewalOpensOn && contract.status === 'ACTIVE' ? (
          <p className="text-dense text-fg-muted">Có thể gia hạn từ ngày {formatDate(contract.renewalOpensOn)}.</p>
        ) : null}

        <DescriptionList
          columns={2}
          items={[
            { label: 'Ngày bắt đầu', value: formatDate(contract.startDate) },
            { label: 'Thuê đến', value: formatDate(contract.endDate) },
            { label: 'Phí hàng tháng', value: <span className="tabular-nums">{formatCurrency(contract.monthlyFee)}</span> },
            { label: 'Tiền cọc', value: <span className="tabular-nums">{formatCurrency(contract.depositHeld)}</span> },
            {
              label: 'Công nợ',
              full: true,
              value: (
                <span className="flex flex-wrap items-center justify-between gap-2">
                  {debtValue}
                  {canPay && dueNow > 0 && !overdue ? (
                    <Button size="sm" variant="secondary" leftIcon={CreditCard} onClick={() => actions.onPayOutstanding(contract)}>
                      Thanh toán
                    </Button>
                  ) : null}
                </span>
              ),
            },
          ]}
        />

        <UnitAccessPanel
          unitCode={contract.unitCode}
          pin={pin}
          onToggle={() => actions.onTogglePin(contract)}
          onRetry={() => actions.onRetryPin(contract)}
          onChangePin={() => actions.onChangePin(contract)}
        />

        {bookingCode ? (
          <div className="flex flex-col gap-2">
            <Button variant="ghost" size="sm" leftIcon={QrCode} className="self-start" aria-expanded={showCode} onClick={() => setShowCode(value => !value)}>
              {showCode ? 'Ẩn mã đơn tại quầy' : 'Mã đơn tại quầy'}
            </Button>
            {showCode ? (
              <CheckInQr
                bookingCode={bookingCode}
                title="Mã đơn tại quầy"
                description="Nhân viên quét mã này để mở đơn khi bạn trả kho hoặc cần hỗ trợ tại quầy. Mã không mở cổng hay khóa kho."
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
