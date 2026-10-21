import React from 'react'
import { getRoleMeta } from '../../constants/statusMeta'
import { getApiErrorMessage } from '../../lib/apiError'
import { Avatar, Badge, ConfirmDialog, useToast } from '../ui'

interface LogoutConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  userName?: string
  userEmail?: string
  userRole?: string
}

/** Logout confirmation (ConfirmDialog) showing which account is being signed out. */
export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
  userEmail,
  userRole,
}) => {
  const toast = useToast()
  const roleMeta = getRoleMeta(userRole)

  const handleConfirm = async () => {
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      toast.error('Không thể đăng xuất', getApiErrorMessage(error, 'Vui lòng thử lại.'))
    }
  }

  return (
    <ConfirmDialog
      open={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      tone="danger"
      title="Đăng xuất khỏi Boxora?"
      description="Phiên đăng nhập trên thiết bị này sẽ kết thúc. Bạn cần đăng nhập lại để tiếp tục làm việc."
      confirmLabel="Đăng xuất"
      cancelLabel="Hủy"
    >
      {userName || userEmail ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <Avatar name={userName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{userName || 'Người dùng'}</p>
            {userEmail ? <p className="truncate text-dense text-fg-muted">{userEmail}</p> : null}
          </div>
          {userRole ? (
            <Badge size="sm" tone={roleMeta.tone} className="shrink-0">
              {roleMeta.label}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </ConfirmDialog>
  )
}

export default LogoutConfirmModal
