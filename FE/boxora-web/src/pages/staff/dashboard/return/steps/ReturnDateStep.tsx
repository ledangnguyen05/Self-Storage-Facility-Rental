import React from 'react'
import { ArrowRight } from 'lucide-react'
import { Alert, Button, DescriptionList, SkeletonText } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, toNumber } from '@/lib/format'
import { getOverdueDays, type ReturnQueueItem } from '../../utils/frontDesk'
import type { ReturnPreview } from '../returnInspection'

interface ReturnDateStepProps {
  item: ReturnQueueItem
  preview: ReturnPreview | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
  today: string
  onNext: () => void
}

export function ReturnDateStep({ item, preview, isLoading, error, onRetry, today, onNext }: ReturnDateStepProps) {
  if (isLoading) {
    return (
      <div aria-busy="true">
        <SkeletonText lines={6} />
      </div>
    )
  }
  if (error || !preview) {
    return (
      <Alert
        tone="danger"
        title="Không tải được thông tin quyết toán"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error, 'Không có dữ liệu quyết toán cho hợp đồng này.')}
      </Alert>
    )
  }

  const endDate = preview.rentalEndDate || item.endDate
  const overdueDays = toNumber(preview.overdueDays) ?? getOverdueDays(endDate, today)
  const lateFee = toNumber(preview.calculatedOverdueLateFee)
  const deposit = toNumber(preview.depositPaid)
  const status = String(item.status).toUpperCase()

  return (
    <div className="flex flex-col gap-4">
      {status === 'CHECKOUT_REQUESTED' ? (
        <Alert tone="info">Khách đã gửi yêu cầu trả kho. Biên bản nghiệm thu sẽ được lưu cùng quyết toán.</Alert>
      ) : null}
      {overdueDays > 0 ? (
        <Alert tone="warning" title={`Quá hạn ${overdueDays} ngày`}>
          Phí trễ hạn ước tính {formatCurrency(lateFee ?? 0)}
          {toNumber(preview.dailyLateFee) ? ` (${formatCurrency(preview.dailyLateFee)}/ngày sau thời gian ân hạn)` : ''}. Có thể điều chỉnh ở bước khấu trừ.
        </Alert>
      ) : null}
      <DescriptionList
        columns={2}
        items={[
          { label: 'Khách thuê', value: preview.customerName || item.customerName || '—' },
          { label: 'Số điện thoại', value: preview.customerPhone || item.customerPhone || '—' },
          { label: 'Kho', value: preview.unitCode || item.unitCode || '—', mono: true },
          { label: 'Mã hợp đồng', value: preview.contractCode || '—', mono: true },
          { label: 'Ngày hết hạn hợp đồng', value: formatDate(endDate) },
          { label: 'Ngày trả thực tế', value: formatDate(preview.actualReturnDate || today) },
          { label: 'Số ngày quá hạn', value: overdueDays > 0 ? `${overdueDays} ngày` : 'Không quá hạn' },
          { label: 'Tiền cọc đã thu', value: formatCurrency(deposit) },
          {
            label: 'Cam kết hoàn cọc',
            value: preview.depositRefundSlaDays ? `Trong ${preview.depositRefundSlaDays} ngày làm việc` : '—',
          },
        ]}
      />
      <div className="flex justify-end border-t border-line pt-4">
        <Button rightIcon={ArrowRight} onClick={onNext}>
          Tiếp tục nghiệm thu
        </Button>
      </div>
    </div>
  )
}
