import { QrCode } from 'lucide-react'
import { Skeleton, cn } from '@/components/ui'
import { useQrDataUrl } from '../hooks/useQrDataUrl'
import { checkInQrPayload } from '../lib/checkInQr'

interface CheckInQrProps {
  bookingCode: string
  /** What the code is used for at the counter. */
  title?: string
  description?: string
  className?: string
}

/**
 * Booking code as a QR for the front desk: staff scan it to open the reservation (check-in,
 * return). It identifies the booking only; it does not open any gate or lock.
 */
export function CheckInQr({ bookingCode, title = 'Mã nhận kho tại quầy', description, className }: CheckInQrProps) {
  const qr = useQrDataUrl(bookingCode ? checkInQrPayload(bookingCode) : null, 176)
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col items-center gap-4 rounded-lg border border-line bg-surface-2 p-4 sm:flex-row sm:items-start', className)}
    >
      {qr.dataUrl ? (
        <img src={qr.dataUrl} alt={`Mã QR của đơn ${bookingCode}`} className="size-36 shrink-0 rounded-md bg-surface" />
      ) : qr.failed ? (
        <div className="flex size-36 shrink-0 items-center justify-center rounded-md border border-line bg-surface p-2 text-center text-xs text-fg-muted">
          Không tạo được mã QR
        </div>
      ) : (
        <Skeleton className="size-36 shrink-0" />
      )}
      <div className="flex min-w-0 flex-col gap-1 text-center sm:text-left">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-fg sm:justify-start">
          <QrCode size={16} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
          {title}
        </p>
        <p className="font-mono text-base font-semibold tracking-wide text-fg">{bookingCode}</p>
        <p className="text-dense text-fg-muted">
          {description ?? 'Đưa mã này cho nhân viên quầy quét để mở đơn của bạn, hoặc đọc mã đơn ở trên. Mã chỉ dùng để tra cứu đơn, không mở cổng hay khóa kho.'}
        </p>
      </div>
    </section>
  )
}
