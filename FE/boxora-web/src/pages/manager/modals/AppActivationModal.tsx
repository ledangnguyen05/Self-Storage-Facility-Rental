import React, { useState, useEffect } from 'react'
import { bookingService } from '../../../services/bookingService'

interface AppActivationModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'HANDOVER' | 'REISSUE'
  unit: {
    id: string
    backendId?: string
    bookingId?: string
    tenant: string
    contract: string
    smartlock: string
    type: string
  }
  onCompleteActivation: (msg: string) => void
}

export const AppActivationModal: React.FC<AppActivationModalProps> = ({
  isOpen,
  onClose,
  mode = 'HANDOVER',
  unit,
  onCompleteActivation
}) => {
  const [activationPin, setActivationPin] = useState('849201')
  const [copied, setCopied] = useState(false)
  const [sendSMS, setSendSMS] = useState(true)
  const [sendEmail, setSendEmail] = useState(true)
  const [sendZalo, setSendZalo] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingPin, setIsLoadingPin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isReissue = mode === 'REISSUE'

  const generateSecurePin = (): string => {
    const array = new Uint32Array(1)
    window.crypto.getRandomValues(array)
    return String(100000 + (array[0] % 900000))
  }

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      loadCurrentPin()
    }
  }, [isOpen, unit.backendId, unit.bookingId])

  const loadCurrentPin = async () => {
    if (!unit.backendId && !unit.bookingId) {
      setActivationPin(generateSecurePin())
      return
    }

    setIsLoadingPin(true)
    try {
      let res: { pin?: string } | null = null
      if (unit.backendId) {
        res = await bookingService.getBookingPinByUnit(unit.backendId)
      } else if (unit.bookingId) {
        res = await bookingService.getBookingPin(unit.bookingId)
      }

      if (res?.pin) {
        setActivationPin(res.pin)
      } else {
        setActivationPin(generateSecurePin())
      }
    } catch {
      // If error or not yet provisioned, generate secure PIN
      setActivationPin(generateSecurePin())
    } finally {
      setIsLoadingPin(false)
    }
  }

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard?.writeText(activationPin)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegeneratePin = () => {
    setActivationPin(generateSecurePin())
  }

  const handleSend = async () => {
    if (!/^\d{6}$/.test(activationPin)) {
      setErrorMessage('Mã PIN phải bao gồm đúng 6 chữ số.')
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      if (unit.backendId) {
        await bookingService.updatePinByUnit(unit.backendId, activationPin)
      } else if (unit.bookingId) {
        await bookingService.updatePin(unit.bookingId, activationPin)
      }

      if (isReissue) {
        onCompleteActivation(`Đã tái cấp mã PIN an toàn AES-256 (${activationPin}) cho kho #${unit.id} (${unit.tenant}) vào CSDL!`)
      } else {
        onCompleteActivation(`Đã kích hoạt và lưu mã PIN AES-256 (${activationPin}) cho kho #${unit.id} (${unit.tenant})!`)
      }
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Lỗi khi lưu mã PIN mã hóa AES-256 vào cơ sở dữ liệu'
      setErrorMessage(msg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isReissue ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
              <span className="material-symbols-outlined text-[26px]">{isReissue ? 'lock_reset' : 'key'}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isReissue ? 'Cấp Lại Mã PIN & Khôi Phục Quyền Mở Khóa' : 'Bàn Giao Mã Kích Hoạt Boxora App Lần Đầu'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bảo mật mã hóa chuẩn AES-256-GCM lưu trữ trực tiếp vào CSDL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Unit Info Summary */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Phòng kho:</span>
            <span className="font-mono font-bold text-slate-900">Kho #{unit.id} ({unit.type})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Khách hàng nhận quyền:</span>
            <span className="font-semibold text-slate-900">{unit.tenant}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Mã hợp đồng:</span>
            <span className="font-mono font-bold text-blue-600">{unit.contract}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Thiết bị SmartLock:</span>
            <span className="font-mono text-slate-800">{unit.smartlock}</span>
          </div>
        </div>

        {/* Master PIN & QR Activation Card */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-blue-50/60 border border-blue-200">
          {/* Simulated QR Code */}
          <div className="w-24 h-24 bg-white p-2 rounded-lg border border-blue-200 shadow-2xs shrink-0 flex flex-col items-center justify-center relative">
            <div className="grid grid-cols-4 gap-1 w-full h-full p-1">
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-300 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-300 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-300 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-300 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
              <div className="bg-slate-900 rounded-xs"></div>
            </div>
            <span className="text-[8px] font-mono font-bold text-slate-600 mt-0.5">AES-256</span>
          </div>

          {/* Activation PIN Code */}
          <div className="flex flex-col gap-1.5 flex-1 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-blue-950 flex items-center gap-1">
                {isReissue ? 'Mã PIN Cấp Lại (AES-256):' : 'Mã PIN Kích Hoạt (AES-256):'}
                {isLoadingPin && <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>}
              </span>
              <button
                type="button"
                onClick={handleRegeneratePin}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">refresh</span> Đổi mã bảo mật
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={activationPin}
                onChange={(e) => setActivationPin(e.target.value.replace(/\D/g, ''))}
                className="px-4 py-2 bg-white rounded-lg border border-blue-300 font-mono text-2xl font-black text-slate-900 tracking-widest text-center flex-1 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="p-2.5 rounded-lg bg-white border border-blue-300 text-blue-800 hover:bg-blue-50 transition-all cursor-pointer shadow-2xs"
                title="Sao chép mã"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
            <span className="text-[10px] text-blue-950 font-medium">
              &bull; Mã PIN sinh ngẫu nhiên an toàn bằng Web Crypto API và lưu mã hóa AES-256-GCM.
            </span>
          </div>
        </div>

        {/* Channels */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2 text-xs">
          <span className="font-semibold text-slate-800">Kênh gửi mã bảo mật tự động:</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input type="checkbox" checked={sendSMS} onChange={(e) => setSendSMS(e.target.checked)} className="rounded text-blue-600" />
              <span>SMS Brandname</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded text-blue-600" />
              <span>Email hóa đơn điện tử</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input type="checkbox" checked={sendZalo} onChange={(e) => setSendZalo(e.target.checked)} className="rounded text-blue-600" />
              <span>Zalo ZNS</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSending ? 'animate-spin' : ''}`}>
              {isSending ? 'sync' : 'security'}
            </span>
            <span>{isSending ? 'Đang mã hóa AES-256 & Lưu...' : 'Lưu Mã PIN AES-256'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
