import React, { useState } from 'react'
import { ArrowLeft, Bell, Copy, FileText, KeyRound, Mail, Printer } from 'lucide-react'
import { Alert, Badge, Button, ConfirmDialog, DescriptionList, Field, IconButton, Input, Skeleton, Textarea, useToast } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/format'
import { handoverService, type HandoverPrerequisites } from '@/services/handoverService'
import type { Booking, HandoverRecord } from '@/types'
import { EvidenceViewer } from '../../../components/EvidenceViewer'
import type { HandoverSession, HandoverSessionPatch } from '../../hooks/useHandoverSessions'
import { CHECKIN_CHECKLIST, EVIDENCE_SLOTS, collectPhotos, countPassed } from '../checklist'
import { HandoverReceiptModal } from '../modals/HandoverReceiptModal'

interface PinHandoverStepProps {
  booking: Booking
  prerequisites: HandoverPrerequisites
  session: HandoverSession
  isCompleted: boolean
  customerEmail: string
  facilityName: string
  staffName: string
  onUpdate: (patch: HandoverSessionPatch) => void
  onBack: () => void
  /** The backend accepted the handover; `record` carries the PIN (once) and the real email outcome. */
  onCompleted: (record: HandoverRecord) => void
}

export function PinHandoverStep({
  booking,
  prerequisites,
  session,
  isCompleted,
  customerEmail,
  facilityName,
  staffName,
  onUpdate,
  onBack,
  onCompleted,
}: PinHandoverStepProps) {
  const toast = useToast()
  const { copy, copied } = useCopyToClipboard()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const unitCode = booking.unitCode || prerequisites.unitCode || '—'
  const passed = countPassed(session.checklist)
  const sessionPhotos = collectPhotos(session.photos)
  const pin = session.accessPin

  // After the handover the evidence is read back from the server, so it survives a reload.
  const historyQuery = useAsyncData((signal) => handoverService.getByBookingId(booking.id, { signal }), [booking.id], {
    enabled: isCompleted,
  })
  const checkInRecord = (historyQuery.data ?? []).find((record) => record.recordType === 'CHECK_IN')
  const savedPhotos = checkInRecord?.evidencePhotos ?? []
  // The note typed at the inspection lives on the inspection record, not on the handover record: keep it visible.
  const inspectionNote =
    (historyQuery.data ?? [])
      .filter((record) => record.recordType === 'CHECK_IN_INSPECTION' && record.notes?.trim())
      .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))[0]
      ?.notes?.trim() ?? ''

  const handOver = async () => {
    try {
      const record = await handoverService.checkIn({
        bookingId: booking.id,
        recordType: 'CHECK_IN',
        idCardType: prerequisites.idCardType,
        idCardNumber: prerequisites.idCardNumber?.trim() || undefined,
        identityVerified: Boolean(prerequisites.identityVerified),
        rfidCardNumber: session.rfidCard.trim() || undefined,
        notes: session.handoverNotes.trim() || undefined,
      })
      // The handover is saved first and the email follows in the background: `emailQueued` means it is on its way,
      // `emailError` says why it cannot be sent at all (no address, no mail server).
      const emailSent = record?.emailSent === true
      const emailQueued = record?.emailQueued === true
      onUpdate({
        step: 2,
        isCompleted: true,
        completedAt: new Date().toISOString(),
        accessPin: record?.accessPin ?? '',
        emailSent,
        emailQueued,
        emailError: emailSent || emailQueued ? '' : (record?.emailError ?? 'Chưa gửi được email cho khách.'),
        webPushSent: record?.inAppNotificationSent === true,
      })
      setConfirmOpen(false)
      if (!emailSent && !emailQueued) {
        toast.warning('Đã bàn giao nhưng chưa gửi được email', record?.emailError ?? 'Hãy đưa mã PIN cho khách trực tiếp tại quầy.')
      }
      onCompleted(record)
    } catch (err) {
      toast.error('Không bàn giao được kho', getApiErrorMessage(err))
    }
  }

  const sendEmail = async () => {
    setIsSendingEmail(true)
    try {
      const sentTo = await handoverService.sendPinEmail(booking.id)
      onUpdate({ emailSent: true, emailQueued: false, emailError: '' })
      toast.success('Đã gửi email bàn giao', sentTo || customerEmail)
    } catch (err) {
      const message = getApiErrorMessage(err)
      onUpdate({ emailSent: false, emailQueued: false, emailError: message })
      toast.error('Không gửi được email', message)
    } finally {
      setIsSendingEmail(false)
    }
  }

  const copyPin = async () => {
    const ok = await copy(pin)
    if (ok) toast.success('Đã sao chép mã PIN')
    else toast.error('Không sao chép được mã PIN')
  }

  const receipt = (
    <HandoverReceiptModal
      open={receiptOpen}
      onClose={() => setReceiptOpen(false)}
      booking={booking}
      prerequisites={prerequisites}
      session={session}
      isCompleted={isCompleted}
      facilityName={facilityName}
      staffName={staffName}
      inspectionNote={inspectionNote}
    />
  )

  if (!isCompleted) {
    return (
      <div className="flex flex-col gap-5">
        <DescriptionList
          columns={2}
          items={[
            { label: 'Điều kiện nhận kho', value: <Badge tone="success">Đủ 4/4 điều kiện</Badge> },
            {
              label: 'Nghiệm thu kho',
              value: `${passed}/${CHECKIN_CHECKLIST.length} tiêu chí đạt · ${sessionPhotos.length}/${EVIDENCE_SLOTS.length} ảnh`,
            },
          ]}
        />
        {sessionPhotos.length > 0 ? <EvidenceViewer urls={sessionPhotos} label="Ảnh nghiệm thu" /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Thẻ RFID cấp cho khách" optional hint="Bỏ trống nếu không cấp thẻ.">
            <Input
              value={session.rfidCard}
              onChange={(e) => onUpdate({ rfidCard: e.target.value })}
              className="font-mono"
              autoComplete="off"
            />
          </Field>
          <Field label="Ghi chú bàn giao" optional className="sm:col-span-2">
            <Textarea
              rows={2}
              value={session.handoverNotes}
              onChange={(e) => onUpdate({ handoverNotes: e.target.value })}
              placeholder="Khách mượn xe đẩy, hẹn chuyển đồ sau 17:00…"
            />
          </Field>
        </div>
        <Alert tone="info">
          Mã PIN do hệ thống tạo khi bạn xác nhận bàn giao. Hệ thống gửi mã tới email trong hồ sơ của khách và báo lại nếu không gửi được.
        </Alert>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" leftIcon={ArrowLeft} onClick={onBack} className="mr-auto">
            Quay lại
          </Button>
          <Button variant="secondary" leftIcon={FileText} onClick={() => setReceiptOpen(true)}>
            Xem trước biên bản
          </Button>
          <Button leftIcon={KeyRound} onClick={() => setConfirmOpen(true)}>
            Xác nhận bàn giao
          </Button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={`Bàn giao kho ${unitCode}?`}
          description={`Kho chuyển sang đang thuê, hợp đồng có hiệu lực từ hôm nay và hệ thống cấp mã PIN cho ${booking.customerName || 'khách'}. Không thể hoàn tác tại quầy.`}
          confirmLabel="Bàn giao kho"
          onConfirm={handOver}
        />
        {receipt}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Alert tone="success" title={`Đã bàn giao kho ${unitCode}`}>
        Kho đã chuyển sang đang thuê và biên bản bàn giao đã được lưu.
      </Alert>

      {!session.emailSent && session.emailError ? (
        <Alert tone="warning" title="Chưa gửi được mã PIN qua email">
          {session.emailError} Hãy đưa mã PIN cho khách tại quầy hoặc thử gửi lại bên dưới.
        </Alert>
      ) : null}
      {!session.emailSent && session.emailQueued ? (
        <Alert tone="info" title="Email mã PIN đang được gửi">
          Hệ thống gửi thư tới {customerEmail || 'email của khách'} sau khi lưu bàn giao. Nếu khách chưa nhận được sau vài phút, bấm “Gửi lại” để gửi
          và biết kết quả ngay.
        </Alert>
      ) : null}

      <section className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-6" aria-label="Mã PIN mở kho">
        <div className="flex items-center gap-2 text-sm font-medium text-fg-muted">
          <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
          Mã PIN mở kho {unitCode}
        </div>
        {pin ? (
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="sr-only">{`Mã PIN: ${pin.split('').join(' ')}`}</span>
              {pin.split('').map((digit, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="flex h-12 w-10 items-center justify-center rounded-md border border-line-strong bg-surface font-mono text-2xl font-semibold tabular-nums text-fg"
                >
                  {digit}
                </span>
              ))}
            </div>
            <IconButton icon={Copy} variant="secondary" aria-label={copied ? 'Đã sao chép' : 'Sao chép mã PIN'} tooltip onClick={copyPin} />
          </div>
        ) : (
          <span className="font-mono text-2xl text-fg-subtle">—</span>
        )}
        <p className="max-w-md text-center text-xs text-fg-subtle">
          {pin
            ? 'Mã chỉ hiển thị một lần trên màn hình này. Khách có thể xem lại trong mục Mã truy cập của ứng dụng Boxora.'
            : 'Mã PIN không còn hiển thị tại quầy. Khách xem mã trong mục Mã truy cập của ứng dụng Boxora hoặc email bàn giao.'}
        </p>
      </section>

      <section className="flex flex-col divide-y divide-line rounded-lg border border-line" aria-label="Gửi thông tin bàn giao">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Mail size={16} strokeWidth={1.75} className="text-fg-subtle" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">Email bàn giao</p>
            <p className="truncate text-xs text-fg-muted">{customerEmail || 'Khách chưa có email trong hồ sơ'}</p>
          </div>
          <Badge tone={session.emailSent ? 'success' : session.emailQueued ? 'info' : 'neutral'} size="sm">
            {session.emailSent ? 'Đã gửi' : session.emailQueued ? 'Đang gửi' : 'Chưa gửi'}
          </Badge>
          <Button variant="secondary" size="sm" onClick={sendEmail} loading={isSendingEmail} disabled={!customerEmail}>
            {session.emailSent || session.emailQueued ? 'Gửi lại' : 'Gửi email'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Bell size={16} strokeWidth={1.75} className="text-fg-subtle" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">Thông báo trong ứng dụng</p>
            <p className="text-xs text-fg-muted">Hiện trong mục thông báo của khách, không kèm mã PIN</p>
          </div>
          <Badge tone={session.webPushSent ? 'success' : 'neutral'} size="sm">
            {session.webPushSent ? 'Đã tạo' : 'Chưa tạo'}
          </Badge>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="Biên bản nghiệm thu">
        <h4 className="text-sm font-semibold text-fg">Biên bản nghiệm thu khi nhận kho</h4>
        {historyQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : historyQuery.error ? (
          <Alert
            tone="warning"
            action={
              <Button size="sm" variant="secondary" onClick={() => void historyQuery.reload()}>
                Thử lại
              </Button>
            }
          >
            Không tải được biên bản nghiệm thu: {getApiErrorMessage(historyQuery.error)}
          </Alert>
        ) : checkInRecord ? (
          <>
            <DescriptionList
              columns={2}
              items={[
                { label: 'Kết quả', value: checkInRecord.unitCondition || '—' },
                { label: 'Thời điểm', value: formatDateTime(checkInRecord.recordedAt) },
                { label: 'Người bàn giao', value: checkInRecord.staffName || '—' },
                { label: 'Thẻ RFID', value: checkInRecord.rfidCardNumber || '—', mono: true },
                { label: 'Ghi chú hiện trạng', value: inspectionNote || 'Không có ghi chú' },
              ]}
            />
            <EvidenceViewer urls={savedPhotos} label="Ảnh nghiệm thu" emptyText="Biên bản này không có ảnh đính kèm." />
          </>
        ) : (
          <p className="text-sm text-fg-muted">Chưa đọc được biên bản bàn giao của đơn này.</p>
        )}
      </section>

      <div className="flex justify-end border-t border-line pt-4">
        <Button variant="secondary" leftIcon={Printer} onClick={() => setReceiptOpen(true)}>
          In phiếu nhận kho
        </Button>
      </div>
      {receipt}
    </div>
  )
}
