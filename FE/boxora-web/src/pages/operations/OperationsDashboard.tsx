import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { reportService } from '../../services/reportService'
import { facilityService } from '../../services/facilityService'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { storageUnitService } from '../../services/storageUnitService'
import { contractService, RentalContract } from '../../services/contractService'
import { userService } from '../../services/userService'
import { Facility, FacilityPolicy, FacilityPolicyCreateRequest, FacilityPolicyUpdateRequest, RevenueReport, OccupancyReport, OverdueDebtReport, UnitType, User } from '../../types'
import { FacilityPolicyModal } from './components/FacilityPolicyModal'

export const OperationsDashboard: React.FC = () => {
  const { role } = useAuth()
  const { t } = useLanguage()
  const canManagePolicies = role === 'BUSINESS_MANAGER'
  const { selectedFacility, setSelectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    setSelectedFacility?: (facId: string) => void
    facilities?: Facility[]
  }>() || {}

  // Policy configuration state
  const [miniPrice, setMiniPrice] = useState('450.000')
  const [standardPrice, setStandardPrice] = useState('1.250.000')
  const [climatePrice, setClimatePrice] = useState('2.400.000')
  const [depositOption, setDepositOption] = useState<'1month' | '2months'>('1month')
  const [discount3M, setDiscount3M] = useState('-5')
  const [discount6M, setDiscount6M] = useState('-10')
  const [discount12M, setDiscount12M] = useState('-15')
  const [graceDays, setGraceDays] = useState('03 Ngày')
  const [lateFee, setLateFee] = useState('50.000')
  const [lockoutDay, setLockoutDay] = useState('Ngày thứ 05')

  // Live reports and facilities from BE
  const [facilities, setFacilities] = useState<Facility[]>(contextFacilities || [])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(() => {
    if (!selectedFacility || selectedFacility === 'ALL') return 'all'
    return selectedFacility
  })
  const [currentPolicy, setCurrentPolicy] = useState<FacilityPolicy | null>(null)
  const [allPolicies, setAllPolicies] = useState<FacilityPolicy[]>([])
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [editingPolicyFacility, setEditingPolicyFacility] = useState<Facility | null>(null)
  const [editingExistingPolicy, setEditingExistingPolicy] = useState<FacilityPolicy | null>(null)
  const [grantModalData, setGrantModalData] = useState<{
    facility: Facility
    policy: FacilityPolicy
    managers: User[]
    grantedManagerIds: string[]
    loading: boolean
  } | null>(null)
  const [revenueData, setRevenueData] = useState<RevenueReport | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null)
  const [debtData, setDebtData] = useState<OverdueDebtReport | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [contracts, setContracts] = useState<RentalContract[]>([])
  const [isReportsLoading, setIsReportsLoading] = useState(true)
  const [facilitySort, setFacilitySort] = useState<'revenue' | 'occupancy'>('revenue')

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  // Report Date Range State - Default to All Time (empty) so user sees full DB revenue initially
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [tempFromDate, setTempFromDate] = useState<string>('')
  const [tempToDate, setTempToDate] = useState<string>('')

  useEffect(() => {
    if (contextFacilities && contextFacilities.length > 0) {
      setFacilities(contextFacilities)
    }
  }, [contextFacilities])

  useEffect(() => {
    const nextScope = (!selectedFacility || selectedFacility === 'ALL') ? 'all' : selectedFacility
    setSelectedFacilityId(nextScope)
  }, [selectedFacility])

  useEffect(() => {
    void loadDashboardData(fromDate, toDate, selectedFacilityId)
  }, [selectedFacilityId])

  const loadDashboardData = async (fDate = fromDate, tDate = toDate, targetScope?: string) => {
    setIsReportsLoading(true)
    try {
      const queryFrom = fDate || undefined
      const queryTo = tDate || undefined
      const scope = targetScope !== undefined ? targetScope : selectedFacilityId
      const targetFacilityId = scope === 'all' ? undefined : scope
      const [facRes, revRes, occRes, debtRes, polRes, payRes, utRes, ctRes, allPolRes] = await Promise.allSettled([
        facilityService.getFacilities(),
        reportService.getRevenueReport(queryFrom, queryTo, targetFacilityId),
        reportService.getOccupancyReport(targetFacilityId),
        reportService.getOverdueDebtReport(targetFacilityId ? { facilityId: targetFacilityId } : undefined),
        targetFacilityId
          ? facilityPolicyService.getByFacilityId(targetFacilityId)
          : Promise.resolve(null),
        paymentService.getPayments({ size: 100 }),
        storageUnitService.getUnitTypes(),
        contractService.getMyContracts({ size: 100 }),
        facilityPolicyService.getAll({ size: 100 }),
      ])
      if (facRes.status === 'fulfilled' && facRes.value?.content) {
        setFacilities(facRes.value.content)
      }
      if (revRes.status === 'fulfilled' && revRes.value) {
        setRevenueData(revRes.value)
      }
      if (occRes.status === 'fulfilled' && occRes.value) {
        setOccupancyData(occRes.value)
      }
      if (debtRes.status === 'fulfilled' && debtRes.value) {
        setDebtData(debtRes.value)
      }
      if (payRes.status === 'fulfilled' && payRes.value) {
        setPayments(payRes.value)
      }
      if (utRes.status === 'fulfilled' && utRes.value) {
        const uts: UnitType[] = utRes.value
        setUnitTypes(uts)
        const mini = uts.find((ut) => ut.typeName.toLowerCase().includes('mini'))
        const standard = uts.find((ut) => ut.typeName.toLowerCase().includes('standard') || ut.typeName.toLowerCase().includes('tiêu chuẩn'))
        const climate = uts.find((ut) => ut.typeName.toLowerCase().includes('cold') || ut.typeName.toLowerCase().includes('climate') || ut.typeName.toLowerCase().includes('mát'))
        if (mini?.basePricePerMonth != null) {
          setMiniPrice(Number(mini.basePricePerMonth).toLocaleString('vi-VN'))
        }
        if (standard?.basePricePerMonth != null) {
          setStandardPrice(Number(standard.basePricePerMonth).toLocaleString('vi-VN'))
        }
        if (climate?.basePricePerMonth != null) {
          setClimatePrice(Number(climate.basePricePerMonth).toLocaleString('vi-VN'))
        }
      }
      if (ctRes.status === 'fulfilled' && ctRes.value?.content) {
        setContracts(ctRes.value.content)
      }
      if (allPolRes.status === 'fulfilled' && allPolRes.value?.content) {
        setAllPolicies(allPolRes.value.content)
      }
      if (polRes.status === 'fulfilled' && polRes.value) {
        const pol = polRes.value
        setCurrentPolicy(pol)
        const dep = pol.depositPercentage ?? pol.depositPercent
        if (dep != null) setDepositOption(dep >= 100 ? '1month' : '1month')
        const lf = pol.dailyLateFee ?? pol.lateFeePerDay
        if (lf != null) setLateFee(Number(lf).toLocaleString('vi-VN'))
        const gr = pol.overdueGraceDays ?? pol.gracePeriodDays
        if (gr != null) setGraceDays(`${gr} Ngày`)
        if (pol.discount3Months != null) setDiscount3M(`-${pol.discount3Months}`)
        if (pol.discount6Months != null) setDiscount6M(`-${pol.discount6Months}`)
        if (pol.discount12Months != null) setDiscount12M(`-${pol.discount12Months}`)
        const seal = pol.overdueSealingDays
        if (seal != null) setLockoutDay(`Ngày thứ ${seal}`)
      } else {
        setCurrentPolicy(null)
      }
    } catch {
      // Keep static defaults on network error
    } finally {
      setIsReportsLoading(false)
    }
  }

  const handleOpenCreatePolicy = (fac?: Facility) => {
    setEditingPolicyFacility(fac || null)
    setEditingExistingPolicy(null)
    setIsPolicyModalOpen(true)
  }

  const handleOpenEditPolicy = (fac: Facility, pol: FacilityPolicy) => {
    setEditingPolicyFacility(fac)
    setEditingExistingPolicy(pol)
    setIsPolicyModalOpen(true)
  }

  const handleDeletePolicy = async (pol: FacilityPolicy) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa chính sách của cơ sở ${pol.facilityName || ''}?`)) {
      return
    }
    try {
      await facilityPolicyService.delete(pol.id)
      showToast('Đã xóa chính sách cơ sở thành công!')
      void loadDashboardData(fromDate, toDate, selectedFacilityId)
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể xóa chính sách.', true)
    }
  }

  const handlePolicySaved = (saved: FacilityPolicy, isNew: boolean) => {
    showToast(isNew ? 'Đã ban hành chính sách mới cho cơ sở thành công!' : 'Đã cập nhật chính sách cơ sở thành công!')
    void loadDashboardData(fromDate, toDate, selectedFacilityId)
  }

  const handleTogglePolicyActive = async (pol: FacilityPolicy) => {
    const newActive = pol.isActive === false ? true : false
    try {
      await facilityPolicyService.update(pol.id, { isActive: newActive })
      showToast(newActive ? 'Đã kích hoạt áp dụng chính sách cơ sở thành công!' : 'Đã ngừng áp dụng chính sách cơ sở.')
      void loadDashboardData(fromDate, toDate, selectedFacilityId)
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể thay đổi trạng thái chính sách.', true)
    }
  }

  const handleOpenGrantModal = async (fac: Facility, pol: FacilityPolicy) => {
    setGrantModalData({
      facility: fac,
      policy: pol,
      managers: [],
      grantedManagerIds: [],
      loading: true,
    })
    try {
      const [managersRes, grantsRes] = await Promise.all([
        userService.getAllUsers({ role: 'FACILITY_MANAGER', facilityId: fac.id }),
        facilityService.getPolicyExceptionGrants(pol.id),
      ])
      setGrantModalData({
        facility: fac,
        policy: pol,
        managers: managersRes.data || [],
        grantedManagerIds: Array.isArray(grantsRes) ? grantsRes : [],
        loading: false,
      })
    } catch (err: any) {
      showToast('Không thể tải danh sách quản lý cơ sở: ' + (err?.message || ''), true)
      setGrantModalData(null)
    }
  }

  const handleToggleGrant = async (managerId: string, currentlyGranted: boolean) => {
    if (!grantModalData) return
    try {
      await facilityService.setPolicyExceptionGrant(grantModalData.policy.id, managerId, !currentlyGranted)
      setGrantModalData((prev) => {
        if (!prev) return null
        const updatedIds = currentlyGranted
          ? prev.grantedManagerIds.filter((id) => id !== managerId)
          : [...prev.grantedManagerIds, managerId]
        return { ...prev, grantedManagerIds: updatedIds }
      })
      showToast(!currentlyGranted ? 'Đã cấp quyền sửa ngoại lệ cho Quản lý cơ sở!' : 'Đã thu hồi quyền sửa ngoại lệ!')
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Lỗi khi cập nhật quyền ngoại lệ.', true)
    }
  }

  const occupancyRows = [...(occupancyData?.byFacility ?? [])]
    .filter((row) => selectedFacilityId === 'all' || row.facilityId === selectedFacilityId)
    .sort((a, b) => {
      if (facilitySort === 'occupancy') return b.occupancyRate - a.occupancyRate
      const aRevenue = revenueData?.byFacility?.find((item) => item.facilityId === a.facilityId)?.totalRevenue ?? -1
      const bRevenue = revenueData?.byFacility?.find((item) => item.facilityId === b.facilityId)?.totalRevenue ?? -1
      return bRevenue - aRevenue
    })
  const revenueForScope = selectedFacilityId === 'all'
    ? revenueData?.systemSummary?.totalRevenue
    : (revenueData?.byFacility?.find((item) => item.facilityId === selectedFacilityId)?.totalRevenue ?? 0)

  const paymentCountForScope = selectedFacilityId === 'all'
    ? revenueData?.systemSummary?.paymentCount
    : (revenueData?.byFacility?.find((item) => item.facilityId === selectedFacilityId)?.paymentCount ?? 0)

  const renewalRevenueForScope = selectedFacilityId === 'all'
    ? revenueData?.systemSummary?.renewalFeeRevenue
    : (revenueData?.byFacility?.find((item) => item.facilityId === selectedFacilityId)?.renewalFeeRevenue ?? 0)

  const occupancyForScope = selectedFacilityId === 'all'
    ? occupancyData?.systemSummary
    : occupancyData?.byFacility?.find((item) => item.facilityId === selectedFacilityId)

  const periodLabel = !fromDate && !toDate
    ? 'Toàn bộ thời gian'
    : fromDate && toDate
      ? `${new Date(`${fromDate}T00:00:00`).toLocaleDateString('vi-VN')} – ${new Date(`${toDate}T00:00:00`).toLocaleDateString('vi-VN')}`
      : revenueData?.fromDate && revenueData?.toDate
        ? `${new Date(`${revenueData.fromDate}T00:00:00`).toLocaleDateString('vi-VN')} – ${new Date(`${revenueData.toDate}T00:00:00`).toLocaleDateString('vi-VN')}`
        : 'Kỳ hiện tại'

  // Scoped payments matching active facility filter
  const scopedPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedFacilityId === 'all') return true
      if (p.facilityName) {
        const fac = facilities.find((f) => f.id === selectedFacilityId)
        if (fac && p.facilityName === fac.name) return true
      }
      const ct = contracts.find((c) => c.id === p.contractId)
      if (ct) {
        if (ct.facilityId) return ct.facilityId === selectedFacilityId
        const fac = facilities.find((f) => f.id === selectedFacilityId)
        if (fac && ct.facilityName) return ct.facilityName === fac.name
      }
      return false
    })
  }, [payments, contracts, facilities, selectedFacilityId])

  // Dynamic monthly revenue aggregation from real DB payments
  const monthlyRevenueData = useMemo(() => {
    if (!scopedPayments || scopedPayments.length === 0) return []
    const groups: Record<string, { rentalFee: number; deposit: number; renewalFee: number; total: number }> = {}

    scopedPayments.forEach((p) => {
      const dateStr = p.paymentTime || p.createdAt
      if (!dateStr) return
      const monthKey = dateStr.slice(0, 7) // "2026-03"
      if (!groups[monthKey]) {
        groups[monthKey] = { rentalFee: 0, deposit: 0, renewalFee: 0, total: 0 }
      }
      const amt = Number(p.amount) || 0
      groups[monthKey].total += amt
      if (p.paymentType === 'RENTAL_FEE') groups[monthKey].rentalFee += amt
      else if (p.paymentType === 'DEPOSIT') groups[monthKey].deposit += amt
      else if (p.paymentType === 'RENEWAL_FEE') groups[monthKey].renewalFee += amt
      else groups[monthKey].rentalFee += amt
    })

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mKey, data]) => {
        const [year, month] = mKey.split('-')
        return {
          monthKey: mKey,
          label: `T${month}/${year.slice(2)}`,
          ...data,
        }
      })
  }, [scopedPayments])

  const maxMonthlyTotal = useMemo(() => {
    if (monthlyRevenueData.length === 0) return 1
    return Math.max(...monthlyRevenueData.map((m) => m.total), 1)
  }, [monthlyRevenueData])

  // Dynamic payment method distribution from real DB payments
  const paymentMethodStats = useMemo(() => {
    const totalCount = scopedPayments.length
    if (totalCount === 0) {
      return { vnpayPercent: 0, bankPercent: 0, momoPercent: 0, vnpayCount: 0, bankCount: 0, momoCount: 0, totalCount: 0 }
    }
    const vnpayCount = scopedPayments.filter((p) => p.paymentMethod === 'VNPAY').length
    const bankCount = scopedPayments.filter((p) => p.paymentMethod === 'BANK_TRANSFER').length
    const momoCount = scopedPayments.filter((p) => p.paymentMethod === 'MOMO').length

    return {
      vnpayPercent: Math.round((vnpayCount / totalCount) * 1000) / 10,
      bankPercent: Math.round((bankCount / totalCount) * 1000) / 10,
      momoPercent: Math.round((momoCount / totalCount) * 1000) / 10,
      vnpayCount,
      bankCount,
      momoCount,
      totalCount,
    }
  }, [scopedPayments])

  const formatCurrency = (value?: number) => (value == null ? '—' : value.toLocaleString('vi-VN'))

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const [isSavingPolicies, setIsSavingPolicies] = useState(false)

  const parseCurrencyInput = (val: string) => {
    const cleaned = String(val).replace(/\D/g, '')
    return Number(cleaned) || 0
  }

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManagePolicies) return
    setIsSavingPolicies(true)
    try {
      const priceUpdates: string[] = []

      // 1. Save UnitType prices (Mini, Tiêu Chuẩn, Kho Mát) under BR-RULE-011
      const miniUt = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('mini'))
      const standardUt = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('standard') || ut.typeName.toLowerCase().includes('tiêu chuẩn'))
      const climateUt = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('cold') || ut.typeName.toLowerCase().includes('climate') || ut.typeName.toLowerCase().includes('mát'))

      const miniVal = parseCurrencyInput(miniPrice)
      const standardVal = parseCurrencyInput(standardPrice)
      const climateVal = parseCurrencyInput(climatePrice)

      if (miniUt && miniVal > 0 && miniVal !== Number(miniUt.basePricePerMonth)) {
        await storageUnitService.adjustUnitTypePrice(miniUt.id, {
          newPrice: miniVal,
          reason: 'Điều chỉnh ma trận giá loại kho Mini từ Operations Dashboard theo BR-RULE-011',
          cascadeToAvailableUnits: true,
        })
        priceUpdates.push(`Mini: ${miniVal.toLocaleString('vi-VN')} đ`)
      }

      if (standardUt && standardVal > 0 && standardVal !== Number(standardUt.basePricePerMonth)) {
        await storageUnitService.adjustUnitTypePrice(standardUt.id, {
          newPrice: standardVal,
          reason: 'Điều chỉnh ma trận giá loại kho Tiêu Chuẩn từ Operations Dashboard theo BR-RULE-011',
          cascadeToAvailableUnits: true,
        })
        priceUpdates.push(`Tiêu chuẩn: ${standardVal.toLocaleString('vi-VN')} đ`)
      }

      if (climateUt && climateVal > 0 && climateVal !== Number(climateUt.basePricePerMonth)) {
        await storageUnitService.adjustUnitTypePrice(climateUt.id, {
          newPrice: climateVal,
          reason: 'Điều chỉnh ma trận giá loại kho Mát từ Operations Dashboard theo BR-RULE-011',
          cascadeToAvailableUnits: true,
        })
        priceUpdates.push(`Kho Mát: ${climateVal.toLocaleString('vi-VN')} đ`)
      }

      // 2. Save FacilityPolicy if a specific facility is selected
      let policySaved = false
      if (selectedFacilityId !== 'all') {
        if (currentPolicy?.id) {
          const updatePayload: FacilityPolicyUpdateRequest = {
            depositPercentage: 100,
            dailyLateFee: Number(lateFee.replace(/\D/g, '')) || 50000,
            overdueGraceDays: Number.parseInt(graceDays, 10) || 3,
            overdueSealingDays: Number.parseInt(lockoutDay.replace(/\D/g, ''), 10) || 7,
            minimumRentalMonths: currentPolicy.minimumRentalMonths ?? 1,
            renewalWindowDays: currentPolicy.renewalWindowDays ?? 7,
            cancellationFullRefundHours: currentPolicy.cancellationFullRefundHours ?? 48,
            cancellationPartialRefundHours: currentPolicy.cancellationPartialRefundHours ?? 24,
            cancellationPartialRefundPercent: currentPolicy.cancellationPartialRefundPercent ?? 50,
            returnNoticeDays: currentPolicy.returnNoticeDays ?? 3,
            depositRefundSlaDays: currentPolicy.depositRefundSlaDays ?? 3,
            overdueAccessDisableDays: currentPolicy.overdueAccessDisableDays ?? 5,
          }
          const saved = await facilityPolicyService.update(currentPolicy.id, updatePayload)
          setCurrentPolicy(saved)
          policySaved = true
        } else {
          const createPayload: FacilityPolicyCreateRequest = {
            facilityId: selectedFacilityId,
            depositPercentage: 100,
            dailyLateFee: Number(lateFee.replace(/\D/g, '')) || 50000,
            overdueGraceDays: Number.parseInt(graceDays, 10) || 3,
            overdueSealingDays: Number.parseInt(lockoutDay.replace(/\D/g, ''), 10) || 7,
            minimumRentalMonths: 1,
            renewalWindowDays: 7,
            cancellationFullRefundHours: 48,
            cancellationPartialRefundHours: 24,
            cancellationPartialRefundPercent: 50,
            returnNoticeDays: 3,
            depositRefundSlaDays: 3,
            overdueAccessDisableDays: 5,
          }
          const saved = await facilityPolicyService.create(createPayload)
          setCurrentPolicy(saved)
          policySaved = true
        }
      }

      // 3. Re-fetch updated unit types
      const updatedUnitTypes = await storageUnitService.getUnitTypes()
      if (updatedUnitTypes) {
        setUnitTypes(updatedUnitTypes)
      }

      if (priceUpdates.length > 0 && policySaved) {
        showToast(`Đã lưu bảng giá (${priceUpdates.join(', ')}) và chính sách cơ sở thành công!`)
      } else if (priceUpdates.length > 0) {
        showToast(`Đã cập nhật bảng giá (${priceUpdates.join(', ')}) vào CSDL và StorageUnitPriceHistory (BR-RULE-011)!`)
      } else if (policySaved) {
        showToast(`Đã lưu chính sách cơ sở cho ${facilities.find((facility) => facility.id === selectedFacilityId)?.name || 'cơ sở đã chọn'}.`)
      } else {
        showToast('Thông số chính sách và bảng giá hiện tại đã khớp CSDL.')
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Không lưu được chính sách hoặc bảng giá. Vui lòng thử lại.'
      showToast(errMsg, true)
    } finally {
      setIsSavingPolicies(false)
    }
  }

  const handleExportRevenueCsv = () => {
    const rows = revenueData?.byFacility
    if (!rows?.length) {
      showToast('Chưa có dữ liệu doanh thu để xuất.', true)
      return
    }
    const csvRows = [
      ['Cơ sở', 'Tổng doanh thu (VND)', 'Tiền thuê (VND)', 'Tiền cọc (VND)', 'Gia hạn (VND)', 'Số thanh toán'],
      ...rows
        .filter(row => selectedFacilityId === 'all' || row.facilityId === selectedFacilityId)
        .map(row => [row.facilityName, row.totalRevenue, row.rentalFeeRevenue, row.depositRevenue, row.renewalFeeRevenue ?? 0, row.paymentCount ?? 0]),
    ]
    const csv = '\uFEFF' + csvRows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `boxora-doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Đã tải báo cáo doanh thu CSV.')
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className={`material-symbols-outlined text-[20px] ${toastIsError ? 'text-rose-400' : 'text-emerald-400'}`}>{toastIsError ? 'error' : 'check_circle'}</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* TOP CONTEXT & C-LEVEL STRIP */}
      <div className="relative w-full rounded-2xl bg-white p-6 shadow-sm border border-slate-200 z-10">
        {/* Background decorative blurs clipped to card border */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"></div>
          <div className="absolute left-1/3 -bottom-16 h-48 w-48 rounded-full bg-teal-500/10 blur-2xl"></div>
        </div>

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-2 max-w-2xl text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${isReportsLoading ? 'bg-slate-50 border-slate-200 text-slate-600' : revenueData && occupancyData && debtData ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isReportsLoading ? 'bg-slate-400' : revenueData && occupancyData && debtData ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                {isReportsLoading ? 'Đang tải báo cáo' : revenueData && occupancyData && debtData ? 'Dữ liệu hệ thống' : 'Dữ liệu chưa đầy đủ'}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-headline text-slate-900 tracking-tight">
              Doanh thu &amp; vận hành hệ thống
            </h1>
            <p className="text-sm text-slate-600">
              Theo dõi doanh thu, công suất kho, công nợ và chính sách tại các cơ sở.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Facility Selector Dropdown */}
            <div className="flex items-center bg-slate-50 hover:bg-slate-100 text-left px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all shadow-xs group">
              <span className="material-symbols-outlined text-blue-600 group-hover:scale-110 transition-transform text-[20px] mr-2">
                location_on
              </span>
              <div className="flex flex-col pr-1 text-left">
                <span className="text-[10px] text-slate-500 uppercase font-semibold leading-none mb-0.5">
                  Cơ sở báo cáo
                </span>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => {
                    const newFacilityId = e.target.value
                    setSelectedFacilityId(newFacilityId)
                    if (setSelectedFacility) {
                      setSelectedFacility(newFacilityId)
                    }
                  }}
                  className="bg-transparent font-mono text-xs text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">Toàn hệ thống (Tất cả)</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name.replace(/StoreHub\s*/gi, 'Boxora ')} ({f.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative z-30">
              <button
                type="button"
                onClick={() => {
                  setTempFromDate(fromDate)
                  setTempToDate(toDate)
                  setIsDatePickerOpen(!isDatePickerOpen)
                }}
                title="Bấm để chọn khoảng ngày báo cáo doanh thu"
                className="flex items-center bg-slate-50 hover:bg-slate-100 text-left px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all shadow-xs cursor-pointer group"
              >
                <span className="material-symbols-outlined text-blue-600 group-hover:scale-110 transition-transform text-[20px] mr-2">
                  calendar_month
                </span>
                <div className="flex flex-col pr-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold leading-none">Kỳ báo cáo</span>
                    <span className="material-symbols-outlined text-[13px] text-slate-400 group-hover:text-blue-600 transition-colors">
                      edit_calendar
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-900 font-bold group-hover:text-blue-700 transition-colors">
                    {periodLabel}
                  </span>
                </div>
              </button>

              {/* Date Range Picker Popover */}
              {isDatePickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDatePickerOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-88 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-blue-600 text-[18px]">date_range</span>
                        <h4 className="text-xs font-bold text-slate-900">Chọn Kỳ Báo Cáo</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Chọn nhanh
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setTempFromDate('')
                            setTempToDate('')
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-semibold border cursor-pointer text-center ${!tempFromDate && !tempToDate ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          Toàn bộ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date()
                            const f = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                            const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                            setTempFromDate(f)
                            setTempToDate(t)
                          }}
                          className="px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 cursor-pointer text-center"
                        >
                          Tháng này
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date()
                            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                            const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
                            const f = `${firstDayLastMonth.getFullYear()}-${String(firstDayLastMonth.getMonth() + 1).padStart(2, '0')}-01`
                            const t = `${lastDayLastMonth.getFullYear()}-${String(lastDayLastMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayLastMonth.getDate()).padStart(2, '0')}`
                            setTempFromDate(f)
                            setTempToDate(t)
                          }}
                          className="px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 cursor-pointer text-center"
                        >
                          Tháng trước
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date()
                            const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                            const f = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`
                            const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                            setTempFromDate(f)
                            setTempToDate(t)
                          }}
                          className="px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 cursor-pointer text-center"
                        >
                          7 ngày qua
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date()
                            const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                            const f = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`
                            const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                            setTempFromDate(f)
                            setTempToDate(t)
                          }}
                          className="px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 cursor-pointer text-center"
                        >
                          30 ngày qua
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date()
                            const f = `${now.getFullYear()}-01-01`
                            const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                            setTempFromDate(f)
                            setTempToDate(t)
                          }}
                          className="px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 cursor-pointer text-center"
                        >
                          Năm nay
                        </button>
                      </div>
                    </div>

                    {/* Custom Date Pickers */}
                    <div className="space-y-2 mb-4 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          Từ ngày (Bắt đầu):
                        </label>
                        <input
                          type="date"
                          value={tempFromDate}
                          onChange={(e) => setTempFromDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          Đến ngày (Kết thúc):
                        </label>
                        <input
                          type="date"
                          value={tempToDate}
                          onChange={(e) => setTempToDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (tempFromDate && tempToDate && tempFromDate > tempToDate) {
                            showToast('Ngày bắt đầu không được lớn hơn ngày kết thúc', true)
                            return
                          }
                          setFromDate(tempFromDate)
                          setToDate(tempToDate)
                          setIsDatePickerOpen(false)
                          void loadDashboardData(tempFromDate || undefined, tempToDate || undefined)
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Áp dụng kỳ</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>


            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              <button 
                type="button" 
                onClick={handleExportRevenueCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-all shadow-xs border border-slate-200"
              >
                <span className="material-symbols-outlined text-[18px]">table_view</span>
                Tải CSV
              </button>
              <button 
                type="button" 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-neutral-800 rounded-lg text-xs font-semibold transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                In / lưu PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 EXECUTIVE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Tổng Doanh Thu Hệ Thống</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {revenueData ? (revenueForScope ?? 0).toLocaleString('vi-VN') : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {revenueData != null
              ? `${(paymentCountForScope ?? 0).toLocaleString('vi-VN')} giao dịch trong kỳ`
              : 'Chưa có dữ liệu doanh thu'}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Tỷ Lệ Lấp Đầy Bình Quân</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {occupancyForScope?.occupancyRate != null ? `${occupancyForScope.occupancyRate.toFixed(1)}%` : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {occupancyForScope?.occupiedUnits != null ? `${occupancyForScope.occupiedUnits} / ${occupancyForScope.totalUnits}` : 'kho'}
                </span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <span className="material-symbols-outlined text-[22px]">pie_chart</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {occupancyForScope?.availableUnits != null ? `Còn trống: ${occupancyForScope.availableUnits} kho` : 'Chưa có dữ liệu công suất'}
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${occupancyForScope?.occupancyRate ?? 0}%` }}></div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Doanh Thu Tái Ký &amp; Gia Hạn</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-emerald-600">
                  {revenueData ? (renewalRevenueForScope ?? 0).toLocaleString('vi-VN') : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <span className="material-symbols-outlined text-[22px]">autorenew</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {contracts.length > 0
              ? `${contracts.filter(c => c.status === 'ACTIVE').length} / ${contracts.length} hợp đồng đang hiệu lực`
              : 'Theo dõi hợp đồng gia hạn trong kỳ'}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Nợ Xấu &amp; Quá Hạn Thu</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-rose-600">{debtData ? debtData.totalDebtAmount.toLocaleString('vi-VN') : '—'}</span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
              <span className="material-symbols-outlined text-[22px]">gavel</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {debtData
              ? `${debtData.totalOverdueCount} khoản quá hạn · ${debtData.accessBlockedCount} kho đã khóa`
              : 'Chưa có dữ liệu công nợ'}
          </div>
        </div>
      </div>

      {/* CHARTS ROW: STACKED REVENUE & DONUT CHURN (POWERED BY REAL DB DATA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stacked Revenue Bar Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Xu hướng doanh thu theo kỳ</h2>
              <p className="text-xs text-slate-500">
                {monthlyRevenueData.length > 0
                  ? `Dữ liệu thanh toán thực tế từ ${monthlyRevenueData.length} kỳ phát sinh doanh thu trong hệ thống.`
                  : 'Đang tải dữ liệu chu kỳ thanh toán...'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-xs font-medium flex-wrap">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-900"></span>Tiền thuê kho</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500"></span>Tiền cọc bảo chứng</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>Phí tái ký / gia hạn</span>
            </div>
          </div>

          {/* Bar Columns Container */}
          <div className="w-full h-64 flex items-end justify-between gap-2 sm:gap-4 pt-4 pb-2 px-2 border-b border-slate-200 overflow-x-auto">
            {monthlyRevenueData.length > 0 ? (
              monthlyRevenueData.map((m) => {
                const heightPercent = Math.max(14, Math.min(100, Math.round((m.total / maxMonthlyTotal) * 100)))
                const rentalPct = m.total > 0 ? (m.rentalFee / m.total) * 100 : 0
                const depositPct = m.total > 0 ? (m.deposit / m.total) * 100 : 0
                const renewalPct = m.total > 0 ? (m.renewalFee / m.total) * 100 : 0

                return (
                  <div key={m.monthKey} className="flex-1 min-w-[48px] flex flex-col items-center gap-2 h-full justify-end group">
                    <div 
                      className="w-full flex flex-col items-center gap-0.5 transition-all duration-300 group-hover:opacity-90"
                      style={{ height: `${heightPercent}%` }}
                    >
                      {renewalPct > 0 && (
                        <div 
                          className="w-full max-w-[42px] bg-emerald-600 rounded-t"
                          style={{ height: `${renewalPct}%` }}
                          title={`Tái ký: ${(m.renewalFee / 1_000_000).toFixed(2)} tr`}
                        />
                      )}
                      {depositPct > 0 && (
                        <div 
                          className={`w-full max-w-[42px] bg-cyan-500 ${renewalPct === 0 ? 'rounded-t' : ''}`}
                          style={{ height: `${depositPct}%` }}
                          title={`Cọc: ${(m.deposit / 1_000_000).toFixed(2)} tr`}
                        />
                      )}
                      {rentalPct > 0 && (
                        <div 
                          className={`w-full max-w-[42px] bg-slate-900 rounded-b ${renewalPct === 0 && depositPct === 0 ? 'rounded-t' : ''}`}
                          style={{ height: `${rentalPct}%` }}
                          title={`Tiền thuê: ${(m.rentalFee / 1_000_000).toFixed(2)} tr`}
                        />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-600 font-semibold">{m.label}</span>
                    <span className="font-mono text-[11px] text-slate-900 font-bold">
                      {m.total >= 1_000_000 ? `${(m.total / 1_000_000).toFixed(1)} tr` : `${(m.total / 1_000).toFixed(0)} k`}
                    </span>
                  </div>
                )
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu kỳ thanh toán để hiển thị biểu đồ
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg flex flex-wrap items-center justify-between gap-2 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-[20px]">insights</span>
              <span className="text-xs text-slate-700 font-medium">
                Biểu đồ cột phản ánh doanh thu thực theo tháng từ lịch sử hóa đơn thanh toán của hệ thống.
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900">
              Tổng cộng: {scopedPayments.length} GD thành công
            </span>
          </div>
        </div>

        {/* Donut Payment Channel & Contract Retention (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Kênh thanh toán &amp; HĐ</h2>
              <p className="text-xs text-slate-500">Phân bố thực tế từ {paymentMethodStats.totalCount} giao dịch</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
              Hệ thống
            </span>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
              <circle className="text-slate-100" cx="80" cy="80" fill="transparent" r="64" stroke="currentColor" strokeWidth="14"></circle>
              {/* VNPay segment */}
              <circle 
                className="text-blue-600" 
                cx="80" 
                cy="80" 
                fill="transparent" 
                r="64" 
                stroke="currentColor" 
                strokeDasharray="402" 
                strokeDashoffset={402 - (402 * (paymentMethodStats.vnpayPercent / 100))} 
                strokeLinecap="round" 
                strokeWidth="14"
              />
              {/* Bank Transfer segment */}
              <circle 
                className="text-slate-900" 
                cx="80" 
                cy="80" 
                fill="transparent" 
                r="64" 
                stroke="currentColor" 
                strokeDasharray="402" 
                strokeDashoffset={402 - (402 * ((paymentMethodStats.vnpayPercent + paymentMethodStats.bankPercent) / 100))} 
                strokeLinecap="round" 
                strokeWidth="14"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold font-mono text-slate-900 leading-none">
                {paymentMethodStats.totalCount}
              </span>
              <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1">Giao dịch đã thu</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                Cổng VNPay (Thẻ / QR)
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {paymentMethodStats.vnpayCount} GD ({paymentMethodStats.vnpayPercent}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900"></span>
                Chuyển khoản Ngân hàng
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {paymentMethodStats.bankCount} GD ({paymentMethodStats.bankPercent}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                Ví MoMo
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {paymentMethodStats.momoCount} GD ({paymentMethodStats.momoPercent}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MULTI-FACILITY PERFORMANCE TABLE */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-[24px]">view_list</span>
              <h2 className="text-base font-bold text-slate-900">So sánh các cơ sở</h2>
            </div>
            <p className="text-xs text-slate-500">Công suất và doanh thu trong kỳ báo cáo. Dấu “—” là chưa có số liệu.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">Sắp xếp:</span>
            <button
              type="button"
              aria-pressed={facilitySort === 'revenue'}
              onClick={() => setFacilitySort('revenue')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${facilitySort === 'revenue' ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              Doanh thu
            </button>
            <button
              type="button"
              aria-pressed={facilitySort === 'occupancy'}
              onClick={() => setFacilitySort('occupancy')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${facilitySort === 'occupancy' ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              Lấp đầy
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-mono uppercase border-y border-slate-200">
                <th className="py-3 px-4 font-semibold">Tên Cơ Sở &amp; Quản Lý</th>
                <th className="py-3 px-3 font-semibold">Địa Chỉ Chi Nhánh</th>
                <th className="py-3 px-3 text-right font-semibold">Tổng Kho</th>
                <th className="py-3 px-4 font-semibold text-center">Tỷ Lệ Lấp Đầy</th>
                <th className="py-3 px-4 text-right font-semibold">Tổng doanh thu</th>
                <th className="py-3 px-4 text-right font-semibold">Doanh thu thuê</th>
                <th className="py-3 px-3 text-center font-semibold">Kho trống</th>
                <th className="py-3 px-4 text-center font-semibold">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {occupancyRows.length > 0 ? (
                occupancyRows.map((bf) => {
                  const facilityInfo = facilities.find(f => f.id === bf.facilityId)
                  const facilityRevenue = revenueData?.byFacility?.find(f => f.facilityId === bf.facilityId)
                  return (
                    <tr key={bf.facilityId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{bf.facilityName}</span>
                          <span className="text-[11px] text-slate-500">
                            {bf.occupiedUnits} kho đang thuê{facilityInfo?.contactPhone ? ` · Hotline: ${facilityInfo.contactPhone}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {facilityInfo?.address ? `${facilityInfo.address}, ${facilityInfo.city}` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">{bf.totalUnits} kho</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="font-mono font-bold text-slate-900">{bf.occupancyRate.toFixed(1)}%</span>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${bf.occupancyRate >= 70 ? 'bg-orange-600' : bf.occupancyRate >= 30 ? 'bg-blue-600' : 'bg-slate-400'}`} 
                              style={{ width: `${Math.min(100, bf.occupancyRate)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {facilityRevenue?.totalRevenue != null ? `${facilityRevenue.totalRevenue.toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-orange-600">
                        {facilityRevenue?.rentalFeeRevenue != null ? `${facilityRevenue.rentalFeeRevenue.toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold border border-slate-200">
                          {bf.availableUnits} kho trống
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button 
                          type="button" 
                          onClick={() => {
                            if (setSelectedFacility) {
                              setSelectedFacility(bf.facilityId)
                            } else {
                              setSelectedFacilityId(bf.facilityId)
                            }
                          }}
                          aria-label={`Lọc báo cáo theo ${bf.facilityName}`}
                          title={`Lọc báo cáo theo ${bf.facilityName}`}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    {isReportsLoading ? 'Đang tải báo cáo...' : 'Chưa có dữ liệu cơ sở trong kỳ báo cáo.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FACILITY OPERATING POLICIES MANAGEMENT (BUSINESS MANAGER & ADMIN) */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 border border-cyan-100">
              <span className="material-symbols-outlined text-[24px]">policy</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Chính Sách Vận Hành Cơ Sở (Facility Operating Policies)
              </h2>
              <p className="text-xs text-slate-500">
                Quản lý các quy định tiền cọc, điều kiện hủy hoàn tiền, SLA hoàn cọc và quy trình xử lý nợ quá hạn của từng cơ sở theo phân quyền.
              </p>
            </div>
          </div>
          {canManagePolicies && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenCreatePolicy()}
                className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Tạo chính sách cơ sở mới</span>
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Cơ sở / Chi nhánh</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 px-3 text-center">Tiền cọc &amp; Thuê min</th>
                <th className="py-3 px-3 text-center">Gia hạn &amp; Báo trước</th>
                <th className="py-3 px-3 text-center">Hủy hoàn tiền (Full / 1 phần)</th>
                <th className="py-3 px-3 text-center">SLA Hoàn cọc</th>
                <th className="py-3 px-3 text-center">Xử lý Nợ &amp; Quá hạn</th>
                {canManagePolicies && <th className="py-3 px-4 text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facilities.length > 0 ? (
                facilities.map((fac) => {
                  const policy = allPolicies.find((p) => p.facilityId === fac.id)
                  const hasPolicy = Boolean(policy)

                  return (
                    <tr key={fac.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{fac.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {fac.code || 'MÃ CHƯA CẬP NHẬT'} • {fac.address || fac.city || 'Chưa có địa chỉ'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {hasPolicy ? (
                          policy?.isActive === false ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Ngừng áp dụng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Đang kích hoạt
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Chưa cấu hình
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-900">
                              {policy?.depositPercentage ?? policy?.depositPercent ?? 100}%
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Tối thiểu {policy?.minimumRentalMonths ?? 1} tháng
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-slate-800">
                              Mở trước {policy?.renewalWindowDays ?? 7} ngày
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Báo trả: {policy?.returnNoticeDays ?? 3} ngày
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-emerald-700">
                              100% (≥ {policy?.cancellationFullRefundHours ?? 48}h)
                            </span>
                            <span className="text-[10px] text-amber-600">
                              {policy?.cancellationPartialRefundPercent ?? 50}% (≥ {policy?.cancellationPartialRefundHours ?? 24}h)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                            {policy?.depositRefundSlaDays ?? 3} ngày làm việc
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-rose-600">
                              {formatCurrency(policy?.dailyLateFee ?? policy?.lateFeePerDay)} đ/ngày
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Ân hạn {policy?.overdueGraceDays ?? 3}d • Khóa {policy?.overdueAccessDisableDays ?? 5}d • Niêm phong {policy?.overdueSealingDays ?? 7}d
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      {canManagePolicies && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {hasPolicy && policy ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPolicy(fac, policy)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold text-xs transition border border-cyan-200 cursor-pointer"
                                  title="Chỉnh sửa quy định chính sách"
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  <span>Sửa</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePolicyActive(policy)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs transition border cursor-pointer ${
                                    policy.isActive === false
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                  }`}
                                  title={policy.isActive === false ? 'Kích hoạt chính sách này' : 'Ngừng áp dụng chính sách này'}
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    {policy.isActive === false ? 'toggle_on' : 'toggle_off'}
                                  </span>
                                  <span>{policy.isActive === false ? 'Kích hoạt' : 'Ngừng áp dụng'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGrantModal(fac, policy)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-200 cursor-pointer"
                                  title="Cấp quyền sửa ngoại lệ cho Quản lý cơ sở"
                                >
                                  <span className="material-symbols-outlined text-[15px]">key</span>
                                  <span>Ngoại lệ FM</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePolicy(policy)}
                                  className="inline-flex items-center p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  title="Xóa chính sách"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenCreatePolicy(fac)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition border border-emerald-200 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                <span>Tạo chính sách</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Chưa có danh sách cơ sở.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-TIER DYNAMIC PRICING MATRIX & BUSINESS POLICY ENGINE */}
      {canManagePolicies ? (
      <form onSubmit={handleSavePolicies} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
              <span className="material-symbols-outlined text-[24px]">tune</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cấu Hình Quy Tắc Kinh Doanh &amp; Chính Sách Giá Động (Pricing Matrix)
              </h2>
              <p className="text-xs text-slate-500">Lưu các trường chính sách được API hỗ trợ cho cơ sở đang chọn. Bảng giá theo diện tích chỉ để tham khảo.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => {
                const mini = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('mini'))
                const standard = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('standard') || ut.typeName.toLowerCase().includes('tiêu chuẩn'))
                const climate = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('cold') || ut.typeName.toLowerCase().includes('climate') || ut.typeName.toLowerCase().includes('mát'))
                setMiniPrice(mini?.basePricePerMonth ? Number(mini.basePricePerMonth).toLocaleString('vi-VN') : '450.000')
                setStandardPrice(standard?.basePricePerMonth ? Number(standard.basePricePerMonth).toLocaleString('vi-VN') : '2.400.000')
                setClimatePrice(climate?.basePricePerMonth ? Number(climate.basePricePerMonth).toLocaleString('vi-VN') : '3.200.000')
                setDepositOption('1month')
                setDiscount3M('-5')
                setDiscount6M('-10')
                setDiscount12M('-15')
                showToast('Đã khôi phục thông số chính sách và bảng giá loại kho')
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
            >
              Khôi phục mặc định
            </button>
            <button 
              type="submit" 
              disabled={isReportsLoading || isSavingPolicies}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isSavingPolicies ? 'hourglass_top' : 'save'}
              </span>
              <span>
                {isSavingPolicies
                  ? 'Đang lưu...'
                  : selectedFacilityId === 'all'
                  ? 'Lưu bảng giá loại kho (BR-RULE-011)'
                  : 'Lưu bảng giá & chính sách cơ sở'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Tier 1: Base Pricing (Real Unit Types from DB with BR-RULE-011 live adjustment) */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-600 text-[18px]">sell</span>
                  1. Bảng Giá Tiêu Chuẩn
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-emerald-700 border border-emerald-200">
                  {unitTypes.length > 0 ? `${unitTypes.length} loại kho` : 'BR-RULE-011'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Đơn giá niêm yết theo loại kho (lưu StorageUnitPriceHistory và đồng bộ kho trống).
              </p>
              <div className="flex flex-col gap-2.5">
                {/* Mini */}
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Kho Mini (Personal Locker)</span>
                    <span className="text-[10px] text-slate-400 font-mono">1.0 - 2.5m²</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      value={miniPrice}
                      onChange={(e) => setMiniPrice(e.target.value)}
                      placeholder="450.000"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <span className="text-xs text-slate-500 font-mono shrink-0">đ/th</span>
                  </div>
                </div>

                {/* Standard */}
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Kho Tiêu Chuẩn (Standard)</span>
                    <span className="text-[10px] text-slate-400 font-mono">4.0 - 10.0m²</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      value={standardPrice}
                      onChange={(e) => setStandardPrice(e.target.value)}
                      placeholder="2.400.000"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <span className="text-xs text-slate-500 font-mono shrink-0">đ/th</span>
                  </div>
                </div>

                {/* Cold Storage */}
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Kho Mát (Cold Storage 18-22°C)</span>
                    <span className="text-[10px] text-cyan-600 font-mono">Khí hậu ổn định</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      value={climatePrice}
                      onChange={(e) => setClimatePrice(e.target.value)}
                      placeholder="3.200.000"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <span className="text-xs text-slate-500 font-mono shrink-0">đ/th</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Chuẩn BR-RULE-011</span>
              <span>Bảo lưu HĐ đang thuê</span>
            </div>
          </div>

          {/* Tier 2: Security Deposit */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-800 text-[18px]">account_balance_wallet</span>
                  2. Tiền Cọc Đảm Bảo
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-slate-800 border border-slate-200">Bắt buộc</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Chính sách bảo chứng tài sản kho:</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 p-2 rounded bg-white border border-slate-200 cursor-pointer">
                  <input 
                    type="radio" 
                    name="deposit" 
                    checked={depositOption === '1month'}
                    onChange={() => setDepositOption('1month')}
                    className="mt-1 accent-orange-600" 
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">Mặc định: 01 Tháng Tiền Thuê</span>
                    <span className="text-[11px] text-slate-500">Khách cá nhân và DN nhỏ &lt; 6 tháng</span>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-2 rounded bg-white border border-slate-200 cursor-pointer">
                  <input 
                    type="radio" 
                    name="deposit" 
                    checked={depositOption === '2months'}
                    onChange={() => setDepositOption('2months')}
                    className="mt-1 accent-orange-600" 
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">Cố định: 02 Tháng Tiền Thuê</span>
                    <span className="text-[11px] text-slate-500">Kho điều hòa hoặc thuê &gt; 100m²</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Tier 3: Tenure Discount */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-600 text-[18px]">percent</span>
                  3. Chiết Khấu Kỳ Hạn
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-slate-800 border border-slate-200">Kích hoạt</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Khuyến khích ký dài hạn &amp; giảm tỷ lệ churn:</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Trả trước 3 Tháng</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={discount3M}
                      onChange={(e) => setDiscount3M(e.target.value)}
                      className="w-12 text-center bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-orange-600 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-800">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Trả trước 6 Tháng</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={discount6M}
                      onChange={(e) => setDiscount6M(e.target.value)}
                      className="w-12 text-center bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-orange-600 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-800">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Trả trước 12 Tháng</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={discount12M}
                      onChange={(e) => setDiscount12M(e.target.value)}
                      className="w-12 text-center bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-orange-600 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-800">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tier 4: Overdue & Penalty */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
                  4. Xử Lý Quá Hạn
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-rose-600 border border-slate-200">Tự Động</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Quy chuẩn thu hồi công nợ &amp; khóa mã kho:</p>
              <div className="flex flex-col gap-2">
                <div className="p-2 rounded bg-white border border-slate-200 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800">Thời gian ân hạn:</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{graceDays}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Không áp dụng phí phạt trễ hạn.</span>
                </div>
                <div className="p-2 rounded bg-white border border-slate-200 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800">Phạt từ Ngày thứ 4:</span>
                    <span className="font-mono text-xs font-bold text-orange-600">{lateFee} đ/ngày</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Tự cộng vào biên lai kế tiếp.</span>
                </div>
                <div className="p-2 rounded bg-white border border-slate-200 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-700">Khóa cổng điện tử:</span>
                    <span className="font-mono text-xs font-bold text-rose-700">{lockoutDay}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Ngắt mã PIN &amp; quyền App.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">visibility</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('Chính sách kinh doanh & Bảng giá hệ thống (Chế độ xem)', 'Business policies & System pricing (Read-only)')}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('Quản trị viên (Admin) chỉ có quyền xem chính sách và bảng giá. Thẩm quyền ban hành, cấu hình quy tắc và kích hoạt chính sách thuộc về Business Operations Manager.', 'Admin is only authorized to view policies and pricing. Policy creation, rule configuration, and activation are managed by Business Operations Manager.')}</p>
            </div>
          </div>
        </section>
      )}

      {/* Facility Policy Modal for Business Manager & Admin */}
      <FacilityPolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false)
          setEditingPolicyFacility(null)
          setEditingExistingPolicy(null)
        }}
        onSuccess={handlePolicySaved}
        facility={editingPolicyFacility}
        existingPolicy={editingExistingPolicy}
        availableFacilities={facilities}
      />

      {/* Policy Exception Grant Modal for Business Manager */}
      {grantModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cấp Quyền Sửa Ngoại Lệ Chính Sách
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {grantModalData.facility.name} • Thẩm quyền: Business Operations Manager
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGrantModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs text-indigo-950 dark:text-indigo-200">
              <p className="leading-relaxed">
                Theo quy chuẩn, Quản lý cơ sở (Facility Manager) chỉ xem chính sách và thực hiện nghiệp vụ. Bạn có thể cấp quyền sửa ngoại lệ để Facility Manager linh hoạt điều chỉnh quy định riêng tại cơ sở khi cần thiết.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Danh sách Quản lý cơ sở (Facility Managers):
              </h4>
              {grantModalData.loading ? (
                <div className="py-6 text-center text-xs text-slate-500">Đang tải danh sách nhân sự...</div>
              ) : grantModalData.managers.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  Chưa có nhân sự vai trò Facility Manager nào được phân công tại cơ sở này.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {grantModalData.managers.map((mgr) => {
                    const isGranted = grantModalData.grantedManagerIds.includes(mgr.id)
                    return (
                      <div
                        key={mgr.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {mgr.fullName || mgr.username}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {mgr.email}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleGrant(mgr.id, isGranted)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isGranted
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isGranted ? 'check_circle' : 'lock'}
                          </span>
                          <span>{isGranted ? 'Đã cấp quyền' : 'Chưa cấp quyền'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGrantModalData(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
