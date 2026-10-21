import { useMemo, useState } from 'react'
import { ExternalLink, Link2, RefreshCw } from 'lucide-react'
import { Alert, Button, DescriptionList, Field, Modal, Select, SkeletonText } from '@/components/ui'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import { isSafePaymentUrl, paymentService, type VNPayPayment } from '@/services/paymentService'
import type { RentalContract } from '@/types'
import { PaymentLinkPanel } from '../components/PaymentLinkPanel'

interface OutstandingPaymentModalProps {
  contract: RentalContract
  onClose: () => void
  /** Opens the renewal flow instead (overdue contracts). */
  onRenew?: (contract: RentalContract) => void
}

const MAX_PREPAY_OPTIONS = 12

/**
 * Pays what a contract owes today: rent of the monthly periods already started and, for an expired
 * contract, the overdue rent and late fee. Every figure comes from the server; the customer may add
 * upcoming months of the term in advance.
 */
export function OutstandingPaymentModal({ contract, onClose, onRenew }: OutstandingPaymentModalProps) {
  const query = useAsyncData(signal => paymentService.getContractOutstanding(contract.id, { signal }), [contract.id])
  const data = query.data
  const [upcoming, setUpcoming] = useState(0)
  const [payment, setPayment] = useState<VNPayPayment | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const prepayOptions = useMemo(() => {
    const max = Math.min(data?.remainingTermMonths ?? 0, MAX_PREPAY_OPTIONS)
    return Array.from({ length: max + 1 }, (_, months) => ({
      value: String(months),
      label: months === 0 ? 'Không trả trước' : `Trả trước ${months} tháng (${formatCurrency((data?.monthlyRent ?? 0) * months)})`,
    }))
  }, [data?.remainingTermMonths, data?.monthlyRent])

  const total = data ? data.totalDueNow + data.monthlyRent * upcoming : 0
  const canCreate = Boolean(data?.canPayOnline) && total > 0 && !creating

  const createLink = async () => {
    if (!canCreate) return
    setCreating(true)
    setError(null)
    try {
      const created = await paymentService.payContractOutstanding(contract.id, upcoming)
      if (!isSafePaymentUrl(created?.paymentUrl)) throw new Error('Cổng thanh toán trả về liên kết không hợp lệ.')
      setPayment(created)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tạo liên kết thanh toán. Vui lòng thử lại.'))
    } finally {
      setCreating(false)
    }
  }

  const footer = payment ? (
    <>
      <Button variant="secondary" leftIcon={Link2} onClick={() => setPayment(null)}>
        Đổi số tiền
      </Button>
      <Button rightIcon={ExternalLink} onClick={() => window.open(payment.paymentUrl, '_blank', 'noopener,noreferrer')}>
        Mở trang thanh toán
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose} disabled={creating}>
        Đóng
      </Button>
      {data?.overdue && onRenew && contract.renewable ? (
        <Button variant="secondary" leftIcon={RefreshCw} onClick={() => onRenew(contract)} disabled={creating}>
          Gia hạn theo tháng
        </Button>
      ) : null}
      <Button onClick={() => void createLink()} loading={creating} disabled={!canCreate}>
        Tạo liên kết thanh toán
      </Button>
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!creating}
      size="md"
      title={data?.overdue ? 'Thanh toán công nợ quá hạn' : 'Thanh toán tiền thuê'}
      description={`Kho ${contract.unitCode} · ${contract.facilityName ? formatFacilityName(contract.facilityName) : '—'} · Hợp đồng ${contract.contractCode || '—'}`}
      footer={footer}
    >
      {query.isLoading ? (
        <div className="rounded-lg border border-line p-4" aria-busy="true">
          <SkeletonText lines={4} />
        </div>
      ) : query.error || !data ? (
        <Alert
          tone="danger"
          title="Không tải được công nợ"
          action={
            <Button size="sm" variant="secondary" onClick={() => void query.reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(query.error, 'Không thể tính công nợ của hợp đồng.')}
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Tiền thuê hàng tháng', value: <span className="tabular-nums">{formatCurrency(data.monthlyRent)}</span> },
              { label: 'Kỳ đã đến hạn', value: `${data.billedMonths}/${data.termMonths ?? '—'} tháng` },
              { label: 'Đã thanh toán tiền thuê', value: <span className="tabular-nums">{formatCurrency(data.rentPaid)}</span> },
              { label: 'Kỳ tiếp theo', value: data.nextRentDueDate ? formatDate(data.nextRentDueDate) : '—' },
            ]}
          />

          <section className="flex flex-col gap-2 rounded-lg border border-line p-4">
            <h3 className="text-sm font-medium text-fg">Khoản cần thanh toán</h3>
            {data.items.length === 0 ? (
              <p className="text-dense text-fg-muted">Hiện không có khoản nào đến hạn.</p>
            ) : (
              <DescriptionList
                layout="inline"
                items={data.items.map(item => ({
                  key: item.code,
                  label: item.label,
                  value: <span className="tabular-nums">{formatCurrency(item.amount)}</span>,
                }))}
              />
            )}
            {prepayOptions.length > 1 && !payment ? (
              <Field label="Trả trước các tháng tiếp theo" optional hint="Thanh toán trước cho các kỳ chưa đến hạn của hợp đồng.">
                <Select value={String(upcoming)} onChange={event => setUpcoming(Number(event.target.value))} options={prepayOptions} />
              </Field>
            ) : null}
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm font-medium text-fg">Tổng thanh toán</span>
              <span className="text-xl font-semibold tabular-nums text-fg">{formatCurrency(payment?.amount ?? total)}</span>
            </div>
          </section>

          {data.overdue && data.paidThroughAfterSettlement ? (
            <Alert tone="warning" title="Hợp đồng đã hết hạn">
              Sau khi thanh toán, thời hạn thuê được kéo dài đến {formatDate(data.paidThroughAfterSettlement)} (tính theo khối 30 ngày) và quyền truy
              cập kho được mở lại. Nếu muốn thuê tiếp theo tháng, hãy chọn Gia hạn theo tháng.
            </Alert>
          ) : data.note ? (
            <Alert tone="info" icon={null}>
              {data.note}
            </Alert>
          ) : null}
          {!data.canPayOnline && data.blockedReason ? <Alert tone="info">{data.blockedReason}</Alert> : null}
          {error ? (
            <Alert tone="danger" title="Không tạo được liên kết" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          {payment ? <PaymentLinkPanel paymentUrl={payment.paymentUrl} /> : null}
        </div>
      )}
    </Modal>
  )
}
