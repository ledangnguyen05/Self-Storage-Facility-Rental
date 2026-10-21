import React from 'react'
import { ConciergeBell, ScanQrCode } from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Skeleton,
  SkeletonText,
  Stepper,
  type StepItem,
} from '@/components/ui'
import { getBookingPaymentStatusMeta, getBookingStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDate } from '@/lib/format'
import type { Booking, HandoverRecord } from '@/types'
import { useCheckInPrerequisites } from '../dashboard/hooks/useCheckInPrerequisites'
import { useHandoverSessions, type CheckInStep } from '../dashboard/hooks/useHandoverSessions'
import { CHECKIN_CHECKLIST, countPassed, getSigningMethodLabel, isCheckInReady } from '../dashboard/workbench/checklist'
import { InspectionChecklistStep } from '../dashboard/workbench/steps/InspectionChecklistStep'
import { PinHandoverStep } from '../dashboard/workbench/steps/PinHandoverStep'
import { PrerequisiteAuditStep } from '../dashboard/workbench/steps/PrerequisiteAuditStep'

export interface HandoverCheckInWorkbenchProps {
  /** Booking selected in the front-desk queue (or resolved from a QR scan). */
  booking: Booking | null
  /** Facility in scope, used when the booking does not carry its name. */
  facilityName?: string
  staffName?: string
  onHandoverComplete?: (booking: Booking, record: HandoverRecord) => void
  onOpenQrScanner?: () => void
}

/**
 * Check-in wizard: 1 conditions → 2 inspection → 3 PIN handover. The parent's
 * arrivals list is the only source of bookings; this component fetches only the
 * selected booking's conditions.
 */
