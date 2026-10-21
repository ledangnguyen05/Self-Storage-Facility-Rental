import { useMemo, useState, type FormEvent } from 'react'
import { Check, Copy, Mail, Phone } from 'lucide-react'
import {
  Alert,
  Button,
  buttonVariants,
  Badge,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui'
import { getRoleMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  supportTicketService,
  type EscalationContact,
  type SupportTicketContactLog,
  type SupportTicketRecord,
} from '@/services/supportTicketService'
import { ContactLogTimeline } from '../components/ContactLogTimeline'
import { TicketSummary } from '../components/TicketSummary'
import { CONTACT_METHOD_OPTIONS, type ContactMethod } from '../constants'
import { buildEscalationText, getTicketCode } from '../ticketUtils'

const OTHER_TARGET = '__other__'
const NO_CONTACTS: EscalationContact[] = []
const NO_LOGS: SupportTicketContactLog[] = []

interface ContactBomModalProps {
  ticket: SupportTicketRecord
  onClose: () => void
}

/**
 * Facility manager escalates a ticket to the business managers: copy a summary,
 * call or email a contact, then record the exchange. Recording never changes the ticket status.
 */
export function ContactBomModal({ ticket, onClose }: ContactBomModalProps) {
  const toast = useToast()
  const { copy, copied } = useCopyToClipboard()

  const contactsQuery = useAsyncData(signal => supportTicketService.getEscalationContacts({ signal }), [])
  const logsQuery = useAsyncData(signal => supportTicketService.getContactLogs(ticket.id, { signal }), [ticket.id])
  const contacts = contactsQuery.data ?? NO_CONTACTS
  const logs = logsQuery.data ?? NO_LOGS

  const [method, setMethod] = useState<ContactMethod>('PHONE')
  const [targetChoice, setTargetChoice] = useState<string | null>(null)
  const [customTarget, setCustomTarget] = useState('')
  const [summary, setSummary] = useState('')
  const [result, setResult] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const targetOptions = useMemo(
    () => [
      ...contacts.map(contact => ({ value: `${contact.fullName} (${contact.email})`, label: `${contact.fullName} (${contact.email})` })),
      { value: OTHER_TARGET, label: 'Người khác' },
    ],
    [contacts]
  )
  const effectiveChoice = targetChoice ?? targetOptions[0]?.value ?? OTHER_TARGET
  const contactTarget = effectiveChoice === OTHER_TARGET ? customTarget.trim() : effectiveChoice

  const summaryError = touched && !summary.trim() ? 'Tóm tắt nội dung đã trao đổi.' : undefined
  const targetError = touched && !contactTarget ? 'Nhập người hoặc số liên hệ.' : undefined

  const handleCopy = async () => {
    const ok = await copy(buildEscalationText(ticket))
    if (!ok) toast.error('Không thể sao chép', 'Trình duyệt không cho phép truy cập bộ nhớ tạm.')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!summary.trim() || !contactTarget) return
    setSaving(true)
    try {
      await supportTicketService.recordContactLog(ticket.id, {
        contactMethod: method,
        targetRole: 'BUSINESS_MANAGER',
        contactTarget,
        summary: summary.trim(),
        result: result.trim() || undefined,
      })
      toast.success('Đã lưu nhật ký liên hệ', 'Trạng thái ticket không thay đổi.')
      setSummary('')
      setResult('')
      setTouched(false)
      await logsQuery.reload()
    } catch (err) {
      toast.error('Không thể lưu nhật ký liên hệ', getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const mailSubject = encodeURIComponent(`[Escalation] Ticket ${getTicketCode(ticket)}`)

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title="Liên hệ giám đốc vận hành"
      description="Dùng khi sự cố vượt thẩm quyền của cơ sở hoặc cần quyết định vận hành."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          <Button type="submit" form="contact-log-form" loading={saving}>
            Lưu nhật ký
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3" aria-label="Thông tin sự cố">
          <TicketSummary ticket={ticket} />
          <div>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={copied ? Check : Copy}
              onClick={() => void handleCopy()}
            >
              {copied ? 'Đã sao chép' : 'Sao chép thông tin sự cố'}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="bom-contacts-heading">
          <h3 id="bom-contacts-heading" className="text-sm font-semibold text-fg">
            Danh bạ giám đốc vận hành
          </h3>
          {contactsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : contactsQuery.error ? (
            <Alert
              tone="danger"
              title="Không tải được danh bạ"
              action={
                <Button size="sm" variant="secondary" onClick={() => void contactsQuery.reload()}>
                  Thử lại
                </Button>
              }
            >
              {getApiErrorMessage(contactsQuery.error)}
            </Alert>
          ) : contacts.length === 0 ? (
            <EmptyState size="sm" title="Chưa có đầu mối liên hệ" description="Hệ thống chưa có giám đốc vận hành nào để liên hệ." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {contacts.map(contact => {
                const role = getRoleMeta(contact.role)
                return (
                  <li key={contact.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-fg">{contact.fullName}</span>
                      <Badge tone={role.tone} size="sm">
                        {role.label}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-0.5 text-dense text-fg-muted">
                      <span className="font-mono">{contact.phone || '—'}</span>
                      <span className="truncate">{contact.email}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                          <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                          Gọi điện
                        </a>
                      ) : null}
                      <a
                        href={`mailto:${contact.email}?subject=${mailSubject}`}
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                      >
                        <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                        Gửi email
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <form
          id="contact-log-form"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 border-t border-line pt-5"
          aria-labelledby="bom-log-heading"
        >
          <div>
            <h3 id="bom-log-heading" className="text-sm font-semibold text-fg">
              Ghi nhật ký trao đổi
            </h3>
            <p className="text-dense text-fg-muted">Dùng để truy vết điều phối. Không tự động đổi trạng thái ticket.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phương thức liên hệ" required>
              <Select value={method} onChange={event => setMethod(event.target.value as ContactMethod)} options={CONTACT_METHOD_OPTIONS} />
            </Field>
            <Field label="Người nhận liên hệ" required error={effectiveChoice === OTHER_TARGET ? undefined : targetError}>
              <Select value={effectiveChoice} onChange={event => setTargetChoice(event.target.value)} options={targetOptions} />
            </Field>
          </div>
          {effectiveChoice === OTHER_TARGET ? (
            <Field label="Tên hoặc số liên hệ" required error={targetError}>
              <Input value={customTarget} onChange={event => setCustomTarget(event.target.value)} placeholder="Tên người nhận hoặc số điện thoại" />
            </Field>
          ) : null}

          <Field label="Tóm tắt nội dung trao đổi" required error={summaryError}>
            <Textarea
              rows={2}
              value={summary}
              onChange={event => setSummary(event.target.value)}
              placeholder="Vấn đề phát sinh cần quyết định ở cấp vận hành."
            />
          </Field>
          <Field label="Kết quả hoặc kết luận thống nhất" optional>
            <Input
              value={result}
              onChange={event => setResult(event.target.value)}
              placeholder="Ví dụ: đồng ý điều kỹ thuật hỗ trợ, hoàn thành trước 18:00."
            />
          </Field>
        </form>

        <section className="flex flex-col gap-3 border-t border-line pt-5" aria-labelledby="bom-history-heading">
          <h3 id="bom-history-heading" className="text-sm font-semibold text-fg">
            Lịch sử liên hệ{logs.length > 0 ? ` (${logs.length})` : ''}
          </h3>
          <ContactLogTimeline
            logs={logs}
            isLoading={logsQuery.isLoading}
            error={logsQuery.error}
            onRetry={() => void logsQuery.reload()}
            emptyText="Chưa có lượt liên hệ nào cho ticket này."
          />
        </section>
      </div>
    </Modal>
  )
}
