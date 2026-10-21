import React, { useEffect, useId, useRef, useState } from 'react'
import { CameraOff, ImageUp, RefreshCw, ScanQrCode, Search } from 'lucide-react'
import { Alert, Badge, Button, DescriptionList, Field, Input, Modal, Select, Spinner } from '@/components/ui'
import { getBookingPaymentStatusMeta, getBookingStatusMeta } from '@/constants/statusMeta'
import { isRequestCanceled } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Booking } from '@/types'
import { useQrScanner } from '../dashboard/hooks/useQrScanner'
import { parseBookingQr, resolveQrBooking } from '../dashboard/utils/qrBooking'

interface QrCameraCheckInModalProps {
  isOpen: boolean
  onClose: () => void
  /** Facility-scoped arrivals from the page (the single source of bookings). */
  arrivals: Booking[]
  facilityId?: string
  /** Opens the check-in workbench for the scanned booking. Never checks in directly. */
  onSelectBookingForWorkbench: (booking: Booking) => void
}

type View =
  | { kind: 'scan' }
  | { kind: 'resolving'; raw: string }
  | { kind: 'found'; booking: Booking }
  | { kind: 'failed'; title: string; message: string }

export const QrCameraCheckInModal: React.FC<QrCameraCheckInModalProps> = (props) => {
  // Mounted only while open: the camera, the view and the typed code reset on every open.
  if (!props.isOpen) return null
  return <QrScannerDialog {...props} />
}

