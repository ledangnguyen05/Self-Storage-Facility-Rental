import { Check, Copy, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Alert, Button, IconButton, Skeleton, useToast } from '@/components/ui'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import type { UnitPinState } from '../hooks/useUnitPin'

interface UnitAccessPanelProps {
  unitCode: string
  pin: UnitPinState
  onToggle: () => void
  onRetry: () => void
  onChangePin: () => void
}

/**
 * Access PIN of one rented unit. The PIN is only shown after a successful fetch. No smart lock is
 * connected to Boxora yet (test environment): the PIN is stored and checked by the facility staff.
 */
export function UnitAccessPanel({ unitCode, pin, onToggle, onRetry, onChangePin }: UnitAccessPanelProps) {
  const toast = useToast()
  const { copy, copied } = useCopyToClipboard()
  const isLoading = pin.status === 'loading'
  const isRevealed = pin.status === 'ready' && pin.revealed

  const handleCopy = async () => {
    const ok = await copy(pin.pin)
    if (ok) toast.success('Đã sao chép mã PIN')
    else toast.error('Không thể sao chép mã PIN', 'Trình duyệt không cho phép truy cập bộ nhớ tạm.')
  }

  return (
    <section aria-label={`Truy cập kho ${unitCode}`} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
            <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
            Mã PIN truy cập
          </p>
          <p className="text-dense text-fg-muted">
            Xuất trình khi ra vào kho. Môi trường thử nghiệm: khóa thông minh chưa kết nối, mã được lưu và đối chiếu trên hệ thống Boxora.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onChangePin}>
            Đổi mã PIN
          </Button>
          <Button variant="secondary" size="sm" leftIcon={isRevealed ? EyeOff : Eye} loading={isLoading} onClick={onToggle}>
            {isRevealed ? 'Ẩn' : 'Hiện mã'}
          </Button>
        </div>
      </div>

      {pin.status === 'error' ? (
        <Alert
          tone="danger"
          title="Không tải được mã PIN"
          action={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Thử lại
            </Button>
          }
        >
          {pin.error}
        </Alert>
      ) : isLoading ? (
        <Skeleton className="h-9 w-40" />
      ) : isRevealed ? (
        pin.pin ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xl font-semibold tracking-widest text-fg tabular-nums" aria-label={`Mã PIN ${pin.pin.split('').join(' ')}`}>
              {pin.pin}
            </span>
            <IconButton
              icon={copied ? Check : Copy}
              aria-label={copied ? 'Đã sao chép mã PIN' : 'Sao chép mã PIN'}
              tooltip
              size="sm"
              onClick={handleCopy}
            />
          </div>
        ) : (
          <p className="text-dense text-fg-muted">Kho chưa có mã PIN. Mã được kích hoạt sau khi cơ sở bàn giao kho.</p>
        )
      ) : (
        <p className="font-mono text-2xl tracking-widest text-fg-subtle" aria-label="Mã PIN đang ẩn">
          ••••••
        </p>
      )}
    </section>
  )
}
