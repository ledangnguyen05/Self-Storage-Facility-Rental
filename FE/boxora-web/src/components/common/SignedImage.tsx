import { useRef, useState, type ImgHTMLAttributes } from 'react'
import { ImageOff, ShieldAlert } from 'lucide-react'
import { cn } from '@/components/ui'
import { useSignedUrl } from '@/hooks/useSignedUrl'

export interface SignedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** The stored path of the file (`/uploads/…`), exactly as the API returned it. */
  src: string | null | undefined
  /** Called once the image cannot be shown (no permission, file gone, or it failed to load twice). */
  onFailed?: () => void
}

/**
 * An uploaded image. Uploaded evidence is private, so the stored path is exchanged for a short-lived signed link
 * (see `useSignedUrl`) before the browser asks for it. While the link is being issued a placeholder holds the space;
 * if the image does not load the link is renewed once, then a plain message is shown.
 */
export function SignedImage({ src, alt, className, onFailed, onError, ...props }: SignedImageProps) {
  const { src: signed, phase, refresh } = useSignedUrl(src)
  const [loadFailed, setLoadFailed] = useState<string | null>(null)
  const retried = useRef<string | null>(null)

  if (!src) return null

  const failedMessage =
    phase === 'denied'
      ? { icon: ShieldAlert, text: 'Bạn không có quyền xem ảnh này' }
      : phase === 'missing'
        ? { icon: ImageOff, text: 'Tệp không còn trên hệ thống' }
        : phase === 'error' || (loadFailed !== null && loadFailed === signed)
          ? { icon: ImageOff, text: 'Không tải được ảnh' }
          : null

  if (failedMessage) {
    const Icon = failedMessage.icon
    return (
      <span
        role="img"
        aria-label={alt ? `${alt}: ${failedMessage.text}` : failedMessage.text}
        className={cn('flex flex-col items-center justify-center gap-1 bg-surface-2 px-2 text-center text-xs text-fg-subtle', className)}
      >
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        {failedMessage.text}
      </span>
    )
  }

  if (!signed) {
    return <span aria-hidden="true" className={cn('skeleton block', className)} />
  }

  return (
    <img
      {...props}
      src={signed}
      alt={alt ?? ''}
      className={className}
      onError={event => {
        onError?.(event)
        if (retried.current !== src) {
          // The link may simply have expired (sleeping computer): ask for a new one once.
          retried.current = src
          refresh()
          return
        }
        setLoadFailed(signed)
        onFailed?.()
      }}
    />
  )
}
