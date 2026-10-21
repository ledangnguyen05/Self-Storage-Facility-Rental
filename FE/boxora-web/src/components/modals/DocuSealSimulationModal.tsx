import { useMemo, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import type { RentalContract } from '../../types'
import { contractService } from '../../services/contractService'
import { useAuth } from '../../context/AuthContext'
import { SITE_CONFIG } from '../../constants/siteConfig'
import { getApiErrorMessage } from '../../lib/apiError'
import { formatCurrency, formatDate } from '../../lib/format'
import { Alert, Button, Checkbox, DescriptionList, Field, Input, Modal, Tabs, useToast, type TabItem } from '../ui'
import { SignaturePad, type SignaturePadHandle } from './contract/SignaturePad'
import { buildTypedSignatureDataUrl, normalizeSignatureName, SIGNATURE_NAME_MAX_LENGTH } from './shared/signature'

interface DocuSealSimulationModalProps {
  contract: RentalContract
  onClose: () => void
  onSignedSuccess: (updated: RentalContract) => void
}

type SignatureMode = 'draw' | 'type'

const MODE_ITEMS: TabItem<SignatureMode>[] = [
  { value: 'draw', label: 'Vẽ chữ ký' },
  { value: 'type', label: 'Ký theo tên' },
]

const MIN_TYPED_NAME_LENGTH = 2

/**
 * In-app signing of a contract, used while DocuSeal is not configured (test environment).
 * The backend accepts it only after the OTP step (ContractOtpModal) and stores the
 * signature image; no signed PDF is produced. With DocuSeal configured the OTP step
 * redirects to DocuSeal instead and this dialog is never shown.
 */
export function DocuSealSimulationModal({ contract, onClose, onSignedSuccess }: DocuSealSimulationModalProps) {
  const { user } = useAuth()
  const toast = useToast()
  const customerName = contract.customerName || user?.fullName || ''
  const padRef = useRef<SignaturePadHandle>(null)

  const [mode, setMode] = useState<SignatureMode>('draw')
  const [typedName, setTypedName] = useState(customerName)
  const [hasInk, setHasInk] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typedSignature = useMemo(
    () => (normalizeSignatureName(typedName).length >= MIN_TYPED_NAME_LENGTH ? buildTypedSignatureDataUrl(typedName) : null),
    [typedName],
  )
  const hasSignature = mode === 'draw' ? hasInk : Boolean(typedSignature)
  const canSign = agreed && hasSignature && !isSigning

  let blockedReason: string | null = null
  if (!hasSignature) blockedReason = mode === 'draw' ? 'Vẽ chữ ký của bạn để tiếp tục.' : 'Nhập họ tên để tạo chữ ký.'
  else if (!agreed) blockedReason = 'Đánh dấu xác nhận đồng ý với điều khoản để ký.'

  const handleSign = async () => {
    if (!canSign) return
    const signatureData = mode === 'draw' ? padRef.current?.toDataUrl() : typedSignature
    if (!signatureData) {
      setError('Chưa có chữ ký. Vui lòng ký lại.')
      return
    }

    setIsSigning(true)
    setError(null)
    try {
      const updated = await contractService.mockSignContract(contract.id, signatureData)
      // New object: the API response is never mutated.
      const signed: RentalContract = { ...contract, ...updated, signatureData: updated?.signatureData ?? signatureData }
      // The only success toast of the signing flow: callers just close and reload.
      toast.success('Đã ký hợp đồng điện tử', `Hợp đồng ${contract.contractCode} đã được ký trong môi trường thử nghiệm.`)
      onSignedSuccess(signed)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Ký hợp đồng thất bại. Vui lòng thử lại.'))
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Ký hợp đồng điện tử"
      description={`Hợp đồng ${contract.contractCode}`}
      dismissible={!isSigning}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSigning}>
            Ký sau
          </Button>
          <Button onClick={() => void handleSign()} loading={isSigning} disabled={!canSign}>
            Ký hợp đồng
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Alert tone="warning" title="Môi trường thử nghiệm">
          Hệ thống chưa kết nối dịch vụ ký số DocuSeal. Chữ ký của bạn được lưu trên Boxora sau khi xác thực OTP qua email; hợp đồng
          không có tệp PDF ký số. Bạn có thể ký bản giấy tại quầy khi nhận kho.
        </Alert>
        <section aria-label="Tóm tắt hợp đồng" className="rounded-lg border border-line bg-surface-2 p-4">
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Bên cho thuê', value: SITE_CONFIG.company.legalName },
              { label: 'Bên thuê', value: customerName },
              { label: 'Ngăn kho', value: contract.unitCode, mono: true },
              { label: 'Cơ sở', value: contract.facilityName },
              { label: 'Thời hạn thuê', value: `${formatDate(contract.startDate)} - ${formatDate(contract.endDate)}` },
              { label: 'Giá thuê', value: <span className="tabular-nums">{formatCurrency(contract.monthlyFee)}/tháng</span> },
              { label: 'Tiền đặt cọc', value: <span className="tabular-nums">{formatCurrency(contract.depositHeld)}</span> },
              { label: 'Liên hệ bên thuê', value: [contract.customerEmail || user?.email, contract.customerPhone || user?.phone].filter(Boolean).join(' · ') },
            ]}
          />
          <ul className="mt-4 list-disc space-y-1 border-t border-line pt-3 pl-5 text-dense text-fg-muted">
            <li>Bên thuê cam kết không lưu trữ hàng cấm, vũ khí, chất cháy nổ hoặc động vật sống.</li>
            <li>Mã PIN truy cập được kích hoạt theo quy trình bàn giao của cơ sở.</li>
            <li>Thanh toán định kỳ theo chính sách của cơ sở.</li>
          </ul>
        </section>

        <section aria-label="Chữ ký" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">Chữ ký của bên thuê</h3>
            <Tabs variant="segmented" size="sm" aria-label="Cách ký" items={MODE_ITEMS} value={mode} onValueChange={setMode} />
          </div>

          <div className={mode === 'draw' ? 'flex flex-col gap-2' : 'hidden'}>
            <SignaturePad ref={padRef} disabled={isSigning} onInkChange={setHasInk} />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={Eraser}
                disabled={!hasInk || isSigning}
                onClick={() => padRef.current?.clear()}
              >
                Xóa và ký lại
              </Button>
            </div>
          </div>

          {mode === 'type' ? (
            <div className="flex flex-col gap-3">
              <Field label="Họ và tên" required hint="Tên này sẽ được dùng làm chữ ký của bạn.">
                <Input
                  value={typedName}
                  maxLength={SIGNATURE_NAME_MAX_LENGTH}
                  autoComplete="name"
                  onChange={event => setTypedName(event.target.value)}
                  disabled={isSigning}
                />
              </Field>
              <div className="flex h-24 items-center justify-center rounded-lg border border-line-strong bg-surface px-3">
                {typedSignature ? (
                  <img src={typedSignature} alt={`Chữ ký: ${normalizeSignatureName(typedName)}`} className="h-20 w-full select-none object-contain" />
                ) : (
                  <span className="text-sm text-fg-subtle">Chữ ký sẽ hiển thị tại đây</span>
                )}
              </div>
            </div>
          ) : null}

          <Checkbox
            checked={agreed}
            onCheckedChange={setAgreed}
            disabled={isSigning}
            label="Tôi đã đọc, hiểu và đồng ý với các điều khoản của hợp đồng thuê kho."
            description="Chữ ký điện tử có giá trị như chữ ký của tôi. Hiệu lực hợp đồng và thời hạn thuê chính thức bắt đầu khi tôi hoàn tất check-in tại cơ sở."
          />

          {blockedReason && !isSigning ? <p className="text-dense text-fg-subtle">{blockedReason}</p> : null}
        </section>

        {error ? (
          <Alert tone="danger" title="Chưa ký được hợp đồng">
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}
