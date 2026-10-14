import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/LanguageContext'

interface LogoutConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  userName?: string
  userEmail?: string
  userRole?: string
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
  userEmail,
  userRole,
}) => {
  const { t } = useLanguage()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="flex flex-col gap-4 text-left">
        {/* Header with warning icon */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[26px]">logout</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {t('Xác nhận đăng xuất')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('Kết thúc phiên làm việc hiện tại trên Boxora')}
            </p>
          </div>
        </div>

        {/* User identification badge */}
        {(userName || userEmail) && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {userName ? userName.slice(0, 2).toUpperCase() : 'US'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {userName || t('Người dùng')}
                </p>
                {userEmail && (
                  <p className="text-[11px] text-slate-500 truncate">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
            {userRole && (
              <span className="shrink-0 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-200 text-slate-700">
                {userRole}
              </span>
            )}
          </div>
        )}

        {/* Informative notice */}
        <p className="text-xs text-slate-600 leading-relaxed">
          {t('Bạn có chắc chắn muốn đăng xuất không? Phiên đăng nhập sẽ được thu hồi an toàn. Bạn sẽ cần nhập lại thông tin để tiếp tục sử dụng hệ thống.')}
        </p>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('Hủy bỏ')}
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{t('Đang xử lý...')}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>{t('Đăng xuất')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
export default LogoutConfirmModal
