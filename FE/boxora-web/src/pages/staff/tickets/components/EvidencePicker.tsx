import { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { EVIDENCE_ACCEPT, MAX_EVIDENCE_FILES, MAX_EVIDENCE_SIZE_BYTES } from '../constants'

interface EvidencePickerProps {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

const ALLOWED_TYPES = EVIDENCE_ACCEPT.split(',')

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB` : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`

/** Picks up to three evidence images (JPG, PNG, WEBP, 10 MB each). Files are uploaded when the ticket is created. */
export function EvidencePicker({ files, onChange, disabled = false }: EvidencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const isFull = files.length >= MAX_EVIDENCE_FILES

  const handlePick = (picked: FileList | null) => {
    if (!picked) return
    const accepted: File[] = []
    let message: string | null = null
    for (const file of Array.from(picked)) {
      if (!ALLOWED_TYPES.includes(file.type)) message = `${file.name}: chỉ nhận ảnh JPG, PNG hoặc WEBP.`
      else if (file.size > MAX_EVIDENCE_SIZE_BYTES) message = `${file.name}: ảnh vượt quá 10 MB.`
      else if (files.length + accepted.length >= MAX_EVIDENCE_FILES) message = `Chỉ đính kèm tối đa ${MAX_EVIDENCE_FILES} ảnh.`
      else accepted.push(file)
    }
    setProblem(message)
    if (accepted.length > 0) onChange([...files, ...accepted])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={EVIDENCE_ACCEPT}
        multiple
        hidden
        onChange={event => handlePick(event.target.files)}
      />
      {files.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0 truncate text-dense text-fg">{file.name}</span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-xs tabular-nums text-fg-subtle">{formatSize(file.size)}</span>
                <IconButton
                  icon={X}
                  size="sm"
                  aria-label={`Bỏ ảnh ${file.name}`}
                  disabled={disabled}
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={Paperclip}
          disabled={disabled || isFull}
          onClick={() => inputRef.current?.click()}
        >
          Đính kèm ảnh
        </Button>
      </div>
      {problem ? (
        <p role="alert" className="text-xs text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
