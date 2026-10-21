import React, { useRef } from 'react'
import { ExternalLink, PenLine, Printer } from 'lucide-react'
import type { RentalContract } from '../../types'
import { getContractStatusMeta } from '../../constants/statusMeta'
import { getApiErrorMessage } from '../../lib/apiError'
import { Alert, Badge, Button, Modal, buttonVariants, useToast } from '../ui'
import { ContractDocument } from './contract/ContractDocument'
import { printElement } from './shared/printElement'

interface ContractDocumentModalProps {
  contract: RentalContract | null
  onClose: () => void
  onSignNow?: (contract: RentalContract) => void
  isSigning?: boolean
}

export const ContractDocumentModal: React.FC<ContractDocumentModalProps> = ({ contract, onClose, onSignNow, isSigning = false }) => {
  if (!contract) return null
  return <ContractViewer contract={contract} onClose={onClose} onSignNow={onSignNow} isSigning={isSigning} />
}

interface ContractViewerProps {
  contract: RentalContract
  onClose: () => void
  onSignNow?: (contract: RentalContract) => void
  isSigning: boolean
}

function ContractViewer({ contract, onClose, onSignNow, isSigning }: ContractViewerProps) {
  const toast = useToast()
  const documentRef = useRef<HTMLDivElement>(null)
  const statusMeta = getContractStatusMeta(contract.status)
  const canSign = contract.status === 'PENDING_SIGNATURE' && Boolean(onSignNow)

  const handlePrint = () => {
    try {
      printElement(documentRef.current, `Hop-dong-${contract.contractCode}`)
    } catch (err) {
      toast.error('Không thể in hợp đồng', getApiErrorMessage(err))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Hợp đồng thuê kho"
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono">{contract.contractCode}</span>
          <Badge tone={statusMeta.tone} dot>
            {statusMeta.label}
          </Badge>
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button variant="secondary" leftIcon={Printer} onClick={handlePrint}>
            In hợp đồng
          </Button>
          {canSign ? (
            <Button leftIcon={PenLine} loading={isSigning} onClick={() => onSignNow?.(contract)}>
              Ký hợp đồng
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {contract.signingMethod === 'ELECTRONIC_TEST' ? (
          <Alert tone="warning" title="Ký trong môi trường thử nghiệm">
            Hợp đồng được ký trong cổng Boxora khi hệ thống chưa kết nối DocuSeal. Văn bản dưới đây hiển thị chữ ký đã lưu; không có tệp PDF
            ký số đi kèm.
          </Alert>
        ) : null}
        {contract.signedDocumentUrl && /^https:\/\//.test(contract.signedDocumentUrl) ? (
          <a
            href={contract.signedDocumentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'self-start' })}
          >
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
            Mở bản ký số (DocuSeal)
          </a>
        ) : null}
        <ContractDocument ref={documentRef} contract={contract} />
      </div>
    </Modal>
  )
}
