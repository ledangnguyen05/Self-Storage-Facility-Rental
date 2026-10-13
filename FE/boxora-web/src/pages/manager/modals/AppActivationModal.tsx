import React, { useState } from 'react'

interface AppActivationModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'HANDOVER' | 'REISSUE'
  unit: {
    id: string
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

  if (!isOpen) return null

  const isReissue = mode === 'REISSUE'

  const handleCopy = () => {
    navigator.clipboard?.writeText(activationPin)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegeneratePin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString()
    setActivationPin(newPin)
  }

  const handleSend = () => {
    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      if (isReissue) {
        onCompleteActivation(`Đã cấp lại mã PIN mới (${activationPin}) cho khách hàng ${unit.tenant} thành công!`)
      } else {
        onCompleteActivation(`Đã bàn giao mã kích hoạt PIN ${activationPin} và gửi hướng dẫn Boxora App cho khách hàng ${unit.tenant}!`)
      }
      onClose()
    }, 800)
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
                {isReissue 
                  ? 'Khách hàng đang thuê yêu cầu cấp lại mã PIN hoặc đổi thiết bị di động mới'
                  : 'Cấp quyền truy cập SmartLock & ứng dụng di động cho khách nhận kho mới'}
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
            <span className="text-slate-500">Mã hợp đồng điện tử:</span>
            <span className="font-mono font-bold text-orange-600">{unit.contract}</span>
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
            <span className="text-[8px] font-mono font-bold text-slate-600 mt-0.5">SCAN IN APP</span>
          </div>

          {/* Activation PIN Code */}
          <div className="flex flex-col gap-1.5 flex-1 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-blue-950">
                {isReissue ? 'Mã PIN Mới Cấp Lại (1-Lần):' : 'Mã PIN Kích Hoạt 1-Lần:'}
              </span>
              <button
                type="button"
                onClick={handleRegeneratePin}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">refresh</span> Đổi mã
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-white rounded-lg border border-blue-300 font-mono text-2xl font-black text-slate-900 tracking-widest text-center flex-1 shadow-2xs">
                {activationPin}
              </div>
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
              {isReissue 
                ? '• Có hiệu lực trong 24 giờ. Mã PIN cũ sẽ bị vô hiệu hóa ngay khi mã mới được kích hoạt.'
                : '• Có hiệu lực trong 72 giờ để khách liên kết thiết bị lần đầu.'}
            </span>
          </div>
        </div>

        {/* Handover Channels Options */}
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
            {isReissue ? 'Kênh gửi thông báo mã PIN mới' : 'Kênh phát hành thông tin bàn giao'}
          </span>
          <div className="flex flex-col gap-1.5 text-xs">
            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={sendSMS}
                onChange={(e) => setSendSMS(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
              <span className="text-slate-800 font-medium">
                {isReissue 
                  ? 'Gửi tin nhắn SMS Brandname chứa mã PIN khôi phục' 
                  : 'Gửi tin nhắn SMS Brandname kèm mã PIN và đường link tải ứng dụng Boxora'}
              </span>
            </label>
            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
              <span className="text-slate-800 font-medium">
                {isReissue 
                  ? 'Gửi Email xác nhận thay đổi thông tin bảo mật SmartLock' 
                  : 'Gửi Email chính thức kèm Hướng dẫn quy trình ra vào kho an toàn 24/7'}
              </span>
            </label>
            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={sendZalo}
                onChange={(e) => setSendZalo(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
              <span className="text-slate-800 font-medium">
                Gửi thông báo xác nhận qua Zalo ZNS (Doanh nghiệp)
              </span>
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
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-neutral-800 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSending ? 'animate-spin' : ''}`}>
              {isSending ? 'sync' : 'send'}
            </span>
            <span>{isSending ? 'Đang xử lý...' : (isReissue ? 'Cấp Lại & Gửi PIN Cho Khách' : 'Bàn Giao & Gửi Cho Khách')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
