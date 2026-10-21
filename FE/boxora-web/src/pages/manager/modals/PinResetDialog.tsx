import { useState } from 'react'
import { Copy, KeyRound } from 'lucide-react'
import { Alert, Button, DescriptionList, Modal } from '@/components/ui'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/format'
import { bookingService, type BookingPinData } from '@/services/bookingService'

interface PinResetDialogProps {
  open: boolean
  onClose: () => void
  unitId: string
  unitCode: string
  tenantName?: string
  onReset?: () => void
}

/** Six random digits from the browser CSPRNG. */
function generatePin(): string {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return String(values[0] % 1_000_000).padStart(6, '0')
}

/**
 * Issues a new door PIN for the active booking of a unit (PUT /bookings/unit/{unitId}/access-pin). The new PIN is
 * shown once here; the tenant always sees the current PIN in the customer portal.
 */
export function PinResetDialog(props: PinResetDialogProps) {
  if (!props.open) return null
  return <PinResetForm {...props} />
}

function PinResetForm({ onClose, unitId, unitCode, tenantName, onReset }: PinResetDialogProps) {
  const [result, setResult] = useState<BookingPinData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { copy, copied } = useCopyToClipboard()

  const reset = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      setResult(await bookingService.updateAccessPinByUnit(unitId, generatePin()))
      onReset?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể cấp lại mã PIN.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      title={
        <>
          Cấp lại mã PIN kho <span className="whitespace-nowrap">{unitCode}</span>
        </>
      }
      description="Mã cũ hết hiệu lực ngay. Khách xem mã mới trong mục Mã truy cập của cổng khách hàng."
      footer={
        result ? (
          <Button onClick={onClose}>Xong</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button leftIcon={KeyRound} loading={isSubmitting} onClick={() => void reset()}>
              Cấp mã PIN mới
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Alert tone="danger" title="Không thể cấp lại mã PIN" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {result ? (
          <>
            <Alert tone="success" title="Đã cấp mã PIN mới">
              Chỉ đọc mã cho khách khi đã xác minh danh tính. Mã không được lưu ở trình duyệt.
            </Alert>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-4">
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-widest text-fg">{result.pin}</span>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={Copy}
                onClick={() => void copy(result.pin)}
              >
                {copied ? 'Đã sao chép' : 'Sao chép'}
              </Button>
            </div>
            <DescriptionList
              items={[
                { label: 'Mã đặt kho', value: result.bookingCode, mono: true },
                { label: 'Cập nhật lúc', value: result.pinUpdatedAt ? formatDateTime(result.pinUpdatedAt) : undefined },
              ]}
            />
          </>
        ) : (
          <>
            <DescriptionList
              items={[
                { label: 'Kho', value: unitCode, mono: true },
                { label: 'Khách thuê', value: tenantName },
              ]}
            />
            <Alert tone="warning">
              Dùng khi khách quên mã hoặc nghi lộ mã. Hệ thống chưa kết nối khóa điện tử: nếu khóa tại kho lưu mã riêng, nhân viên
              cần cập nhật mã mới trên thiết bị.
            </Alert>
          </>
        )}
      </div>
    </Modal>
  )
}
