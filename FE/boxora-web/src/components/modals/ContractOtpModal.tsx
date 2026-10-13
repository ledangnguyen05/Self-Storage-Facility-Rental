import { FormEvent, useEffect, useState } from 'react'
import { RentalContract } from '../../types'
import { contractService } from '../../services/contractService'

interface ContractOtpModalProps {
  contract: RentalContract
  onClose: () => void
  onOpenSimulationSign?: (contract: RentalContract) => void
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không thể xử lý yêu cầu OTP. Vui lòng thử lại.'
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`
}

export function ContractOtpModal({ contract, onClose, onOpenSimulationSign }: ContractOtpModalProps) {
  const [otp, setOtp] = useState('')
  const [hasSentOtp, setHasSentOtp] = useState(false)
  const [resendInSeconds, setResendInSeconds] = useState(0)
  const [expiresInSeconds, setExpiresInSeconds] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const countdownActive = hasSentOtp && (resendInSeconds > 0 || expiresInSeconds > 0)

  useEffect(() => {
    if (!countdownActive) return
    const timer = window.setInterval(() => {
      setResendInSeconds(seconds => Math.max(0, seconds - 1))
      setExpiresInSeconds(seconds => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countdownActive])

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
      setError(getErrorMessage(requestError))
    } finally {
      setIsSending(false)
    }
  }

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      setError('Vui lòng nhập mã OTP gồm 6 chữ số.')
      return
    }
    setIsVerifying(true)
    setError(null)
    try {
      const result = await contractService.verifySigningOtp(contract.id, otp)
      if (!result.signingUrl) {
        throw new Error('Không nhận được liên kết ký hợp đồng.')
      }

      if (result.signingUrl.includes('mockSignContractId=') && onOpenSimulationSign) {
        onOpenSimulationSign(contract)
        onClose()
      } else {
        window.location.assign(result.signingUrl)
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-otp-title"
        className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <span className="material-symbols-outlined">verified_user</span>
            </div>
            <h2 id="contract-otp-title" className="text-lg font-bold text-slate-900">
              Xác thực ký hợp đồng
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Hợp đồng <strong className="text-slate-700">{contract.contractCode}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-700">
          <p className="font-semibold">Mã xác thực gửi tới email</p>
          <p className="mt-1 font-mono text-cyan-800">{maskEmail(contract.customerEmail)}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Mã OTP có hiệu lực 5 phút. Sau khi xác thực, bạn sẽ tiếp tục ký điện tử trên DocuSeal.
          </p>
        </div>

        {!hasSentOtp ? (
          <button
            type="button"
            onClick={() => void sendOtp()}
            disabled={isSending}
            className="w-full rounded-lg bg-cyan-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? 'Đang gửi mã...' : 'Gửi mã OTP'}
          </button>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <label htmlFor="contract-otp" className="block text-xs font-semibold text-slate-700">
              Nhập mã OTP gồm 6 chữ số
            </label>
            <input
              id="contract-otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-12 w-full rounded-lg border border-slate-300 text-center font-mono text-xl tracking-[0.5em] text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="••••••"
              aria-invalid={Boolean(error)}
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{expiresInSeconds > 0 ? `Mã hết hạn sau ${Math.ceil(expiresInSeconds / 60)} phút` : 'Mã OTP đã hết hạn'}</span>
              <button
                type="button"
                disabled={isSending || resendInSeconds > 0}
                onClick={() => void sendOtp(true)}
                className="font-semibold text-cyan-700 hover:text-cyan-900 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isSending ? 'Đang gửi...' : resendInSeconds > 0 ? `Gửi lại sau ${resendInSeconds}s` : 'Gửi lại mã'}
              </button>
            </div>
            <button
              type="submit"
              disabled={isVerifying || otp.length !== 6}
              className="w-full rounded-lg bg-cyan-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifying ? 'Đang xác thực...' : 'Xác thực và tiếp tục ký'}
            </button>
          </form>
        )}

        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">{error}</p>}
      </section>
    </div>
  )
}
