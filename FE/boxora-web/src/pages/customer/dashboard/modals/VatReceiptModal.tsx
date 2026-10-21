import { Printer } from 'lucide-react'
import { Badge, Button, DescriptionList, Modal } from '@/components/ui'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { SITE_CONFIG } from '@/constants/siteConfig'
import { getPaymentMethodMeta, getPaymentStatusMeta, getPaymentTypeMeta } from '@/constants/statusMeta'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { PaymentItem } from '@/services/paymentService'
import type { User } from '@/types'

interface VatReceiptModalProps {
  payment: PaymentItem
  user: User | null
  onClose: () => void
}

/**
 * Payment receipt built only from the payment record and the company facts in
 * siteConfig. The backend returns no VAT breakdown, so none is invented: the
 * receipt shows the amount actually paid.
 */
export function VatReceiptModal({ payment, user, onClose }: VatReceiptModalProps) {
  const status = getPaymentStatusMeta(payment.status)
  const type = getPaymentTypeMeta(payment.paymentType)
  const reference = payment.transactionId || payment.id

  return (
    <Modal
      open
      onClose={onClose}
      title="Biên lai thanh toán"
      description={
        <>
          Mã tra cứu <span className="font-mono">{reference}</span>
        </>
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" leftIcon={Printer} onClick={() => window.print()}>
            In biên lai
          </Button>
          <Button onClick={onClose}>Đóng</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{SITE_CONFIG.company.legalName}</p>
            <p className="text-dense text-fg-muted">
              Mã số thuế {SITE_CONFIG.company.taxId} · Hotline {SITE_CONFIG.hotline.display}
            </p>
            <p className="text-dense text-fg-muted">Cơ sở: {payment.facilityName ? formatFacilityName(payment.facilityName) : '—'}</p>
          </div>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>

        <DescriptionList
          columns={2}
          items={[
            { label: 'Người thanh toán', value: user?.fullName || payment.customerName || '—' },
            { label: 'Email', value: user?.email || '—' },
            { label: 'Kho', value: payment.unitCode || '—', mono: true },
            { label: 'Mã đặt chỗ', value: payment.bookingCode || '—', mono: true },
            { label: 'Phương thức', value: payment.paymentMethod ? getPaymentMethodMeta(payment.paymentMethod).label : '—' },
            { label: 'Thời gian', value: formatDateTime(payment.paymentTime || payment.createdAt) },
          ]}
        />

        <div className="overflow-hidden rounded-lg border border-line">
          <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2 px-4 py-2 text-dense font-medium text-fg-muted">
            <span>Nội dung</span>
            <span>Số tiền</span>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-fg">
                {type.label}
                {payment.unitCode ? ` · kho ${payment.unitCode}` : ''}
              </p>
              <p className="break-all text-xs text-fg-muted">Mã giao dịch {reference}</p>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-fg">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
            <span className="text-sm font-medium text-fg">Tổng thanh toán</span>
            <span className="text-base font-semibold tabular-nums text-fg">{formatCurrency(payment.amount)}</span>
          </div>
        </div>

        <p className="text-dense text-fg-muted">
          Cần hóa đơn giá trị gia tăng? Gửi yêu cầu kèm mã tra cứu tới{' '}
          <a href={SITE_CONFIG.supportEmailHref} className="text-accent-text underline-offset-2 hover:underline">
            {SITE_CONFIG.supportEmail}
          </a>
          .
        </p>
      </div>
    </Modal>
  )
}
