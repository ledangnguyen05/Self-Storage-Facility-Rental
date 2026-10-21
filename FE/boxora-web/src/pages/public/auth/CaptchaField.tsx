import React from 'react'
import { RefreshCw } from 'lucide-react'
import { Alert, Button, Field, IconButton, Input, Skeleton } from '../../../components/ui'
import { getApiErrorMessage } from '../../../lib/apiError'

interface CaptchaFieldProps {
  image: string | undefined
  isLoading: boolean
  /** Error from loading the captcha. There is no offline fallback: without a server code nothing can be validated. */
  loadError: unknown
  value: string
  onChange: (value: string) => void
  onRefresh: () => void
  error?: string | null
}

/** Server-issued captcha image, input and refresh. A load failure shows an error with Retry. */
export function CaptchaField({ image, isLoading, loadError, value, onChange, onRefresh, error }: CaptchaFieldProps) {
  if (loadError && !image) {
    return (
      <Alert
        tone="danger"
        title="Không tải được mã xác thực"
        action={
          <Button type="button" size="sm" variant="secondary" onClick={onRefresh}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(loadError, 'Không thể kết nối máy chủ. Hãy kiểm tra mạng rồi thử lại.')}
      </Alert>
    )
  }

  return (
    <Field label="Mã xác thực" required error={error} hint="Nhập các ký tự trong hình. Không phân biệt chữ hoa, chữ thường.">
      <div className="flex items-center gap-2">
        <Input
          size="lg"
          value={value}
          onChange={event => onChange(event.target.value.toUpperCase())}
          placeholder="Nhập mã"
          maxLength={5}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-w-0 flex-1 font-mono tracking-widest"
        />
        <div className="flex h-10 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-2">
          {isLoading || !image ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <img src={image} alt="Mã xác thực" className="h-full w-full object-contain" />
          )}
        </div>
        <IconButton
          icon={RefreshCw}
          variant="secondary"
          size="lg"
          aria-label="Đổi mã xác thực khác"
          tooltip
          loading={isLoading}
          onClick={onRefresh}
        />
      </div>
    </Field>
  )
}
