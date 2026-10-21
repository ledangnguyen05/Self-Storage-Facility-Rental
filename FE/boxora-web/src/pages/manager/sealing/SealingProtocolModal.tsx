import { LockOpen, Printer } from 'lucide-react'
import { Alert, Badge, Button, DescriptionList, Modal, Skeleton, useToast } from '@/components/ui'
import { getSealingStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { sealingService, type SealingRecordResponse } from '@/services/sealingService'
import { printSealingProtocol, protocolSections } from './printProtocol'

interface SealingProtocolModalProps {
  open: boolean
  onClose: () => void
  /** Record already in hand (e.g. right after sealing); otherwise it is loaded by `recordId`. */
  record?: SealingRecordResponse | null
  recordId?: string | null
  /** Shown right after sealing: result of the notice email. */
  notice?: { notified?: boolean; message?: string }
  /** When set and the record is still sealed, offers "Gỡ niêm phong". */
  onUnseal?: (record: SealingRecordResponse) => void
}

/** The sealing protocol as a document, with "In biên bản" printing only the protocol. */
export function SealingProtocolModal(props: SealingProtocolModalProps) {
  if (!props.open) return null
  return <SealingProtocolDialog {...props} />
}

function SealingProtocolDialog({ onClose, record, recordId, notice, onUnseal }: SealingProtocolModalProps) {
  const toast = useToast()
  const query = useAsyncData((signal) => sealingService.getById(recordId as string, { signal }), [recordId], {
    enabled: !record && Boolean(recordId),
  })
  const data = record ?? query.data
  const status = data ? getSealingStatusMeta(data.status) : null

  const print = () => {
    if (!data) return
    if (!printSealingProtocol(data)) toast.error('Không mở được hộp thoại in', 'Trình duyệt chặn cửa sổ in. Hãy thử lại.')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={data?.protocolNumber ? `Biên bản niêm phong ${data.protocolNumber}` : 'Biên bản niêm phong'}
      description={data ? `Kho ${data.unitCode ?? '—'} · ${data.facilityName ?? ''}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {data && onUnseal && data.status === 'SEALED' ? (
            <Button variant="secondary" leftIcon={LockOpen} onClick={() => onUnseal(data)}>
              Gỡ niêm phong
            </Button>
          ) : null}
          <Button leftIcon={Printer} disabled={!data} onClick={print}>
            In biên bản
          </Button>
        </>
      }
    >
      {!data && query.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40" />
        </div>
      ) : !data ? (
        <Alert
          tone="danger"
          title="Không tải được biên bản"
          action={
            <Button size="sm" variant="secondary" onClick={() => void query.reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(query.error, 'Không tìm thấy biên bản niêm phong.')}
        </Alert>
      ) : (
        <div className="flex flex-col gap-5">
          {notice?.message ? (
            <Alert tone={notice.notified ? 'success' : 'warning'} title={notice.notified ? 'Đã thông báo cho khách' : 'Chưa thông báo được cho khách'}>
              {notice.message}
            </Alert>
          ) : null}
          {status ? (
            <div>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            </div>
          ) : null}
          {protocolSections(data).map((section) => (
            <section key={section.title} aria-label={section.title} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-fg">{section.title}</h3>
              <DescriptionList
                columns={2}
                items={section.rows.map(([label, value]) => ({ label, value: String(value), full: String(value).length > 40 }))}
              />
            </section>
          ))}
        </div>
      )}
    </Modal>
  )
}
