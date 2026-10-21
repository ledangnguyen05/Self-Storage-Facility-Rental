import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, FileText, X } from 'lucide-react'
import { SignedFileLink } from '@/components/common/SignedFileLink'
import { SignedImage } from '@/components/common/SignedImage'
import { IconButton, cn } from '@/components/ui'
import { isPdfUrl } from '../dashboard/utils/files'

interface EvidenceViewerProps {
  /** Uploaded file urls (`/uploads/...`). Images show as thumbnails, PDFs as file tiles. */
  urls: string[]
  /** Used in the accessible names of the thumbnails, e.g. "Ảnh nghiệm thu". */
  label?: string
  /** Shown instead of the grid when there is nothing to display. */
  emptyText?: string
  className?: string
}

function Thumb({ url, name, active, onSelect }: { url: string; name: string; active: boolean; onSelect: () => void }) {
  const pdf = isPdfUrl(url)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Xem ${name}`}
      aria-pressed={active}
      className={cn(
        'group relative flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-surface-2 transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active ? 'border-accent ring-2 ring-ring' : 'border-line hover:border-line-strong',
      )}
    >
      {pdf ? (
        <span className="flex flex-col items-center gap-1 text-xs text-fg-muted">
          <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
          Tệp PDF
        </span>
      ) : (
        <SignedImage src={url} alt={name} loading="lazy" className="size-full object-cover" />
      )}
    </button>
  )
}

/**
 * Evidence thumbnails with an inline viewer: pick a thumbnail and it opens larger right below the grid, with
 * previous / next and a link to the original file. Inline on purpose, so it also works inside drawers and
 * dialogs where a second overlay is not allowed.
 */
export function EvidenceViewer({ urls, label = 'Ảnh minh chứng', emptyText, className }: EvidenceViewerProps) {
  const [active, setActive] = useState<number | null>(null)

  if (urls.length === 0) {
    return emptyText ? <p className={cn('text-sm text-fg-muted', className)}>{emptyText}</p> : null
  }

  const index = active !== null && active < urls.length ? active : null
  const current = index !== null ? urls[index] : null
  const move = (step: number) => setActive((value) => (value === null ? 0 : (value + step + urls.length) % urls.length))

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {urls.map((url, i) => (
          <Thumb
            key={url}
            url={url}
            name={`${label} ${i + 1}`}
            active={index === i}
            onSelect={() => setActive((value) => (value === i ? null : i))}
          />
        ))}
      </div>

      {current !== null && index !== null ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-2" role="group" aria-label={`${label} ${index + 1}/${urls.length}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums text-fg-muted">
              {label} {index + 1}/{urls.length}
            </span>
            <div className="flex items-center gap-1">
              {urls.length > 1 ? (
                <>
                  <IconButton icon={ChevronLeft} size="sm" aria-label="Ảnh trước" onClick={() => move(-1)} />
                  <IconButton icon={ChevronRight} size="sm" aria-label="Ảnh sau" onClick={() => move(1)} />
                </>
              ) : null}
              <SignedFileLink
                href={current}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-accent-text hover:underline"
              >
                Mở tệp gốc <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
              </SignedFileLink>
              <IconButton icon={X} size="sm" aria-label="Đóng xem ảnh" onClick={() => setActive(null)} />
            </div>
          </div>
          {isPdfUrl(current) ? (
            <p className="px-1 pb-1 text-sm text-fg-muted">Tệp PDF không xem trước được tại đây. Dùng “Mở tệp gốc” để xem.</p>
          ) : (
            <SignedImage
              key={current}
              src={current}
              alt={`${label} ${index + 1}`}
              className="max-h-96 min-h-24 w-full rounded-md object-contain"
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
