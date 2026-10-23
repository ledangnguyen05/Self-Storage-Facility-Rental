import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Booking } from '../../../types'
import { bookingService } from '../../../services/bookingService'

interface QrCameraCheckInModalProps {
  isOpen: boolean
  facilityId?: string
  onClose: () => void
  onSelectBookingForWorkbench?: (bookingId: string) => void
}

interface BookingReference {
  bookingId?: string
  bookingCode?: string
}

const normalizeBookingCode = (value: string) => value.trim().replace(/^#/, '').toUpperCase()

const parseBookingReference = (rawValue: string): BookingReference | null => {
  const value = rawValue.trim()
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object') {
      const data = parsed as Record<string, unknown>
      const bookingId = typeof data.bookingId === 'string' ? data.bookingId.trim() : undefined
      const bookingCode = typeof data.bookingCode === 'string' ? data.bookingCode.trim() : undefined
      if (bookingId || bookingCode) return { bookingId, bookingCode }
    }
  } catch {
    // Plain booking codes are also accepted.
  }

  if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    return { bookingId: value }
  }

  return { bookingCode: value }
}

const bookingStatusLabel: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_APPROVAL: 'Chờ duyệt',
  PENDING_SIGNATURE: 'Chờ ký',
  ACTIVE: 'Đang thuê',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  OVERDUE: 'Quá hạn',
}

export const QrCameraCheckInModal: React.FC<QrCameraCheckInModalProps> = ({
  isOpen,
  facilityId,
  onClose,
  onSelectBookingForWorkbench,
}) => {
  const [scannerState, setScannerState] = useState<'STARTING' | 'SCANNING' | 'ERROR'>('STARTING')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [matchedBooking, setMatchedBooking] = useState<Booking | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [scannerEpoch, setScannerEpoch] = useState(0)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lookupInProgressRef = useRef(false)
  const containerId = 'boxora-html5-qrcode-region'

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch {
      // The camera may already have stopped while the modal was closing.
    }
  }, [])

  const lookupBooking = useCallback(async (rawValue: string) => {
    if (lookupInProgressRef.current) return
    lookupInProgressRef.current = true
    setIsLookingUp(true)
    setErrorMessage(null)
    await stopScanner()

    try {
      if (!facilityId) {
        throw new Error('Tài khoản nhân viên chưa được phân công cơ sở.')
      }

      const reference = parseBookingReference(rawValue)
      if (!reference) {
        throw new Error('Mã QR không chứa mã booking hợp lệ.')
      }

      const arrivals = await bookingService.getUpcomingArrivals(facilityId)
      const matched = arrivals.find((booking) => {
        const idMatches = reference.bookingId && booking.id.toLowerCase() === reference.bookingId.toLowerCase()
        const codeMatches = reference.bookingCode
          && normalizeBookingCode(booking.bookingCode) === normalizeBookingCode(reference.bookingCode)
        return Boolean(idMatches || codeMatches)
      })

      if (!matched) {
        throw new Error('Không tìm thấy booking sắp đến có mã này tại cơ sở được phân công.')
      }

      setMatchedBooking(matched)
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'Không thể tra cứu booking này.')
    } finally {
      lookupInProgressRef.current = false
      setIsLookingUp(false)
    }
  }, [facilityId, stopScanner])

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setScannerState('STARTING')
    setErrorMessage(null)

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(containerId)
        scannerRef.current = scanner
        const cameras = await Html5Qrcode.getCameras()
        if (!active) return
        await scanner.start(
          cameras[0] ? { deviceId: { exact: cameras[0].id } } : { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (active) void lookupBooking(decodedText)
          },
          () => {},
        )
        if (active) setScannerState('SCANNING')
      } catch {
        if (active) {
          setScannerState('ERROR')
          setErrorMessage('Không thể truy cập camera. Hãy nhập mã booking hoặc tải ảnh QR lên.')
        }
      }
    }

    void startScanner()
    return () => {
      active = false
      void stopScanner()
    }
  }, [containerId, isOpen, lookupBooking, scannerEpoch, stopScanner])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      await stopScanner()
      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner
      const decodedText = await scanner.scanFile(file, true)
      await lookupBooking(decodedText)
    } catch {
      setErrorMessage('Không đọc được mã booking từ ảnh QR này.')
    }
  }

  const handleRescan = () => {
    setMatchedBooking(null)
    setErrorMessage(null)
    setManualCode('')
    setScannerEpoch((value) => value + 1)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="staff-qr-title">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 p-5">
          <div>
            <h3 id="staff-qr-title" className="font-headline text-sm font-bold text-slate-900">Tra cứu booking bằng mã QR</h3>
            <p className="mt-1 text-[11px] text-slate-500">Mã QR chỉ được dùng để tìm booking tại cơ sở được phân công.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200" aria-label="Close">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {matchedBooking ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                <div className="text-xs font-bold">Đã tìm thấy booking. Chưa hoàn tất check-in.</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div><span className="block text-[10px] text-blue-700">Mã booking</span><strong className="font-mono">{matchedBooking.bookingCode}</strong></div>
                  <div><span className="block text-[10px] text-blue-700">Mã kho</span><strong className="font-mono">{matchedBooking.unitCode}</strong></div>
                  <div><span className="block text-[10px] text-blue-700">Khách hàng</span><strong>{matchedBooking.customerName || 'Chưa có thông tin'}</strong></div>
                  <div><span className="block text-[10px] text-blue-700">Trạng thái booking</span><strong>{bookingStatusLabel[matchedBooking.status] || matchedBooking.status}</strong></div>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">Mở bàn giao để kiểm tra hợp đồng, thanh toán, giấy tờ và nghiệm thu đã lưu. Backend sẽ kiểm tra lại các điều kiện khi gửi yêu cầu check-in.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectBookingForWorkbench?.(matchedBooking.id)
                    onClose()
                  }}
                  className="flex-1 rounded-xl bg-cyan-700 px-4 py-3 text-xs font-bold text-white hover:bg-cyan-800"
                >Mở quy trình bàn giao</button>
                <button type="button" onClick={handleRescan} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Quét lại</button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl bg-slate-950">
                <div id={containerId} className="h-full w-full overflow-hidden [&_video]:object-cover" />
                {scannerState === 'STARTING' && !isLookingUp && <div className="absolute inset-0 flex items-center justify-center text-xs text-cyan-200">Đang khởi động camera…</div>}
                {scannerState === 'SCANNING' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-60 w-60 rounded-2xl border-2 border-cyan-400" /></div>}
              </div>

              {isLookingUp && <p className="text-center text-xs text-slate-600">Đang tra cứu booking…</p>}
              {errorMessage && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{errorMessage}</p>}

              <form onSubmit={(event) => { event.preventDefault(); void lookupBooking(manualCode) }} className="space-y-2 border-t border-slate-100 pt-4">
                <label htmlFor="staff-booking-code" className="block text-[11px] font-semibold text-slate-700">Hoặc nhập mã booking</label>
                <div className="flex gap-2">
                  <input id="staff-booking-code" value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="BX-…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
                  <button type="submit" disabled={!manualCode.trim() || isLookingUp} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:bg-slate-300">Tra cứu</button>
                </div>
              </form>

              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-cyan-800 hover:underline">
                <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                Tải ảnh QR lên
                <input type="file" accept="image/*" onChange={(event) => void handleFileUpload(event)} className="hidden" />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
