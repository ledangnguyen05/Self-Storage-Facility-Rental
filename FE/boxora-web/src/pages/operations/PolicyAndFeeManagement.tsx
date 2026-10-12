import React, { useState, useEffect } from 'react'
import { feeTypeService } from '../../services/feeTypeService'
import { discountService } from '../../services/discountService'
import { policyService } from '../../services/policyService'
import {
  FeeType,
  FeeTypeCreateRequest,
  FeeCategory,
  Discount,
  DiscountCreateRequest,
  DiscountType,
  DiscountValidateResponse,
  FacilityPolicy,
  FacilityPolicyUpdateRequest,
} from '../../types'

export const PolicyAndFeeManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'fees' | 'discounts' | 'policies'>('fees')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg)
    setToastType(type)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // ==========================================
  // TAB 1: FEE TYPES STATE
  // ==========================================
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([])
  const [loadingFees, setLoadingFees] = useState(false)
  const [feeCategoryFilter, setFeeCategoryFilter] = useState<string>('ALL')
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false)
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [feeForm, setFeeForm] = useState<FeeTypeCreateRequest>({
    code: '',
    name: '',
    description: '',
    defaultAmount: 100000,
    feeCategory: 'CLEANING',
    isRecurring: false,
    isActive: true,
  })

  // Fallback initial mock fee types if empty
  const fallbackFeeTypes: FeeType[] = [
    { id: 'f-1', code: 'CLEANING_BASIC', name: 'Phí vệ sinh khử khuẩn tiêu chuẩn', description: 'Vệ sinh dọn dẹp kho khi trả', defaultAmount: 150000, feeCategory: 'CLEANING', isRecurring: false, isActive: true },
    { id: 'f-2', code: 'KEY_REPLACEMENT', name: 'Phí cấp lại chìa khóa / SmartLock PIN', description: 'Cấp lại mã PIN hoặc cấp thẻ từ mới', defaultAmount: 200000, feeCategory: 'KEY_REPLACEMENT', isRecurring: false, isActive: true },
    { id: 'f-3', code: 'LATE_PENALTY_RATE', name: 'Phạt vi phạm chậm thanh toán (+1 ngày)', description: '5% tiền thuê tháng áp dụng mốc +1 ngày', defaultAmount: 50000, feeCategory: 'LATE_PENALTY', isRecurring: false, isActive: true },
    { id: 'f-4', code: 'INSURANCE_FIRE', name: 'Bảo hiểm cháy nổ & rủi ro thiên tai', description: 'Gói bảo hiểm tài sản ký gửi cao cấp', defaultAmount: 90000, feeCategory: 'INSURANCE', isRecurring: true, isActive: true },
    { id: 'f-5', code: 'OVERDUE_STORAGE_FEE', name: 'Phí lưu kho quá hạn kiểm kê', description: 'Phí quản lý tài sản sau khi niêm phong kho', defaultAmount: 30000, feeCategory: 'OVERDUE_STORAGE', isRecurring: false, isActive: true },
  ]

  const loadFeeTypes = async () => {
    setLoadingFees(true)
    try {
      const data = await feeTypeService.getAll()
      if (data && data.length > 0) {
        setFeeTypes(data)
      } else {
        setFeeTypes(fallbackFeeTypes)
      }
    } catch {
      setFeeTypes(fallbackFeeTypes)
    } finally {
      setLoadingFees(false)
    }
  }

  const handleOpenFeeModal = (fee?: FeeType) => {
    if (fee) {
      setEditingFeeId(fee.id)
      setFeeForm({
        code: fee.code,
        name: fee.name,
        description: fee.description || '',
        defaultAmount: fee.defaultAmount,
        feeCategory: fee.feeCategory,
        isRecurring: fee.isRecurring,
        isActive: fee.isActive,
      })
    } else {
      setEditingFeeId(null)
      setFeeForm({
        code: '',
        name: '',
        description: '',
        defaultAmount: 100000,
        feeCategory: 'CLEANING',
        isRecurring: false,
        isActive: true,
      })
    }
    setIsFeeModalOpen(true)
  }

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingFeeId) {
        await feeTypeService.update(editingFeeId, feeForm)
        showToast('Cập nhật loại phí dịch vụ thành công!')
      } else {
        await feeTypeService.create(feeForm)
        showToast('Thêm mới loại phí dịch vụ thành công!')
      }
      setIsFeeModalOpen(false)
      loadFeeTypes()
    } catch (err: unknown) {
      // Local optimistic update
      if (editingFeeId) {
        setFeeTypes(feeTypes.map(f => f.id === editingFeeId ? { ...f, ...feeForm } : f))
        showToast('Đã lưu cập nhật loại phí (local)!')
      } else {
        const newFee: FeeType = {
          ...feeForm,
          id: `f-${Date.now()}`,
          isRecurring: feeForm.isRecurring ?? false,
          isActive: feeForm.isActive ?? true,
        }
        setFeeTypes([...feeTypes, newFee])
        showToast('Đã thêm loại phí mới (local)!')
      }
      setIsFeeModalOpen(false)
    }
  }

  const handleToggleFeeStatus = async (fee: FeeType) => {
    try {
      await feeTypeService.update(fee.id, { isActive: !fee.isActive })
      setFeeTypes(feeTypes.map(f => f.id === fee.id ? { ...f, isActive: !f.isActive } : f))
      showToast(`Đã ${!fee.isActive ? 'kích hoạt' : 'vô hiệu hóa'} loại phí ${fee.code}!`)
    } catch {
      setFeeTypes(feeTypes.map(f => f.id === fee.id ? { ...f, isActive: !f.isActive } : f))
      showToast(`Đã đổi trạng thái loại phí ${fee.code} (local)!`)
    }
  }

  // ==========================================
  // TAB 2: DISCOUNTS & VOUCHERS STATE
  // ==========================================
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loadingDiscounts, setLoadingDiscounts] = useState(false)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null)
  const [discountForm, setDiscountForm] = useState<DiscountCreateRequest>({
    code: '',
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minRentalMonths: 1,
    maxDiscountAmount: 500000,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-12-31',
    usageLimit: 100,
    isActive: true,
  })

  // Coupon Testing State
  const [testCouponCode, setTestCouponCode] = useState('BOXORA10')
  const [testMonths, setTestMonths] = useState(3)
  const [testBaseAmount, setTestBaseAmount] = useState(3000000)
  const [validateResult, setValidateResult] = useState<DiscountValidateResponse | null>(null)
  const [validating, setValidating] = useState(false)

  const fallbackDiscounts: Discount[] = [
    { id: 'd-1', code: 'BOXORA10', name: 'Chào bạn mới giảm 10%', description: 'Áp dụng cho khách hàng mới thuê lần đầu', discountType: 'PERCENTAGE', discountValue: 10, minRentalMonths: 1, maxDiscountAmount: 300000, startDate: '2026-01-01', endDate: '2026-12-31', usageLimit: 500, usedCount: 42, isActive: true, isCurrentlyValid: true },
    { id: 'd-2', code: 'LONGTERM6M', name: 'Chiết khấu thuê 6 tháng (-10%)', description: 'Ưu đãi hợp đồng trung hạn từ 6 tháng', discountType: 'TENURE_CYCLE', discountValue: 10, minRentalMonths: 6, startDate: '2026-01-01', endDate: '2026-12-31', usageLimit: 200, usedCount: 88, isActive: true, isCurrentlyValid: true },
    { id: 'd-3', code: 'ANNUAL15', name: 'Ký dài hạn 12 tháng (-15%)', description: 'Tặng kèm 10 thùng carton và giảm 15% tiền thuê', discountType: 'TENURE_CYCLE', discountValue: 15, minRentalMonths: 12, startDate: '2026-01-01', endDate: '2026-12-31', usageLimit: 100, usedCount: 29, isActive: true, isCurrentlyValid: true },
    { id: 'd-4', code: 'VOUCHER200K', name: 'Voucher giảm trực tiếp 200.000đ', description: 'Giảm 200k cho đơn từ 2.000.000đ', discountType: 'FIXED_AMOUNT', discountValue: 200000, minRentalMonths: 2, startDate: '2026-05-01', endDate: '2026-09-30', usageLimit: 50, usedCount: 15, isActive: true, isCurrentlyValid: true },
  ]

  const loadDiscounts = async () => {
    setLoadingDiscounts(true)
    try {
      const data = await discountService.getAll()
      if (data && data.length > 0) {
        setDiscounts(data)
      } else {
        setDiscounts(fallbackDiscounts)
      }
    } catch {
      setDiscounts(fallbackDiscounts)
    } finally {
      setLoadingDiscounts(false)
    }
  }

  const handleOpenDiscountModal = (d?: Discount) => {
    if (d) {
      setEditingDiscountId(d.id)
      setDiscountForm({
        code: d.code,
        name: d.name,
        description: d.description || '',
        discountType: d.discountType,
        discountValue: d.discountValue,
        minRentalMonths: d.minRentalMonths,
        maxDiscountAmount: d.maxDiscountAmount,
        startDate: d.startDate,
        endDate: d.endDate,
        usageLimit: d.usageLimit,
        facilityId: d.facilityId,
        isActive: d.isActive,
      })
    } else {
      setEditingDiscountId(null)
      setDiscountForm({
        code: '',
        name: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minRentalMonths: 1,
        maxDiscountAmount: 500000,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '2026-12-31',
        usageLimit: 100,
        isActive: true,
      })
    }
    setIsDiscountModalOpen(true)
  }

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingDiscountId) {
        await discountService.update(editingDiscountId, discountForm)
        showToast('Cập nhật chương trình khuyến mãi thành công!')
      } else {
        await discountService.create(discountForm)
        showToast('Tạo mới voucher khuyến mãi thành công!')
      }
      setIsDiscountModalOpen(false)
      loadDiscounts()
    } catch {
      if (editingDiscountId) {
        setDiscounts(discounts.map(d => d.id === editingDiscountId ? { ...d, ...discountForm } : d))
        showToast('Đã lưu cập nhật khuyến mãi (local)!')
      } else {
        const newD: Discount = {
          ...discountForm,
          id: `d-${Date.now()}`,
          minRentalMonths: discountForm.minRentalMonths ?? 1,
          isActive: discountForm.isActive ?? true,
          usedCount: 0,
          isCurrentlyValid: true,
        }
        setDiscounts([...discounts, newD])
        showToast('Đã thêm voucher mới (local)!')
      }
      setIsDiscountModalOpen(false)
    }
  }

  const handleToggleDiscountStatus = async (d: Discount) => {
    try {
      await discountService.update(d.id, { isActive: !d.isActive })
      setDiscounts(discounts.map(item => item.id === d.id ? { ...item, isActive: !item.isActive } : item))
      showToast(`Đã ${!d.isActive ? 'kích hoạt' : 'vô hiệu hóa'} voucher ${d.code}!`)
    } catch {
      setDiscounts(discounts.map(item => item.id === d.id ? { ...item, isActive: !item.isActive } : item))
      showToast(`Đã đổi trạng thái voucher ${d.code} (local)!`)
    }
  }

  const handleTestValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidating(true)
    setValidateResult(null)
    try {
      const res = await discountService.validateDiscount({
        code: testCouponCode,
        rentalMonths: Number(testMonths),
        baseAmount: Number(testBaseAmount),
      })
      setValidateResult(res)
      showToast(res.message || 'Mã ưu đãi hợp lệ!')
    } catch (err: any) {
      // Fallback local calculation
      const target = discounts.find(d => d.code.toUpperCase() === testCouponCode.toUpperCase() && d.isActive)
      if (target) {
        let discountAmt = 0
        if (target.discountType === 'PERCENTAGE' || target.discountType === 'TENURE_CYCLE') {
          discountAmt = (testBaseAmount * target.discountValue) / 100
          if (target.maxDiscountAmount && discountAmt > target.maxDiscountAmount) {
            discountAmt = target.maxDiscountAmount
          }
        } else {
          discountAmt = Math.min(testBaseAmount, target.discountValue)
        }
        setValidateResult({
          isValid: true,
          discountId: target.id,
          code: target.code,
          name: target.name,
          discountType: target.discountType,
          discountValue: target.discountValue,
          discountAmount: discountAmt,
          finalAmount: Math.max(0, testBaseAmount - discountAmt),
          message: `Áp dụng thành công voucher '${target.code}'. Giảm ${discountAmt.toLocaleString('vi-VN')} đ`,
        })
        showToast('Mã voucher hợp lệ (kiểm tra giả lập)!')
      } else {
        setValidateResult({
          isValid: false,
          discountId: '',
          code: testCouponCode,
          name: '',
          discountType: 'PERCENTAGE',
          discountValue: 0,
          discountAmount: 0,
          finalAmount: testBaseAmount,
          message: 'Mã voucher không tồn tại hoặc đã hết hạn sử dụng.',
        })
        showToast('Mã voucher không hợp lệ!', 'error')
      }
    } finally {
      setValidating(false)
    }
  }

  // ==========================================
  // TAB 3: FACILITY POLICIES STATE
  // ==========================================
  const [policies, setPolicies] = useState<FacilityPolicy[]>([])
  const [selectedFacilityPolicy, setSelectedFacilityPolicy] = useState<FacilityPolicy | null>(null)
  const [loadingPolicies, setLoadingPolicies] = useState(false)
  const [policyForm, setPolicyForm] = useState<FacilityPolicyUpdateRequest>({
    depositPercentage: 100,
    renewalWindowDays: 14,
    cancellationFullRefundHours: 48,
    cancellationPartialRefundHours: 24,
    cancellationPartialRefundPercent: 50,
    returnNoticeDays: 7,
    depositRefundSlaDays: 2,
    dailyLateFee: 50000,
    overdueGraceDays: 1,
    overdueAccessDisableDays: 3,
    overdueSealingDays: 7,
    minimumRentalMonths: 1,
  })

  const fallbackPolicies: FacilityPolicy[] = [
    {
      id: 'p-1',
      facilityId: 'f-tb',
      facilityName: 'Boxora Mega Central Tân Bình (TP.HCM)',
      depositPercentage: 100,
      renewalWindowDays: 14,
      cancellationFullRefundHours: 48,
      cancellationPartialRefundHours: 24,
      cancellationPartialRefundPercent: 50,
      returnNoticeDays: 7,
      depositRefundSlaDays: 2,
      dailyLateFee: 50000,
      overdueGraceDays: 1,
      overdueAccessDisableDays: 3,
      overdueSealingDays: 7,
      minimumRentalMonths: 1,
    },
    {
      id: 'p-2',
      facilityId: 'f-q7',
      facilityName: 'Kho Nam Sài Gòn Q7 (TP.HCM)',
      depositPercentage: 100,
      renewalWindowDays: 14,
      cancellationFullRefundHours: 48,
      cancellationPartialRefundHours: 24,
      cancellationPartialRefundPercent: 50,
      returnNoticeDays: 7,
      depositRefundSlaDays: 2,
      dailyLateFee: 50000,
      overdueGraceDays: 1,
      overdueAccessDisableDays: 3,
      overdueSealingDays: 7,
      minimumRentalMonths: 1,
    },
  ]

  const loadPolicies = async () => {
    setLoadingPolicies(true)
    try {
      const res = await policyService.getAll()
      if (res?.content && res.content.length > 0) {
        setPolicies(res.content)
        setSelectedFacilityPolicy(res.content[0])
        setPolicyForm(res.content[0])
      } else {
        setPolicies(fallbackPolicies)
        setSelectedFacilityPolicy(fallbackPolicies[0])
        setPolicyForm(fallbackPolicies[0])
      }
    } catch {
      setPolicies(fallbackPolicies)
      setSelectedFacilityPolicy(fallbackPolicies[0])
      setPolicyForm(fallbackPolicies[0])
    } finally {
      setLoadingPolicies(false)
    }
  }

  const handleSelectPolicy = (p: FacilityPolicy) => {
    setSelectedFacilityPolicy(p)
    setPolicyForm({
      depositPercentage: p.depositPercentage,
      renewalWindowDays: p.renewalWindowDays,
      cancellationFullRefundHours: p.cancellationFullRefundHours,
      cancellationPartialRefundHours: p.cancellationPartialRefundHours,
      cancellationPartialRefundPercent: p.cancellationPartialRefundPercent,
      returnNoticeDays: p.returnNoticeDays,
      depositRefundSlaDays: p.depositRefundSlaDays,
      dailyLateFee: p.dailyLateFee,
      overdueGraceDays: p.overdueGraceDays,
      overdueAccessDisableDays: p.overdueAccessDisableDays,
      overdueSealingDays: p.overdueSealingDays,
      minimumRentalMonths: p.minimumRentalMonths,
    })
  }

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFacilityPolicy) return
    try {
      await policyService.update(selectedFacilityPolicy.id, policyForm)
      showToast(`Đã lưu & đồng bộ chính sách cho ${selectedFacilityPolicy.facilityName}!`)
      loadPolicies()
    } catch {
      setPolicies(policies.map(p => p.id === selectedFacilityPolicy.id ? { ...p, ...policyForm } : p))
      showToast(`Đã cập nhật chính sách cơ sở (local)!`)
    }
  }

  useEffect(() => {
    loadFeeTypes()
    loadDiscounts()
    loadPolicies()
  }, [])

  const filteredFeeTypes = feeTypes.filter(f => {
    if (feeCategoryFilter === 'ALL') return true
    return f.feeCategory === feeCategoryFilter
  })

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 ${
          toastType === 'success'
            ? 'bg-neutral-900 text-white border-neutral-700'
            : 'bg-rose-900 text-white border-rose-700'
        }`}>
          <span className="material-symbols-outlined text-[20px] text-emerald-400">
            {toastType === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER STRIP */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 font-mono text-[11px] font-bold uppercase tracking-wider border border-orange-200">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-pulse"></span>
                Chính Sách &amp; Bảng Phí Hệ Thống
              </span>
              <span className="text-slate-400 text-xs">• Cấu hình BR-RULE-011 &amp; BR-RULE-012</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Quản Trị Biểu Phí, Khuyến Mãi &amp; Chính Sách Cơ Sở
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Thiết lập chính sách cọc, ân hạn nợ, biểu phí phụ trợ, mã voucher chiết khấu và quy chuẩn niêm phong tự động.
            </p>
          </div>

          {/* TAB SWITCHER */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0 self-start md:self-center">
            <button
              onClick={() => setActiveTab('fees')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'fees'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-orange-600">receipt</span>
              Biểu Phí Dịch Vụ ({feeTypes.length})
            </button>
            <button
              onClick={() => setActiveTab('discounts')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'discounts'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-violet-600">percent</span>
              Khuyến Mãi &amp; Voucher ({discounts.length})
            </button>
            <button
              onClick={() => setActiveTab('policies')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'policies'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-blue-600">policy</span>
              Chính Sách Cơ Sở ({policies.length})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BIỂU PHÍ & PHỤ PHÍ DỊCH VỤ (FEE TYPES CRUD) */}
      {/* ========================================================================= */}
      {activeTab === 'fees' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Lọc theo danh mục:</span>
              {['ALL', 'CLEANING', 'KEY_REPLACEMENT', 'LATE_PENALTY', 'INSURANCE', 'OVERDUE_STORAGE', 'OTHER'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFeeCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    feeCategoryFilter === cat
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'Tất cả' : cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenFeeModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Thêm Loại Phí Mới
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-500 uppercase">
                    <th className="py-3 px-4">Mã Phí (Code)</th>
                    <th className="py-3 px-4">Tên Loại Phí</th>
                    <th className="py-3 px-4">Phân Loại</th>
                    <th className="py-3 px-4 text-right">Đơn Giá Mặc Định</th>
                    <th className="py-3 px-4 text-center">Định Kỳ</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingFees ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">Đang tải danh mục phí...</td>
                    </tr>
                  ) : filteredFeeTypes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">Không có loại phí nào phù hợp.</td>
                    </tr>
                  ) : (
                    filteredFeeTypes.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {f.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{f.name}</div>
                          {f.description && <div className="text-[11px] text-slate-400 truncate max-w-xs">{f.description}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {f.feeCategory}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                          {Number(f.defaultAmount).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-4 text-center">
                          {f.isRecurring ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Hàng tháng</span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Một lần</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            f.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}>
                            {f.isActive ? 'Đang áp dụng' : 'Tạm dừng'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenFeeModal(f)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Sửa biểu phí"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleToggleFeeStatus(f)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                f.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={f.isActive ? 'Tạm ngưng loại phí' : 'Kích hoạt lại loại phí'}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {f.isActive ? 'power_settings_new' : 'check'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KHUYẾN MÃI, CHIẾT KHẤU & THỬ NGHIỆM VOUCHER (DISCOUNTS CRUD) */}
      {/* ========================================================================= */}
      {activeTab === 'discounts' && (
        <div className="flex flex-col gap-6">
          {/* Top Actions & Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Voucher Testing Simulator */}
            <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Thử Nghiệm Mã Voucher</h3>
                      <p className="text-[11px] text-slate-500">Giả lập kiểm tra hợp lệ &amp; tính số tiền giảm</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleTestValidateCoupon} className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Mã ưu đãi (Coupon Code)</label>
                    <input
                      type="text"
                      value={testCouponCode}
                      onChange={e => setTestCouponCode(e.target.value.toUpperCase())}
                      placeholder="VD: BOXORA10"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-violet-500 uppercase"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Thời gian thuê</label>
                      <input
                        type="number"
                        min="1"
                        value={testMonths}
                        onChange={e => setTestMonths(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Tổng tiền gốc (đ)</label>
                      <input
                        type="number"
                        step="50000"
                        value={testBaseAmount}
                        onChange={e => setTestBaseAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={validating}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">calculate</span>
                    {validating ? 'Đang kiểm tra...' : 'Kiểm Tra & Tính Giảm Giá'}
                  </button>
                </form>

                {validateResult && (
                  <div className={`mt-4 p-3.5 rounded-xl border text-xs flex flex-col gap-1.5 ${
                    validateResult.isValid
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/70 border-rose-200 text-rose-950'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>{validateResult.isValid ? '✓ Hợp lệ' : '✗ Không hợp lệ'}</span>
                      {validateResult.isValid && (
                        <span className="font-mono text-emerald-700">
                          -{validateResult.discountAmount.toLocaleString('vi-VN')} đ
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed">{validateResult.message}</p>
                    {validateResult.isValid && (
                      <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between font-bold text-slate-900">
                        <span>Số tiền sau giảm:</span>
                        <span className="text-sm font-mono text-orange-600">
                          {validateResult.finalAmount.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Discount List Cards */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Danh Sách Chương Trình Ưu Đãi</h3>
                  <p className="text-xs text-slate-500">Quản lý voucher, chiết khấu kỳ hạn và ưu đãi chào hè</p>
                </div>
                <button
                  onClick={() => handleOpenDiscountModal()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Tạo Voucher Mới
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingDiscounts ? (
                  <div className="col-span-2 text-center py-8 text-slate-400">Đang tải danh sách ưu đãi...</div>
                ) : discounts.map(d => (
                  <div
                    key={d.id}
                    className={`p-4 rounded-2xl bg-white border transition-all flex flex-col justify-between shadow-xs ${
                      d.isActive ? 'border-slate-200 hover:border-violet-300' : 'border-slate-200 opacity-60 bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 font-mono font-bold text-xs border border-violet-200">
                          {d.code}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            d.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}>
                            {d.isActive ? 'Hoạt động' : 'Đã ngưng'}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mb-1">{d.name}</h4>
                      <p className="text-[11px] text-slate-500 mb-3 line-clamp-2">{d.description || 'Không có mô tả'}</p>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] mb-3">
                        <div>
                          <span className="text-slate-400 block">Mức giảm:</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {d.discountType === 'PERCENTAGE' || d.discountType === 'TENURE_CYCLE'
                              ? `${d.discountValue}%`
                              : `${Number(d.discountValue).toLocaleString('vi-VN')} đ`}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Kỳ hạn tối thiểu:</span>
                          <span className="font-bold text-slate-900">{d.minRentalMonths} tháng</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Lượt sử dụng:</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {d.usedCount} / {d.usageLimit ? d.usageLimit : '∞'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Thời hạn:</span>
                          <span className="font-bold text-slate-900 truncate">
                            {d.endDate ? d.endDate : 'Vô thời hạn'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenDiscountModal(d)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Sửa
                      </button>
                      <button
                        onClick={() => handleToggleDiscountStatus(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                          d.isActive
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {d.isActive ? 'block' : 'check_circle'}
                        </span>
                        {d.isActive ? 'Tạm ngưng' : 'Mở lại'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CHÍNH SÁCH CƠ SỞ (FACILITY POLICIES CRUD) */}
      {/* ========================================================================= */}
      {activeTab === 'policies' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Facility List Selector */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3">
            <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">apartment</span>
              Chọn Cơ Sở Cấu Hình
            </h3>
            <div className="flex flex-col gap-2">
              {loadingPolicies ? (
                <div className="text-center py-6 text-slate-400 text-xs">Đang tải danh sách cơ sở...</div>
              ) : policies.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPolicy(p)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1 ${
                    selectedFacilityPolicy?.id === p.id
                      ? 'bg-blue-50/70 border-blue-400 text-blue-950 font-semibold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-slate-900">{p.facilityName || 'Cơ sở Boxora'}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Cọc: {p.depositPercentage}%</span>
                    <span>Phạt: {Number(p.dailyLateFee).toLocaleString('vi-VN')} đ/ngày</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Policy Detail Editor Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Cấu Hình Chính Sách: {selectedFacilityPolicy?.facilityName || 'Toàn Chuỗi'}
                </h3>
                <p className="text-xs text-slate-500">
                  Quy định tiền cọc, hoàn tiền hủy kho, và các mốc quá hạn (+1, +3, +7)
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePolicy}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Lưu Chính Sách
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Group 1: Tiền Cọc & Thuê Tối Thiểu */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
                <span className="font-mono text-[11px] font-bold uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-600 text-[18px]">account_balance_wallet</span>
                  1. Tiền Cọc &amp; Thuê Tối Thiểu
                </span>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tỷ lệ tiền cọc (% tháng thuê)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={policyForm.depositPercentage ?? 100}
                      onChange={e => setPolicyForm({ ...policyForm, depositPercentage: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Số tháng thuê tối thiểu</label>
                  <input
                    type="number"
                    value={policyForm.minimumRentalMonths ?? 1}
                    onChange={e => setPolicyForm({ ...policyForm, minimumRentalMonths: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Thời gian SLA hoàn cọc (ngày làm việc)</label>
                  <input
                    type="number"
                    value={policyForm.depositRefundSlaDays ?? 2}
                    onChange={e => setPolicyForm({ ...policyForm, depositRefundSlaDays: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Group 2: Gia Hạn & Hủy Hợp Đồng */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
                <span className="font-mono text-[11px] font-bold uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-violet-600 text-[18px]">event_repeat</span>
                  2. Gia Hạn &amp; Hủy Hợp Đồng
                </span>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cửa sổ thông báo gia hạn trước (ngày)</label>
                  <input
                    type="number"
                    value={policyForm.renewalWindowDays ?? 14}
                    onChange={e => setPolicyForm({ ...policyForm, renewalWindowDays: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Báo trước khi trả kho (ngày)</label>
                  <input
                    type="number"
                    value={policyForm.returnNoticeDays ?? 7}
                    onChange={e => setPolicyForm({ ...policyForm, returnNoticeDays: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Hủy hoàn 100% (giờ)</label>
                    <input
                      type="number"
                      value={policyForm.cancellationFullRefundHours ?? 48}
                      onChange={e => setPolicyForm({ ...policyForm, cancellationFullRefundHours: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Hủy hoàn 50% (giờ)</label>
                    <input
                      type="number"
                      value={policyForm.cancellationPartialRefundHours ?? 24}
                      onChange={e => setPolicyForm({ ...policyForm, cancellationPartialRefundHours: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Mốc Quá Hạn & Thu Hồi (BR-RULE-012) */}
              <div className="md:col-span-2 p-4 rounded-xl bg-rose-50/50 border border-rose-200 flex flex-col gap-3">
                <span className="font-mono text-[11px] font-bold uppercase text-rose-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
                  3. Xử Lý Quá Hạn Theo Mốc (BR-RULE-012)
                </span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Phí phạt trễ hạn (VNĐ/ngày)</label>
                    <input
                      type="number"
                      step="5000"
                      value={policyForm.dailyLateFee ?? 50000}
                      onChange={e => setPolicyForm({ ...policyForm, dailyLateFee: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Mốc +1 (Ân hạn / Phạt 5%)</label>
                    <input
                      type="number"
                      value={policyForm.overdueGraceDays ?? 1}
                      onChange={e => setPolicyForm({ ...policyForm, overdueGraceDays: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Mốc +3 (Khóa PIN / QR App)</label>
                    <input
                      type="number"
                      value={policyForm.overdueAccessDisableDays ?? 3}
                      onChange={e => setPolicyForm({ ...policyForm, overdueAccessDisableDays: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Mốc +7 (Niêm phong kho)</label>
                    <input
                      type="number"
                      value={policyForm.overdueSealingDays ?? 7}
                      onChange={e => setPolicyForm({ ...policyForm, overdueSealingDays: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: THÊM / SỬA LOẠI PHÍ (FEE TYPE MODAL) */}
      {/* ========================================================================= */}
      {isFeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingFeeId ? 'Cập Nhật Loại Phí Dịch Vụ' : 'Thêm Mới Loại Phí Dịch Vụ'}
              </h3>
              <button
                onClick={() => setIsFeeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveFee} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mã loại phí (Code in hoa)</label>
                <input
                  type="text"
                  disabled={!!editingFeeId}
                  value={feeForm.code}
                  onChange={e => setFeeForm({ ...feeForm, code: e.target.value.toUpperCase() })}
                  placeholder="VD: CLEANING_PREMIUM"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none uppercase disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên loại phí</label>
                <input
                  type="text"
                  value={feeForm.name}
                  onChange={e => setFeeForm({ ...feeForm, name: e.target.value })}
                  placeholder="VD: Phí vệ sinh khử khuẩn kho chuyên sâu"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn giá mặc định (VNĐ)</label>
                  <input
                    type="number"
                    step="10000"
                    value={feeForm.defaultAmount}
                    onChange={e => setFeeForm({ ...feeForm, defaultAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Danh mục phí</label>
                  <select
                    value={feeForm.feeCategory}
                    onChange={e => setFeeForm({ ...feeForm, feeCategory: e.target.value as FeeCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="CLEANING">Vệ sinh kho (CLEANING)</option>
                    <option value="KEY_REPLACEMENT">Cấp chìa/PIN (KEY_REPLACEMENT)</option>
                    <option value="LATE_PENALTY">Phạt trễ hạn (LATE_PENALTY)</option>
                    <option value="INSURANCE">Bảo hiểm (INSURANCE)</option>
                    <option value="OVERDUE_STORAGE">Lưu kho quá hạn (OVERDUE_STORAGE)</option>
                    <option value="OTHER">Phí khác (OTHER)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mô tả chi tiết</label>
                <textarea
                  rows={2}
                  value={feeForm.description}
                  onChange={e => setFeeForm({ ...feeForm, description: e.target.value })}
                  placeholder="Ghi chú điều kiện áp dụng loại phí..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feeForm.isRecurring}
                    onChange={e => setFeeForm({ ...feeForm, isRecurring: e.target.checked })}
                    className="accent-orange-600 rounded"
                  />
                  <span className="text-slate-700 font-medium">Tính định kỳ mỗi tháng</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feeForm.isActive}
                    onChange={e => setFeeForm({ ...feeForm, isActive: e.target.checked })}
                    className="accent-orange-600 rounded"
                  />
                  <span className="text-slate-700 font-medium">Kích hoạt sử dụng</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsFeeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-xs"
                >
                  Lưu Loại Phí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TẠO / SỬA VOUCHER (DISCOUNT MODAL) */}
      {/* ========================================================================= */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingDiscountId ? 'Cập Nhật Chương Trình Khuyến Mãi' : 'Tạo Mới Mã Ưu Đãi / Voucher'}
              </h3>
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã voucher (in hoa)</label>
                  <input
                    type="text"
                    disabled={!!editingDiscountId}
                    value={discountForm.code}
                    onChange={e => setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })}
                    placeholder="VD: WELCOME20"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 uppercase disabled:bg-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Loại chiết khấu</label>
                  <select
                    value={discountForm.discountType}
                    onChange={e => setDiscountForm({ ...discountForm, discountType: e.target.value as DiscountType })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900"
                  >
                    <option value="PERCENTAGE">Giảm theo tỷ lệ phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">Giảm số tiền cố định (VNĐ)</option>
                    <option value="TENURE_CYCLE">Chiết khấu theo chu kỳ kỳ hạn</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên chương trình khuyến mãi</label>
                <input
                  type="text"
                  value={discountForm.name}
                  onChange={e => setDiscountForm({ ...discountForm, name: e.target.value })}
                  placeholder="VD: Ưu đãi tân khách hàng giảm 20%"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá trị giảm</label>
                  <input
                    type="number"
                    value={discountForm.discountValue}
                    onChange={e => setDiscountForm({ ...discountForm, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Thuê tối thiểu (tháng)</label>
                  <input
                    type="number"
                    min="1"
                    value={discountForm.minRentalMonths ?? 1}
                    onChange={e => setDiscountForm({ ...discountForm, minRentalMonths: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Trần giảm tối đa (đ)</label>
                  <input
                    type="number"
                    step="50000"
                    value={discountForm.maxDiscountAmount ?? ''}
                    onChange={e => setDiscountForm({ ...discountForm, maxDiscountAmount: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Không giới hạn"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={discountForm.startDate}
                    onChange={e => setDiscountForm({ ...discountForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày kết thúc</label>
                  <input
                    type="date"
                    value={discountForm.endDate ?? ''}
                    onChange={e => setDiscountForm({ ...discountForm, endDate: e.target.value || undefined })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số lượt tối đa</label>
                  <input
                    type="number"
                    value={discountForm.usageLimit ?? ''}
                    onChange={e => setDiscountForm({ ...discountForm, usageLimit: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Vô hạn"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mô tả điều kiện</label>
                <textarea
                  rows={2}
                  value={discountForm.description}
                  onChange={e => setDiscountForm({ ...discountForm, description: e.target.value })}
                  placeholder="Điều kiện áp dụng voucher..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-xs"
                >
                  Lưu Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