function QrScannerDialog({ onClose, arrivals, facilityId, onSelectBookingForWorkbench }: QrCameraCheckInModalProps) {
  const elementId = `boxora-qr-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const fileRef = useRef<HTMLInputElement>(null)
  // Initial focus on a button, so phones do not open the keyboard for the code field.
  const uploadButtonRef = useRef<HTMLButtonElement>(null)
  const lookupRef = useRef<AbortController | null>(null)
  const [view, setView] = useState<View>({ kind: 'scan' })
  const [manualCode, setManualCode] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => () => lookupRef.current?.abort(), [])

  const resolve = async (raw: string) => {
    const ref = parseBookingQr(raw)
    if (!ref) {
      setView({ kind: 'failed', title: 'Mã không hợp lệ', message: 'Mã QR không chứa mã đặt chỗ hoặc mã booking của Boxora.' })
      return
    }
    lookupRef.current?.abort()
    const controller = new AbortController()
    lookupRef.current = controller
    setView({ kind: 'resolving', raw })
    try {
      const result = await resolveQrBooking(ref, arrivals, facilityId, controller.signal)
      if (controller.signal.aborted) return
      if (result.kind === 'found') setView({ kind: 'found', booking: result.booking })
      else
        setView({
          kind: 'failed',
          title: result.kind === 'not-found' ? 'Không tìm thấy booking' : 'Không thể nhận kho',
          message: result.message,
        })
    } catch (err) {
      if (controller.signal.aborted || isRequestCanceled(err)) return
      setView({ kind: 'failed', title: 'Không tra cứu được booking', message: err instanceof Error ? err.message : 'Vui lòng thử lại.' })
    }
  }

  const scanner = useQrScanner({
    elementId,
    enabled: view.kind === 'scan',
    onDecode: (text) => void resolve(text),
  })

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFileError(null)
    try {
      const text = await scanner.scanFile(file)
      void resolve(text)
    } catch {
      setFileError('Không nhận diện được mã QR trong ảnh này.')
      void scanner.restart()
    }
  }

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault()
    if (!manualCode.trim()) {
      setManualError('Nhập mã đặt chỗ hoặc mã booking.')
      return
    }
    setManualError(null)
    void resolve(manualCode)
  }

  const rescan = () => {
    lookupRef.current?.abort()
    setFileError(null)
    setView({ kind: 'scan' })
  }

  const openWorkbench = (booking: Booking) => {
    onSelectBookingForWorkbench(booking)
    onClose()
  }

  const footer =
    view.kind === 'found' ? (
      <>
        <Button variant="secondary" onClick={rescan}>
          Quét lại
        </Button>
        <Button onClick={() => openWorkbench(view.booking)}>Mở quy trình nhận kho</Button>
      </>
    ) : view.kind === 'failed' ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        <Button leftIcon={RefreshCw} onClick={rescan}>
          Quét lại
        </Button>
      </>
    ) : (
      <Button variant="secondary" onClick={onClose}>
        Đóng
      </Button>
    )

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Quét mã QR nhận kho"
      description="Quét mã trên ứng dụng của khách hoặc nhập mã đặt chỗ."
      footer={footer}
      initialFocusRef={uploadButtonRef}
    >
      {/* Kept mounted (hidden) outside the scan view so the camera is always stopped on a live element. */}
      <div className={view.kind === 'scan' ? 'flex flex-col gap-4' : 'hidden'}>
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface-2">
          <div id={elementId} className="size-full [&_video]:size-full [&_video]:object-cover" />
          {scanner.status === 'starting' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-2 text-sm text-fg-muted">
              <Spinner size="md" label="" />
              Đang bật camera…
            </div>
          ) : null}
          {scanner.status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-2 p-6 text-center">
              <CameraOff size={28} strokeWidth={1.75} className="text-fg-subtle" aria-hidden="true" />
              <p className="text-sm font-medium text-fg">Không dùng được camera</p>
              <p className="text-xs text-fg-muted">{scanner.error}</p>
              <Button size="sm" variant="secondary" leftIcon={RefreshCw} onClick={() => void scanner.restart()}>
                Thử lại
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {scanner.cameras.length > 1 ? (
            <Select
              size="sm"
              aria-label="Chọn camera"
              className="w-full sm:w-64"
              value={scanner.cameraId}
              onChange={(e) => scanner.selectCamera(e.target.value)}
              options={scanner.cameras.map((camera, index) => ({ value: camera.id, label: camera.label || `Camera ${index + 1}` }))}
            />
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <ScanQrCode size={16} strokeWidth={1.75} aria-hidden="true" />
              Đưa mã QR vào giữa khung hình
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFile}
          />
          <Button ref={uploadButtonRef} variant="ghost" size="sm" leftIcon={ImageUp} onClick={() => fileRef.current?.click()}>
            Tải ảnh mã QR
          </Button>
        </div>
        {fileError ? <Alert tone="warning">{fileError}</Alert> : null}

        <form onSubmit={submitManual} className="border-t border-line pt-4" noValidate>
          <Field label="Hoặc nhập mã đặt chỗ" error={manualError ?? undefined}>
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="font-mono"
                autoComplete="off"
                placeholder="Mã đặt chỗ hoặc mã booking"
              />
              <Button type="submit" variant="secondary" leftIcon={Search} className="shrink-0">
                Tìm
              </Button>
            </div>
          </Field>
        </form>
      </div>

      {view.kind === 'resolving' ? (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-fg-muted" aria-live="polite">
          <Spinner size="md" label="" />
          Đang tra cứu booking…
        </div>
      ) : null}

      {view.kind === 'found' ? <ScannedBookingSummary booking={view.booking} /> : null}

      {view.kind === 'failed' ? (
        <Alert tone="danger" title={view.title}>
          {view.message}
        </Alert>
      ) : null}
    </Modal>
  )
}

function ScannedBookingSummary({ booking }: { booking: Booking }) {
  const status = getBookingStatusMeta(booking.status)
  const payment = booking.paymentStatus ? getBookingPaymentStatusMeta(booking.paymentStatus) : null
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-fg">{booking.customerName || 'Khách hàng'}</span>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        {payment ? <Badge tone={payment.tone}>{payment.label}</Badge> : null}
      </div>
      <DescriptionList
        columns={2}
        items={[
          { label: 'Mã đặt chỗ', value: booking.bookingCode || '—', mono: true },
          { label: 'Kho', value: booking.unitCode || '—', mono: true },
          { label: 'Số điện thoại', value: booking.customerPhone || '—' },
          { label: 'Ngày nhận', value: formatDate(booking.startDate) },
          { label: 'Tiền cọc', value: formatCurrency(booking.depositPaid ?? booking.depositAmount) },
          { label: 'Cơ sở', value: booking.facilityName || '—' },
        ]}
      />
      <p className="text-xs text-fg-subtle">Điều kiện nhận kho (hợp đồng, cọc, tiền thuê, giấy tờ) được kiểm tra ở bước tiếp theo.</p>
    </div>
  )
}
