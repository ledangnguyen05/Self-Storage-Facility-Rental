import { useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { Alert, Button, DescriptionList, Field, Input, Modal, SkeletonText, Textarea, useToast } from '@/components/ui'
import { useCancelPolicy } from '@/components/modals/cancel/useCancelPolicy'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { addDays, formatCurrency, formatDate, toLocalISODate } from '@/lib/format'
import { handoverService } from '@/services/handoverService'
import type { Booking, RentalContract } from '@/types'

interface MoveOutRequestModalProps {
  contract: RentalContract
  booking?: Booking
  onClose: () => void
  onRequested: () => void
}

const NOTE_MAX = 400

/**
 * "Yêu cầu trả kho": the customer tells the facility when they will move out (respecting the
 * policy notice period). Staff then inspect the unit and settle the deposit at the counter; the
 * estimate below comes from the server's return-settlement preview.
 */
export function MoveOutRequestModal({ contract, booking, onClose, onRequested }: MoveOutRequestModalProps) {
  const toast = useToast()
  const bookingId = booking?.id ?? contract.bookingId
  const policyQuery = useCancelPolicy({ facilityId: contract.facilityId, storageUnitId: contract.storageUnitId ?? booking?.storageUnitId ?? '' })
  const preview = useAsyncData(
    signal => handoverService.getReturnSettlementPreview(bookingId as string, { signal }),
    [bookingId],
    { enabled: Boolean(bookingId) },
  )
  const noticeDays = policyQuery.data?.policy.returnNoticeDays ?? 0
  const earliest = useMemo(() => toLocalISODate(addDays(new Date(), noticeDays)), [noticeDays])
  const [moveOutDate, setMoveOutDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosenDate = moveOutDate || earliest
  const dateError = chosenDate < earliest ? `Theo chính sách, vui lòng báo trước ít nhất ${noticeDays} ngày (từ ${formatDate(earliest)}).` : undefined
  const alreadyRequested = ['CHECKOUT_REQUESTED', 'INSPECTED'].includes((booking?.status ?? contract.bookingStatus ?? '').toUpperCase())

  const submit = async () => {
    if (!bookingId || dateError || alreadyRequested) return
    setSubmitting(true)
    setError(null)
    try {
      const notes = [`Ngày dự kiến trả kho: ${formatDate(chosenDate)}`, note.trim()].filter(Boolean).join('. ')
      await handoverService.requestCheckout(bookingId, notes)
      toast.success('Đã gửi yêu cầu trả kho', 'Cơ sở sẽ liên hệ để hẹn kiểm tra kho và quyết toán tiền cọc.')
      onRequested()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không gửi được yêu cầu trả kho. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const data = preview.data
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      size="md"
      title="Yêu cầu trả kho"
      description={`Kho ${contract.unitCode} · ${contract.facilityName ? formatFacilityName(contract.facilityName) : '—'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Đóng
          </Button>
          <Button leftIcon={LogOut} onClick={() => void submit()} loading={submitting} disabled={!bookingId || Boolean(dateError) || alreadyRequested}>
            Gửi yêu cầu trả kho
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!bookingId ? (
          <Alert tone="warning">Hợp đồng này chưa gắn với đơn đặt kho nên không gửi được yêu cầu trực tuyến. Vui lòng liên hệ cơ sở.</Alert>
        ) : alreadyRequested ? (
          <Alert tone="info" title="Đã gửi yêu cầu trả kho">
            Cơ sở đang xử lý yêu cầu trả kho của bạn. Nhân viên sẽ kiểm tra kho và quyết toán tiền cọc tại quầy.
          </Alert>
        ) : (
          <Alert tone="info" icon={null}>
            Sau khi gửi yêu cầu, hãy dọn hàng hóa ra khỏi kho và mang CCCD đến quầy vào ngày đã hẹn. Nhân viên kiểm tra hiện trạng, thu lại thẻ
            hoặc mã truy cập và quyết toán tiền cọc.
          </Alert>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-fg">Ước tính quyết toán</h3>
          {preview.isLoading ? (
            <div className="rounded-lg border border-line p-4" aria-busy="true">
              <SkeletonText lines={3} />
            </div>
          ) : preview.error || !data ? (
            <Alert
              tone="warning"
              action={
                bookingId ? (
                  <Button size="sm" variant="secondary" onClick={() => void preview.reload()}>
                    Thử lại
                  </Button>
                ) : undefined
              }
            >
              {preview.error ? getApiErrorMessage(preview.error, 'Chưa xem trước được khoản quyết toán.') : 'Chưa có dữ liệu quyết toán.'}
            </Alert>
          ) : (
            <DescriptionList
              layout="inline"
              className="rounded-lg border border-line p-4"
              items={[
                { label: 'Hết hạn hợp đồng', value: formatDate(data.rentalEndDate || contract.endDate) },
                { label: 'Tiền cọc đã nộp', value: <span className="tabular-nums">{formatCurrency(data.depositPaid)}</span> },
                ...(Number(data.overdueDays) > 0
                  ? [
                      { label: 'Số ngày quá hạn', value: `${data.overdueDays} ngày` },
                      { label: 'Phí trễ hạn tạm tính', value: <span className="tabular-nums text-danger">{formatCurrency(data.calculatedOverdueLateFee)}</span> },
                    ]
                  : []),
                {
                  label: 'Thời hạn hoàn cọc',
                  value: data.depositRefundSlaDays != null ? `${data.depositRefundSlaDays} ngày làm việc sau khi trả kho` : '—',
                },
              ]}
            />
          )}
          <p className="text-dense text-fg-muted">
            Khấu trừ hư hại hoặc vệ sinh (nếu có) được xác định khi nhân viên kiểm tra kho. Tiền cọc còn lại được hoàn vào tài khoản bạn cung cấp.
          </p>
        </section>

        {!alreadyRequested && bookingId ? (
          <>
            <Field
              label="Ngày dự kiến trả kho"
              required
              error={dateError}
              hint={noticeDays > 0 ? `Chính sách cơ sở: báo trước ít nhất ${noticeDays} ngày.` : 'Cơ sở không yêu cầu báo trước.'}
            >
              <Input type="date" min={earliest} value={chosenDate} onChange={event => setMoveOutDate(event.target.value)} />
            </Field>
            <Field label="Ghi chú cho cơ sở" optional hint={`${note.length}/${NOTE_MAX} ký tự`}>
              <Textarea value={note} maxLength={NOTE_MAX} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: cần hỗ trợ xe đẩy, khung giờ thuận tiện" />
            </Field>
          </>
        ) : null}

        {error ? (
          <Alert tone="danger" title="Chưa gửi được yêu cầu" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}
