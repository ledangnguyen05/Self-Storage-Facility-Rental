import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  supportTicketService,
  SupportTicketRecord,
  SupportTicketContactLog,
  EscalationContact,
  SupportTicketStats
} from '../../services/supportTicketService'
import { userService } from '../../services/userService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { useAuth } from '../../context/AuthContext'
import { User, Facility, StorageUnit } from '../../types'
import { toast } from '../../utils/toast'

export const IncidentTicketsPage: React.FC = () => {
  const { user, role } = useAuth()
  const effectiveRole = role || (typeof user?.role === 'string' ? user.role : user?.role?.name) || 'STAFF'
  const isStaff = effectiveRole === 'STAFF'
  const isFacilityManager = effectiveRole === 'FACILITY_MANAGER'
  const isBusinessManager = effectiveRole === 'BUSINESS_MANAGER'
  const isAdmin = effectiveRole === 'ADMIN'
  const isReadOnly = isBusinessManager || isAdmin

  // Task 3: Strictly enforce facility scope.
  // - Staff is always confined to assigned facility.
  // - Facility Manager assigned to a facility is strictly confined to that facility.
  // - "Tất cả cơ sở" option is only available to Admin & BOM (Business Operations Manager).
  const isFacilityScoped = isStaff || (isFacilityManager && Boolean(user?.facilityId))
  const canSelectAllFacilities = !isFacilityScoped && (isAdmin || isBusinessManager)

  // Tickets & data
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [stats, setStats] = useState<SupportTicketStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Accessible facilities according to role permission
  const accessibleFacilities = useMemo(() => {
    if (isFacilityScoped && user?.facilityId) {
      const matched = facilities.filter(f => f.id === user.facilityId)
      if (matched.length > 0) return matched
      if (user?.facilityName) {
        return [{
          id: user.facilityId,
          name: user.facilityName,
          code: user.facilityCode || 'FAC',
          address: '',
          city: '',
          contactPhone: '',
          totalUnits: 0,
          availableUnits: 0,
        } as Facility]
      }
    }
    return facilities
  }, [facilities, isFacilityScoped, user?.facilityId, user?.facilityName, user?.facilityCode])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string>(() => {
    if (isFacilityScoped && user?.facilityId) return user.facilityId
    return canSelectAllFacilities ? 'ALL' : (user?.facilityId || 'ALL')
  })
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 10

  const currentEffectiveFacilityId = isFacilityScoped && user?.facilityId
    ? user.facilityId
    : (selectedFacilityFilter && selectedFacilityFilter !== 'ALL' ? selectedFacilityFilter : undefined)

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('LOCK_ISSUE')
  const [newUnitCode, setNewUnitCode] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newDescription, setNewDescription] = useState('')
  const [newFacilityId, setNewFacilityId] = useState<string>('')
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  // Assign Modal (FM only)
  const [assigningTicket, setAssigningTicket] = useState<SupportTicketRecord | null>(null)
  const [facilityStaffList, setFacilityStaffList] = useState<User[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [assignNotes, setAssignNotes] = useState<string>('')
  const [assignPriority, setAssignPriority] = useState<string>('')
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false)

  // Resolve Modal (Staff & FM)
  const [resolvingTicket, setResolvingTicket] = useState<SupportTicketRecord | null>(null)
  const [resolutionText, setResolutionText] = useState('')
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false)

  // Contact BOM Modal (FM only)
  const [contactBomTicket, setContactBomTicket] = useState<SupportTicketRecord | null>(null)
  const [escalationContacts, setEscalationContacts] = useState<EscalationContact[]>([])
  const [contactLogs, setContactLogs] = useState<SupportTicketContactLog[]>([])
  const [isLoadingContactLogs, setIsLoadingContactLogs] = useState(false)
  const [selectedContactMethod, setSelectedContactMethod] = useState<'PHONE' | 'EMAIL' | 'INTERNAL_CHAT' | 'OTHER'>('PHONE')
  const [targetContactName, setTargetContactName] = useState('')
  const [contactSummary, setContactSummary] = useState('')
  const [contactResult, setContactResult] = useState('')
  const [isSubmittingContactLog, setIsSubmittingContactLog] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Detail Modal (All roles)
  const [detailTicket, setDetailTicket] = useState<SupportTicketRecord | null>(null)
  const [detailContactLogs, setDetailContactLogs] = useState<SupportTicketContactLog[]>([])
  const [isLoadingDetailLogs, setIsLoadingDetailLogs] = useState(false)

  // Reopen Modal (FM only)
  const [reopenTargetTicket, setReopenTargetTicket] = useState<SupportTicketRecord | null>(null)
  const [fmReopenReason, setFmReopenReason] = useState('')
  const [isSubmittingReopen, setIsSubmittingReopen] = useState(false)

  // Close Ticket Modal (FM only - Task 2 confirmation modal)
  const [closingTicketTarget, setClosingTicketTarget] = useState<SupportTicketRecord | null>(null)
  const [closeTicketNote, setCloseTicketNote] = useState('')
  const [isSubmittingClose, setIsSubmittingClose] = useState(false)
  const [closeTicketError, setCloseTicketError] = useState<string | null>(null)

  // Flow 7 System Actions States
  // 6A: IoT Lock Actions
  const [isRegeneratingPin, setIsRegeneratingPin] = useState(false)
  const [isRemoteUnlocking, setIsRemoteUnlocking] = useState(false)

  // 6B: Billing Adjustment Modal
  const [showBillingModal, setShowBillingModal] = useState(false)
  const [billingAmount, setBillingAmount] = useState('')
  const [billingNote, setBillingNote] = useState('')
  const [isSubmittingBilling, setIsSubmittingBilling] = useState(false)

  // 6C: Maintenance & Unit Transfer Modals
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [maintenanceReason, setMaintenanceReason] = useState('')
  const [maintenancePerson, setMaintenancePerson] = useState('')
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false)

  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferTargetUnitId, setTransferTargetUnitId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [availableUnitsForTransfer, setAvailableUnitsForTransfer] = useState<StorageUnit[]>([])
  const [isLoadingAvailableUnits, setIsLoadingAvailableUnits] = useState(false)
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false)

  // Step 7: Tabbed Messaging Box in Detail Modal
  const [messageTab, setMessageTab] = useState<'INTERNAL_NOTE' | 'CUSTOMER_REPLY'>('INTERNAL_NOTE')
  const [messageContent, setMessageContent] = useState('')
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false)

  const fetchTicketsAndData = useCallback(async (facilityIdOverride?: string) => {
    setIsLoading(true)
    setFetchError(null)
    setTickets([])
    setStats(null)
    try {
      const activeFilter = facilityIdOverride !== undefined ? facilityIdOverride : selectedFacilityFilter
      let effectiveFacilityId: string | undefined = undefined
      if (isFacilityScoped && user?.facilityId) {
        effectiveFacilityId = user.facilityId
      } else if (activeFilter && activeFilter !== 'ALL') {
        effectiveFacilityId = activeFilter
      }

      const [queueRes, statsRes, facRes] = await Promise.allSettled([
        supportTicketService.getQueue({ facilityId: effectiveFacilityId }),
        supportTicketService.getStats(effectiveFacilityId),
        facilityService.getFacilities()
      ])

      if (queueRes.status === 'fulfilled' && Array.isArray(queueRes.value)) {
        setTickets(queueRes.value)
      } else {
        setTickets([])
        if (queueRes.status === 'rejected') {
          const err: any = queueRes.reason
          setFetchError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách sự cố')
        }
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value)
      } else {
        setStats(null)
      }

      if (facRes.status === 'fulfilled' && facRes.value?.content) {
        setFacilities(facRes.value.content)
      }
    } catch (err: any) {
      console.warn('Failed to load tickets:', err)
      setFetchError(err?.response?.data?.message || err?.message || 'Lỗi khi tải dữ liệu sự cố')
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [isFacilityScoped, user?.facilityId, selectedFacilityFilter])

  // Initial load and reload whenever selected facility filter changes
  useEffect(() => {
    fetchTicketsAndData(selectedFacilityFilter)
  }, [selectedFacilityFilter, fetchTicketsAndData])

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedFacilityFilter, categoryFilter, priorityFilter, statusFilter, overdueOnly])

  // Enforce facility scope and synchronization
  useEffect(() => {
    if (isFacilityScoped && user?.facilityId) {
      if (selectedFacilityFilter !== user.facilityId) {
        setSelectedFacilityFilter(user.facilityId)
      }
    } else if (!canSelectAllFacilities && user?.facilityId) {
      if (selectedFacilityFilter !== user.facilityId) {
        setSelectedFacilityFilter(user.facilityId)
      }
    } else if (canSelectAllFacilities && selectedFacilityFilter !== 'ALL') {
      if (facilities.length > 0 && !facilities.some(f => f.id === selectedFacilityFilter)) {
        setSelectedFacilityFilter('ALL')
      }
    }
  }, [isFacilityScoped, canSelectAllFacilities, user?.facilityId, facilities, selectedFacilityFilter])

  // Handle Take Ticket (Staff / FM - Flow 7 Bước 5)
  const handleTakeTicket = async (ticket: SupportTicketRecord) => {
    if (isReadOnly) return
    try {
      const updated = await supportTicketService.takeTicket(ticket.id)
      toast.success(`Đã tiếp nhận xử lý sự cố #${ticket.ticketCode || ticket.id.slice(0, 8)}. Trạng thái chuyển sang ĐANG XỬ LÝ (IN_PROGRESS).`)
      if (detailTicket?.id === ticket.id) {
        setDetailTicket(updated)
      }
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể tiếp nhận ticket')
    }
  }

  // Flow 7 Bước 6A: IoT Lock Actions
  const handleRegeneratePin = async (ticketId: string) => {
    setIsRegeneratingPin(true)
    try {
      const res = await supportTicketService.regeneratePin(ticketId)
      toast.success('Đã tạo và đồng bộ mã PIN mới cho ô kho thành công!')
      setDetailTicket(res)
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể cấp lại mã PIN.')
    } finally {
      setIsRegeneratingPin(false)
    }
  }

  const handleRemoteUnlock = async (ticketId: string) => {
    if (!window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn phát lệnh MỞ KHÓA TỪ XA KHẨN CẤP cho ô kho này không?')) return
    setIsRemoteUnlocking(true)
    try {
      const res = await supportTicketService.remoteUnlock(ticketId)
      toast.success('Đã gửi lệnh mở khóa từ xa khẩn cấp thành công!')
      setDetailTicket(res)
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể mở khóa từ xa.')
    } finally {
      setIsRemoteUnlocking(false)
    }
  }

  // Flow 7 Bước 6B: Billing Adjustment
  const handleSubmitBillingAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailTicket) return
    setIsSubmittingBilling(true)
    try {
      const amountNum = billingAmount ? Number(billingAmount) : undefined
      const res = await supportTicketService.adjustBilling(detailTicket.id, {
        amount: amountNum,
        note: billingNote.trim() || undefined,
      })
      toast.success('Đã cập nhật điều chỉnh/miễn trừ phụ phí thành công!')
      setShowBillingModal(false)
      setBillingAmount('')
      setBillingNote('')
      setDetailTicket(res)
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể điều chỉnh phụ phí.')
    } finally {
      setIsSubmittingBilling(false)
    }
  }

  // Flow 7 Bước 6C: Maintenance & Unit Transfer
  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailTicket) return
    setIsSubmittingMaintenance(true)
    try {
      const res = await supportTicketService.setUnitMaintenance(detailTicket.id, {
        reason: maintenanceReason.trim() || undefined,
        maintainerName: maintenancePerson.trim() || user?.fullName || undefined,
      })
      toast.success('Đã chuyển ô kho sang trạng thái BẢO TRÌ (UNDER_MAINTENANCE) thành công!')
      setShowMaintenanceModal(false)
      setMaintenanceReason('')
      setMaintenancePerson('')
      setDetailTicket(res)
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể chuyển trạng thái bảo trì.')
    } finally {
      setIsSubmittingMaintenance(false)
    }
  }

  const handleOpenTransferModal = async (ticket: SupportTicketRecord) => {
    setShowTransferModal(true)
    setTransferTargetUnitId('')
    setTransferReason(`Điều chuyển kho tạm thời để xử lý sự cố #${ticket.ticketCode || ticket.id.slice(0, 8)}`)
    setIsLoadingAvailableUnits(true)
    try {
      const units = await storageUnitService.getUnits({
        facilityId: ticket.facilityId,
        status: 'AVAILABLE',
      })
      setAvailableUnitsForTransfer(units || [])
    } catch (err: any) {
      console.warn('Failed to load available units:', err)
      setAvailableUnitsForTransfer([])
    } finally {
      setIsLoadingAvailableUnits(false)
    }
  }

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailTicket || !transferTargetUnitId) {
      toast.warning('Vui lòng chọn ô kho đích để chuyển đến')
      return
    }
    setIsSubmittingTransfer(true)
    try {
      const res = await supportTicketService.transferUnit(detailTicket.id, {
        targetUnitId: transferTargetUnitId,
        reason: transferReason.trim() || undefined,
      })
      toast.success('Đã điều chuyển khách hàng sang ô kho mới thành công!')
      setShowTransferModal(false)
      setDetailTicket(res)
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể điều chuyển ô kho.')
    } finally {
      setIsSubmittingTransfer(false)
    }
  }

  // Flow 7 Bước 7: Send Message / Log (Internal Note vs Customer Reply)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailTicket || !messageContent.trim()) return
    setIsSubmittingMessage(true)
    try {
      await supportTicketService.addTicketMessage(detailTicket.id, {
        messageType: messageTab,
        content: messageContent.trim(),
      })
      toast.success(messageTab === 'INTERNAL_NOTE' ? 'Đã lưu ghi chú nội bộ' : 'Đã gửi phản hồi đến khách hàng')
      setMessageContent('')
      const logs = await supportTicketService.getContactLogs(detailTicket.id)
      setDetailContactLogs(logs)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể lưu tin nhắn/ghi chú.')
    } finally {
      setIsSubmittingMessage(false)
    }
  }

  // Handle Resolve Ticket
  const handleSubmitResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingTicket || isReadOnly) return
    setIsSubmittingResolve(true)
    try {
      await supportTicketService.resolveTicket(resolvingTicket.id, resolutionText.trim() || 'Đã kiểm tra hiện trường và xử lý khắc phục sự cố')
      setResolvingTicket(null)
      setResolutionText('')
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể cập nhật hoàn tất ticket')
    } finally {
      setIsSubmittingResolve(false)
    }
  }

  // Handle Open Close Ticket Confirmation Modal (FM only - Task 2)
  const handleOpenCloseModal = (ticket: SupportTicketRecord) => {
    if (!isFacilityManager) return
    setClosingTicketTarget(ticket)
    setCloseTicketNote('Quản lý cơ sở đã nghiệm thu hiện trường và xác nhận đóng ticket.')
    setCloseTicketError(null)
  }

  // Handle Submit Close Ticket (FM only)
  const handleSubmitCloseTicket = async () => {
    if (!closingTicketTarget || !isFacilityManager || isSubmittingClose) return
    setIsSubmittingClose(true)
    setCloseTicketError(null)
    try {
      await supportTicketService.closeTicket(closingTicketTarget.id, closeTicketNote.trim() || 'Quản lý cơ sở đã nghiệm thu và xác nhận đóng ticket')
      setClosingTicketTarget(null)
      await fetchTicketsAndData()
    } catch (err: any) {
      setCloseTicketError(err?.response?.data?.message || err?.message || 'Không thể đóng ticket. Trạng thái phiếu vẫn được giữ nguyên.')
    } finally {
      setIsSubmittingClose(false)
    }
  }

  // Handle Reopen Ticket (FM only)
  const handleSubmitFmReopen = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reopenTargetTicket || !isFacilityManager || !fmReopenReason.trim()) return
    setIsSubmittingReopen(true)
    try {
      await supportTicketService.reopenTicket(reopenTargetTicket.id, fmReopenReason.trim())
      setReopenTargetTicket(null)
      setFmReopenReason('')
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể yêu cầu xử lý lại')
    } finally {
      setIsSubmittingReopen(false)
    }
  }

  // Open Assign Modal (FM only)
  const handleOpenAssignModal = async (ticket: SupportTicketRecord) => {
    setAssigningTicket(ticket)
    setSelectedStaffId(ticket.assignedStaffId || '')
    setAssignNotes('')
    setAssignPriority(ticket.priority || 'MEDIUM')
    try {
      const facId = ticket.facilityId || user?.facilityId
      const res = await userService.getAllUsers({ role: 'STAFF', facilityId: facId })
      setFacilityStaffList(res?.data || [])
    } catch (err) {
      console.warn('Failed to fetch staff for facility:', err)
      setFacilityStaffList([])
    }
  }

  // Submit Assign
  const handleSubmitAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningTicket || !selectedStaffId || !isFacilityManager) return
    setIsSubmittingAssign(true)
    try {
      await supportTicketService.assignTicket(assigningTicket.id, {
        assignedStaffId: selectedStaffId,
        notes: assignNotes.trim() || undefined,
        priority: assignPriority || undefined
      })
      setAssigningTicket(null)
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể phân công ticket')
    } finally {
      setIsSubmittingAssign(false)
    }
  }

  // Open Contact BOM Modal (FM only)
  const handleOpenContactBomModal = async (ticket: SupportTicketRecord) => {
    setContactBomTicket(ticket)
    setContactSummary('')
    setContactResult('')
    setSelectedContactMethod('PHONE')
    setIsLoadingContactLogs(true)
    try {
      const [contactsRes, logsRes] = await Promise.allSettled([
        supportTicketService.getEscalationContacts(),
        supportTicketService.getContactLogs(ticket.id)
      ])
      if (contactsRes.status === 'fulfilled') {
        setEscalationContacts(contactsRes.value)
        if (contactsRes.value.length > 0) {
          setTargetContactName(`${contactsRes.value[0].fullName} (${contactsRes.value[0].email})`)
        }
      }
      if (logsRes.status === 'fulfilled') {
        setContactLogs(logsRes.value)
      }
    } catch (err) {
      console.warn('Failed to load contact logs or escalation contacts:', err)
    } finally {
      setIsLoadingContactLogs(false)
    }
  }

  // Submit Contact Log
  const handleSubmitContactLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactBomTicket || !isFacilityManager || !contactSummary.trim()) return
    setIsSubmittingContactLog(true)
    try {
      await supportTicketService.recordContactLog(contactBomTicket.id, {
        contactMethod: selectedContactMethod,
        targetRole: 'BUSINESS_OPERATIONS_MANAGER',
        contactTarget: targetContactName,
        summary: contactSummary.trim(),
        result: contactResult.trim() || undefined
      })
      // Refresh contact logs
      const updatedLogs = await supportTicketService.getContactLogs(contactBomTicket.id)
      setContactLogs(updatedLogs)
      setContactSummary('')
      setContactResult('')
      toast.success('Đã lưu nhật ký liên hệ thành công. (Lưu ý: Không thay đổi trạng thái ticket)')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể lưu nhật ký liên hệ')
    } finally {
      setIsSubmittingContactLog(false)
    }
  }

  // Copy Ticket Details for Escalation
  const handleCopyTicketForEscalation = (ticket: SupportTicketRecord) => {
    const text = `[BOXORA SUPPORT ESCALATION]\nMã ticket: #${ticket.ticketCode || ticket.id.substring(0, 8)}\nCơ sở: ${ticket.facilityName || 'N/A'}\nKho: ${ticket.unitCode ? `#${ticket.unitCode}` : 'Khu vực cơ sở'}\nƯu tiên: ${ticket.priority}\nTrạng thái: ${ticket.status}\nTiêu đề: ${ticket.title}\nMô tả: ${ticket.description}\nThời điểm phát sinh: ${ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('vi-VN') : 'N/A'}`
    navigator.clipboard.writeText(text)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  // Open Detail Modal
  const handleOpenDetailModal = async (ticket: SupportTicketRecord) => {
    setDetailTicket(ticket)
    setIsLoadingDetailLogs(true)
    try {
      const logs = await supportTicketService.getContactLogs(ticket.id)
      setDetailContactLogs(logs)
    } catch (err) {
      setDetailContactLogs([])
    } finally {
      setIsLoadingDetailLogs(false)
    }
  }

  // Handle Create Ticket (Staff / FM)
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isReadOnly || !newTitle.trim()) return
    setIsSubmittingCreate(true)
    try {
      await supportTicketService.createTicket({
        category: newCategory,
        title: newTitle.trim(),
        description: newDescription.trim() || 'Báo cáo sự cố tại hiện trường',
        priority: newPriority,
        facilityId: newFacilityId || user?.facilityId || undefined
      })
      setIsCreateModalOpen(false)
      setNewTitle('')
      setNewUnitCode('')
      setNewDescription('')
      await fetchTicketsAndData()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể tạo ticket mới')
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Facility scope enforcement (Staff & Scoped Manager can strictly only access assigned facility)
      if (isFacilityScoped && user?.facilityId && t.facilityId !== user.facilityId) return false

      // Facility filter
      if (selectedFacilityFilter !== 'ALL' && t.facilityId !== selectedFacilityFilter) return false

      // Category filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false

      // Priority filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false

      // Status filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false

      // Overdue filter
      if (overdueOnly && !t.isOverdue && !t.isOverdueSla) return false

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchCode = t.ticketCode?.toLowerCase().includes(query) || t.id.toLowerCase().includes(query)
        const matchTitle = t.title?.toLowerCase().includes(query)
        const matchDesc = t.description?.toLowerCase().includes(query)
        const matchUnit = t.unitCode?.toLowerCase().includes(query)
        const matchStaff = t.assignedStaffName?.toLowerCase().includes(query)
        const matchCustomer = t.customerName?.toLowerCase().includes(query)
        const matchFacility = t.facilityName?.toLowerCase().includes(query)
        if (!matchCode && !matchTitle && !matchDesc && !matchUnit && !matchStaff && !matchCustomer && !matchFacility) {
          return false
        }
      }

      return true
    })
  }, [tickets, selectedFacilityFilter, categoryFilter, priorityFilter, statusFilter, overdueOnly, searchQuery])

  // Pagination Slice
  const totalItems = filteredTickets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTickets.slice(startIndex, startIndex + pageSize)
  }, [filteredTickets, currentPage, pageSize])

  // Category Meta Helper
  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case 'LOCK_ISSUE': return 'Khóa SmartLock'
      case 'ACCESS_ISSUE': return 'Truy cập kho'
      case 'CLEANLINESS_PEST': return 'Vệ sinh & Côn trùng'
      case 'CLIMATE_TEMP': return 'Nhiệt độ & Độ ẩm'
      case 'FACILITY_DAMAGE': return 'Hư hỏng thiết bị'
      case 'PAYMENT_ISSUE': return 'Thanh toán'
      case 'PIN_CODE': return 'Mã PIN'
      default: return 'Khác / Chung'
    }
  }

  // Priority Badge Helper
  const getPriorityBadge = (p?: string) => {
    switch (p) {
      case 'CRITICAL':
      case 'URGENT':
        return 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200'
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  // Status Badge Helper
  const getStatusBadge = (s?: string) => {
    switch (s) {
      case 'OPEN':
      case 'PENDING':
        return { label: 'Chờ tiếp nhận', badge: 'bg-amber-50 text-amber-800 border-amber-200' }
      case 'IN_PROGRESS':
        return { label: 'Đang xử lý', badge: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'RESOLVED':
        return { label: 'Đã giải quyết', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'CLOSED':
        return { label: 'Đã đóng', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
      case 'REOPENED':
        return { label: 'Mở lại (Xử lý lại)', badge: 'bg-rose-50 text-rose-700 border-rose-300' }
      default:
        return { label: s || 'N/A', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Notice Pill for BOM & Admin */}
      {isReadOnly && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-blue-600">visibility</span>
            <span>
              <strong>Chế độ Xem &amp; Báo Cáo Sự Cố:</strong> Bạn đang đăng nhập với vai trò{' '}
              <strong className="underline">{isBusinessManager ? 'Business Operations Manager' : 'System Administrator'}</strong>.
              Hệ thống giới hạn quyền để đảm bảo phân nhiệm vận hành; các thao tác phân công, cập nhật trạng thái và đóng ticket do Facility Staff &amp; Facility Manager trực tiếp phụ trách.
            </span>
          </div>
          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold font-mono text-[11px] rounded-lg border border-blue-300 shrink-0">
            CHẾ ĐỘ GIÁM SÁT
          </span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">support_agent</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Quản Lý &amp; Xử Lý Sự Cố Boxora
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200">
                {currentEffectiveFacilityId ? `Cơ sở: ${facilities.find(f => f.id === currentEffectiveFacilityId)?.name || 'Chi nhánh phân quyền'}` : 'Toàn hệ thống (Tất cả chi nhánh)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isFacilityManager
                ? 'Điều phối nhân sự kỹ thuật cơ sở, xử lý sự cố kẹt cửa/khóa thông minh, và liên hệ Ban Quản Lý (BOM) khi vượt thẩm quyền.'
                : isStaff
                ? 'Tiếp nhận sự cố được giao, cập nhật tiến độ hiện trường và đề xuất hoàn tất sau khi khắc phục.'
                : 'Theo dõi toàn diện chất lượng vận hành, tỷ lệ vi phạm SLA và tiến độ giải quyết sự cố trên toàn hệ thống.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchTicketsAndData()}
            disabled={isLoading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Làm mới</span>
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setNewTitle('')
                setNewDescription('')
                setNewUnitCode('')
                setNewFacilityId(user?.facilityId || (facilities[0]?.id || ''))
                setIsCreateModalOpen(true)
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_alert</span>
              <span>Ghi Nhận Sự Cố</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng ticket */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng sự cố trong phạm vi</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {isLoading ? <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span> : (stats?.totalTickets ?? tickets.length)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Đang xử lý: <strong className="text-blue-700">{stats ? (stats.openTickets ?? 0) + (stats.inProgressTickets ?? 0) + (stats.reopenedTickets ?? 0) : tickets.filter(t => t.status === 'IN_PROGRESS' || t.status === 'OPEN' || t.status === 'REOPENED').length}</strong> · Đã xong: <strong className="text-emerald-700">{stats ? (stats.resolvedTickets ?? 0) + (stats.closedTickets ?? 0) : tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Đang xử lý */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Chưa hoàn tất</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-700 tracking-tight">
              {isLoading ? <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span> : (stats
                ? stats.openTickets + stats.inProgressTickets + stats.reopenedTickets
                : tickets.filter(t => t.status === 'IN_PROGRESS' || t.status === 'OPEN' || t.status === 'REOPENED').length)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              OPEN, IN_PROGRESS và REOPENED
            </div>
          </div>
        </div>

        {/* Card 3: Quá SLA */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Quá hạn SLA</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <span className="material-symbols-outlined text-[18px]">alarm_on</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tracking-tight">
              {isLoading ? (
                <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span>
              ) : (
                ((stats?.overdueTickets ?? stats?.overdueSlaTickets) ?? tickets.filter(t => t.isOverdue || t.isOverdueSla).length)
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Nhóm này có thể giao với ticket chưa hoàn tất
            </div>
          </div>
        </div>

        {/* Card 4: Đã hoàn tất */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Đã xử lý &amp; hoàn tất</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tracking-tight">
              {isLoading ? <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span> : (stats
                ? stats.resolvedTickets + stats.closedTickets
                : tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              RESOLVED và CLOSED
            </div>
          </div>
        </div>
      </div>

      {/* Main Ticket Queue Table with Search, Filter & Pagination */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search input */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã, kho, khách, tiêu đề, nhân viên..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white font-mono"
              />
            </div>

            {/* Facility filter (Task 3: 'Tất cả cơ sở' is restricted to Admin & BOM, Scoped roles locked to assigned facility) */}
            <select
              value={selectedFacilityFilter}
              onChange={(e) => {
                if (isFacilityScoped) return
                setSelectedFacilityFilter(e.target.value)
              }}
              disabled={isFacilityScoped}
              title={isFacilityScoped ? 'Bạn đang xem dữ liệu cơ sở được phân công' : 'Chọn cơ sở cần lọc'}
              className={`px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none ${
                isFacilityScoped ? 'opacity-80 cursor-not-allowed bg-slate-100' : 'cursor-pointer'
              }`}
            >
              {canSelectAllFacilities && <option value="ALL">Tất cả cơ sở</option>}
              {accessibleFacilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả danh mục sự cố</option>
              <option value="LOCK_ISSUE">Khóa SmartLock</option>
              <option value="ACCESS_ISSUE">Truy cập kho</option>
              <option value="CLEANLINESS_PEST">Vệ sinh &amp; Côn trùng</option>
              <option value="CLIMATE_TEMP">Nhiệt độ &amp; Độ ẩm</option>
              <option value="FACILITY_DAMAGE">Hư hỏng thiết bị</option>
              <option value="PAYMENT_ISSUE">Thanh toán</option>
              <option value="PIN_CODE">Mã PIN</option>
              <option value="OTHER">Vấn đề khác</option>
            </select>

            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả ưu tiên</option>
              <option value="CRITICAL">Nguy cấp (Critical / Urgent)</option>
              <option value="HIGH">Ưu tiên cao (High)</option>
              <option value="MEDIUM">Bình thường (Medium)</option>
              <option value="LOW">Thấp (Low)</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="OPEN">Chờ tiếp nhận (Open)</option>
              <option value="IN_PROGRESS">Đang xử lý (In Progress)</option>
              <option value="RESOLVED">Đã giải quyết (Resolved)</option>
              <option value="CLOSED">Đã đóng (Closed)</option>
              <option value="REOPENED">Mở lại (Reopened)</option>
            </select>

            {/* Overdue SLA toggle */}
            <button
              type="button"
              onClick={() => setOverdueOnly(!overdueOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                overdueOnly
                  ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">alarm</span>
              <span>Chỉ xem quá SLA</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {fetchError && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-600">error</span>
              <span>{fetchError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTicketsAndData(selectedFacilityFilter)}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Tickets Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <th className="py-3 px-3.5">Mã ticket</th>
                <th className="py-3 px-3.5">Sự cố &amp; danh mục</th>
                <th className="py-3 px-3.5">Cơ sở &amp; kho</th>
                <th className="py-3 px-3.5 text-center">Độ ưu tiên</th>
                <th className="py-3 px-3.5">Phụ trách</th>
                <th className="py-3 px-3.5">Thời gian &amp; SLA</th>
                <th className="py-3 px-3.5 text-center">Trạng thái</th>
                <th className="py-3 px-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[20px] text-rose-600">
                        progress_activity
                      </span>
                      <span>Đang nạp danh sách ticket xử lý sự cố...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-slate-300">task_alt</span>
                      <span>Không có sự cố nào phù hợp với bộ lọc hiện tại. Cơ sở hoạt động ổn định!</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t) => {
                  const statusMeta = getStatusBadge(t.status)
                  const categoryLabel = getCategoryLabel(t.category)
                  const isResolved = t.status === 'RESOLVED'
                  const isClosed = t.status === 'CLOSED'
                  const isOpen = t.status === 'OPEN' || t.status === 'PENDING'
                  const isInProgress = t.status === 'IN_PROGRESS' || t.status === 'REOPENED'

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          #{t.ticketCode || t.id.substring(0, 8).toUpperCase()}
                        </span>
                        {t.reopenCount && t.reopenCount > 0 ? (
                          <span className="ml-1 px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[9px] font-bold rounded-full">
                            Mở lại x{t.reopenCount}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-3.5 max-w-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded">
                            {categoryLabel}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 text-xs">{t.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{t.description}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="text-slate-800 font-medium text-xs">{t.facilityName || 'N/A'}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {t.unitCode ? `Kho #${t.unitCode}` : 'Khu vực chung'}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        {t.assignedStaffName ? (
                          <div className="text-slate-800 font-semibold text-xs flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-emerald-600">badge</span>
                            <span>{t.assignedStaffName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa phân công</span>
                        )}
                        {t.customerName && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Khách: {t.customerName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                        <div>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</div>
                        {t.isOverdue || t.isOverdueSla ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-rose-100 text-rose-700 border border-rose-300 rounded text-[9px] font-bold mt-0.5">
                            <span className="material-symbols-outlined text-[10px]">alarm</span>
                            <span>SLA overdue</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">{t.slaDueAt ? `Due ${new Date(t.slaDueAt).toLocaleString('vi-VN')}` : 'SLA not set'}</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.badge}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Staff / FM Action: Take Ticket */}
                          {!isReadOnly && isOpen && !t.assignedStaffId && (
                            <button
                              type="button"
                              onClick={() => handleTakeTicket(t)}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-0.5"
                              title="Tiếp nhận xử lý sự cố này"
                            >
                              <span className="material-symbols-outlined text-[13px]">handshake</span>
                              <span>Nhận</span>
                            </button>
                          )}

                          {/* FM Action: Assign Staff */}
                          {isFacilityManager && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(t)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] border border-slate-300 transition-all cursor-pointer flex items-center gap-0.5"
                              title="Phân công nhân viên xử lý"
                            >
                              <span className="material-symbols-outlined text-[13px]">person_add</span>
                              <span>Phân công</span>
                            </button>
                          )}

                          {/* Staff / FM Action: Resolve Ticket */}
                          {!isReadOnly && isInProgress && (
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingTicket(t)
                                setResolutionText('')
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                              title="Báo cáo giải quyết xong hiện trường"
                            >
                              <span className="material-symbols-outlined text-[13px]">check</span>
                              <span>Xong</span>
                            </button>
                          )}

                          {/* FM Action: Close Ticket */}
                          {isFacilityManager && isResolved && (
                            <button
                              type="button"
                              onClick={() => handleOpenCloseModal(t)}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-neutral-800 text-white font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-0.5"
                              title="Nghiệm thu đóng ticket hoàn tất"
                            >
                              <span className="material-symbols-outlined text-[13px]">lock</span>
                              <span>Đóng</span>
                            </button>
                          )}

                          {/* FM Action: Reopen Ticket */}
                          {isFacilityManager && isResolved && (
                            <button
                              type="button"
                              onClick={() => {
                                setReopenTargetTicket(t)
                                setFmReopenReason('')
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-0.5"
                              title="Yêu cầu nhân viên xử lý lại"
                            >
                              <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                              <span>Xử lý lại</span>
                            </button>
                          )}

                          {/* FM Action: Contact BOM (Liên hệ hỗ trợ quản lý) */}
                          {isFacilityManager && (
                            <button
                              type="button"
                              onClick={() => handleOpenContactBomModal(t)}
                              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-0.5"
                              title="Liên hệ Ban Quản Lý (BOM) khi vượt thẩm quyền"
                            >
                              <span className="material-symbols-outlined text-[13px]">phone_forwarded</span>
                              <span>Báo BOM</span>
                            </button>
                          )}

                          {/* View details (All roles) */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(t)}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Xem chi tiết phiếu sự cố & lịch sử"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar - Centered */}
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 pt-3.5 border-t border-slate-100 text-xs text-slate-500">
          <div className="text-center md:text-left">
            Hiển thị <span className="font-semibold text-slate-800 font-mono">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> -{' '}
            <span className="font-semibold text-slate-800 font-mono">{Math.min(currentPage * pageSize, totalItems)}</span> trên tổng số{' '}
            <span className="font-semibold text-slate-800 font-mono">{totalItems}</span> ticket sự cố
          </div>

          <div className="flex items-center justify-center gap-1.5 md:absolute md:left-1/2 md:-translate-x-1/2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Trang trước"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
              if (
                totalPages > 7 &&
                pageNumber !== 1 &&
                pageNumber !== totalPages &&
                Math.abs(pageNumber - currentPage) > 2
              ) {
                if (pageNumber === 2 || pageNumber === totalPages - 1) {
                  return <span key={pageNumber} className="px-1 text-slate-400">...</span>
                }
                return null
              }

              const isActive = currentPage === pageNumber
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`min-w-[28px] h-7 px-2 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNumber}
                </button>
              )
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Trang sau"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* MODAL 1: Phân Công Nhân Viên (FM only) */}
      {assigningTicket && isFacilityManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">person_add</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Phân Công Xử Lý #{assigningTicket.ticketCode || assigningTicket.id.substring(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssigningTicket(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitAssign} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn nhân viên ca trực (Cơ sở: {assigningTicket.facilityName || 'Hiện tại'}) *
                </label>
                <select
                  required
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn nhân viên phụ trách --</option>
                  {facilityStaffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.username} ({s.email})
                    </option>
                  ))}
                </select>
                {facilityStaffList.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Đang tải danh sách nhân viên hoặc chưa có nhân viên ca trực tại cơ sở này.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Điều chỉnh mức độ ưu tiên</label>
                <select
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="LOW">Thấp (Low - trong 24h)</option>
                  <option value="MEDIUM">Bình thường (Medium - trong ca)</option>
                  <option value="HIGH">Cao (High - trong 2h)</option>
                  <option value="CRITICAL">Nguy cấp (Critical - xử lý ngay)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú phân công / Chỉ đạo nghiệp vụ</label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Ví dụ: Kiểm tra bộ nguồn SmartLock kho A101, kiểm tra pin dự phòng..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningTicket(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign || !selectedStaffId}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
                  <span>{isSubmittingAssign ? 'Đang giao...' : 'Xác Nhận Phân Công'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Giải Quyết Hoàn Tất Hiện Trường (Staff & FM) */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]">task_alt</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Báo Cáo Hoàn Tất #{resolvingTicket.ticketCode || resolvingTicket.id.substring(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingTicket(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitResolve} className="p-5 space-y-4">
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-semibold text-slate-800">{resolvingTicket.title}</div>
                <div className="text-slate-500 mt-1">{resolvingTicket.description}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kết quả kiểm tra &amp; Ghi chú xử lý hiện trường *
                </label>
                <textarea
                  required
                  rows={4}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Mô tả cụ thể nguyên nhân và biện pháp khắc phục (Ví dụ: Đã thay pin cửa cuốn, cài đặt lại mã PIN và kiểm tra cảm biến thành công)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve || !resolutionText.trim()}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>{isSubmittingResolve ? 'Đang lưu...' : 'Xác Nhận Giải Quyết'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Liên Hệ Hỗ Trợ Quản Lý Vận Hành (BOM) (FM only) */}
      {contactBomTicket && isFacilityManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-50/50 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <span className="material-symbols-outlined text-[22px]">phone_forwarded</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Liên Hệ Hỗ Trợ Quản Lý Vận Hành (BOM)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chủ động liên hệ Business Operations Manager khi sự cố vượt thẩm quyền hoặc cần quyết định vận hành
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContactBomTicket(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Ticket Summary Box with Copy Button */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Thông tin sự cố cần trao đổi
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyTicketForEscalation(contactBomTicket)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copySuccess ? 'check' : 'content_copy'}
                    </span>
                    <span>{copySuccess ? 'Đã sao chép!' : 'Sao chép thông tin'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Mã Ticket:</span>
                    <strong className="font-mono text-slate-800">#{contactBomTicket.ticketCode || contactBomTicket.id.substring(0, 8)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Cơ sở:</span>
                    <strong className="text-slate-800">{contactBomTicket.facilityName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Mức độ:</span>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${getPriorityBadge(contactBomTicket.priority)}`}>
                      {contactBomTicket.priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Trạng thái:</span>
                    <strong className="text-slate-800">{contactBomTicket.status}</strong>
                  </div>
                </div>

                <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="font-semibold">{contactBomTicket.title}</span> — {contactBomTicket.description}
                </div>
              </div>

              {/* Direct Contact Options with BOMs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">contact_phone</span>
                  <span>Danh bạ Business Operations Manager (BOM)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {escalationContacts.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">{c.fullName}</span>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {c.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">call</span>
                          <span className="font-mono">{c.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">mail</span>
                          <span>{c.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[13px]">call</span>
                            <span>Gọi điện</span>
                          </a>
                        )}
                        <a
                          href={`mailto:${c.email}?subject=[Boxora Escalation] Ticket #${contactBomTicket.ticketCode || contactBomTicket.id.substring(0, 8)}`}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px]">mail</span>
                          <span>Gửi Email</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Record Contact Log Form */}
              <form onSubmit={handleSubmitContactLog} className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-600">history_edu</span>
                    <span>Ghi nhật ký trao đổi &amp; Chỉ đạo</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">Nhằm truy vết &amp; kiểm toán</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phương thức liên hệ *</label>
                    <select
                      value={selectedContactMethod}
                      onChange={(e) => setSelectedContactMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="PHONE">Gọi điện thoại nội bộ</option>
                      <option value="EMAIL">Gửi Email công việc</option>
                      <option value="INTERNAL_CHAT">Chat nội bộ</option>
                      <option value="OTHER">Trao đổi trực tiếp / Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Người nhận liên hệ</label>
                    <input
                      type="text"
                      value={targetContactName}
                      onChange={(e) => setTargetContactName(e.target.value)}
                      placeholder="Tên BOM hoặc số liên hệ..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tóm tắt nội dung trao đổi *</label>
                  <textarea
                    required
                    rows={2}
                    value={contactSummary}
                    onChange={(e) => setContactSummary(e.target.value)}
                    placeholder="Tóm tắt vấn đề phát sinh cần quyết định cấp vận hành..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kết quả / Kết luận thống nhất</label>
                  <input
                    type="text"
                    value={contactResult}
                    onChange={(e) => setContactResult(e.target.value)}
                    placeholder="Ví dụ: BOM đồng ý điều xe cứu hộ kỹ thuật, hạn hoàn thành trước 18h..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0">info</span>
                  <span>Ghi nhật ký liên hệ chỉ nhằm truy vết điều phối; không tự động thay đổi trạng thái ticket.</span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingContactLog || !contactSummary.trim()}
                    className="px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>{isSubmittingContactLog ? 'Đang lưu...' : 'Lưu Nhật Ký Liên Hệ'}</span>
                  </button>
                </div>
              </form>

              {/* History of Past Contact Logs */}
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Lịch sử liên hệ BOM của ticket này ({contactLogs.length})
                </h4>

                {isLoadingContactLogs ? (
                  <div className="text-center py-4 text-xs text-slate-400">Đang tải lịch sử liên hệ...</div>
                ) : contactLogs.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 italic">Chưa có lượt liên hệ nào được ghi nhận cho ticket này.</div>
                ) : (
                  <div className="space-y-2">
                    {contactLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{log.contactedByName || 'Quản lý cơ sở'}</span>
                            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] font-mono rounded">
                              {log.contactMethod}
                            </span>
                            <span className="text-slate-500">→ {log.contactTarget || 'Ban Quản Lý'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}
                          </span>
                        </div>
                        <p className="text-slate-700">{log.summary}</p>
                        {log.result && (
                          <div className="text-emerald-700 font-medium text-[11px]">
                            Kết quả: {log.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Yêu Cầu Xử Lý Lại (FM only) */}
      {reopenTargetTicket && isFacilityManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-rose-50/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">restart_alt</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Yêu Cầu Xử Lý Lại #{reopenTargetTicket.ticketCode || reopenTargetTicket.id.substring(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReopenTargetTicket(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitFmReopen} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do từ chối nghiệm thu &amp; Yêu cầu kiểm tra lại *
                </label>
                <textarea
                  required
                  rows={4}
                  value={fmReopenReason}
                  onChange={(e) => setFmReopenReason(e.target.value)}
                  placeholder="Nêu rõ điểm chưa đạt yêu cầu để nhân viên khắc phục lại..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReopenTargetTicket(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReopen || !fmReopenReason.trim()}
                  className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span>{isSubmittingReopen ? 'Đang gửi...' : 'Xác Nhận Mở Lại Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Xem Chi Tiết Toàn Diện & Minh Chứng (All roles) */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                  #{detailTicket.ticketCode || detailTicket.id.substring(0, 8)}
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-[240px]">
                  {detailTicket.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailTicket(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Cơ sở:</span>
                  <strong className="text-slate-800">{detailTicket.facilityName || 'Boxora Facility'}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Vị trí / Ngăn kho:</span>
                  <strong className="text-slate-800">{detailTicket.unitCode ? `Kho #${detailTicket.unitCode}` : 'Khu vực chung'}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Người báo cáo:</span>
                  <strong className="text-slate-800">{detailTicket.customerName || 'Nhân viên cơ sở'}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Nhân viên phụ trách:</span>
                  <strong className="text-slate-800">{detailTicket.assignedStaffName || 'Chưa phân công'}</strong>
                </div>
              </div>

              <div className="text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mô tả chi tiết:</div>
                <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">{detailTicket.description}</div>
              </div>

              {detailTicket.resolutionNote && (
                <div className="text-xs bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 space-y-1">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Kết quả giải quyết:</div>
                  <div className="text-emerald-900 leading-relaxed whitespace-pre-wrap">{detailTicket.resolutionNote}</div>
                </div>
              )}

              {detailTicket.reopenReason && (
                <div className="text-xs bg-rose-50/80 p-3.5 rounded-xl border border-rose-200 space-y-1">
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Lý do mở lại:</div>
                  <div className="text-rose-900 leading-relaxed whitespace-pre-wrap">{detailTicket.reopenReason}</div>
                </div>
              )}

              {/* Customer Rating for CLOSED ticket (Flow 7 Bước 9) */}
              {detailTicket.status === 'CLOSED' && detailTicket.rating && (
                <div className="text-xs bg-amber-50 p-3.5 rounded-xl border border-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                      Đánh giá từ khách hàng:
                    </span>
                    <div className="flex items-center text-amber-500">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span key={idx} className="material-symbols-outlined text-[16px]">
                          {idx < detailTicket.rating! ? 'star' : 'star_border'}
                        </span>
                      ))}
                    </div>
                    <span className="font-bold text-amber-900">({detailTicket.rating}/5 sao)</span>
                  </div>
                  {detailTicket.customerFeedback && (
                    <div className="text-amber-800 italic mt-1 bg-white/70 p-2 rounded border border-amber-200">
                      "{detailTicket.customerFeedback}"
                    </div>
                  )}
                </div>
              )}

              {/* FLOW 7: HỘP NGHIỆP VỤ XỬ LÝ SỰ CỐ TẠI CHỖ */}
              {!isReadOnly && detailTicket.status !== 'CLOSED' && (
                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400 text-[18px]">bolt</span>
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-100">
                        Nghiệp Vụ Xử Lý Sự Cố (Flow 7)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Trạng thái: {detailTicket.status}
                    </span>
                  </div>

                  {/* Bước 5: Tiếp nhận nếu chưa nhận việc */}
                  {(detailTicket.status === 'OPEN' || !detailTicket.assignedStaffId) && (
                    <div className="p-2.5 bg-blue-900/60 rounded-lg border border-blue-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-blue-200">Ticket chưa có người tiếp nhận</span>
                      <button
                        type="button"
                        onClick={() => handleTakeTicket(detailTicket)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">handshake</span>
                        <span>Nhận việc ngay</span>
                      </button>
                    </div>
                  )}

                  {/* Bước 6: Các nút hành động theo phân loại */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {/* 6A: IoT Lock */}
                    <button
                      type="button"
                      disabled={isRegeneratingPin}
                      onClick={() => handleRegeneratePin(detailTicket.id)}
                      className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 text-left"
                      title="Tạo và đồng bộ mã PIN mới cho ô kho"
                    >
                      <span className="material-symbols-outlined text-blue-400 text-[18px]">key</span>
                      <div>
                        <div className="font-bold text-[11px]">Cấp lại mã PIN mới</div>
                        <div className="text-[10px] text-slate-400">Đồng bộ SmartLock IoT</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isRemoteUnlocking}
                      onClick={() => handleRemoteUnlock(detailTicket.id)}
                      className="p-2.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-200 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 text-left"
                      title="Mở khóa từ xa khẩn cấp qua IoT"
                    >
                      <span className="material-symbols-outlined text-rose-400 text-[18px]">lock_open</span>
                      <div>
                        <div className="font-bold text-[11px]">Mở khóa từ xa khẩn cấp</div>
                        <div className="text-[10px] text-rose-300/80">Remote Unlock</div>
                      </div>
                    </button>

                    {/* 6B: Billing */}
                    <button
                      type="button"
                      onClick={() => setShowBillingModal(true)}
                      className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-2 transition-colors cursor-pointer text-left"
                      title="Điều chỉnh / Miễn trừ phụ phí hoặc hoàn tiền"
                    >
                      <span className="material-symbols-outlined text-emerald-400 text-[18px]">price_change</span>
                      <div>
                        <div className="font-bold text-[11px]">Điều chỉnh phụ phí</div>
                        <div className="text-[10px] text-slate-400">Xử lý hóa đơn sai lệch</div>
                      </div>
                    </button>

                    {/* 6C: Maintenance */}
                    <button
                      type="button"
                      onClick={() => setShowMaintenanceModal(true)}
                      className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-2 transition-colors cursor-pointer text-left"
                      title="Chuyển ô kho sang trạng thái BẢO TRÌ"
                    >
                      <span className="material-symbols-outlined text-amber-400 text-[18px]">build</span>
                      <div>
                        <div className="font-bold text-[11px]">Kho sang Bảo Trì</div>
                        <div className="text-[10px] text-slate-400">Hư hỏng vật lý / Thấm dột</div>
                      </div>
                    </button>

                    {/* 6C: Transfer Unit */}
                    <button
                      type="button"
                      onClick={() => handleOpenTransferModal(detailTicket)}
                      className="p-2.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/90 border border-indigo-700/80 text-indigo-200 flex items-center gap-2 transition-colors cursor-pointer sm:col-span-2 text-left"
                      title="Điều chuyển khách sang ô kho khả dụng khác"
                    >
                      <span className="material-symbols-outlined text-indigo-400 text-[18px]">swap_horiz</span>
                      <div>
                        <div className="font-bold text-[11px]">Điều chuyển sang ô kho khác (Unit Transfer)</div>
                        <div className="text-[10px] text-indigo-300/80">Chuyển sang ô kho trống cùng loại trong cơ sở khi kho cũ gặp sự cố</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* FLOW 7 BƯỚC 7: CẬP NHẬT TIẾN ĐỘ & TRAO ĐỔI (TABBED MESSAGING) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMessageTab('INTERNAL_NOTE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        messageTab === 'INTERNAL_NOTE'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      🔒 Ghi chú nội bộ
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageTab('CUSTOMER_REPLY')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        messageTab === 'CUSTOMER_REPLY'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      💬 Phản hồi khách hàng
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {messageTab === 'INTERNAL_NOTE' ? 'Chỉ nhân viên nhìn thấy' : 'Hiển thị trên app khách hàng'}
                  </span>
                </div>

                {!isReadOnly && detailTicket.status !== 'CLOSED' && (
                  <form onSubmit={handleSendMessage} className="space-y-2">
                    <textarea
                      rows={2}
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder={
                        messageTab === 'INTERNAL_NOTE'
                          ? 'Ghi chú kỹ thuật hiện trường, vật tư cần thay, liên hệ thợ...'
                          : 'Soạn phản hồi gửi khách hàng về tiến độ khắc phục sự cố...'
                      }
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingMessage || !messageContent.trim()}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">send</span>
                        <span>{isSubmittingMessage ? 'Đang gửi...' : 'Gửi'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Evidence photo preview */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Minh chứng hiện trường (Camera &amp; Ảnh đính kèm)
                </span>
                {detailTicket.imageEvidence || (detailTicket.evidenceUrls && detailTicket.evidenceUrls.length > 0) ? (
                  <div className="flex flex-wrap gap-2">
                    {[detailTicket.imageEvidence, ...(detailTicket.evidenceUrls || [])].filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx).map((imgUrl, i) => (
                      <a key={i} href={imgUrl} target="_blank" rel="noreferrer" className="block w-28 h-28 rounded-xl overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                        <img src={imgUrl} alt="Hiện trường sự cố" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center relative">
                    <img
                      src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80"
                      alt="Hiện trường sự cố"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-900/80 backdrop-blur-xs rounded text-white text-[10px] font-mono">
                      Ảnh ghi nhận camera giám sát tại cơ sở
                    </div>
                  </div>
                )}
              </div>

              {/* Contact history in detail modal */}
              {detailContactLogs.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Nhật ký liên hệ Ban Quản Lý (BOM):
                  </div>
                  <div className="space-y-1.5">
                    {detailContactLogs.map((log) => (
                      <div key={log.id} className="p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-200">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{log.contactedByName} ({log.contactMethod})</span>
                          <span>{log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : ''}</span>
                        </div>
                        <div className="text-slate-700 mt-0.5">{log.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDetailTicket(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Ghi Nhận Sự Cố Mới (Staff & FM) */}
      {isCreateModalOpen && !isReadOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-600">
                  <span className="material-symbols-outlined text-[20px]">add_alert</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">Ghi Nhận Sự Cố Vận Hành</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề sự cố *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Kẹt cửa cuốn kho A-102, Hỏng khóa điện tử..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Danh mục sự cố</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="LOCK_ISSUE">Khóa SmartLock</option>
                    <option value="ACCESS_ISSUE">Truy cập kho</option>
                    <option value="CLEANLINESS_PEST">Vệ sinh &amp; Côn trùng</option>
                    <option value="CLIMATE_TEMP">Nhiệt độ &amp; Độ ẩm</option>
                    <option value="FACILITY_DAMAGE">Hư hỏng thiết bị</option>
                    <option value="OTHER">Vấn đề khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ ưu tiên</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="LOW">Thấp (Low - trong 24h)</option>
                    <option value="MEDIUM">Bình thường (Medium - trong ca)</option>
                    <option value="HIGH">Cao (High - trong 2h)</option>
                    <option value="CRITICAL">Nguy cấp (Critical - xử lý ngay)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cơ sở xảy ra sự cố</label>
                  <select
                    value={newFacilityId}
                    onChange={(e) => setNewFacilityId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vị trí / Mã kho liên quan</label>
                  <input
                    type="text"
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    placeholder="Ví dụ: A-102, B-205..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả hiện trường</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Mô tả chi tiết nguyên nhân, hiện trạng hư hỏng hoặc yêu cầu phối hợp kỹ thuật..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate || !newTitle.trim()}
                  className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{isSubmittingCreate ? 'Đang tạo...' : 'Lưu & Phân Phối'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task 2: Confirm Close Ticket Modal (FM only) */}
      {closingTicketTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận nghiệm thu &amp; đóng phiếu</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Bạn có chắc chắn muốn đóng phiếu sự cố #{closingTicketTarget.ticketCode || closingTicketTarget.id.slice(0, 8)}? Hành động này xác nhận hiện trường đã được khắc phục hoàn tất.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Ghi chú nghiệm thu hoàn tất
              </label>
              <textarea
                rows={3}
                value={closeTicketNote}
                onChange={(e) => setCloseTicketNote(e.target.value)}
                placeholder="Nhập ghi chú nghiệm thu hoàn tất sự cố..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white resize-none"
              />
            </div>

            {closeTicketError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {closeTicketError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmittingClose}
                onClick={() => {
                  setClosingTicketTarget(null)
                  setCloseTicketError(null)
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmittingClose}
                onClick={handleSubmitCloseTicket}
                className="px-4 py-2 bg-slate-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingClose ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Đang đóng...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Xác nhận</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOW 7 MODAL 6B: Điều Chỉnh / Miễn Trừ Phụ Phí */}
      {showBillingModal && detailTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">price_change</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Điều Chỉnh / Miễn Trừ Phụ Phí (Billing)</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Xử lý tranh chấp hóa đơn, phí phạt quá hạn do lỗi hệ thống hoặc bồi hoàn cho khách hàng.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitBillingAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số tiền điều chỉnh / miễn trừ (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={billingAmount}
                  onChange={(e) => setBillingAmount(e.target.value)}
                  placeholder="Ví dụ: 200000 (Để trống nếu chỉ ghi nhận đối soát)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Căn cứ / Lý do điều chỉnh *
                </label>
                <textarea
                  rows={3}
                  required
                  value={billingNote}
                  onChange={(e) => setBillingNote(e.target.value)}
                  placeholder="Ghi rõ: Lỗi cổng tự động kẹt xe quá giờ, hệ thống tính thừa phí quá hạn, hoặc bồi hoàn sự cố..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingBilling}
                  onClick={() => setShowBillingModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBilling}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{isSubmittingBilling ? 'Đang lưu...' : 'Xác Nhận Điều Chỉnh'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOW 7 MODAL 6C: Chuyển Kho Sang Trạng Thái BẢO TRÌ */}
      {showMaintenanceModal && detailTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">build</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Chuyển Kho Sang Trạng Thái Bảo Trì</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Khóa ô kho #{detailTicket.unitCode || 'hiện tại'} để bảo trì kỹ thuật (UNDER_MAINTENANCE).
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitMaintenance} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do chuyển bảo trì *
                </label>
                <textarea
                  rows={3}
                  required
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="Ví dụ: Cửa cuốn kẹt ray, tường bị thấm dột sau mưa bão, cần sơn sửa và chống thấm..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn vị / Kỹ thuật viên phụ trách
                </label>
                <input
                  type="text"
                  value={maintenancePerson}
                  onChange={(e) => setMaintenancePerson(e.target.value)}
                  placeholder={user?.fullName || 'Tổ kỹ thuật cơ sở'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingMaintenance}
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMaintenance}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">engineering</span>
                  <span>{isSubmittingMaintenance ? 'Đang lưu...' : 'Xác Nhận Bảo Trì'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOW 7 MODAL 6C: Điều Chuyển Sang Ô Kho Khác (Unit Transfer) */}
      {showTransferModal && detailTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">swap_horiz</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Điều Chuyển Ô Kho (Unit Transfer)</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Chuyển hợp đồng của khách hàng từ kho <strong>#{detailTicket.unitCode || 'cũ'}</strong> sang một ô kho trống khả dụng khác tại cơ sở.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn ô kho mới khả dụng (Status: AVAILABLE) *
                </label>
                {isLoadingAvailableUnits ? (
                  <div className="py-4 text-center text-slate-400 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span>Đang tải danh sách ô kho trống...</span>
                  </div>
                ) : availableUnitsForTransfer.length === 0 ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                    Hiện không còn ô kho nào ở trạng thái AVAILABLE tại cơ sở này.
                  </div>
                ) : (
                  <select
                    value={transferTargetUnitId}
                    onChange={(e) => setTransferTargetUnitId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Chọn ô kho nhận bàn giao mới --</option>
                    {availableUnitsForTransfer.map((u) => (
                      <option key={u.id} value={u.id}>
                        Kho #{u.unitCode} - Tầng {u.floorLevel || '1'} ({u.unitTypeName || 'Standard'} - {u.areaSqMeters || 6}m²)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do điều chuyển kho *
                </label>
                <textarea
                  rows={2}
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ghi rõ lý do điều chuyển: Ô kho cũ bị ẩm mốc/thấm dột, chuyển tạm để sửa chữa..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <strong>Quy trình xử lý hệ thống:</strong>
                <div>• Ô kho cũ sẽ tự động chuyển sang trạng thái <strong>UNDER_MAINTENANCE (Bảo trì)</strong>.</div>
                <div>• Hợp đồng thuê và phiếu sự cố sẽ được cập nhật sang mã kho mới.</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingTransfer}
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer || !transferTargetUnitId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>{isSubmittingTransfer ? 'Đang chuyển...' : 'Xác Nhận Điều Chuyển Kho'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
