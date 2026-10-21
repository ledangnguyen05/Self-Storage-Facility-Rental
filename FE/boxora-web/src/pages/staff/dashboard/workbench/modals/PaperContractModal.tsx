import React, { useRef, useState } from 'react'
import { ExternalLink, FileCheck2, Upload } from 'lucide-react'
import { SignedFileLink } from '@/components/common/SignedFileLink'
import { Alert, Button, Field, Input, Modal, Textarea, cn, useToast } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { handoverService, type HandoverPrerequisites } from '@/services/handoverService'
import { DOCUMENT_ACCEPT, describeUploadError, formatFileSize, prepareUploadFile } from '../../utils/files'

interface PaperContractModalProps {
  open: boolean
  onClose: () => void
  bookingId: string
  bookingCode: string
  unitCode: string
  prerequisites: HandoverPrerequisites | null
  /** Called after the contract is saved (reload the conditions). */
  onSaved: () => Promise<void> | void
}

export function PaperContractModal(props: PaperContractModalProps) {
  // Mounted only while open, so the form resets on every open.
  if (!props.open) return null
  return <PaperContractDialog {...props} />
}

const FORM_ID = 'paper-contract-form'

function PaperContractDialog({ onClose, bookingId, bookingCode, unitCode, prerequisites, onSaved }: PaperContractModalProps) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [contractCode, setContractCode] = useState(prerequisites?.contractCode ?? '')
  const [location, setLocation] = useState(prerequisites?.paperOriginalLocation ?? '')
  /** Scan already stored on the server for this contract. */
  const existingUrl = prerequisites?.paperContractUrl ?? ''
  /** Newly picked file; it is uploaded when the form is saved. */
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    setFileError(null)
    try {
      setFile(await prepareUploadFile(picked))
    } catch (err) {
      setFile(null)
      setFileError(describeUploadError(err, getApiErrorMessage))
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file && !existingUrl) {
      setFileError('Tải lên ảnh chụp hoặc bản scan hợp đồng đã ký.')
      return
    }
    setIsSaving(true)
    try {
      // The scan is stored as a file on the server; the contract only keeps its url.
      const scanUrl = file ? (await handoverService.uploadEvidence(file, bookingId)).fileUrl : existingUrl
      await handoverService.createOrUploadPaperContract({
        bookingId,
        contractCode: contractCode.trim() || undefined,
        paperContractUrl: scanUrl,
        paperOriginalLocation: location.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success('Đã lưu hợp đồng giấy', 'Đối chiếu chữ ký rồi bấm “Xác minh hợp đồng” để hoàn tất điều kiện.')
      onClose()
      await onSaved()
    } catch (err) {
      toast.error('Không lưu được hợp đồng giấy', describeUploadError(err, getApiErrorMessage))
    } finally {
      setIsSaving(false)
    }
  }

  const hasScan = Boolean(file) || Boolean(existingUrl)

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      dismissible={!isSaving}
      title="Hợp đồng giấy tại quầy"
      description={`Đơn ${bookingCode || '—'} · Kho ${unitCode || '—'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSaving}>
            Lưu hợp đồng
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Mã hợp đồng" optional hint="Để trống để hệ thống tự tạo mã.">
          <Input value={contractCode} onChange={(e) => setContractCode(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Nơi lưu bản gốc" optional hint="Ví dụ: tủ hồ sơ, ngăn, kệ tại cơ sở.">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Bản scan hợp đồng đã ký" required error={fileError ?? undefined}>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleFile}
            />
            <div
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3',
                hasScan ? 'border-success-line bg-success-subtle' : 'border-line-strong bg-surface-2',
              )}
            >
              {hasScan ? (
                <FileCheck2 size={20} strokeWidth={1.75} className="shrink-0 text-success" aria-hidden="true" />
              ) : (
                <Upload size={20} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-fg">
                  {file ? `${file.name} (${formatFileSize(file.size)})` : existingUrl ? 'Đã có bản scan trên hệ thống' : 'Chưa có tệp'}
                </p>
                <p className="text-xs text-fg-subtle">Ảnh JPG, PNG, WEBP hoặc PDF có đủ chữ ký của khách và nhân viên, tối đa 10 MB. Tệp được tải lên khi bạn bấm Lưu.</p>
                {!file && existingUrl ? (
                  <SignedFileLink href={existingUrl} className="mt-1 inline-flex items-center gap-1 text-xs text-accent-text hover:underline">
                    Xem bản scan hiện tại <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                  </SignedFileLink>
                ) : null}
              </div>
              <Button variant="secondary" size="sm" disabled={isSaving} onClick={() => fileRef.current?.click()}>
                {hasScan ? 'Đổi tệp' : 'Chọn tệp'}
              </Button>
            </div>
          </div>
        </Field>
        <Field label="Ghi chú" optional>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Alert tone="info">
          Sau khi lưu, hợp đồng ở trạng thái chờ xác minh. Kiểm tra chữ ký và con dấu rồi bấm “Xác minh hợp đồng” để điều kiện được công nhận.
        </Alert>
      </form>
    </Modal>
  )
}
