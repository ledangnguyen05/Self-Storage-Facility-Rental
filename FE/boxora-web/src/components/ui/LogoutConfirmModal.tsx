import React, { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface LogoutConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  userName?: string
  userEmail?: string
  role?: string
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
  userEmail,
  role,
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await onConfirm()
      onClose()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận đăng xuất"
      description="Kết thúc phiên làm việc hiện tại trên thiết bị"
      maxWidth="sm"
    >
      <div className="space-y-5 text-left">
        {/* User Card Info */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
            {userName ? userName.slice(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">
              {userName || 'Tài khoản người dùng'}
            </div>
            {userEmail && (
              <div className="text-xs text-slate-500 truncate">{userEmail}</div>
            )}
          </div>
          {role && (
            <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
              {role}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoggingOut}
            className="flex-1 font-semibold"
          >
            Ở lại
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            icon={<LogOut size={15} />}
            className="flex-1 font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm"
          >
            Đăng xuất
          </Button>
        </div>
      </div>
    </Modal>
  )
}
