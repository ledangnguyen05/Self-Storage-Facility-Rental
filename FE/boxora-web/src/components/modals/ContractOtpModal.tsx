import { FormEvent, useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import type { RentalContract } from '../../types'
import { contractService } from '../../services/contractService'
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiError'
import { Alert, Button, Field, Input, Modal } from '../ui'

interface ContractOtpModalProps {
  contract: RentalContract
  onClose: () => void
  /**
   * Called when the backend answers with the in-app signing link (DocuSeal not configured, test
   * environment). The caller swaps this dialog for the signature pad; the OTP stays verified.
   */
  onOpenSimulationSign?: (contract: RentalContract) => void
}

const OTP_LENGTH = 6
const FORM_ID = 'contract-otp-form'
/** Marker of the in-app signing link returned by the backend in the test environment. */
const IN_APP_SIGNING_MARKER = 'mockSignContractId='
/** ErrorCode.CONTRACT_OTP_ALREADY_VERIFIED: the customer verified earlier and can go straight to signing. */
const OTP_ALREADY_VERIFIED = 1513

function maskEmail(email: string | undefined) {
  if (!email) return ''
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`
}

/** Only http(s) links (absolute or same-origin) may be navigated to. */
function isNavigableUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/**
 * Step 1 of electronic signing: a 6-digit OTP is emailed to the customer and verified before the
 * signing link (DocuSeal, or the in-app pad in the test environment) is released.
 */
export function ContractOtpModal({ contract, onClose, onOpenSimulationSign }: ContractOtpModalProps) {
  const [otp, setOtp] = useState('')
  const [hasSentOtp, setHasSentOtp] = useState(false)
  const [resendInSeconds, setResendInSeconds] = useState(0)
  const [expiresInSeconds, setExpiresInSeconds] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const countdownActive = hasSentOtp && (resendInSeconds > 0 || expiresInSeconds > 0)
  const busy = isSending || isVerifying

  useEffect(() => {
    if (!countdownActive) return
    const timer = window.setInterval(() => {
      setResendInSeconds(seconds => Math.max(0, seconds - 1))
      setExpiresInSeconds(seconds => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countdownActive])

  /** Opens the signing step for a link returned by the backend. */
  const openSigning = (signingUrl: string | undefined) => {
    if (!signingUrl) throw new Error('Không nhận được liên kết ký hợp đồng.')
    if (signingUrl.includes(IN_APP_SIGNING_MARKER) && onOpenSimulationSign) {
      onOpenSimulationSign(contract)
      return
    }
    if (!isNavigableUrl(signingUrl)) throw new Error('Liên kết ký hợp đồng không hợp lệ.')
    window.location.assign(signingUrl)
  }

  const sendOtp = async (resend = false) => {
    setIsSending(true)
    setError(null)
    try {
      const result = resend
        ? await contractService.resendSigningOtp(contract.id)
        : await contractService.sendSigningOtp(contract.id)
      setHasSentOtp(true)
      setOtp('')
      setResendInSeconds(result.resendInSeconds)
      setExpiresInSeconds(result.expiresInSeconds)
    } catch (requestError) {
      if (getApiErrorCode(requestError) === OTP_ALREADY_VERIFIED) {
        try {
          openSigning(await contractService.getSigningUrl(contract.id))
          return
        } catch (signingError) {
          setError(getApiErrorMessage(signingError, 'Không lấy được liên kết ký hợp đồng. Vui lòng thử lại.'))
          return
        }
      }
      setError(getApiErrorMessage(requestError, 'Không thể gửi mã OTP. Vui lòng thử lại.'))
    } finally {
      setIsSending(false)
    }
  }

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) {
      setError(`Vui lòng nhập mã OTP gồm ${OTP_LENGTH} chữ số.`)
      return
    }
    setIsVerifying(true)
    setError(null)
    try {
      const result = await contractService.verifySigningOtp(contract.id, otp)
      openSigning(result.signingUrl)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng thử lại.'))
    } finally {
      setIsVerifying(false)
    }
  }

  const maskedEmail = maskEmail(contract.customerEmail)

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Xác thực ký hợp đồng"
      description={`Hợp đồng ${contract.contractCode}`}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          {hasSentOtp ? (
            <Button type="submit" form={FORM_ID} loading={isVerifying} disabled={otp.length !== OTP_LENGTH || isSending}>
              Xác thực và ký
            </Button>
          ) : (
            <Button onClick={() => void sendOtp()} loading={isSending}>
              Gửi mã OTP
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info" icon={Mail} title="Mã xác thực gửi qua email">
          <span className="font-mono text-fg">{maskedEmail || 'Email trong hồ sơ của bạn'}</span>
          <span className="mt-1 block text-dense">
            {hasSentOtp
              ? 'Nhập mã gồm 6 chữ số trong email để tiếp tục ký hợp đồng điện tử.'
              : 'Nhấn "Gửi mã OTP" để nhận mã xác thực qua email, sau đó tiếp tục ký hợp đồng điện tử.'}
          </span>
        </Alert>

        {hasSentOtp ? (
          <form id={FORM_ID} onSubmit={event => void handleVerify(event)} className="flex flex-col gap-3" noValidate>
            <Field
              label={`Mã OTP gồm ${OTP_LENGTH} chữ số`}
              required
              hint={
                expiresInSeconds > 0 ? (
                  <>
                    Mã hết hạn sau <span className="tabular-nums">{formatCountdown(expiresInSeconds)}</span>
                  </>
                ) : (
                  'Mã OTP đã hết hạn. Hãy gửi lại mã mới.'
                )
              }
            >
              <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={OTP_LENGTH}
                value={otp}
                onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                placeholder="000000"
                size="lg"
                className="text-center font-mono tracking-widest tabular-nums"
              />
            </Field>
            <div className="flex justify-end">
              <Button
                variant="link"
                size="sm"
                disabled={isSending || resendInSeconds > 0}
                loading={isSending}
                onClick={() => void sendOtp(true)}
              >
                {resendInSeconds > 0 ? `Gửi lại sau ${resendInSeconds} giây` : 'Gửi lại mã'}
              </Button>
            </div>
          </form>
        ) : null}

        {error ? (
          <Alert tone="danger" title={hasSentOtp ? 'Chưa xác thực được mã OTP' : 'Chưa gửi được mã OTP'}>
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}
