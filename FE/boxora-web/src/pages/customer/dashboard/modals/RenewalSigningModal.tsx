import { useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Alert, Button, Checkbox, DescriptionList, Modal, useToast } from '@/components/ui'
import { SignaturePad, type SignaturePadHandle } from '@/components/modals/contract/SignaturePad'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import { contractService, type ContractRenewal } from '@/services/contractService'

interface RenewalSigningModalProps {
  renewal: ContractRenewal
  onClose: () => void
  onSigned: (renewal: ContractRenewal) => void
}

/**
 * Signs a renewal addendum in the portal. Only used while DocuSeal is not configured (test
 * environment); the backend rejects it otherwise and stores the drawn signature, no PDF.
 */
export function RenewalSigningModal({ renewal, onClose, onSigned }: RenewalSigningModalProps) {
  const toast = useToast()
  const padRef = useRef<SignaturePadHandle>(null)
  const [hasInk, setHasInk] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const signature = padRef.current?.toDataUrl()
    if (!signature || !hasInk) {
      setError('Vui lòng ký vào ô chữ ký.')
      return
    }
    setSigning(true)
    setError(null)
    try {
      const updated = await contractService.mockSignRenewal(renewal.id, signature)
      toast.success('Đã ký phụ lục gia hạn', updated.status === 'COMPLETED' ? 'Hợp đồng đã được gia hạn.' : 'Hãy thanh toán phí gia hạn để hoàn tất.')
      onSigned(updated)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không ký được phụ lục. Vui lòng thử lại.'))
    } finally {
      setSigning(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!signing}
      size="lg"
      title="Ký phụ lục gia hạn"
      description={`Hợp đồng ${renewal.contractCode || '—'} · kho ${renewal.unitCode || '—'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={signing}>
            Ký sau
          </Button>
          <Button onClick={() => void submit()} loading={signing} disabled={!hasInk || !agreed}>
            Ký phụ lục
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Alert tone="warning" title="Môi trường thử nghiệm">
          Hệ thống chưa kết nối dịch vụ ký số DocuSeal. Chữ ký được lưu trên Boxora; phụ lục không có tệp PDF ký số.
        </Alert>
        <DescriptionList
          layout="inline"
          className="rounded-lg border border-line bg-surface-2 p-4"
          items={[
            { label: 'Gia hạn thêm', value: `${renewal.cycleMonths} tháng` },
            { label: 'Hết hạn hiện tại', value: formatDate(renewal.oldEndDate) },
            { label: 'Hết hạn mới', value: formatDate(renewal.newEndDate) },
            { label: 'Phí gia hạn', value: <span className="tabular-nums">{formatCurrency(renewal.renewalFee)}</span> },
          ]}
        />
        <section aria-label="Chữ ký" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg">Chữ ký của bên thuê</h3>
          <SignaturePad ref={padRef} disabled={signing} onInkChange={setHasInk} />
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" leftIcon={Eraser} disabled={!hasInk || signing} onClick={() => padRef.current?.clear()}>
              Xóa và ký lại
            </Button>
          </div>
          <Checkbox
            checked={agreed}
            onCheckedChange={setAgreed}
            disabled={signing}
            label="Tôi đồng ý gia hạn hợp đồng theo thời hạn và mức phí nêu trên."
            description="Các điều khoản khác của hợp đồng gốc giữ nguyên hiệu lực."
          />
        </section>
        {error ? (
          <Alert tone="danger" title="Chưa ký được phụ lục">
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}