export const HandoverCheckInWorkbench: React.FC<HandoverCheckInWorkbenchProps> = ({
  booking,
  facilityName,
  staffName = '',
  onHandoverComplete,
  onOpenQrScanner,
}) => {
  const { getSession, updateSession } = useHandoverSessions()
  const prereq = useCheckInPrerequisites(booking?.id)

  const header = (
    <CardHeader
      title="Nhận kho"
      description="Kiểm tra điều kiện, nghiệm thu kho và bàn giao mã PIN"
      divider
      actions={
        onOpenQrScanner ? (
          <Button variant="secondary" size="sm" leftIcon={ScanQrCode} onClick={onOpenQrScanner}>
            Quét QR
          </Button>
        ) : null
      }
    />
  )

  if (!booking) {
    return (
      <Card id="handover-workbench">
        {header}
        <CardContent>
          <EmptyState
            icon={ConciergeBell}
            title="Chưa chọn lượt khách"
            description="Chọn một lượt nhận kho trong danh sách Hôm nay hoặc quét mã QR của khách để bắt đầu."
            action={
              onOpenQrScanner ? (
                <Button variant="secondary" leftIcon={ScanQrCode} onClick={onOpenQrScanner}>
                  Quét mã QR
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>
    )
  }

  const session = getSession(booking.id)
  const update = (patch: Parameters<typeof updateSession>[1]) => updateSession(booking.id, patch)
  const p = prereq.prerequisites
  const ready = isCheckInReady(p)
  const completed = session.isCompleted || String(booking.status).toUpperCase() === 'ACTIVE'
  const maxStep: CheckInStep = completed ? 2 : !ready ? 0 : session.inspectionRecorded ? 2 : 1
  const step: CheckInStep = completed ? 2 : (Math.min(session.step, maxStep) as CheckInStep)
  const passed = countPassed(session.checklist)

  const steps: StepItem[] = [
    { id: 'audit', label: 'Điều kiện', description: ready ? 'Đủ 4/4 điều kiện' : 'Hợp đồng, cọc, tiền thuê, giấy tờ' },
    { id: 'inspection', label: 'Nghiệm thu kho', description: `${passed}/${CHECKIN_CHECKLIST.length} tiêu chí đạt` },
    {
      id: 'handover',
      label: 'Bàn giao PIN',
      description: completed ? 'Đã bàn giao' : 'Cấp mã truy cập',
      status: completed ? 'complete' : undefined,
    },
  ]

  const status = getBookingStatusMeta(booking.status)
  const payment = booking.paymentStatus ? getBookingPaymentStatusMeta(booking.paymentStatus) : null
  const customerName = booking.customerName || p?.customerName || ''
  const unitCode = booking.unitCode || p?.unitCode || ''
  const bookingCode = booking.bookingCode || p?.bookingCode || ''
  const resolvedFacility = booking.facilityName || p?.facilityName || facilityName || ''
  const customerEmail = booking.customerEmail || p?.customerEmail || ''

  let body: React.ReactNode
  if (prereq.isLoading) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="rounded-lg border border-line p-4">
              <Skeleton className="mb-3 h-5 w-40" />
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      </div>
    )
  } else if (!p) {
    body = (
      <Alert
        tone="danger"
        title="Không tải được điều kiện nhận kho"
        action={
          <Button size="sm" variant="secondary" onClick={() => void prereq.reload()}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(prereq.error, 'Không kết nối được máy chủ. Vui lòng thử lại.')}
      </Alert>
    )
  } else if (step === 0) {
    body = (
      <PrerequisiteAuditStep
        bookingId={booking.id}
        bookingCode={bookingCode}
        unitCode={unitCode}
        customerName={customerName}
        prerequisites={p}
        isRefreshing={prereq.isRefreshing}
        onReload={prereq.reload}
        onPrerequisitesChange={prereq.setPrerequisites}
        onCompleted={() => update({ step: 1 })}
      />
    )
  } else if (step === 1) {
    body = (
      <InspectionChecklistStep
        bookingId={booking.id}
        unitCode={unitCode}
        checklist={session.checklist}
        photos={session.photos}
        notes={session.handoverNotes}
        onChecklistChange={(checklist) => update({ checklist })}
        onPhotoChange={(slot, value) => update({ photos: { [slot]: value } })}
        onNotesChange={(handoverNotes) => update({ handoverNotes })}
        onBack={() => update({ step: 0 })}
        onRecorded={() => update({ inspectionRecorded: true, step: 2 })}
      />
    )
  } else {
    body = (
      <PinHandoverStep
        booking={booking}
        prerequisites={p}
        session={session}
        isCompleted={completed}
        customerEmail={customerEmail}
        facilityName={resolvedFacility}
        staffName={staffName}
        onUpdate={update}
        onBack={() => update({ step: 1 })}
        onCompleted={(record) => onHandoverComplete?.(booking, record)}
      />
    )
  }

  return (
    <Card id="handover-workbench">
      {header}
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar name={customerName || undefined} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-fg">{customerName || 'Khách hàng'}</span>
              <span className="font-mono text-dense text-fg-muted">{bookingCode || '—'}</span>
              <Badge tone={completed ? 'success' : status.tone} dot>
                {completed ? 'Đã nhận kho' : status.label}
              </Badge>
              {payment && !completed ? <Badge tone={payment.tone}>{payment.label}</Badge> : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-dense text-fg-muted">
              <span className="tabular-nums">{booking.customerPhone || p?.customerPhone || '—'}</span>
              <span>
                Kho <span className="font-mono text-fg">{unitCode || '—'}</span>
              </span>
              <span>{booking.rentalMonths ? `${booking.rentalMonths} tháng` : '—'}</span>
              <span className="tabular-nums">Nhận từ {formatDate(booking.startDate)}</span>
              {p?.contractSigningMethod || booking.signingMethod ? (
                <span>{getSigningMethodLabel(p?.contractSigningMethod || booking.signingMethod)}</span>
              ) : null}
            </div>
          </div>
        </div>

        <Stepper steps={steps} current={step} aria-label="Các bước nhận kho" />

        <div key={booking.id}>{body}</div>
      </CardContent>
    </Card>
  )
}
