import React, { useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { SignedImage } from '@/components/common/SignedImage'
import { Button, IconButton, Spinner, cn, useToast } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { handoverService } from '@/services/handoverService'
import { IMAGE_ACCEPT, describeUploadError, prepareUploadFile } from '../utils/files'

interface EvidencePhotoSlotProps {
  label: string
  hint?: string
  /** Url of the uploaded photo (`/uploads/handover/...`), if one was taken. */
  value?: string
  onChange: (value: string | undefined) => void
  /** Booking the photo belongs to; the backend checks the staff member's facility against it. */
  bookingId?: string
  required?: boolean
  disabled?: boolean
}

/**
 * One evidence photo: take or pick, upload to the server right away, preview, retake or remove.
 * The slot holds the uploaded file's URL, never the image data.
 */
export function EvidencePhotoSlot({ label, hint, value, onChange, bookingId, required = false, disabled = false }: EvidencePhotoSlotProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setIsUploading(true)
    try {
      const prepared = await prepareUploadFile(file, { imagesOnly: true })
      const uploaded = await handoverService.uploadEvidence(prepared, bookingId)
      setPreviewFailed(false)
      onChange(uploaded.fileUrl)
    } catch (err) {
      toast.error('Không tải được ảnh lên', describeUploadError(err, getApiErrorMessage))
    } finally {
      setIsUploading(false)
    }
  }

  const pick = () => inputRef.current?.click()
  const busy = disabled || isUploading

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">
          {label}
          {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
        </span>
        {value ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" leftIcon={Camera} onClick={pick} disabled={busy}>
              Chụp lại
            </Button>
            <IconButton
              icon={Trash2}
              size="sm"
              aria-label={`Xóa ảnh ${label.toLowerCase()}`}
              tooltip
              onClick={() => onChange(undefined)}
              disabled={busy}
            />
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFile}
      />
      {value ? (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-surface-2">
          {previewFailed ? (
            <div className="flex size-full items-center justify-center px-4 text-center text-xs text-fg-muted">
              Ảnh đã tải lên nhưng chưa xem trước được. Bạn vẫn có thể tiếp tục hoặc chụp lại.
            </div>
          ) : (
            <SignedImage src={value} alt={label} onFailed={() => setPreviewFailed(true)} className="size-full object-cover" />
          )}
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-scrim">
              <Spinner size="md" label="Đang tải ảnh lên" />
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className={cn(
            'flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-surface-2 px-4 text-center',
            'transition-colors hover:border-accent hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {isUploading ? (
            <Spinner size="md" label="Đang tải ảnh lên" />
          ) : (
            <ImagePlus size={24} strokeWidth={1.75} className="text-fg-subtle" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-fg">{isUploading ? 'Đang tải ảnh lên…' : 'Chụp hoặc tải ảnh'}</span>
          {hint && !isUploading ? <span className="text-xs text-fg-subtle">{hint}</span> : null}
        </button>
      )}
    </div>
  )
}
