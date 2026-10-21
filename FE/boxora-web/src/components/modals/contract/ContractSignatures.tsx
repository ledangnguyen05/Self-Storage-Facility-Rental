import { useState, type ReactNode } from 'react'
import { PenLine } from 'lucide-react'
import type { RentalContract } from '../../../types'
import { SITE_CONFIG } from '../../../constants/siteConfig'
import { getContractStatusMeta } from '../../../constants/statusMeta'
import { formatDateTime } from '../../../lib/format'
import { cn } from '../../ui'
import { toSignatureImageSrc } from '../shared/signature'
import { isContractSigned } from './contractState'

const BOX = 'my-3 flex h-32 w-52 max-w-full flex-col items-center justify-between rounded-lg border p-3 text-center'

/** The signature image comes only from stored signature data and is rendered as <img>, never as markup. */
function SignatureImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="text-dense text-fg-muted">Không hiển thị được hình chữ ký</span>
  return <img src={src} alt={alt} onError={() => setFailed(true)} className="h-16 w-full select-none object-contain" />
}

function SignatureBox({ children, footer, dashed = false }: { children: ReactNode; footer?: ReactNode; dashed?: boolean }) {
  return (
    <div className={cn(BOX, dashed ? 'justify-center border-dashed border-line-strong bg-surface-2' : 'border-line bg-surface')}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">{children}</div>
      {footer ? <div className="w-full border-t border-line pt-1.5 text-xs tabular-nums text-fg-muted">{footer}</div> : null}
    </div>
  )
}

export function ContractSignatures({ contract }: { contract: RentalContract }) {
  const signed = isContractSigned(contract)
  const customerName = contract.customerName || 'Khách hàng'
  const signatureSrc = signed ? toSignatureImageSrc(contract.signatureData) : null
  const statusMeta = getContractStatusMeta(contract.status)
  const signedAtText = contract.signedAt ? `Ký lúc ${formatDateTime(contract.signedAt)}` : null

  return (
    <div className="grid grid-cols-2 gap-6 text-center text-sm break-inside-avoid">
      <div className="flex flex-col items-center">
        <span className="font-semibold text-fg">Đại diện bên cho thuê (Bên A)</span>
        <span className="text-xs text-fg-muted">{SITE_CONFIG.company.shortName}</span>
        {signed ? (
          <SignatureBox footer={signedAtText}>
            <span className="text-dense font-medium text-fg">Đã ký điện tử</span>
          </SignatureBox>
        ) : (
          <SignatureBox dashed>
            <span className="text-dense text-fg-muted">Chưa ký</span>
          </SignatureBox>
        )}
        <span className="text-xs text-fg-muted">{contract.facilityName}</span>
      </div>

      <div className="flex flex-col items-center">
        <span className="font-semibold text-fg">Đại diện bên thuê kho (Bên B)</span>
        <span className="text-xs text-fg-muted">{customerName}</span>
        {signed ? (
          <SignatureBox footer={signedAtText}>
            {signatureSrc ? (
              <SignatureImage src={signatureSrc} alt={`Chữ ký của ${customerName}`} />
            ) : (
              <span className="text-dense font-medium text-fg">
                {contract.signingMethod === 'IN_PERSON' || contract.signingMethod === 'PAPER'
                  ? 'Đã ký tại quầy'
                  : contract.signingMethod === 'ELECTRONIC_TEST'
                    ? 'Đã ký (môi trường thử nghiệm)'
                    : 'Đã ký điện tử'}
              </span>
            )}
          </SignatureBox>
        ) : contract.status === 'PENDING_SIGNATURE' ? (
          <SignatureBox dashed>
            <PenLine size={20} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
            <span className="text-dense font-medium text-fg">Chờ khách hàng ký</span>
          </SignatureBox>
        ) : (
          <SignatureBox dashed>
            <span className="text-dense text-fg-muted">{statusMeta.label}</span>
          </SignatureBox>
        )}
        <span className="break-all font-mono text-xs text-fg-muted">{contract.customerEmail}</span>
      </div>
    </div>
  )
}
