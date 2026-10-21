import { useState } from 'react'
import type { RentalContract } from '../../../types'
import { ContractOtpModal } from '../ContractOtpModal'
import { DocuSealSimulationModal } from '../DocuSealSimulationModal'

interface ContractSigningFlowProps {
  contract: RentalContract
  onClose: () => void
  onSigned: (contract: RentalContract) => void
}

/**
 * Electronic signing: OTP by email first, then DocuSeal (redirect) or, while DocuSeal is not
 * configured, the in-app signature pad. Only one dialog is open at a time.
 */
export function ContractSigningFlow({ contract, onClose, onSigned }: ContractSigningFlowProps) {
  const [step, setStep] = useState<'otp' | 'sign'>('otp')

  if (step === 'otp') {
    return <ContractOtpModal contract={contract} onClose={onClose} onOpenSimulationSign={() => setStep('sign')} />
  }
  return <DocuSealSimulationModal contract={contract} onClose={onClose} onSignedSuccess={onSigned} />
}
