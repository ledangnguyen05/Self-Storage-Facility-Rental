import React, { useState, useEffect } from 'react'
import { SupportTicketRecord, supportTicketService } from '../../services/supportTicketService'

interface TicketCloseConfirmModalProps {
  isOpen: boolean
  ticket: SupportTicketRecord | null
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export const TicketCloseConfirmModal: React.FC<TicketCloseConfirmModalProps> = ({
  isOpen,
  ticket,
  onClose,
  onSuccess,
}) => {
  const [closingNote, setClosingNote] = useState('Khách hàng xác nhận sự cố đã được xử lý hoàn tất và hài lòng với dịch vụ')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && ticket) {
      setClosingNote('Khách hàng xác nhận sự cố đã được xử lý hoàn tất và hài lòng với dịch vụ')
      setErrorMessage(null)
      setIsSubmitting(false)
    }
  }, [isOpen, ticket])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen || !ticket) return null

  const handleConfirm = async () => {
    if (isSubmitting) return

    // Validate ticket eligibility
    if (ticket.status !== 'RESOLVED') {
      setErrorMessage('Chỉ có thể đóng phiếu khi sự cố đã ở trạng thái ĐÃ XỬ LÝ (RESOLVED).')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const finalNote = closingNote.trim() || 'Khách hàng xác nhận sự cố đã được xử lý hoàn tất'
      await supportTicketService.closeTicket(ticket.id, finalNote)
      await onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to close support ticket:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể đóng phiếu sự cố. Trạng thái phiếu vẫn được giữ nguyên.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (isSubmitting) return
    setErrorMessage(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-ticket-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </div>
            <div>
              <h3 id="close-ticket-title" className="text-base font-bold text-slate-900">
                Xác nhận hài lòng và đóng phiếu
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Mã phiếu: #{ticket.ticketCode || ticket.ticketNumber || ticket.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCancel}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          {/* Main Description */}
          <p className="text-xs text-slate-600 leading-relaxed">
            Vui lòng xác nhận rằng sự cố đã được xử lý và bạn hài lòng với kết quả. Sau khi xác nhận, phiếu sẽ được chuyển sang trạng thái tương ứng theo quy trình xử lý hiện tại.
          </p>

          {/* Ticket Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Tiêu đề sự cố:</span>
              <strong className="text-slate-900 font-semibold">{ticket.title}</strong>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Vị trí / Ngăn kho:</span>
              <span className="font-mono text-slate-800">
                {ticket.unitCode ? `Kho #${ticket.unitCode}` : 'Khu vực chung'} · {ticket.facilityName || 'Boxora Facility'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Trạng thái hiện tại:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ✓ ĐÃ XỬ LÝ (RESOLVED)
              </span>
            </div>

            {ticket.resolutionNote && (
              <div className="pt-1 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Kết quả khắc phục từ nhân viên:
                </span>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                  {ticket.resolutionNote}
                </div>
              </div>
            )}
          </div>

          {/* Customer Confirmation Note */}
          <div className="space-y-1.5">
            <label
              htmlFor="ticket-closing-note"
              className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block"
            >
              Ý kiến hoặc đánh giá của bạn (tùy chọn)
            </label>
            <textarea
              id="ticket-closing-note"
              rows={3}
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              disabled={isSubmitting}
              placeholder="Nhập ghi chú hoặc đánh giá thêm nếu có..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none disabled:opacity-50"
            />
          </div>

          {/* Operational Policy Note */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">info</span>
            <p className="leading-relaxed">
              Sau khi đóng phiếu, hệ thống sẽ lưu biên bản nghiệm thu hoàn tất. Nếu trong tương lai phát sinh vấn đề mới, quý khách có thể gửi yêu cầu hỗ trợ mới bất cứ lúc nào.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0 mt-0.5">error</span>
              <div className="flex-1">
                <p className="font-semibold">Thao tác chưa thành công</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCancel}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isSubmitting || ticket.status !== 'RESOLVED'}
            onClick={handleConfirm}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span>Đang đóng phiếu...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Xác nhận &amp; Đóng phiếu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
