import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/components/ui'
import { useSignedUrl } from '@/hooks/useSignedUrl'

export interface SignedFileLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  /** The stored path of the file (`/uploads/…`), exactly as the API returned it. */
  href: string | null | undefined
  children: ReactNode
}

/**
 * Opens an uploaded file (receipt, contract scan, PDF) in a new tab. Uploaded evidence is private, so the stored
 * path is exchanged for a short-lived signed link first; until it is ready, or when the user may not see the file,
 * the label is shown as plain text instead of a dead link.
 */
export function SignedFileLink({ href, children, className, ...props }: SignedFileLinkProps) {
  const { src, phase } = useSignedUrl(href)
  if (!href) return null

  if (src) {
    return (
      <a {...props} href={src} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }

  const note =
    phase === 'denied'
      ? 'Bạn không có quyền xem tệp này'
      : phase === 'missing'
        ? 'Tệp không còn trên hệ thống'
        : phase === 'error'
          ? 'Không mở được tệp lúc này'
          : undefined

  return (
    <span aria-busy={phase === 'loading'} title={note} className={cn('cursor-default text-fg-subtle', phase === 'loading' && 'opacity-70')}>
      {children}
      {note ? <span className="sr-only"> ({note})</span> : null}
    </span>
  )
}
