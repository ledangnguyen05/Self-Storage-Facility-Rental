import { Skeleton } from '@/components/ui'
import { useQrDataUrl } from '../hooks/useQrDataUrl'

interface PaymentLinkPanelProps {
  paymentUrl: string
  /** Shown under the QR code. */
  hint?: string
}

/** QR code of a VNPay checkout link, so the customer can pay from a phone. */
export function PaymentLinkPanel({ paymentUrl, hint }: PaymentLinkPanelProps) {
  const qr = useQrDataUrl(paymentUrl, 208)
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line p-4 text-center">
      {qr.dataUrl ? (
        <img src={qr.dataUrl} alt="Mã QR mở trang thanh toán VNPay" className="size-52 rounded-md" />
      ) : qr.failed ? (
        <p className="text-dense text-fg-muted">Không tạo được mã QR. Hãy dùng nút mở trang thanh toán.</p>
      ) : (
        <Skeleton className="size-52" />
      )}
      <p className="max-w-sm text-dense text-fg-muted">
        {hint ?? 'Quét mã bằng điện thoại để mở trang thanh toán VNPay, hoặc mở ngay trên thiết bị này. Trạng thái sẽ tự cập nhật sau khi thanh toán.'}
      </p>
    </div>
  )
}
