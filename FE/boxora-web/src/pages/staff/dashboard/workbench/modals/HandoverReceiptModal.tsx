import React, { useRef, useState } from 'react'
import { Printer } from 'lucide-react'
import { SignedImage } from '@/components/common/SignedImage'
import { Alert, Badge, Button, DescriptionList, Modal, useToast } from '@/components/ui'
import { SITE_CONFIG } from '@/constants/siteConfig'
import { formatDateTime } from '@/lib/format'
import type { HandoverPrerequisites } from '@/services/handoverService'
import type { Booking } from '@/types'
import type { HandoverSession } from '../../hooks/useHandoverSessions'
import { CHECKIN_CHECKLIST, EVIDENCE_SLOTS, countPassed, getIdCardTypeLabel, maskIdNumber } from '../checklist'
import { printElement } from '../../utils/printElement'

interface HandoverReceiptModalProps {
  open: boolean
  onClose: () => void
  booking: Booking
  prerequisites: HandoverPrerequisites | null
  session: HandoverSession
  isCompleted: boolean
  facilityName: string
  staffName: string
  /** Note typed at the inspection ("Ghi chú hiện trạng"), read back from the saved record. */
  inspectionNote?: string
}

/** Handover receipt built from the real session: checklist results, parties, unit and PIN when issued. */
export function HandoverReceiptModal({
  open,
  onClose,
  booking,
  prerequisites,
  session,
  isCompleted,
  facilityName,
  staffName,
  inspectionNote = '',
}: HandoverReceiptModalProps) {
  const toast = useToast()
  const receiptRef = useRef<HTMLDivElement>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const bookingCode = booking.bookingCode || prerequisites?.bookingCode || ''
  const customerName = booking.customerName || prerequisites?.customerName || '—'
  const unitCode = booking.unitCode || prerequisites?.unitCode || '—'
  const passed = countPassed(session.checklist)
  const photos = EVIDENCE_SLOTS.flatMap((slot) => (session.photos[slot.key] ? [{ ...slot, src: session.photos[slot.key] as string }] : []))
  const conditionNote = inspectionNote.trim()
  const handoverNote = session.handoverNotes.trim()

  const print = async () => {
    if (!receiptRef.current) return
    setIsPrinting(true)
    const ok = await printElement(receiptRef.current, `Biên bản bàn giao ${bookingCode || unitCode}`)
    setIsPrinting(false)
    if (!ok) toast.error('Không mở được hộp thoại in', 'Trình duyệt đã chặn thao tác in. Vui lòng thử lại.')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Biên bản bàn giao kho"
      description={isCompleted ? 'Bản chính thức sau khi bàn giao' : 'Bản xem trước, chưa có giá trị bàn giao'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button leftIcon={Printer} onClick={print} loading={isPrinting}>
            In biên bản
          </Button>
        </>
      }
    >
      {!isCompleted ? (
        <Alert tone="warning" className="mb-4">
          Bàn giao chưa hoàn tất. Mã PIN chỉ được cấp sau khi xác nhận bàn giao.
        </Alert>
      ) : null}

      <div ref={receiptRef} className="flex flex-col gap-5 text-sm text-fg">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <p className="text-xs text-fg-subtle">{SITE_CONFIG.company.legalName}</p>
            <h3 className="mt-1 text-base font-semibold">Biên bản bàn giao kho và cấp mã truy cập</h3>
            <p className="mt-0.5 text-xs text-fg-muted">
              Số biên bản <span className="font-mono">BB-{bookingCode || '—'}</span>
            </p>
          </div>
          <div className="text-right text-xs text-fg-muted">
            <p>Thời điểm bàn giao</p>
            <p className="font-medium tabular-nums text-fg">{isCompleted ? formatDateTime(session.completedAt) : '—'}</p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <h4 className="text-xs font-medium text-fg-subtle">Bên giao</h4>
            <p className="mt-1 font-medium">{facilityName || '—'}</p>
            <p className="text-fg-muted">Nhân viên: {staffName || '—'}</p>
          </div>
          <div className="rounded-lg border border-line p-4">
            <h4 className="text-xs font-medium text-fg-subtle">Bên nhận</h4>
            <p className="mt-1 font-medium">{customerName}</p>
            <p className="text-fg-muted">
              {getIdCardTypeLabel(prerequisites?.idCardType)}: <span className="font-mono">{maskIdNumber(prerequisites?.idCardNumber)}</span>
            </p>
            <p className="text-fg-muted">
              Điện thoại: <span className="tabular-nums">{booking.customerPhone || prerequisites?.customerPhone || '—'}</span>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="font-semibold">1. Thông tin kho bàn giao</h4>
          <DescriptionList
            columns={3}
            items={[
              { label: 'Mã kho', value: unitCode, mono: true },
              { label: 'Cơ sở', value: facilityName || '—' },
              { label: 'Thời hạn thuê', value: booking.rentalMonths ? `${booking.rentalMonths} tháng` : '—' },
              { label: 'Mã đặt chỗ', value: bookingCode || '—', mono: true },
              { label: 'Mã hợp đồng', value: prerequisites?.contractCode || '—', mono: true },
              { label: 'Thẻ RFID', value: session.rfidCard.trim() || '—', mono: true },
              {
                label: 'Mã PIN',
                value: session.accessPin || (isCompleted ? 'Khách xem trong ứng dụng' : 'Cấp khi hoàn tất bàn giao'),
                mono: Boolean(session.accessPin),
              },
            ]}
          />
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">2. Kết quả nghiệm thu hiện trường</h4>
            <span className="text-xs tabular-nums text-fg-muted">
              {passed}/{CHECKIN_CHECKLIST.length} tiêu chí đạt
            </span>
          </div>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {CHECKIN_CHECKLIST.map((item) => {
              const ok = session.checklist[item.key]
              return (
                <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>{item.label}</span>
                  <Badge tone={ok ? 'success' : 'danger'} size="sm">
                    {ok ? 'Đạt' : 'Chưa đạt'}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </section>

        {photos.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold">3. Ảnh hiện trạng</h4>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <figure key={photo.key} className="flex flex-col gap-1">
                  <SignedImage src={photo.src} alt={photo.label} className="aspect-video w-full rounded-md border border-line object-cover" />
                  <figcaption className="text-xs text-fg-muted">{photo.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h4 className="font-semibold">{photos.length > 0 ? '4' : '3'}. Ghi chú hiện trạng và bàn giao</h4>
          <p className="rounded-lg border border-line px-4 py-3 text-fg-muted">
            <span className="font-medium text-fg">Hiện trạng kho: </span>
            {conditionNote || handoverNote || 'Không có ghi chú.'}
          </p>
          {handoverNote && handoverNote !== conditionNote && conditionNote ? (
            <p className="rounded-lg border border-line px-4 py-3 text-fg-muted">
              <span className="font-medium text-fg">Bàn giao: </span>
              {handoverNote}
            </p>
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-6 pt-2 text-center">
          <div>
            <p className="font-medium">Đại diện bên nhận</p>
            <p className="text-xs text-fg-subtle">Ký và ghi rõ họ tên</p>
            <p className="mt-12 font-medium">{customerName}</p>
          </div>
          <div>
            <p className="font-medium">Đại diện bên giao</p>
            <p className="text-xs text-fg-subtle">Ký và ghi rõ họ tên</p>
            <p className="mt-12 font-medium">{staffName || '—'}</p>
          </div>
        </section>
      </div>
    </Modal>
  )
}
