import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { overdueService, OverdueContractDetail, SealingWorkflowPayload } from '../../../services/overdueService'
import { supportTicketService } from '../../../services/supportTicketService'
import { userService } from '../../../services/userService'
import { useAuth } from '../../../context/AuthContext'
import { User } from '../../../types'
import { toast } from '../../../utils/toast'

interface OverdueContractDetailModalProps {
  isOpen: boolean
  onClose: () => void
  contractId: string
  onRefreshParent: () => void
  initialTab?: 'debt' | 'smartlock' | 'sealing' | 'notices' | 'payments' | 'audit'
  openInventoryDirectly?: boolean
  onSettled?: () => void
}

export const OverdueContractDetailModal: React.FC<OverdueContractDetailModalProps> = ({
  isOpen,
  onClose,
  contractId,
  onRefreshParent,
  initialTab,
  openInventoryDirectly,
  onSettled
}) => {
  const { user: currentUser } = useAuth()
  const [detail, setDetail] = useState<OverdueContractDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'debt' | 'smartlock' | 'sealing' | 'notices' | 'payments' | 'audit'>(initialTab || 'debt')

  const isContractSettled = Boolean(
    detail?.isSettled ||
    detail?.contractStatus === 'TERMINATED' ||
    (() => {
      try {
        const raw = localStorage.getItem('boxora_settled_overdue_contracts')
        if (raw) {
          const list = JSON.parse(raw)
          if (Array.isArray(list)) {
            return list.some((it: any) =>
              it.contractId === contractId ||
              (detail?.contractCode && it.contractCode === detail.contractCode) ||
              (detail?.unitCode && it.unitCode === detail.unitCode)
            )
          }
        }
      } catch {}
      return false
    })()
  )

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab)
      }
      if (openInventoryDirectly && !isContractSettled) {
        setShowInventoryDialog(true)
      }
    }
  }, [isOpen, initialTab, openInventoryDirectly, isContractSettled])

  useEffect(() => {
    if (isContractSettled) {
      setShowInventoryDialog(false)
      setShowConfirmSealingDialog(false)
      setShowCompleteSealingDialog(false)
      setShowRemindDialog(false)
      setShowRevokeConfirmDialog(false)
      setShowTempPinDialog(false)
      setShowSealingRequestDialog(false)
      setShowSealingApprovalDialog(false)
    }
  }, [isContractSettled])

  // Action state
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sub-dialogs state
  const [showRemindDialog, setShowRemindDialog] = useState(false)
  const [remindTemplate, setRemindTemplate] = useState<'REMINDER' | 'WARNING' | 'LOCKOUT_NOTICE' | 'SEAL_WARNING'>('REMINDER')
  const [remindNotes, setRemindNotes] = useState('')

  const [showRevokeConfirmDialog, setShowRevokeConfirmDialog] = useState(false)
  const [revokeReason, setRevokeReason] = useState('Quá hạn cước thuê, thực hiện khóa truy cập SmartLock')

  const [showTempPinDialog, setShowTempPinDialog] = useState(false)
  const [tempPinHours, setTempPinHours] = useState(24)
  const [tempPinReason, setTempPinReason] = useState('Khách hàng cam kết chuyển khoản thanh toán trong 24 giờ')

  const [showSealingRequestDialog, setShowSealingRequestDialog] = useState(false)
  const [sealingReason, setSealingReason] = useState('Hợp đồng quá hạn trên 7 ngày, vi phạm điều khoản hợp đồng')

  const [showSealingApprovalDialog, setShowSealingApprovalDialog] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const [showInventoryDialog, setShowInventoryDialog] = useState(false)
  const [showConfirmSealingDialog, setShowConfirmSealingDialog] = useState(false)
  const [showCompleteSealingDialog, setShowCompleteSealingDialog] = useState(false)
  const [sealTagNumber, setSealTagNumber] = useState('')
  const [witnessUsers, setWitnessUsers] = useState<User[]>([])
  const [selectedWitnessId, setSelectedWitnessId] = useState('')
  const [sealingNotes, setSealingNotes] = useState('')
  const [sealingPhotoUrl, setSealingPhotoUrl] = useState('')
  const [isUploadingSealingPhoto, setIsUploadingSealingPhoto] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<Array<{ itemName: string; quantity: number; conditionStatus: string; estimatedValue: number; notes?: string }>>([
    { itemName: '', quantity: 1, conditionStatus: 'Tốt', estimatedValue: 0, notes: '' }
  ])

  const [simulateOfflineRevocation, setSimulateOfflineRevocation] = useState(false)
  const [showLiquidationReleaseModal, setShowLiquidationReleaseModal] = useState(false)
  const [liquidationNotes, setLiquidationNotes] = useState('Thanh lý tài sản giải phóng buồng kho do hết hạn mức giữ kho (0 ngày)')

  const rawRole = (currentUser?.role?.name || currentUser?.roleName || (typeof (currentUser as any)?.role === 'string' ? (currentUser as any).role : '') || '').replace(/^ROLE_/, '')
  const isAdmin = rawRole === 'ADMIN'
  const isFacilityManager = rawRole === 'FACILITY_MANAGER' || rawRole === 'STAFF'
  const isBusinessManager = rawRole === 'BUSINESS_MANAGER'
  const isBusinessOrFacilityManager = isFacilityManager || isBusinessManager || isAdmin
  const isManagerOrAdmin = isAdmin || isFacilityManager || isBusinessManager

  const fetchDetail = useCallback(async () => {
    if (!contractId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await overdueService.getContractDetail(contractId)
      setDetail(data)
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || ''
      const isSqlError = serverMsg.toLowerCase().includes('column') || 
                         serverMsg.toLowerCase().includes('sql') || 
                         serverMsg.toLowerCase().includes('jdbc') || 
                         serverMsg.toLowerCase().includes('relation') ||
                         serverMsg.toLowerCase().includes('hibernate')
      const userMsg = isSqlError
        ? 'Không thể nạp hồ sơ nợ cước do hệ thống đang cập nhật dữ liệu. Vui lòng thử lại.'
        : serverMsg || 'Không thể tải chi tiết hợp đồng quá hạn'
      setLoadError(userMsg)
      toast.error(userMsg)
    } finally {
      setIsLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    if (isOpen) {
      fetchDetail()
    }
  }, [isOpen, fetchDetail])

  // Load witnesses
  useEffect(() => {
    if (showInventoryDialog || showConfirmSealingDialog || showCompleteSealingDialog) {
      const loadWitnesses = async () => {
        try {
          const res = await userService.getAllUsers({ facilityId: detail?.facilityId })
          const users = (res?.data || []).filter((u: User) => u.isActive && (u.role?.name === 'STAFF' || u.role?.name === 'FACILITY_MANAGER'))
          setWitnessUsers(users)
          if (users.length > 0 && !selectedWitnessId) setSelectedWitnessId(users[0].id)
        } catch {
          // Fallback
        }
      }
      loadWitnesses()
      if (!sealTagNumber && detail) {
        setSealTagNumber(`SEAL-${detail.unitCode}-${Math.floor(1000 + Math.random() * 9000)}`)
      }
    }
  }, [showInventoryDialog, showConfirmSealingDialog, showCompleteSealingDialog, detail, sealTagNumber, selectedWitnessId])

  // Sync existing inventory items if present in dossier
  useEffect(() => {
    if (detail?.sealingDossier?.items && detail.sealingDossier.items.length > 0) {
      setInventoryItems(detail.sealingDossier.items.map(i => ({
        itemName: i.itemName,
        quantity: Math.max(1, i.quantity || 1),
        conditionStatus: i.conditionStatus || 'Tốt',
        estimatedValue: Math.max(0, i.estimatedValue || 0),
        notes: i.notes || ''
      })))
    }
    if (detail?.sealingDossier?.notes) {
      setSealingNotes(detail.sealingDossier.notes)
    }
    if (detail?.sealingDossier?.photoEvidenceUrl) {
      setSealingPhotoUrl(detail.sealingDossier.photoEvidenceUrl)
    }
  }, [detail])

  const formatVND = (num?: number) => {
    if (num == null) return '0 ₫'
    const safeNum = Math.max(0, Math.round(num))
    return `${safeNum.toLocaleString('vi-VN')} ₫`
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const isTempPinActive = Boolean(
    detail?.tempPinGrantedUntil &&
      !isNaN(new Date(detail.tempPinGrantedUntil).getTime()) &&
      new Date(detail.tempPinGrantedUntil).getTime() > Date.now()
  )

  // Liquidation calculations for inventory items
  const dossierItems = detail?.sealingDossier?.items || []
  const totalLiquidationValue = useMemo(() => {
    return dossierItems.reduce((sum, item) => {
      const val = Number(item.estimatedValue) || 0
      const qty = Number(item.quantity) || 1
      return sum + val * qty
    }, 0)
  }, [dossierItems])

  // Đơn giá phạt trễ hạn / ngày (dùng để tính toán hạn mức và số ngày giữ hàng ước tính)
  const dailyPenaltyRate = useMemo(() => {
    if (!detail) return 0
    if (detail.dailyLateFee && Number(detail.dailyLateFee) > 0) {
      return Number(detail.dailyLateFee)
    }
    if (detail.dailyRentalPrice && Number(detail.dailyRentalPrice) > 0) {
      return Number(detail.dailyRentalPrice)
    }
    const monthly = Number(detail.monthlyFee) || 0
    return Math.ceil(monthly / 30 / 1000) * 1000
  }, [detail])

  const dailyRentalPrice = dailyPenaltyRate

  const estimatedHoldingDays = useMemo(() => {
    if (dailyPenaltyRate <= 0) return 0
    // Quy tắc: ước tính ngày giữ kho = (tổng tiền thanh lý - tổng công nợ) / đơn giá phạt ngày của kho
    const currentDebt = Math.max(0, Number(detail?.totalDebt) || 0)
    const remainingValue = totalLiquidationValue - currentDebt
    if (remainingValue <= 0) return 0
    return Math.floor(remainingValue / dailyPenaltyRate)
  }, [totalLiquidationValue, detail?.totalDebt, dailyPenaltyRate])

  const hasInventory = dossierItems.length > 0

  const effectiveSealingStatus = useMemo(() => {
    if (isContractSettled) return 'NONE'
    if (detail?.sealingStatus && detail.sealingStatus !== 'NONE') {
      return detail.sealingStatus
    }
    if (detail?.stage === 'SEALING_ELIGIBLE' || (detail?.daysOverdue ?? 0) >= 7) {
      return 'SEALING_ELIGIBLE'
    }
    return detail?.sealingStatus || 'NONE'
  }, [detail, isContractSettled])

  const effectivePinStatus = useMemo(() => {
    if (isContractSettled) return 'PIN_REVOKED'
    if (isTempPinActive) return 'PIN_ACTIVE'
    if (detail?.pinStatus && detail.pinStatus !== 'PIN_ACTIVE') {
      return detail.pinStatus
    }
    if (detail?.stage === 'PIN_REVOCATION' || detail?.stage === 'SEALING_ELIGIBLE' || (detail?.daysOverdue ?? 0) >= 3) {
      return 'PIN_ELIGIBLE'
    }
    return detail?.pinStatus || 'PIN_ACTIVE'
  }, [detail, isContractSettled, isTempPinActive])

  // Tự động phân loại mẫu thông báo theo hồ sơ nợ cước
  const autoClassifiedTemplate = useMemo(() => {
    if (!detail) {
      return {
        key: 'REMINDER',
        label: 'Ân hạn (1 ngày)',
        subLabel: 'Nhắc cước nhẹ nhàng, chưa tính phí phạt',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badgePill: 'bg-emerald-100 text-emerald-800',
        icon: 'schedule',
        isLiquidation: false
      }
    }

    // Trường hợp 5: Đủ điều kiện niêm phong (>= 7 ngày) / Nợ vượt tiền cọc giữ VÀ có Danh mục kiểm kê tài sản
    const isLiquidation = detail.totalDebt > 0 && (dossierItems.length > 0 || effectiveSealingStatus === 'SEALING_COMPLETED' || effectiveSealingStatus === 'SEALING_ELIGIBLE')
    if (isLiquidation) {
      return {
        key: 'LIQUIDATION_HOLDING_WARNING',
        label: 'Xử lý nợ vượt cọc & Định giá tài sản giữ kho',
        subLabel: `Đủ ĐK Niêm phong (>= 7 ngày) • ${dossierItems.length} mục kiểm kê • Ước tính giữ: ${estimatedHoldingDays} ngày`,
        badgeBg: 'bg-purple-50 text-purple-900 border-purple-200',
        badgePill: 'bg-purple-100 text-purple-800',
        icon: 'inventory_2',
        isLiquidation: true
      }
    }

    switch (detail.stage) {
      case 'GRACE_PERIOD':
        return {
          key: 'REMINDER',
          label: 'Ân hạn (1 ngày)',
          subLabel: 'Nhắc cước nhẹ nhàng, chưa tính phí phạt',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          badgePill: 'bg-emerald-100 text-emerald-800',
          icon: 'schedule',
          isLiquidation: false
        }
      case 'WARNING':
        return {
          key: 'WARNING',
          label: 'Cảnh báo (2 ngày)',
          subLabel: 'Cảnh báo phát sinh phạt theo ngày & nhắc trả kho',
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          badgePill: 'bg-amber-100 text-amber-800',
          icon: 'warning',
          isLiquidation: false
        }
      case 'PIN_REVOCATION':
        return {
          key: 'LOCKOUT_NOTICE',
          label: 'Thu hồi PIN (3-6 ngày)',
          subLabel: 'Cảnh báo tạm khóa quyền truy cập SmartLock IoT',
          badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
          badgePill: 'bg-rose-100 text-rose-800',
          icon: 'pin',
          isLiquidation: false
        }
      case 'SEALING_ELIGIBLE':
      default:
        return {
          key: 'SEAL_WARNING',
          label: 'Đủ ĐK Niêm phong (>= 7 ngày)',
          subLabel: 'Cảnh báo niêm phong kho & tiến hành kiểm kê tài sản',
          badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
          badgePill: 'bg-purple-100 text-purple-800',
          icon: 'lock',
          isLiquidation: false
        }
    }
  }, [detail, dossierItems.length, estimatedHoldingDays])

  if (!isOpen) return null

  // Action handlers
  const handleLiquidateRelease = async () => {
    if (!detail) return
    setIsSubmitting(true)
    try {
      await overdueService.liquidateReleaseStorageUnit(contractId, {
        notes: liquidationNotes
      })
      toast.success('Đã giải phóng buồng kho về trạng thái AVAILABLE!')
      setShowLiquidationReleaseModal(false)
      fetchDetail()
      onRefreshParent()
      onSettled?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi giải phóng kho thanh lý')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendReminder = async () => {
    if (isContractSettled) {
      toast.error('Hợp đồng đã hoàn tất thanh toán và trả kho, không thể thực hiện thao tác.')
      return
    }
    setIsSubmitting(true)
    try {
      await overdueService.sendReminder(contractId, {
        channel: 'MULTI',
        templateType: autoClassifiedTemplate.key as any,
        notes: remindNotes
      })
      toast.success(`Đã phát thông báo nhắc cước thành công theo mẫu [${autoClassifiedTemplate.label}] qua Web & Email!`)
      setShowRemindDialog(false)
      setRemindNotes('')
      fetchDetail()
      onRefreshParent()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi gửi thông báo nhắc cước')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestPinRevocation = async () => {
    if (isContractSettled) {
      toast.error('Hợp đồng đã hoàn tất thanh toán và trả kho, không thể thực hiện thao tác.')
      return
    }
    setIsSubmitting(true)
    try {
      await overdueService.requestPinRevocation(contractId, {
        reason: 'Quá hạn thanh toán cước thuê theo quy định cơ sở'
      })
      toast.success('Đã tạo yêu cầu thu hồi PIN/QR. Chờ Quản lý cơ sở thực hiện.')
      fetchDetail()
      onRefreshParent()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi yêu cầu thu hồi PIN')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExecutePinRevocation = async () => {
    if (isContractSettled) {
      toast.error('Hợp đồng đã hoàn tất thanh toán và trả kho, không thể thực hiện thao tác.')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await overdueService.executePinRevocation(contractId, {
        reason: revokeReason || (isTempPinActive ? 'Thu hồi quyền truy cập mã PIN tạm thời' : 'Quá hạn cước thuê, thực hiện khóa truy cập SmartLock'),
        simulateOffline: simulateOfflineRevocation
      })
      if (res.status === 'SUCCESS_MOCK' || res.status === 'SUCCESS_HARDWARE') {
        toast.success(isTempPinActive ? 'Đã thu hồi mã PIN tạm thời thành công!' : 'Đã thu hồi mã PIN/QR SmartLock thành công!')
      } else {
        toast.warning('Thu hồi PIN thất bại: Thiết bị SmartLock đang OFFLINE hoặc mất kết nối!')
      }
      setShowRevokeConfirmDialog(false)
      fetchDetail()
      onRefreshParent()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi thực hiện thu hồi PIN')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGrantTempPin = async () => {
    if (isContractSettled) {
      toast.error('Hợp đồng đã hoàn tất thanh toán và trả kho, không thể thực hiện thao tác.')
      return
    }
    setIsSubmitting(true)
    try {
      await overdueService.grantTemporaryPin(contractId, {
        hours: tempPinHours,
        reason: tempPinReason
      })
      toast.success(`Đã cấp mã PIN tạm thời thành công (Thời hạn ${tempPinHours} giờ)!`)
      setShowTempPinDialog(false)
      fetchDetail()
      onRefreshParent()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi cấp PIN tạm thời')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSealingWorkflow = async (action: 'REQUEST' | 'APPROVE' | 'REJECT' | 'INVENTORY' | 'COMPLETE') => {
    if (isContractSettled) {
      toast.error('Hợp đồng đã hoàn tất thanh toán và trả kho, không thể thực hiện thao tác.')
      return
    }
    setIsSubmitting(true)
    try {
      const payload: SealingWorkflowPayload = { action }
      if (action === 'REQUEST') {
        payload.reason = sealingReason
      } else if (action === 'REJECT') {
        payload.rejectionReason = rejectionReason
      } else if (action === 'INVENTORY' || action === 'COMPLETE') {
        const validItems = inventoryItems.filter(i => i.itemName.trim() !== '')
        for (const item of validItems) {
          if (item.estimatedValue != null && item.estimatedValue < 0) {
            toast.error(`Giá trị ước tính của "${item.itemName}" phải lớn hơn hoặc bằng 0 (>= 0).`)
            setIsSubmitting(false)
            return
          }
          if (item.quantity != null && item.quantity < 1) {
            toast.error(`Số lượng của "${item.itemName}" phải lớn hơn hoặc bằng 1.`)
            setIsSubmitting(false)
            return
          }
        }
        if (action === 'INVENTORY') {
          payload.witnessId = currentUser?.id || selectedWitnessId
          payload.notes = sealingNotes
          payload.photoEvidenceUrl = sealingPhotoUrl.trim() || undefined
          payload.inventoryItems = validItems
        } else {
          payload.sealTagNumber = sealTagNumber
          payload.witnessId = currentUser?.id || selectedWitnessId
          payload.notes = sealingNotes
          payload.photoEvidenceUrl = sealingPhotoUrl.trim() || undefined
          payload.inventoryItems = validItems
        }
      }

      await overdueService.processSealingWorkflow(contractId, payload)
      if (action === 'INVENTORY') {
        toast.success('Đã hoàn thành kiểm kê hiện trường!')
        setShowInventoryDialog(false)
      } else if (action === 'COMPLETE') {
        toast.success('Đã hoàn tất dán tem niêm phong và lập biên bản thành công!')
        setShowConfirmSealingDialog(false)
        setShowCompleteSealingDialog(false)
      } else if (action === 'APPROVE') {
        toast.success('Đã phê duyệt đề xuất niêm phong kho!')
        setShowSealingApprovalDialog(false)
      } else if (action === 'REJECT') {
        toast.success('Đã từ chối đề xuất niêm phong!')
        setShowSealingApprovalDialog(false)
      } else {
        toast.success('Đã gửi đề xuất niêm phong thành công!')
        setShowSealingRequestDialog(false)
      }
      fetchDetail()
      onRefreshParent()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi xử lý quy trình niêm phong')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Inventory rows helper
  const addInventoryRow = () => {
    setInventoryItems([...inventoryItems, { itemName: '', quantity: 1, conditionStatus: 'Tốt', estimatedValue: 0, notes: '' }])
  }
  const removeInventoryRow = (index: number) => {
    setInventoryItems(inventoryItems.filter((_, i) => i !== index))
  }
  const updateInventoryRow = (index: number, field: string, value: any) => {
    const updated = [...inventoryItems]
    let sanitizedValue = value
    if (field === 'estimatedValue') {
      const num = Number(value)
      sanitizedValue = isNaN(num) || num < 0 ? 0 : num
    } else if (field === 'quantity') {
      const num = Number(value)
      sanitizedValue = isNaN(num) || num < 1 ? 1 : Math.floor(num)
    }
    updated[index] = { ...updated[index], [field]: sanitizedValue }
    setInventoryItems(updated)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5 max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[26px]">assignment_late</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Hồ Sơ Nợ Cước: {detail?.contractCode || (loadError ? 'Lỗi kết nối' : 'Đang tải...')}
                </h2>
                {detail?.isDemo && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                    DEMO CASE
                  </span>
                )}
                {detail && (
                  isContractSettled ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      Đã xong (Khách trả kho)
                    </span>
                  ) : (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      detail.stage === 'GRACE_PERIOD' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      detail.stage === 'WARNING' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      detail.stage === 'PIN_REVOCATION' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      detail.stage === 'SEALING_ELIGIBLE' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                      'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {detail.stageLabel}
                    </span>
                  )
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kho: <span className="font-semibold text-slate-800">{detail?.unitCode}</span> {detail?.unitTypeName ? <span className="text-cyan-700 font-bold">({detail.unitTypeName})</span> : null} • Cơ sở: <span className="font-semibold text-slate-800">{detail?.facilityName}</span> • Khách hàng: <span className="font-semibold text-slate-800">{detail?.customerName}</span> ({detail?.customerPhone})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Settled Notice Banner */}
        {isContractSettled && (
          <div className={`p-3.5 border rounded-xl flex items-center justify-between text-xs shadow-xs ${
            detail?.stageLabel?.includes('thanh lý')
              ? 'bg-purple-50 border-purple-200 text-purple-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`material-symbols-outlined text-[22px] ${
                detail?.stageLabel?.includes('thanh lý') ? 'text-purple-600' : 'text-emerald-600'
              }`}>
                {detail?.stageLabel?.includes('thanh lý') ? 'gavel' : 'verified'}
              </span>
              <div>
                <span className="font-bold text-[13px] block">
                  {detail?.stageLabel?.includes('thanh lý')
                    ? 'Hồ sơ đã hoàn tất thanh lý tài sản & buồng kho đã giải phóng về trạng thái AVAILABLE'
                    : 'Hồ sơ đã hoàn tất quyết toán & khách hàng đã bàn giao trả kho'}
                </span>
                <span className={detail?.stageLabel?.includes('thanh lý') ? 'text-purple-700' : 'text-emerald-700'}>
                  Thời gian hoàn tất: <strong>{detail?.settledAt && detail.settledAt !== 'Vừa xong' ? detail.settledAt : 'Đã ghi nhận'}</strong> {detail?.settledByName ? `• Người duyệt: ${detail.settledByName}` : ''}. Tất cả thao tác chế tài, gửi thông báo và niêm phong đã được đóng.
                </span>
              </div>
            </div>
            <span className={`px-3 py-1 font-bold rounded-lg text-xs shrink-0 flex items-center gap-1 text-white ${
              detail?.stageLabel?.includes('thanh lý') ? 'bg-purple-700' : 'bg-emerald-600'
            }`}>
              <span className="material-symbols-outlined text-[15px]">lock</span>
              ĐÃ ĐÓNG HỒ SƠ
            </span>
          </div>
        )}

        {/* Policy Warning Banner if Group 5 */}
        {detail?.stage === 'POLICY_UNCONFIGURED' && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[20px]">warning</span>
              <div>
                <span className="font-bold">Cơ sở chưa có chính sách quá hạn hợp lệ!</span> {detail.policyWarning}
              </div>
            </div>
            <a
              href="/portal/facility-policy"
              className="px-3 py-1 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-all"
            >
              Cấu hình chính sách
            </a>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('debt')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'debt' ? 'border-rose-600 text-rose-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            Công Nợ &amp; Công Thức
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('smartlock')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'smartlock' ? 'border-rose-600 text-rose-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
            SmartLock &amp; Thu Hồi PIN
            {detail?.pinStatus === 'PIN_REVOCATION_PENDING' && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sealing')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'sealing' ? 'border-rose-600 text-rose-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            Niêm Phong &amp; Kiểm Kê
            {detail?.sealingStatus === 'SEALING_REQUESTED' && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            )}
            {detail?.sealingStatus === 'SEALING_REJECTED' && (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notices')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'notices' ? 'border-rose-600 text-rose-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
            Lịch Sử Nhắc Cước ({detail?.reminders?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'payments' ? 'border-rose-600 text-rose-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Lịch Sử Thanh Toán ({detail?.payments?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'audit' ? 'border-rose-600 text-rose-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Nhật Ký Kiểm Toán ({detail?.auditLogs?.length || 0})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <span className="material-symbols-outlined animate-spin text-[36px]">sync</span>
              <p className="text-xs font-semibold">Đang tải hồ sơ hợp đồng quá hạn...</p>
            </div>
          ) : loadError && !detail ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">error_outline</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{loadError}</p>
              <p className="text-xs text-slate-500 max-w-md">Không thể tải thông tin hồ sơ nợ cước từ máy chủ. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>
              <button
                type="button"
                onClick={fetchDetail}
                className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Thử lại</span>
              </button>
            </div>
          ) : detail ? (
            <>
              {/* TAB 1: DEBT & FORMULA */}
              {activeTab === 'debt' && (
                <div className="flex flex-col gap-4">
                  {/* Top 3 KPI Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {detail.totalDebt > 0 ? (
                      <div className="p-3.5 bg-rose-600 text-white rounded-xl shadow-xs">
                        <p className="text-[11px] font-semibold text-rose-100 uppercase tracking-wider">Tổng công nợ</p>
                        <p className="text-lg font-black text-white mt-1">{formatVND(detail.totalDebt)}</p>
                        <span className="text-[10px] text-rose-100 block mt-0.5">Phí phạt vượt tiền cọc giữ</span>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                        <p className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider">Số tiền hoàn khách</p>
                        <p className="text-lg font-black text-white mt-1">
                          {formatVND(detail.customerRefundAmount ?? Math.max(0, (detail.depositHeld || 0) - (detail.lateFee || 0)))}
                        </p>
                        <span className="text-[10px] text-emerald-100 block mt-0.5">Tiền cọc còn lại hoàn khi trả kho</span>
                      </div>
                    )}
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Tiền cọc giữ</p>
                      <p className="text-lg font-black text-emerald-800 mt-1">{formatVND(detail.depositHeld)}</p>
                      <span className="text-[10px] text-emerald-700 block mt-0.5">Tiền bảo đảm hợp đồng</span>
                    </div>
                    <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200">
                      <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Phí phạt trễ hạn</p>
                      <p className="text-lg font-black text-rose-700 mt-1">{formatVND(detail.lateFee)}</p>
                      <span className="text-[10px] text-rose-600 block mt-0.5">Khấu trừ trực tiếp vào cọc</span>
                    </div>
                  </div>

                  {/* Quản lý lưu kho & Thanh lý tài sản khi vượt hạn mức nợ */}
                  {detail.totalDebt > 0 && (
                    !hasInventory ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-amber-600 text-[24px] shrink-0 mt-0.5">assignment_late</span>
                          <div>
                            <p className="font-bold text-amber-900 text-sm">Kho chưa thực hiện kiểm kê tài sản</p>
                            <p className="text-amber-700 mt-0.5 leading-relaxed">
                              Đơn nợ cước này đã bị trừ hết cọc và đang nợ Boxora <strong>{formatVND(detail.totalDebt)}</strong>. Cần kiểm kê danh mục tài sản trong kho để tính toán tổng giá trị thanh lý và số ngày ước tính có thể tiếp tục giữ hàng.
                            </p>
                          </div>
                        </div>
                        {!isContractSettled && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('sealing')}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-center"
                          >
                            <span className="material-symbols-outlined text-[17px]">inventory_2</span>
                            <span>Kiểm kê ngay</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 text-xs shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-indigo-600 text-[24px]">inventory_2</span>
                            <div>
                              <div>
                                <span className="font-bold text-slate-800 text-sm block">Định giá tài sản &amp; Thời gian giữ hàng ước tính</span>
                                <span className="text-slate-500 block text-xs">
                                  Danh mục kiểm kê ({dossierItems.length} mục) • Đơn giá phạt: <strong className="text-slate-700">{formatVND(dailyPenaltyRate)}/ngày</strong>
                                </span>
                                {detail && detail.totalDebt > 0 && totalLiquidationValue > 0 && (
                                  <span className="text-[11px] text-slate-500 block mt-0.5">
                                    Ước tính ngày = (Tổng thanh lý: <strong className="text-indigo-700">{formatVND(totalLiquidationValue)}</strong> - Công nợ: <strong className="text-rose-600">{formatVND(detail.totalDebt)}</strong>) / <strong className="text-slate-700">{formatVND(dailyPenaltyRate)}/ngày</strong> = <strong className={`${estimatedHoldingDays === 0 ? 'text-rose-600' : 'text-emerald-700'} font-bold`}>{estimatedHoldingDays} ngày</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tổng tiền thanh lý</span>
                              <span className="font-black text-indigo-700 text-base">{formatVND(totalLiquidationValue)}</span>
                            </div>
                            {detail && detail.totalDebt > 0 && (
                              <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Sau bù công nợ</span>
                                <span className="font-bold text-slate-800 text-sm">{formatVND(Math.max(0, totalLiquidationValue - detail.totalDebt))}</span>
                              </div>
                            )}
                            <div className={`px-3.5 py-1.5 rounded-xl border shadow-2xs ${
                              estimatedHoldingDays === 0
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}>
                              <span className="block text-[10px] uppercase font-semibold">Ước tính giữ kho</span>
                              <span className="font-black text-base">{estimatedHoldingDays} ngày</span>
                            </div>
                          </div>
                        </div>

                        {estimatedHoldingDays === 0 && (
                          isContractSettled ? (
                            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 text-purple-900 text-xs">
                              <span className="material-symbols-outlined text-purple-600 text-[20px]">check_circle</span>
                              <span><strong>Đã giải phóng buồng kho:</strong> Toàn bộ tài sản kiểm kê đã được thanh lý giải phóng và buồng kho đã về trạng thái AVAILABLE sẵn sàng cho thuê mới.</span>
                            </div>
                          ) : (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-rose-900">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
                                <span className="text-xs">
                                  <strong>Hết hạn mức giữ kho (0 ngày):</strong> Giá trị tài sản thanh lý đã hết/không còn đủ bù cước ngày. Cần trực tiếp giải phóng buồng kho về trạng thái AVAILABLE.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowLiquidationReleaseModal(true)}
                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg whitespace-nowrap transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0 self-start sm:self-center text-xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">meeting_room</span>
                                <span>Giải phóng kho ngay (Available)</span>
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )
                  )}

                  {/* Formula Breakdown Card */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-rose-600">function</span>
                      Bảng công thức tính phạt minh bạch
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white p-3 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-500 block">Ngày hết hạn:</span>
                        <span className="font-bold text-slate-800">{detail.dueDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Số ngày quá hạn:</span>
                        <span className="font-bold text-rose-600">+{detail.daysOverdue} ngày</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ân hạn miễn phí:</span>
                        <span className="font-bold text-emerald-600">1 ngày đầu</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Đơn giá phạt/ngày:</span>
                        <span className="font-bold text-slate-800">{formatVND(detail.dailyLateFee)}/ngày</span>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {detail.unitTypeName ? `${detail.unitTypeName}: ` : ''}{detail.lateFeePercentage ?? 100}% × {formatVND(detail.dailyRentalPrice ?? Math.round(Number(detail.dailyLateFee || 0)))}/d
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Tab 1 */}
                  {!isContractSettled ? (
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRemindDialog(true)}
                        className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
                        Gửi thông báo nhắc nợ
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 2: SMARTLOCK */}
              {activeTab === 'smartlock' && (
                <div className="flex flex-col gap-4">
                  {/* Status Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-500">Trạng thái mã PIN/QR:</span>
                      <span className={`text-sm font-bold ${
                        isTempPinActive ? 'text-amber-700' :
                        effectivePinStatus === 'PIN_ACTIVE' ? 'text-emerald-700' :
                        effectivePinStatus === 'PIN_ELIGIBLE' ? 'text-amber-700' :
                        effectivePinStatus === 'PIN_REVOCATION_PENDING' ? 'text-amber-700' :
                        effectivePinStatus === 'PIN_REVOKED' ? 'text-rose-700' : 'text-slate-700'
                      }`}>
                        {isTempPinActive ? 'Đang cấp quyền tạm thời (24h)' :
                         effectivePinStatus === 'PIN_ACTIVE' ? 'Đang hoạt động (Khách mở được kho)' :
                         effectivePinStatus === 'PIN_ELIGIBLE' ? 'Đủ điều kiện thu hồi PIN (Đã quá hạn >= 3 ngày)' :
                         effectivePinStatus === 'PIN_REVOCATION_PENDING' ? 'Chờ thu hồi mã PIN' :
                         effectivePinStatus === 'PIN_REVOKED' ? 'Đã thu hồi quyền truy cập (Locked)' :
                         'Thu hồi thất bại (Cần kiểm tra thiết bị)'}
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-500">Mã PIN bảo mật:</span>
                      <div className="flex items-center gap-2">
                        {isTempPinActive ? (
                          <>
                            <span className="text-base font-mono font-black text-emerald-800 tracking-wider bg-emerald-100/80 px-2.5 py-0.5 rounded-lg border border-emerald-300 shadow-2xs">
                              {detail.tempAccessPin || detail.maskedPin}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">timer</span>
                              Tạm thời (24h)
                            </span>
                          </>
                        ) : (
                          <span className={`text-sm font-mono font-bold ${detail.maskedPin === 'Đã thu hồi' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {detail.maskedPin || 'Chưa cấp'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Temporary PIN Alert if active */}
                  {detail.tempPinGrantedUntil && (
                    <div className={`p-3 border rounded-xl text-xs flex items-center justify-between ${
                      isTempPinActive
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[20px] ${isTempPinActive ? 'text-amber-600' : 'text-slate-400'}`}>
                          timer
                        </span>
                        <div>
                          <span className="font-bold">
                            {isTempPinActive ? 'Đang cấp quyền tạm thời:' : 'Quyền tạm thời đã hết hạn:'}
                          </span>{' '}
                          Hiệu lực đến {formatDateTime(detail.tempPinGrantedUntil)}
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                        isTempPinActive
                          ? 'bg-amber-200/90 text-amber-900 border border-amber-300'
                          : 'bg-slate-200 text-slate-600 border border-slate-300'
                      }`}>
                        {isTempPinActive ? 'Đang có hiệu lực' : 'Đã hết thời gian cấp'}
                      </span>
                    </div>
                  )}

                  {/* Actions Toolbar for SmartLock */}
                  {isContractSettled ? (
                    <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
                      <span>Hợp đồng đã hoàn tất thanh toán và trả kho. Mã PIN đã được thu hồi và buồng kho đã được giải phóng sẵn sàng cho khách mới.</span>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">admin_panel_settings</span>
                        Thao tác chế tài quyền truy cập IoT SmartLock:
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Khi đang cấp PIN tạm thời: Hiển thị nút Thu hồi PIN tạm thời */}
                        {isBusinessOrFacilityManager && isTempPinActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeReason('Thu hồi quyền truy cập mã PIN tạm thời')
                              setShowRevokeConfirmDialog(true)
                            }}
                            disabled={isSubmitting}
                            className="px-3.5 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">timer_off</span>
                            Thu hồi pin tạm thời
                          </button>
                        )}

                        {/* Khi chưa thu hồi PIN và không có PIN tạm: Chỉ hiển thị nút Thu hồi PIN ngay khi tới ngày quá hạn thứ 3 trở đi */}
                        {isBusinessOrFacilityManager && !isTempPinActive && effectivePinStatus !== 'PIN_REVOKED' && (
                          <>
                            {(detail.daysOverdue ?? 0) >= 3 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokeReason('Quá hạn cước thuê, thực hiện khóa truy cập SmartLock')
                                  setShowRevokeConfirmDialog(true)
                                }}
                                disabled={isSubmitting}
                                className="px-3.5 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-[16px]">lock</span>
                                Thu hồi PIN ngay
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                                <span className="material-symbols-outlined text-[15px] text-amber-600">info</span>
                                <span>
                                  Chưa đạt ngưỡng thu hồi PIN (áp dụng từ ngày quá hạn thứ 3 trở đi, hiện tại: +{detail.daysOverdue} ngày)
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        {/* Khi đã thu hồi PIN và không có PIN tạm: Hiển thị nút Cấp quyền tạm thời (24h) */}
                        {isBusinessOrFacilityManager && effectivePinStatus === 'PIN_REVOKED' && !isTempPinActive && (
                          <button
                            type="button"
                            onClick={() => setShowTempPinDialog(true)}
                            className="px-3.5 py-2 bg-slate-700 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">timer</span>
                            Cấp quyền tạm thời (24h)
                          </button>
                        )}
                        {isAdmin && (
                          <span className="text-[11px] text-slate-500 italic bg-slate-200/60 px-3 py-1.5 rounded-lg border border-slate-300/80 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-slate-500">visibility</span>
                            Tài khoản Admin ở chế độ giám sát (Thao tác thu hồi PIN &amp; cấp PIN tạm thuộc thẩm quyền của Quản lý cơ sở và Quản lý kinh doanh)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Revocation Log Table */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lịch sử yêu cầu thu hồi PIN</h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5 font-bold">Mã Yêu Cầu</th>
                            <th className="p-2.5 font-bold">Trạng Thái</th>
                            <th className="p-2.5 font-bold">Người Thực Hiện</th>
                            <th className="p-2.5 font-bold">Thời Gian</th>
                            <th className="p-2.5 font-bold">Lý Do / Chi Tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detail.pinRequests && detail.pinRequests.length > 0 ? (
                            detail.pinRequests.map(r => (
                              <tr key={r.id}>
                                <td className="p-2.5 font-mono font-bold text-slate-900">{r.requestCode}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    r.status === 'SUCCESS_MOCK' || r.status === 'SUCCESS_HARDWARE' ? 'bg-emerald-100 text-emerald-800' :
                                    r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {r.status} {r.isMock && '[MOCK]'}
                                  </span>
                                </td>
                                <td className="p-2.5">{r.requestedByName}</td>
                                <td className="p-2.5 text-slate-500">{r.executedAt || r.requestedAt}</td>
                                <td className="p-2.5 text-slate-600">{r.reason || r.errorMessage || '-'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400">Chưa có yêu cầu thu hồi PIN nào</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SEALING & INVENTORY */}
              {activeTab === 'sealing' && (
                <div className="flex flex-col gap-4">
                  {/* Sealing Status Header / Rejection Banner */}
                  {detail.sealingStatus === 'SEALING_REJECTED' ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-xl">cancel</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-rose-900">
                            Đề xuất niêm phong đã bị Business Manager từ chối
                          </h4>
                          {detail.sealingDossier?.rejectionReason && (
                            <div className="text-xs text-rose-800 mt-1.5 bg-white/80 p-2.5 rounded-xl border border-rose-200">
                              <span className="font-bold text-rose-950">Lý do từ chối:</span> {detail.sealingDossier.rejectionReason}
                            </div>
                          )}
                          <p className="text-[11px] text-rose-700 mt-1.5">
                            Cần quản lý cơ sở gửi lại đề xuất niêm phong.
                          </p>
                        </div>
                      </div>

                      {(isFacilityManager || isAdmin) && (
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowSealingRequestDialog(true)}
                            className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">send</span>
                            Xin phê duyệt
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-500">Trạng thái hồ sơ niêm phong:</span>
                        <div className="flex items-center gap-2 mt-1">
                          {isContractSettled ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">check_circle</span>
                              Đã hoàn tất thanh toán &amp; trả kho
                            </span>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              effectiveSealingStatus === 'SEALING_COMPLETED' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                              effectiveSealingStatus === 'SEALING_IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                              effectiveSealingStatus === 'SEALING_APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              effectiveSealingStatus === 'SEALING_REQUESTED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              effectiveSealingStatus === 'SEALING_ELIGIBLE' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {effectiveSealingStatus === 'SEALING_COMPLETED' ? 'Đã hoàn tất niêm phong & kiểm kê tài sản' :
                               effectiveSealingStatus === 'SEALING_IN_PROGRESS' ? 'Đã kiểm kê hiện trường • Sẵn sàng niêm phong' :
                               effectiveSealingStatus === 'SEALING_APPROVED' ? 'Business Manager đã duyệt niêm phong' :
                               effectiveSealingStatus === 'SEALING_REQUESTED' ? 'Chờ Business Manager phê duyệt' :
                               effectiveSealingStatus === 'SEALING_ELIGIBLE' ? 'Đủ điều kiện niêm phong (>= 7 ngày)' :
                               'Chưa đạt ngưỡng niêm phong'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Multi-step Workflow Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isContractSettled ? (
                          <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">lock</span>
                            Đã đóng hồ sơ kiểm kê (Chỉ xem)
                          </span>
                        ) : (
                          <>
                            {/* TRƯỜNG HỢP 1: Đủ điều kiện niêm phong (Facility Manager chưa gửi request) */}
                            {effectiveSealingStatus === 'SEALING_ELIGIBLE' && (
                              (isFacilityManager || isBusinessManager || isAdmin) ? (
                                <button
                                  type="button"
                                  onClick={() => setShowSealingRequestDialog(true)}
                                  className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[16px]">send</span>
                                  Xin phê duyệt
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500 italic bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                  Đủ điều kiện niêm phong (Chờ cơ sở gửi đề xuất)
                                </span>
                              )
                            )}

                            {/* TRƯỜNG HỢP 2: Facility Manager ĐÃ GỬI request -> Chờ Business Manager duyệt */}
                            {effectiveSealingStatus === 'SEALING_REQUESTED' && (
                              (isBusinessManager || isAdmin) ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => { setIsRejecting(false); setShowSealingApprovalDialog(true) }}
                                    className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-sm cursor-pointer flex items-center gap-1.5"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                    Phê duyệt đề xuất
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setIsRejecting(true); setShowSealingApprovalDialog(true) }}
                                    className="px-3.5 py-2 bg-rose-100 text-rose-800 text-xs font-bold rounded-xl hover:bg-rose-200 cursor-pointer flex items-center gap-1.5"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                                    Từ chối đề xuất
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] animate-pulse">hourglass_top</span>
                                  Đang chờ Business Manager phê duyệt
                                </span>
                              )
                            )}

                            {/* TRƯỜNG HỢP 3: Business Manager ĐÃ DUYỆT -> Hiển thị Kiểm kê hiện trường */}
                            {effectiveSealingStatus === 'SEALING_APPROVED' && (
                              <button
                                type="button"
                                onClick={() => setShowInventoryDialog(true)}
                                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-[18px]">fact_check</span>
                                Kiểm kê hiện trường
                              </button>
                            )}

                            {effectiveSealingStatus === 'SEALING_IN_PROGRESS' && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowInventoryDialog(true)}
                                  className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                  Cập nhật kiểm kê
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmSealingDialog(true)}
                                  className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[18px]">gavel</span>
                                  Niêm phong
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sealing Dossier & Inventory Items Display */}
                  {detail.sealingDossier ? (
                    <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px] text-purple-600">verified</span>
                          Biên bản niêm phong: {detail.sealingDossier.protocolNumber || detail.sealingDossier.sealTagNumber}
                        </h4>
                        <span className="text-xs text-slate-500">
                          Ngày niêm phong: <span className="font-semibold text-slate-800">{formatDateTime(detail.sealingDossier.sealedAt)}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 block">Số tem niêm phong:</span>
                          <span className="font-mono font-bold text-slate-900">{detail.sealingDossier.sealTagNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Nhân viên thực hiện:</span>
                          <span className="font-bold text-slate-900">{detail.sealingDossier.sealedByName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Người chứng kiến:</span>
                          <span className="font-bold text-slate-900">{detail.sealingDossier.witnessName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Phê duyệt bởi:</span>
                          <span className="font-bold text-slate-900">{detail.sealingDossier.approvedByName || '-'}</span>
                        </div>
                      </div>

                      {/* Ghi chú hiện trường */}
                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <span className="material-symbols-outlined text-[16px] text-amber-700">edit_note</span>
                          <span>Ghi chú hiện trường:</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pl-5 font-normal">
                          {detail.sealingDossier.notes ? (
                            detail.sealingDossier.notes
                          ) : (
                            <span className="text-slate-400 italic">Không có ghi chú hiện trường</span>
                          )}
                        </p>
                        {detail.sealingDossier.photoEvidenceUrl && (
                          <div className="pl-5 pt-2 flex items-center gap-3">
                            <a
                              href={detail.sealingDossier.photoEvidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 p-1.5 bg-white border border-amber-200 rounded-lg hover:border-purple-400 transition"
                            >
                              <img
                                src={detail.sealingDossier.photoEvidenceUrl}
                                alt="Ảnh bằng chứng niêm phong"
                                className="w-14 h-12 object-cover rounded border border-slate-200"
                              />
                              <span className="text-[11px] font-bold text-purple-700 underline pr-1">
                                Xem ảnh niêm phong
                              </span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Itemized Asset Inventory Table */}
                      <div className="mt-2 flex flex-col gap-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px] text-indigo-600">inventory_2</span>
                            Danh mục tài sản kiểm kê trong kho:
                          </span>

                          {/* Thẻ tổng hợp tiền đồ thanh lý & số ngày ước tính giữ hàng */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-bold">
                              Tổng tiền đồ thanh lý: {formatVND(totalLiquidationValue)}
                            </span>
                            {detail && detail.totalDebt > 0 && (
                              <span className="text-xs px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium">
                                Sau bù nợ ({formatVND(detail.totalDebt)}): còn {formatVND(Math.max(0, totalLiquidationValue - detail.totalDebt))}
                              </span>
                            )}
                            <span className={`text-xs px-3 py-1 rounded-lg border font-bold ${
                              estimatedHoldingDays === 0
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}>
                              Ước tính giữ hàng: {estimatedHoldingDays} ngày ({formatVND(dailyRentalPrice)}/ngày)
                            </span>
                            {detail.totalDebt > 0 && estimatedHoldingDays === 0 && !isContractSettled && (
                              <button
                                type="button"
                                onClick={() => setShowLiquidationReleaseModal(true)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <span className="material-symbols-outlined text-[15px]">meeting_room</span>
                                Giải phóng kho ngay (Available)
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                              <tr>
                                <th className="p-2 font-bold">#</th>
                                <th className="p-2 font-bold">Tên Tài Sản / Đồ Dùng</th>
                                <th className="p-2 font-bold">Số Lượng</th>
                                <th className="p-2 font-bold">Tình Trạng</th>
                                <th className="p-2 font-bold">Ước Tính Giá Trị</th>
                                <th className="p-2 font-bold">Ghi Chú</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {detail.sealingDossier.items && detail.sealingDossier.items.length > 0 ? (
                                detail.sealingDossier.items.map((item, idx) => (
                                  <tr key={item.id || idx}>
                                    <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                                    <td className="p-2 font-semibold text-slate-800">{item.itemName}</td>
                                    <td className="p-2">{item.quantity}</td>
                                    <td className="p-2 text-slate-600">{item.conditionStatus || 'Bình thường'}</td>
                                    <td className="p-2 font-mono font-bold text-slate-900">{formatVND(item.estimatedValue)}</td>
                                    <td className="p-2 text-slate-500">{item.notes || '-'}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={6} className="p-3 text-center text-slate-400">Không có tài sản kiểm kê</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      Chưa có hồ sơ hoặc biên bản niêm phong chính thức cho hợp đồng này.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: REMINDER NOTICES */}
              {activeTab === 'notices' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lịch sử phát thông báo nhắc cước</h4>
                    {isContractSettled ? (
                      <span className="text-xs text-slate-400 italic bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                        Đã đóng gửi thông báo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowRemindDialog(true)}
                        className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Gửi thông báo mới
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 font-bold">Kênh Gửi</th>
                          <th className="p-2.5 font-bold">Loại Mẫu</th>
                          <th className="p-2.5 font-bold">Nội Dung</th>
                          <th className="p-2.5 font-bold">Người Gửi</th>
                          <th className="p-2.5 font-bold">Thời Gian</th>
                          <th className="p-2.5 font-bold">Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.reminders && detail.reminders.length > 0 ? (
                          detail.reminders.map(n => (
                            <tr key={n.id}>
                              <td className="p-2.5 font-bold text-slate-800">{n.channel}</td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                                  {n.templateType}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-700 max-w-md">{n.content}</td>
                              <td className="p-2.5 text-slate-600">{n.sentByName}</td>
                              <td className="p-2.5 text-slate-500">{n.sentAt}</td>
                              <td className="p-2.5 font-bold text-emerald-600">{n.deliveryStatus}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400">Chưa có thông báo nào được gửi</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: PAYMENTS */}
              {activeTab === 'payments' && (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lịch sử thanh toán &amp; Đối soát</h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 font-bold">Mã Giao Dịch</th>
                          <th className="p-2.5 font-bold">Loại Thanh Toán</th>
                          <th className="p-2.5 font-bold">Số Tiền</th>
                          <th className="p-2.5 font-bold">Phương Thức</th>
                          <th className="p-2.5 font-bold">Thời Gian</th>
                          <th className="p-2.5 font-bold">Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.payments && detail.payments.length > 0 ? (
                          detail.payments.map(p => (
                            <tr key={p.paymentId || p.transactionId}>
                              <td className="p-2.5 font-mono font-bold text-slate-800">{p.transactionId}</td>
                              <td className="p-2.5">{p.paymentType}</td>
                              <td className="p-2.5 font-mono font-bold text-slate-900">{formatVND(p.amount)}</td>
                              <td className="p-2.5">{p.paymentMethod || 'VNPay / Chuyển khoản'}</td>
                              <td className="p-2.5 text-slate-500">{p.paymentTime}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  p.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                                  p.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400">Chưa có giao dịch thanh toán nào được ghi nhận</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: AUDIT TRAIL */}
              {activeTab === 'audit' && (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Nhật ký kiểm toán (Audit Trail)</h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 font-bold">Hành Động</th>
                          <th className="p-2.5 font-bold">Người Thực Hiện</th>
                          <th className="p-2.5 font-bold">Vai Trò</th>
                          <th className="p-2.5 font-bold">Trạng Thái (Trước &rarr; Sau)</th>
                          <th className="p-2.5 font-bold">Chi Tiết</th>
                          <th className="p-2.5 font-bold">Thời Gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.auditLogs && detail.auditLogs.length > 0 ? (
                          detail.auditLogs.map(a => (
                            <tr key={a.id}>
                              <td className="p-2.5 font-mono font-bold text-rose-700">{a.action}</td>
                              <td className="p-2.5 font-semibold text-slate-800">{a.performedByName}</td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                                  {a.performedByRole}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600">
                                {a.beforeState ? `${a.beforeState} → ${a.afterState}` : a.afterState || '-'}
                              </td>
                              <td className="p-2.5 text-slate-700 max-w-sm">{a.details}</td>
                              <td className="p-2.5 text-slate-500 whitespace-nowrap">{a.createdAt}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400">Chưa có lịch sử kiểm toán nào</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Hệ thống Boxora Overdue &amp; SmartLock Enforcement
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>

      {/* Sub-Dialog: Send Reminder Notice - Tự Động Phân Loại Mẫu Thông Báo */}
      {showRemindDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-3.5 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <span className="material-symbols-outlined text-lg">campaign</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Phát thông báo nhắc cước</h3>
                  <p className="text-[11px] text-slate-500">
                    Tự động đồng bộ gửi qua Web Dashboard &amp; Email chi tiết của khách hàng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRemindDialog(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Recipient Brief Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-800">{detail?.customerName || '-'} ({detail?.customerPhone || '-'})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Hộp thư Email:</span>
                <span className="font-semibold text-slate-800 font-mono text-[11px]">{detail?.customerEmail || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Kho &amp; Cơ sở:</span>
                <span className="font-bold text-slate-800">
                  #{detail?.unitCode} ({detail?.unitTypeName || 'Kho'}) • {detail?.facilityName || 'Boxora'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tổng công nợ:</span>
                <span className="font-black text-rose-600 text-sm">{formatVND(detail?.totalDebt)}</span>
              </div>
            </div>

            {/* Mẫu thông báo: Tự động phân loại (Không cần manager chọn thủ công) */}
            <div className="flex flex-col gap-1.5 text-xs">
              <span className="font-bold text-slate-700 flex items-center justify-between">
                <span>Mẫu thông báo phát gửi:</span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  Tự động phân loại theo hồ sơ
                </span>
              </span>
              <div className={`p-3 rounded-xl border flex items-center justify-between shadow-2xs ${autoClassifiedTemplate.badgeBg}`}>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[22px]">{autoClassifiedTemplate.icon}</span>
                  <div>
                    <span className="font-bold block text-sm">{autoClassifiedTemplate.label}</span>
                    <span className="text-[11px] opacity-90 block mt-0.5">{autoClassifiedTemplate.subLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Xem trước thiết kế thông báo tương ứng */}
            {autoClassifiedTemplate.isLiquidation ? (
              /* Thiết kế Trường Hợp: Đủ ĐK Niêm Phong / Nợ Vượt Cọc & Có Định Giá Tài Sản Kiểm Kê */
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex flex-col gap-2.5 text-xs max-h-64 overflow-y-auto">
                <div className="flex justify-between items-center pb-1.5 border-b border-purple-200/80">
                  <span className="font-bold text-purple-950 flex items-center gap-1 text-[11px]">
                    <span className="material-symbols-outlined text-[15px] text-purple-700">preview</span>
                    Xem trước thiết kế thông báo gửi khách:
                  </span>
                  <span className="text-[10px] font-mono text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-200">
                    #{detail?.contractCode}
                  </span>
                </div>

                {/* 3 Thẻ tài chính: Tổng công nợ, Tiền cọc giữ, Phí phạt trễ hạn */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white border border-rose-200 rounded-lg shadow-2xs">
                    <span className="text-[9px] text-rose-600 block font-semibold uppercase">Tổng công nợ</span>
                    <span className="font-black text-rose-700 text-xs block mt-0.5">{formatVND(detail?.totalDebt)}</span>
                    <span className="text-[8px] text-rose-500 block leading-tight mt-0.5">Phí phạt vượt cọc giữ</span>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <span className="text-[9px] text-slate-500 block font-semibold uppercase">Tiền cọc giữ</span>
                    <span className="font-bold text-slate-800 text-xs block mt-0.5">{formatVND(detail?.depositHeld)}</span>
                    <span className="text-[8px] text-slate-400 block leading-tight mt-0.5">Bảo đảm hợp đồng</span>
                  </div>
                  <div className="p-2 bg-white border border-amber-200 rounded-lg shadow-2xs">
                    <span className="text-[9px] text-amber-700 block font-semibold uppercase">Phí phạt trễ</span>
                    <span className="font-black text-amber-800 text-xs block mt-0.5">{formatVND(detail?.lateFee)}</span>
                    <span className="text-[8px] text-amber-600 block leading-tight mt-0.5">Khấu trừ vào cọc</span>
                  </div>
                </div>

                {/* Khung Định giá tài sản & Thời gian giữ hàng ước tính */}
                <div className="p-2.5 bg-white border border-purple-200 rounded-lg space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-purple-600">inventory_2</span>
                      Định giá tài sản &amp; Thời gian giữ hàng ước tính
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Đơn giá phạt: <strong className="text-slate-700">{formatVND(dailyPenaltyRate)}/ngày</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center pt-0.5">
                    <div className="p-1.5 bg-indigo-50/70 border border-indigo-100 rounded">
                      <span className="text-[9px] text-indigo-700 block uppercase font-medium">Tổng thanh lý</span>
                      <span className="font-bold text-indigo-900 text-xs block">{formatVND(totalLiquidationValue)}</span>
                    </div>
                    <div className="p-1.5 bg-emerald-50/70 border border-emerald-100 rounded">
                      <span className="text-[9px] text-emerald-700 block uppercase font-medium">Sau bù công nợ</span>
                      <span className="font-bold text-emerald-800 text-xs block">{formatVND(Math.max(0, totalLiquidationValue - (detail?.totalDebt || 0)))}</span>
                    </div>
                    <div className={`p-1.5 rounded border ${estimatedHoldingDays === 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-purple-50 border-purple-200 text-purple-800'}`}>
                      <span className="text-[9px] block uppercase font-medium">Ước tính giữ kho</span>
                      <span className="font-black text-xs block">{estimatedHoldingDays} ngày</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
                    Ước tính ngày = ({formatVND(totalLiquidationValue)} - {formatVND(detail?.totalDebt)}) / {formatVND(dailyPenaltyRate)}/ngày = <strong className="text-purple-700">{estimatedHoldingDays} ngày</strong>
                  </div>
                </div>

              </div>
            ) : (
              /* Thiết kế các trường hợp chuẩn: Ân hạn, Cảnh báo, Thu hồi PIN, Đủ ĐK Niêm phong */
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2 text-xs">
                <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-800 text-[11px]">Nội dung phát thông báo tóm tắt:</span>
                  <span className="font-mono text-[10px] text-slate-500">+{detail?.daysOverdue} ngày quá hạn</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Tiền cọc giữ:</span>
                    <span className="font-bold text-slate-800 text-xs">{formatVND(detail?.depositHeld)}</span>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Phí phạt trễ hạn:</span>
                    <span className="font-bold text-rose-600 text-xs">+{formatVND(detail?.lateFee)}</span>
                  </div>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed">
                  {detail?.totalDebt && detail.totalDebt > 0 ? (
                    <span className="text-rose-700 font-medium">
                      Phí phạt đã vượt cọc giữ. Khách hàng cần thanh toán tổng công nợ <strong>{formatVND(detail.totalDebt)}</strong> và làm thủ tục bàn giao kho.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      Phí phạt được khấu trừ vào tiền cọc giữ. Số tiền hoàn dự kiến khi trả kho: <strong>{formatVND(detail?.customerRefundAmount)}</strong>.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Ghi chú thêm của nhân viên */}
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-semibold text-slate-700">Ghi chú nhân viên / Lời nhắn gửi kèm:</label>
              <textarea
                value={remindNotes}
                onChange={e => setRemindNotes(e.target.value)}
                placeholder="Nhập ghi chú hoặc nhắc nhở riêng cho khách hàng nếu có..."
                rows={2}
                className="p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRemindDialog(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Đang gửi thông báo...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Gửi thông báo ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Dialog: Confirm Revoke PIN (Gateway hoặc Tạm thời) */}
      {showRevokeConfirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          {isTempPinActive ? (
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-scaleUp">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                  <span className="material-symbols-outlined text-2xl">help</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900">Xác nhận thu hồi</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Bạn có chắc muốn thu hồi pin tạm thời không?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirmDialog(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleExecutePinRevocation}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      Đang thu hồi...
                    </>
                  ) : (
                    'Xác nhận'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-scaleUp">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                  <span className="material-symbols-outlined text-2xl">lock_clock</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900">Xác nhận thu hồi quyền PIN SmartLock</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thao tác sẽ thu hồi ngay lập tức quyền mở kho qua IoT Gateway.
                  </p>
                </div>
              </div>

              {/* Warning Details Card */}
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Ngăn kho:</span>
                  <span className="font-bold text-slate-900">{detail?.unitCode || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Khách hàng:</span>
                  <span className="font-semibold text-slate-900">{detail?.customerName || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Tổng công nợ quá hạn:</span>
                  <span className="font-black text-rose-600">{formatVND(detail?.totalDebt)}</span>
                </div>
                <div className="pt-2 border-t border-rose-200/80 text-[11px] text-rose-800 leading-relaxed">
                  ⚠️ <strong>Cảnh báo:</strong> Sau khi xác nhận, mã PIN / QR của khách hàng sẽ bị vô hiệu hóa trên hệ thống SmartLock. Khách hàng không thể tự mở kho cho đến khi thanh toán toàn bộ công nợ hoặc được cấp quyền tạm thời.
                </div>
              </div>

              {/* Reason input */}
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="font-semibold text-slate-700">Lý do thu hồi quyền truy cập:</label>
                <textarea
                  value={revokeReason}
                  onChange={e => setRevokeReason(e.target.value)}
                  placeholder="Nhập lý do thu hồi quyền truy cập..."
                  rows={2}
                  className="p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirmDialog(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecutePinRevocation}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      Đang thu hồi...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                      Xác nhận thu hồi PIN ngay
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Dialog: Temporary PIN Grant */}
      {showTempPinDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900">Cấp quyền truy cập SmartLock tạm thời</h3>
            <p className="text-xs text-slate-500">
              Chỉ Quản lý cơ sở (Facility Manager) và Quản lý kinh doanh (Business Manager) mới có thẩm quyền cấp mã PIN tạm thời khi khách có lý do chính đáng và cam kết hoàn tất thanh toán.
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <label className="font-semibold text-slate-700">Thời hạn cấp quyền:</label>
              <select
                value={tempPinHours}
                onChange={e => setTempPinHours(Number(e.target.value))}
                className="p-2 border border-slate-300 rounded-lg"
              >
                <option value={12}>12 giờ</option>
                <option value={24}>24 giờ (1 ngày)</option>
                <option value={48}>48 giờ (2 ngày)</option>
              </select>

              <label className="font-semibold text-slate-700 mt-1">Lý do cấp quyền (Bắt buộc):</label>
              <textarea
                value={tempPinReason}
                onChange={e => setTempPinReason(e.target.value)}
                rows={2}
                className="p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTempPinDialog(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleGrantTempPin}
                disabled={isSubmitting || !tempPinReason.trim()}
                className="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900"
              >
                Xác nhận cấp PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Dialog: Sealing Request */}
      {showSealingRequestDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900">Gửi đề xuất niêm phong kho lưu trữ</h3>
            <div className="flex flex-col gap-2 text-xs">
              <label className="font-semibold text-slate-700">Lý do đề xuất niêm phong:</label>
              <textarea
                value={sealingReason}
                onChange={e => setSealingReason(e.target.value)}
                rows={3}
                className="p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSealingRequestDialog(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSealingWorkflow('REQUEST')}
                disabled={isSubmitting || !sealingReason.trim()}
                className="px-4 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600"
              >
                Gửi đề xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Dialog: Sealing Approval / Rejection */}
      {showSealingApprovalDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900">
              {isRejecting ? 'Từ chối đề xuất niêm phong' : 'Phê duyệt đề xuất niêm phong kho'}
            </h3>
            {isRejecting ? (
              <div className="flex flex-col gap-2 text-xs">
                <label className="font-semibold text-slate-700">Lý do từ chối (Bắt buộc):</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  className="p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Bạn xác nhận phê duyệt đề xuất niêm phong buồng kho <strong>#{detail?.unitCode}</strong>? Sau khi duyệt, nhân viên cơ sở có thể tiến hành dán tem niêm phong và kiểm kê tài sản.
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSealingApprovalDialog(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSealingWorkflow(isRejecting ? 'REJECT' : 'APPROVE')}
                disabled={isSubmitting || (isRejecting && !rejectionReason.trim())}
                className={`px-4 py-1.5 text-white text-xs font-bold rounded-xl ${
                  isRejecting ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isRejecting ? 'Xác nhận từ chối' : 'Xác nhận phê duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Dialog: Inventory On-site (Kiểm kê hiện trường) */}
      {showInventoryDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-hidden animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200">
                <span className="material-symbols-outlined text-2xl">fact_check</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Kiểm kê tài sản hiện trường (Kho #{detail?.unitCode})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mở kho và ghi nhận toàn bộ vật dụng, tình trạng tài sản trước khi tiến hành niêm phong kho.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Người chứng kiến kiểm kê:</label>
                <div className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-indigo-600">person_check</span>
                    <span className="font-semibold text-slate-900">
                      {currentUser?.fullName || currentUser?.email || 'Tài khoản hiện tại'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">Danh mục tài sản kiểm kê trong kho:</label>
                  <button
                    type="button"
                    onClick={addInventoryRow}
                    className="text-indigo-600 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Thêm đồ dùng
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {inventoryItems.map((item, index) => (
                    <div key={index} className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Tên tài sản / vật dụng"
                          value={item.itemName}
                          onChange={e => updateInventoryRow(index, 'itemName', e.target.value)}
                          className="flex-2 p-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="SL"
                          min={1}
                          value={item.quantity}
                          onKeyDown={e => {
                            if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault()
                            }
                          }}
                          onChange={e => {
                            const raw = e.target.value
                            const num = Number(raw)
                            updateInventoryRow(index, 'quantity', isNaN(num) || num < 1 ? 1 : Math.floor(num))
                          }}
                          className="w-16 p-1.5 bg-white border border-slate-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Tình trạng"
                          value={item.conditionStatus}
                          onChange={e => updateInventoryRow(index, 'conditionStatus', e.target.value)}
                          className="w-24 p-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Giá trị ước tính"
                          min={0}
                          step={50000}
                          value={item.estimatedValue === 0 ? '' : item.estimatedValue}
                          onKeyDown={e => {
                            if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault()
                            }
                          }}
                          onChange={e => {
                            const raw = e.target.value
                            if (raw === '') {
                              updateInventoryRow(index, 'estimatedValue', 0)
                            } else {
                              const num = Number(raw)
                              updateInventoryRow(index, 'estimatedValue', isNaN(num) || num < 0 ? 0 : num)
                            }
                          }}
                          className="w-28 p-1.5 bg-white border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                        {inventoryItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInventoryRow(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                            title="Xóa dòng"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-slate-400 shrink-0">edit_note</span>
                        <input
                          type="text"
                          placeholder="Ghi chú cho đồ dùng này"
                          value={item.notes || ''}
                          onChange={e => updateInventoryRow(index, 'notes', e.target.value)}
                          className="flex-1 p-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ghi chú hiện trường:</label>
                <textarea
                  value={sealingNotes}
                  onChange={e => setSealingNotes(e.target.value)}
                  placeholder="Ghi chú thêm về hiện trạng đồ dùng, đóng gói, ghi nhận khách quan..."
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ảnh chụp hiện trường kiểm kê / niêm phong:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs cursor-pointer transition">
                    <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                    <span>{isUploadingSealingPhoto ? 'Đang tải lên...' : (sealingPhotoUrl ? 'Đổi ảnh hiện trường' : 'Tải ảnh lên')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingSealingPhoto}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setIsUploadingSealingPhoto(true)
                        try {
                          const url = await supportTicketService.uploadAttachment(file)
                          if (url) {
                            setSealingPhotoUrl(url)
                            toast.success('Đã tải ảnh hiện trường kiểm kê thành công!')
                          }
                        } catch (err: any) {
                          toast.error(err?.response?.data?.message || err?.message || 'Không thể tải ảnh hiện trường.')
                        } finally {
                          setIsUploadingSealingPhoto(false)
                          e.target.value = ''
                        }
                      }}
                    />
                  </label>
                  {sealingPhotoUrl && (
                    <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg">
                      <img src={sealingPhotoUrl} alt="Ảnh hiện trường" className="w-9 h-9 object-cover rounded border border-slate-200" />
                      <a href={sealingPhotoUrl} target="_blank" rel="noreferrer" className="text-[11px] font-mono text-indigo-600 hover:underline truncate max-w-[180px]">
                        {sealingPhotoUrl}
                      </a>
                      <button
                        type="button"
                        onClick={() => setSealingPhotoUrl('')}
                        className="text-slate-400 hover:text-rose-600 text-xs px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Sau khi hoàn tất kiểm kê, hệ thống sẽ mở khóa nút <strong>Niêm phong</strong> để dán tem kho.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInventoryDialog(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleSealingWorkflow('INVENTORY')}
                  disabled={isSubmitting || inventoryItems.every(i => !i.itemName.trim())}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Hoàn tất kiểm kê
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* Sub-Dialog: Giải phóng kho do hết hạn mức giữ kho (Liquidation Release) */}
      {showLiquidationReleaseModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">meeting_room</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Giải phóng buồng kho #{detail?.unitCode}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thanh lý tài sản kiểm kê &amp; chuyển buồng kho về trạng thái AVAILABLE
                </p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Buồng kho:</span>
                <span className="font-bold text-slate-900">{detail?.unitCode} ({detail?.unitTypeName || 'Kho'})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Khách hàng:</span>
                <span className="font-semibold text-slate-900">{detail?.customerName} ({detail?.customerPhone})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tổng công nợ hiện tại:</span>
                <span className="font-bold text-rose-700">{formatVND(detail?.totalDebt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tổng tiền đồ thanh lý:</span>
                <span className="font-black text-indigo-700">{formatVND(totalLiquidationValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Thời gian ước tính giữ hàng:</span>
                <span className="font-black text-rose-600">{estimatedHoldingDays} ngày (Đã hết hạn mức)</span>
              </div>
              <div className="pt-2 border-t border-rose-200/80 text-[11px] text-rose-900 leading-relaxed space-y-1">
                <p>
                  ✓ Buồng kho sẽ được chuyển trực tiếp sang trạng thái <strong>SẴN SÀNG (AVAILABLE)</strong> để khai thác cho thuê.
                </p>
                <p>
                  ✓ Mã PIN / quyền truy cập SmartLock IoT bị thu hồi toàn bộ.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700">Ghi chú biên bản giải phóng kho:</label>
              <textarea
                value={liquidationNotes}
                onChange={e => setLiquidationNotes(e.target.value)}
                rows={2}
                placeholder="Nhập ghi chú hoặc lý do giải phóng..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLiquidationReleaseModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleLiquidateRelease}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Đang giải phóng kho...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Xác nhận giải phóng kho (AVAILABLE)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Dialog: Confirm Sealing (Xác nhận niêm phong kho) */}
      {showConfirmSealingDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 border border-purple-200">
                <span className="material-symbols-outlined text-2xl">gavel</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Xác nhận niêm phong ngăn kho #{detail?.unitCode}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thao tác dán tem niêm phong vật lý và lập biên bản xử lý nợ cước BR-RULE-012.
                </p>
              </div>
            </div>

            {/* Confirmation Dossier Summary */}
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Ngăn kho:</span>
                <span className="font-bold text-slate-900">{detail?.unitCode || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Hợp đồng nợ cước:</span>
                <span className="font-semibold text-slate-900">{detail?.contractCode || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Khách hàng:</span>
                <span className="font-semibold text-slate-900">{detail?.customerName || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tài sản đã kiểm kê:</span>
                <span className="font-bold text-indigo-700">
                  {inventoryItems.filter(i => i.itemName.trim()).length || detail?.sealingDossier?.items?.length || 0} mục đồ dùng
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Người chứng kiến:</span>
                <span className="font-semibold text-slate-900">
                  {currentUser?.fullName || currentUser?.email || 'Tài khoản hiện tại'} ({currentUser?.role?.name || currentUser?.roleName || 'STAFF'})
                </span>
              </div>
              {(sealingNotes || detail?.sealingDossier?.notes) && (
                <div className="flex justify-between items-start">
                  <span className="text-slate-600">Ghi chú hiện trường:</span>
                  <span className="font-medium text-slate-800 max-w-[65%] text-right line-clamp-2">
                    {sealingNotes || detail?.sealingDossier?.notes}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-purple-200/80 text-[11px] text-purple-900 leading-relaxed">
                ⚠️ <strong>Lưu ý nghiệp vụ:</strong> Sau khi niêm phong, ngăn kho sẽ được dán tem niêm phong vật lý và khóa cứng. Trạng thái ngăn kho chuyển sang <strong>BẢO TRÌ/NIÊM PHONG (UNDER_MAINTENANCE)</strong>. Khách hàng không thể tiếp cận ngăn kho cho đến khi thanh lý hoặc giải tỏa niêm phong.
              </div>
            </div>

            {/* Seal Tag Input */}
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700">Mã tem niêm phong (Seal Tag):</label>
              <input
                type="text"
                value={sealTagNumber}
                onChange={e => setSealTagNumber(e.target.value)}
                placeholder="VD: SEAL-D7-C207-4821"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmSealingDialog(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSealingWorkflow('COMPLETE')}
                disabled={isSubmitting || !sealTagNumber.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Đang niêm phong...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    Xác nhận dán tem niêm phong
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

