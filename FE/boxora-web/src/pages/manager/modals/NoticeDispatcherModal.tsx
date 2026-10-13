import React, { useState } from 'react'

interface NoticeDispatcherModalProps {
  isOpen: boolean
  onClose: () => void
  noticeData: {
    unitCode: string
    tenantName: string
    contractCode: string
    daysOverdue: number
    baseDebt: string
    penaltyFee: string
    totalDebt: string
  }
  onSendNotice: (msg: string) => void
}

export const NoticeDispatcherModal: React.FC<NoticeDispatcherModalProps> = ({
  isOpen,
  onClose,
  noticeData,
  onSendNotice
}) => {
  const [templateType, setTemplateType] = useState<'REMINDER' | 'LOCKOUT_WARNING' | 'SEAL_WARNING'>(
    noticeData.daysOverdue >= 10 ? 'SEAL_WARNING' : 'LOCKOUT_WARNING'
  )
  const [sendSMS, setSendSMS] = useState(true)
  const [sendEmail, setSendEmail] = useState(true)
  const [sendVoiceBot, setSendVoiceBot] = useState(false)
  const [isSending, setIsSending] = useState(false)

  if (!isOpen) return null

  const getMessageContent = () => {
    switch (templateType) {
      case 'REMINDER':
        return `[BOXORA BILLING] Kính gửi ${noticeData.tenantName}, tiền thuê kho #${noticeData.unitCode} (HĐ ${noticeData.contractCode}) đã quá hạn ${noticeData.daysOverdue} ngày. Tổng nợ cần thanh toán: ${noticeData.totalDebt}. Quý khách vui lòng thanh toán để duy trì quyền mở khóa SmartLock. Cổng thanh toán: boxora.vn/pay/${noticeData.contractCode}. Hotline: 1900-BOXORA.`
      case 'LOCKOUT_WARNING':
        return `[BOXORA AN NINH] CẢNH BÁO: Kho #${noticeData.unitCode} của ${noticeData.tenantName} quá hạn ${noticeData.daysOverdue} ngày (Nợ ${noticeData.totalDebt}). Hệ thống sẽ tạm khóa quyền mở SmartLock sau 18:00 hôm nay nếu chưa thanh toán. Vui lòng thanh toán ngay tại boxora.vn/pay/${noticeData.contractCode}.`
      case 'SEAL_WARNING':
        return `[BOXORA PHÁP CHẾ] THÔNG BÁO NIÊM PHONG: HĐ ${noticeData.contractCode} (Kho #${noticeData.unitCode}) của ${noticeData.tenantName} vi phạm quá hạn ${noticeData.daysOverdue} ngày (Nợ ${noticeData.totalDebt}). Ban Quản Lý sẽ tiến hành lập Biên Bản Niêm Phong & kê biên tài sản theo Điều 8 Hợp đồng. Hotline giải quyết khẩn: 0988-BOXORA.`
    }
  }

  const handleSend = () => {
    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      const channels = [sendSMS && 'SMS Brandname', sendEmail && 'Email', sendVoiceBot && 'VoiceBot IVR'].filter(Boolean).join(' & ')
      onSendNotice(`Đã gửi thông báo quá hạn tới ${noticeData.tenantName} (${noticeData.unitCode}) qua kênh ${channels}!`)
      onClose()
    }, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-900">
              <span className="material-symbols-outlined text-[26px]">forward_to_inbox</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Gửi Thông Báo Nợ Cước Quá Hạn</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Phát thông báo nhắc nhở &amp; cảnh báo pháp lý đa kênh
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

        {/* Target Profile Card */}
        <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200 text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Khách hàng nhận thông báo:</span>
            <span className="font-bold text-slate-900">{noticeData.tenantName} ({noticeData.unitCode})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Thời gian quá hạn:</span>
            <span className="font-bold text-rose-700 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              Quá hạn {noticeData.daysOverdue} ngày
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-rose-200/60">
            <span className="text-slate-600">Tổng nợ (Cước + Phạt):</span>
            <span className="font-mono text-sm font-black text-rose-900">{noticeData.totalDebt}</span>
          </div>
        </div>

        {/* Template Selectors */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Mẫu nội dung thông báo</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { type: 'REMINDER' as const, label: 'Nhắc Nợ Đợt 1', desc: 'Thân thiện' },
              { type: 'LOCKOUT_WARNING' as const, label: 'Cảnh Báo Khóa', desc: 'SmartLock' },
              { type: 'SEAL_WARNING' as const, label: 'Niêm Phong Kho', desc: 'Pháp lý' }
            ].map(tpl => (
              <button
                key={tpl.type}
                type="button"
                onClick={() => setTemplateType(tpl.type)}
                className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                  templateType === tpl.type
                    ? 'border-rose-600 bg-rose-50/60 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs block">{tpl.label}</span>
                <span className="text-[10px] text-slate-500 block">{tpl.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Preview */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Xem trước nội dung tin nhắn (SMS &amp; Email)
          </span>
          <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed max-h-28 overflow-y-auto">
            {getMessageContent()}
          </div>
        </div>

        {/* Delivery Channels */}
        <div className="flex flex-col gap-1.5 text-xs">
          <span className="font-semibold text-slate-700">Kênh phát sóng thông báo</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={sendSMS}
                onChange={(e) => setSendSMS(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
              <span className="text-slate-800 font-medium">SMS Brandname</span>
            </label>
            <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
              <span className="text-slate-800 font-medium">Email chính thức</span>
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
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || (!sendSMS && !sendEmail && !sendVoiceBot)}
            className="px-4 py-2 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSending ? 'animate-spin' : ''}`}>
              {isSending ? 'sync' : 'send'}
            </span>
            <span>{isSending ? 'Đang gửi...' : 'Phát Tán Thông Báo Ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
