import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, Field, Select, Textarea, useToast } from '@/components/ui'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, getTicketCategoryMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { supportTicketService } from '@/services/supportTicketService'
import type { RentalContract } from '@/types'
import { EvidencePicker } from '@/pages/staff/tickets/components/EvidencePicker'
import { MAX_EVIDENCE_FILES } from '@/pages/staff/tickets/constants'

/** Select value for a request that is not about a specific unit. */
const GENERAL = 'general'

const PRIORITY_HINTS: Record<string, string> = {
  LOW: 'Thắc mắc hoặc góp ý thông thường.',
  MEDIUM: 'Cần xử lý trong ngày.',
  HIGH: 'Ảnh hưởng tới việc ra vào hoặc bốc dỡ hàng.',
  URGENT: 'Không mở được kho hoặc hàng hóa đang gặp nguy cơ.',
}

interface SupportTicketFormProps {
  customerId?: string
  /** Units the customer holds; the request can be linked to one of them. */
  contracts: RentalContract[]
  /** Preselected unit (contract id), e.g. from "Báo sự cố" on a unit card. */
  defaultContractId?: string
  onCreated: () => void
}

export function SupportTicketForm({ customerId, contracts, defaultContractId, onCreated }: SupportTicketFormProps) {
  const toast = useToast()
  const [unitChoice, setUnitChoice] = useState(defaultContractId ?? '')
  const [category, setCategory] = useState<string>('LOCK_ISSUE')
  const [priority, setPriority] = useState<string>('MEDIUM')
  const [description, setDescription] = useState('')
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Until the customer picks, the first held unit is selected (or "general" without one).
  const selectedValue = unitChoice || contracts[0]?.id || GENERAL
  const contract = contracts.find(item => item.id === selectedValue)
  const descriptionRequired = category === 'OTHER'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = description.trim()
    if (descriptionRequired && !text) {
      setDescriptionError('Vui lòng mô tả vấn đề bạn cần hỗ trợ.')
      return
    }
    const categoryLabel = getTicketCategoryMeta(category).label
    const title = contract ? `Sự cố kho ${contract.unitCode} (${categoryLabel})` : `Yêu cầu hỗ trợ (${categoryLabel})`
    setSubmitting(true)
    try {
      // Evidence photos are uploaded first; the ticket then references the returned file URLs.
      const evidenceUrls: string[] = []
      for (const file of files) {
        const uploaded = await supportTicketService.uploadEvidence(file)
        evidenceUrls.push(uploaded.fileUrl)
      }
      await supportTicketService.createTicket({
        customerId,
        // The ticket links to the booking behind the contract, never to the contract id.
        bookingId: contract?.bookingId || undefined,
        facilityId: contract?.facilityId || undefined,
        category,
        title,
        description: text || `${categoryLabel}${contract ? ` tại kho ${contract.unitCode}` : ''}.`,
        priority,
        evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      })
      toast.success('Đã gửi yêu cầu hỗ trợ', 'Nhân viên cơ sở sẽ phản hồi sớm nhất có thể.')
      setDescription('')
      setDescriptionError(null)
      setFiles([])
      onCreated()
    } catch (err) {
      toast.error('Không gửi được yêu cầu hỗ trợ', getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const unitOptions = [
    ...contracts.map(item => ({
      value: item.id,
      label: `Kho ${item.unitCode}${item.facilityName ? ` · ${formatFacilityName(item.facilityName)}` : ''}`,
    })),
    { value: GENERAL, label: 'Không gắn với kho cụ thể' },
  ]

  return (
    <Card>
      <CardHeader title="Gửi yêu cầu hỗ trợ" description="Báo sự cố khóa, mã PIN, vệ sinh, thanh toán hoặc câu hỏi khác." />
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Kho liên quan">
            <Select value={selectedValue} onChange={event => setUnitChoice(event.target.value)} options={unitOptions} />
          </Field>
          <Field label="Vấn đề">
            <Select
              value={category}
              onChange={event => {
                setCategory(event.target.value)
                setDescriptionError(null)
              }}
              options={TICKET_CATEGORY_OPTIONS}
            />
          </Field>
          <Field label="Mức độ ưu tiên" hint={PRIORITY_HINTS[priority]} className="sm:col-span-2 sm:max-w-sm">
            <Select value={priority} onChange={event => setPriority(event.target.value)} options={TICKET_PRIORITY_OPTIONS} />
          </Field>
          <Field
            label="Mô tả"
            required={descriptionRequired}
            optional={!descriptionRequired}
            error={descriptionError}
            hint={descriptionRequired ? 'Bắt buộc với vấn đề "Khác".' : undefined}
            className="sm:col-span-2"
          >
            <Textarea
              rows={4}
              value={description}
              onChange={event => {
                setDescription(event.target.value)
                if (descriptionError) setDescriptionError(null)
              }}
              placeholder={descriptionRequired ? 'Mô tả cụ thể vấn đề bạn đang gặp.' : 'Thêm chi tiết giúp nhân viên xử lý nhanh hơn.'}
            />
          </Field>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <p className="text-sm font-medium text-fg">
              Ảnh minh chứng <span className="font-normal text-fg-subtle">(không bắt buộc)</span>
            </p>
            <EvidencePicker files={files} onChange={setFiles} disabled={submitting} />
            <p className="text-xs text-fg-subtle">{`Tối đa ${MAX_EVIDENCE_FILES} ảnh JPG, PNG hoặc WEBP, mỗi ảnh dưới 10 MB. Ảnh giúp nhân viên xử lý sự cố nhanh hơn.`}</p>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" leftIcon={Send} loading={submitting}>
              Gửi yêu cầu
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
