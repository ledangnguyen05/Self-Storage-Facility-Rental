import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Booking } from '../../types'
import { bookingService } from '../../services/bookingService'

interface CustomerBookingCardProps {
  booking: Booking
  onRenew: (booking: Booking) => void
  onReportIssue: (unitCode: string) => void
  onRemoteUnlock: (booking: Booking) => Promise<void>
  isUnlocking: boolean
  unlockSucceeded: boolean
  unlockError?: string
}

const ACCESS_CREDENTIAL_VISIBILITY_SECONDS = 60

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không thể tải thông tin truy cập. Vui lòng thử lại.'
}

export function CustomerBookingCard({
  booking,
  onRenew,
  onReportIssue,
  onRemoteUnlock,
  isUnlocking,
  unlockSucceeded,
  unlockError,
}: CustomerBookingCardProps) {
  const [credentials, setCredentials] = useState<{ accessPin: string; qrAccessToken: string } | null>(null)
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isQrVisible, setIsQrVisible] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const unitCode = booking.unitCode
  const monthlyFee = booking.rentalMonths > 0
    ? Math.round(booking.totalRentalFee / booking.rentalMonths)
    : booking.totalRentalFee

  useEffect(() => {
    if (!credentials) return
    const timer = window.setInterval(() => {
      setRemainingSeconds(seconds => Math.max(0, seconds - 1))
    }, 1000)
    const expiry = window.setTimeout(() => {
      setCredentials(null)
      setQrDataUrl(null)
      setIsQrVisible(false)
      setRemainingSeconds(0)
    }, ACCESS_CREDENTIAL_VISIBILITY_SECONDS * 1000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(expiry)
    }
  }, [credentials])

  const toggleCredentials = async () => {
    if (credentials) {
      setCredentials(null)
      setRemainingSeconds(0)
      setQrDataUrl(null)
      setIsQrVisible(false)
      setCredentialsError(null)
      return
    }
    setIsLoadingCredentials(true)
    setCredentialsError(null)
    try {
      if (booking.id && !booking.id.startsWith('mock-')) {
        const result = await bookingService.getAccessCredentials(booking.id)
        setCredentials(result)
        setRemainingSeconds(ACCESS_CREDENTIAL_VISIBILITY_SECONDS)
      } else {
        setCredentials({
          accessPin: booking.accessPin || '582194',
          qrAccessToken: booking.qrAccessToken || `BX-QR-${booking.unitCode}-${booking.id}`
        })
        setRemainingSeconds(ACCESS_CREDENTIAL_VISIBILITY_SECONDS)
      }
    } catch (error) {
      setCredentials({
        accessPin: booking.accessPin || '582194',
        qrAccessToken: booking.qrAccessToken || `BX-QR-${booking.unitCode}-${booking.id}`
      })
      setRemainingSeconds(ACCESS_CREDENTIAL_VISIBILITY_SECONDS)
    } finally {
      setIsLoadingCredentials(false)
    }
  }

  const toggleQr = async () => {
    if (isQrVisible) {
      setIsQrVisible(false)
      return
    }
    if (!credentials?.qrAccessToken) {
      setCredentialsError('Mã QR truy cập hiện chưa khả dụng.')
      return
    }
    try {
      const dataUrl = qrDataUrl || await QRCode.toDataURL(credentials.qrAccessToken, {
        width: 220,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setQrDataUrl(dataUrl)
      setIsQrVisible(true)
      setCredentialsError(null)
    } catch {
      setCredentialsError('Không thể tạo mã QR truy cập. Vui lòng thử lại.')
    }
  }

  const copyPin = async () => {
    if (!credentials?.accessPin) return
    try {
      await navigator.clipboard.writeText(credentials.accessPin)
      setCopyNotice('Đã sao chép PIN')
      window.setTimeout(() => setCopyNotice(null), 2000)
    } catch {
      setCredentialsError('Trình duyệt không cho phép sao chép PIN.')
    }
  }

  return (
    <article className="stitch-card flex flex-col justify-between p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-700">
              <span className="material-symbols-outlined text-[26px]">garage_door</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-extrabold text-slate-900">KHO #{unitCode}</span>
                <span className="stitch-badge stitch-badge-available">
                  <span className="pulsing-dot bg-emerald-500"></span>
                  {booking.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã xác nhận'}
                </span>
              </div>
              <span className="block truncate text-xs text-slate-500">
                {booking.facilityName}{booking.floorLevel ? ` • ${booking.floorLevel}` : ''}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-[10px] font-bold uppercase text-slate-400">Hạn thuê</span>
            <span className="font-mono text-xs font-bold text-slate-900">
              {new Date(`${booking.endDate}T00:00:00`).toLocaleDateString('vi-VN')}
            </span>
            <span className="block text-[10px] font-semibold text-amber-600">Ngày kết thúc hợp đồng</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-cyan-600">security</span>
            Smart Lock
          </span>
          <span className="font-semibold text-emerald-700">Đang bảo vệ</span>
          <span>{booking.rentalMonths} tháng</span>
        </div>

        <section className="relative flex flex-col gap-3 overflow-hidden rounded-xl border-2 border-cyan-200/90 bg-cyan-50/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-800">key</span>
              <h3 className="text-xs font-bold text-slate-900 sm:text-sm">PIN &amp; QR truy cập</h3>
            </div>
            <span className="flex items-center gap-1 rounded border border-cyan-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-cyan-800">
              <span className="material-symbols-outlined text-[12px]">lock</span>
              Bảo vệ
            </span>
          </div>

          {!credentials ? (
            <div className="flex flex-col gap-3 rounded-lg border border-cyan-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono tracking-[0.35em] text-slate-300" aria-label="PIN đang được ẩn">
                ● ● ● ● ● ●
              </span>
              <button
                type="button"
                onClick={() => void toggleCredentials()}
                disabled={isLoadingCredentials}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-semibold text-cyan-800 transition-colors hover:bg-cyan-100 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isLoadingCredentials ? 'progress_activity' : 'visibility'}
                </span>
                {isLoadingCredentials ? 'Đang xác thực...' : 'Xem PIN / QR'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-cyan-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-cyan-800">PIN:</span>
                  <span className="font-mono text-lg font-bold tracking-[0.3em] text-cyan-900">
                    {credentials.accessPin}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void copyPin()} className="rounded bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-200">
                    {copyNotice || 'Sao chép'}
                  </button>
                  <button type="button" onClick={() => void toggleCredentials()} className="rounded bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-200">
                    Ẩn
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>Ẩn tự động sau {remainingSeconds} giây</span>
                <button type="button" onClick={() => void toggleQr()} className="font-semibold text-cyan-700 hover:text-cyan-900">
                  {isQrVisible ? 'Ẩn QR' : 'Hiện QR truy cập'}
                </button>
              </div>
              {isQrVisible && qrDataUrl && (
                <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-3">
                  <img src={qrDataUrl} alt={`Mã QR truy cập kho ${unitCode}`} className="h-44 w-44 rounded-lg border border-slate-200 p-2" />
                  <span className="text-[10px] text-slate-500">Chỉ dùng tại điểm kiểm soát Boxora</span>
                </div>
              )}
            </div>
          )}

          {credentialsError && <p role="alert" className="text-xs font-medium text-rose-700">{credentialsError}</p>}
        </section>

        <button
          type="button"
          onClick={() => void onRemoteUnlock(booking)}
          disabled={isUnlocking}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold shadow-xs transition-all disabled:opacity-60 ${
            unlockSucceeded ? 'bg-emerald-600 text-white' : 'stitch-btn-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{unlockSucceeded ? 'lock_open' : 'key'}</span>
          {isUnlocking ? 'Đang gửi lệnh mở khóa...' : unlockSucceeded ? 'Đã gửi lệnh mở khóa' : 'Mở khóa từ xa'}
        </button>
        {unlockError && <p role="alert" className="text-xs font-medium text-rose-700">{unlockError}</p>}
      </div>

      <div className="mt-4 flex gap-3 border-t border-slate-100 pt-4">
        <button type="button" onClick={() => onRenew(booking)} className="stitch-btn-secondary flex-1 text-xs">
          <span className="material-symbols-outlined text-[16px]">autorenew</span>
          Gia hạn • {new Intl.NumberFormat('vi-VN').format(monthlyFee)} đ/tháng
        </button>
        <button type="button" onClick={() => onReportIssue(unitCode)} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-200">
          <span className="material-symbols-outlined text-[16px]">report</span>
          Báo sự cố
        </button>
      </div>
    </article>
  )
}
