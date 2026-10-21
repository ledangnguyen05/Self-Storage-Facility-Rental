import type { ReactNode } from 'react'
import { CalendarOff } from 'lucide-react'
import { Alert, Badge, Button, Card, CardContent, CardHeader, DescriptionList, EmptyState, Modal, Skeleton } from '@/components/ui'
import { getBookingStatusMeta, getContractStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import { bookingService } from '@/services/bookingService'
import { handoverService, type HandoverPrerequisites } from '@/services/handoverService'
import type { Booking } from '@/types'

/** Statuses after the front desk handed the unit over: the handover checklist no longer applies. */
const HANDED_OVER_STATUSES = new Set(['ACTIVE', 'OVERDUE', 'CHECKOUT_REQUESTED', 'INSPECTED', 'COMPLETED'])

interface BookingDetailReadOnlyModalProps {
  open: boolean
  onClose: () => void
  bookingId?: string
  unitCode?: string
}

/** Read-only booking file with the four handover prerequisites. Staff at the front desk perform the handover. */
export function BookingDetailReadOnlyModal(props: BookingDetailReadOnlyModalProps) {
  if (!props.open) return null
  return <BookingDetailDialog {...props} />
}

function PrerequisiteCard({
  title,
  done,
  doneLabel,
  pendingLabel,
  items,
}: {
  title: string
  done: boolean
  doneLabel: string
  pendingLabel: string
  items: { label: string; value: ReactNode; mono?: boolean }[]
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        titleAs="h4"
        actions={
          <Badge tone={done ? 'success' : 'warning'} dot>
            {done ? doneLabel : pendingLabel}
          </Badge>
        }
      />
      <CardContent className="pt-3">
        <DescriptionList columns={1} layout="inline" items={items} />
      </CardContent>
    </Card>
  )
}

function Prerequisites({ prereq }: { prereq: HandoverPrerequisites }) {
  const contractStatus = prereq.contractStatus ? getContractStatusMeta(prereq.contractStatus).label : undefined
  return (
    <div className="flex flex-col gap-4">
      <Alert
        tone={prereq.eligibleForCheckIn ? 'success' : 'warning'}
        title={prereq.eligibleForCheckIn ? 'Đủ điều kiện bàn giao' : 'Chưa đủ điều kiện bàn giao'}
      >
        {prereq.eligibleForCheckIn
          ? 'Đơn đặt kho đã hoàn tất 4 điều kiện, nhân viên quầy có thể bàn giao.'
          : 'Đơn còn thiếu điều kiện trước khi nhân viên quầy bàn giao kho.'}
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PrerequisiteCard
          title="1. Tiền đặt cọc"
          done={prereq.depositSatisfied}
          doneLabel="Đã thu đủ"
          pendingLabel="Chưa đủ"
          items={[
            { label: 'Đã nộp', value: formatCurrency(prereq.depositPaid) },
            { label: 'Yêu cầu', value: formatCurrency(prereq.requiredDeposit) },
          ]}
        />
        <PrerequisiteCard
          title="2. Tiền thuê tháng đầu"
          done={prereq.firstMonthRentSatisfied}
          doneLabel="Đã thu đủ"
          pendingLabel="Chưa đóng"
          items={[
            { label: 'Đã nộp', value: formatCurrency(prereq.firstMonthRentPaid) },
            { label: 'Yêu cầu', value: formatCurrency(prereq.requiredFirstMonthRent) },
          ]}
        />
        <PrerequisiteCard
          title="3. Hợp đồng điện tử"
          done={prereq.contractSigned}
          doneLabel="Đã ký"
          pendingLabel="Chưa ký"
          items={[
            { label: 'Mã hợp đồng', value: prereq.contractCode, mono: true },
            { label: 'Trạng thái', value: contractStatus },
          ]}
        />
        <PrerequisiteCard
          title="4. Đối soát giấy tờ tùy thân"
          done={prereq.identityVerified}
          doneLabel="Đã xác minh"
          pendingLabel="Chờ kiểm tra"
          items={[
            // Only a number the front desk actually verified; never a placeholder or the phone number.
            { label: 'Số giấy tờ', value: prereq.identityVerified ? prereq.idCardNumber : undefined, mono: true },
            { label: 'Thực hiện tại', value: 'Quầy tiếp đón' },
          ]}
        />
      </div>

      {prereq.missingPrerequisites && prereq.missingPrerequisites.length > 0 ? (
        <Alert tone="danger" title="Cần bổ sung trước khi bàn giao">
          <ul className="list-disc pl-4">
            {prereq.missingPrerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  )
}

function BookingSummary({ booking, prereq }: { booking?: Booking; prereq?: HandoverPrerequisites }) {
  const status = booking ? getBookingStatusMeta(booking.status) : undefined
  const contact = [booking?.customerPhone ?? prereq?.customerPhone, booking?.customerEmail ?? prereq?.customerEmail]
    .filter(Boolean)
    .join(' · ')
  return (
    <DescriptionList
      items={[
        { label: 'Khách hàng', value: booking?.customerName ?? prereq?.customerName },
        { label: 'Liên hệ', value: contact },
        { label: 'Cơ sở', value: booking?.facilityName ?? prereq?.facilityName },
        { label: 'Kho', value: booking?.unitCode ?? prereq?.unitCode, mono: true },
        { label: 'Mã đặt kho', value: booking?.bookingCode ?? prereq?.bookingCode, mono: true },
        {
          label: 'Trạng thái đặt kho',
          value: status ? (
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          ) : undefined,
        },
        { label: 'Thời gian thuê', value: booking ? `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}` : undefined },
      ]}
    />
  )
}

function BookingDetailDialog({ onClose, bookingId, unitCode }: BookingDetailReadOnlyModalProps) {
  const bookingQuery = useAsyncData((signal) => bookingService.getById(bookingId as string, { signal }), [bookingId], {
    enabled: Boolean(bookingId),
  })
  const prereqQuery = useAsyncData((signal) => handoverService.getCheckInPrerequisites(bookingId as string, { signal }), [bookingId], {
    enabled: Boolean(bookingId),
  })

  const isLoading = Boolean(bookingId) && (bookingQuery.isLoading || prereqQuery.isLoading)
  const reload = () => void Promise.all([bookingQuery.reload(), prereqQuery.reload()])

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={unitCode ? `Hồ sơ đặt kho ${unitCode}` : 'Hồ sơ đặt kho'}
      description="Chế độ xem cho quản lý cơ sở. Việc bàn giao do nhân viên quầy thực hiện."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      {!bookingId ? (
        <EmptyState icon={CalendarOff} title="Kho chưa có đặt chỗ hiệu lực" description="Chưa có hồ sơ đặt kho để đối soát cho kho này." />
      ) : isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : prereqQuery.error && !bookingQuery.data ? (
        <Alert
          tone="danger"
          title="Không tải được hồ sơ đặt kho"
          action={
            <Button size="sm" variant="secondary" onClick={reload}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(prereqQuery.error, 'Không thể tải điều kiện bàn giao của đơn này.')}
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <BookingSummary booking={bookingQuery.data} prereq={prereqQuery.data} />
          {bookingQuery.data && HANDED_OVER_STATUSES.has(bookingQuery.data.status) ? (
            <Alert tone="success" title="Đã bàn giao kho">
              {bookingQuery.data.status === 'COMPLETED'
                ? 'Khách đã trả kho. Các điều kiện bàn giao đã được xác nhận khi nhận kho.'
                : 'Khách đang sử dụng kho. Các điều kiện bàn giao đã được xác nhận tại quầy khi nhận kho.'}
            </Alert>
          ) : prereqQuery.data ? (
            <Prerequisites prereq={prereqQuery.data} />
          ) : prereqQuery.error ? (
            <Alert
              tone="warning"
              title="Không tải được điều kiện bàn giao"
              action={
                <Button size="sm" variant="secondary" onClick={() => void prereqQuery.reload()}>
                  Thử lại
                </Button>
              }
            >
              {getApiErrorMessage(prereqQuery.error)}
            </Alert>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
