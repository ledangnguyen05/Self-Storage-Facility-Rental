import React, { useState, useEffect } from 'react'
import { Facility, FacilityPolicy, UnitType } from '../../types'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { storageUnitService } from '../../services/storageUnitService'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'
import { EditUnitTypeModal } from './components/EditUnitTypeModal'

interface DynamicPricingMatrixPanelProps {
  facilities: Facility[]
}

export const DynamicPricingMatrixPanel: React.FC<DynamicPricingMatrixPanelProps> = ({ facilities }) => {
  const { role, hasPermission } = useAuth()
  const { t } = useLanguage()
  const canManagePolicies =
    role === 'BUSINESS_MANAGER' ||
    role === 'ADMIN' ||
    hasPermission('POLICY_UPDATE') ||
    hasPermission('UNIT_TYPE_UPDATE')

  // Task 5.5: Remove 'all' option. Force select specific facility, default to facilities[0]?.id
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(() => {
    return facilities.length > 0 ? facilities[0].id : ''
  })
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [currentPolicy, setCurrentPolicy] = useState<FacilityPolicy | null>(null)

  // Task 4: Duration discount states (3M, 6M, 12M)
  const [discount3M, setDiscount3M] = useState<number>(5)
  const [discount6M, setDiscount6M] = useState<number>(10)
  const [discount12M, setDiscount12M] = useState<number>(15)

  // Edit / Delete discount states
  const [editingDiscountTerm, setEditingDiscountTerm] = useState<3 | 6 | 12 | null>(null)
  const [tempDiscountVal, setTempDiscountVal] = useState<string>('')
  const [deleteConfirmTerm, setDeleteConfirmTerm] = useState<3 | 6 | 12 | null>(null)

  // Edit Unit Type Modal state (Task 3.3 & Task 5.1-5.4)
  const [selectedUnitTypeToEdit, setSelectedUnitTypeToEdit] = useState<UnitType | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Status toggle confirmation modal state (Task 5.3)
  const [statusConfirmUnitType, setStatusConfirmUnitType] = useState<UnitType | null>(null)

  const [isSavingDiscounts, setIsSavingDiscounts] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Ensure selected facility is always valid
  useEffect(() => {
    if (!selectedFacilityId && facilities.length > 0) {
      setSelectedFacilityId(facilities[0].id)
    }
  }, [facilities, selectedFacilityId])

  // Load Unit Types
  const loadUnitTypes = async () => {
    try {
      const uts = await storageUnitService.getUnitTypes()
      if (uts && Array.isArray(uts)) {
        uts.sort((a, b) => (a.areaSqm || 0) - (b.areaSqm || 0))
        setUnitTypes(uts)
      }
    } catch (err) {
      console.warn('Failed to load unit types:', err)
    }
  }

  // Load current policy when facility changes
  const loadFacilityPolicy = async (facId: string) => {
    if (!facId) {
      setCurrentPolicy(null)
      return
    }
    try {
      const pol = await facilityPolicyService.getByFacilityId(facId)
      if (pol) {
        setCurrentPolicy(pol)
        setDiscount3M(pol.discount3MonthPercent ?? 5)
        setDiscount6M(pol.discount6MonthPercent ?? 10)
        setDiscount12M(pol.discount12MonthPercent ?? 15)
      } else {
        setCurrentPolicy(null)
        setDiscount3M(5)
        setDiscount6M(10)
        setDiscount12M(15)
      }
    } catch {
      setCurrentPolicy(null)
    }
  }

  useEffect(() => {
    void loadUnitTypes()
  }, [])

  useEffect(() => {
    if (selectedFacilityId) {
      void loadFacilityPolicy(selectedFacilityId)
    }
  }, [selectedFacilityId])

  useRealtimeSync(() => {
    if (!isEditModalOpen && editingDiscountTerm === null) {
      void loadUnitTypes()
      if (selectedFacilityId) {
        void loadFacilityPolicy(selectedFacilityId)
      }
    }
  }, { intervalMs: 6000 })

  // Save Duration Discounts to backend
  const handleSaveDiscounts = async (updated3M: number, updated6M: number, updated12M: number) => {
    if (!canManagePolicies || !selectedFacilityId) return

    setIsSavingDiscounts(true)
    try {
      if (currentPolicy) {
        const res = await facilityPolicyService.update(currentPolicy.id, {
          discount3MonthPercent: updated3M,
          discount6MonthPercent: updated6M,
          discount12MonthPercent: updated12M,
        })
        setCurrentPolicy(res)
      } else {
        const res = await facilityPolicyService.create({
          facilityId: selectedFacilityId,
          depositPercentage: 100,
          cancellationFullRefundHours: 24,
          cancellationPartialRefundHours: 48,
          cancellationPartialRefundPercent: 70,
          depositRefundSlaDays: 5,
          dailyLateFee: 50000,
          overdueGraceDays: 1,
          overdueAccessDisableDays: 3,
          overdueSealingDays: 7,
          discount3MonthPercent: updated3M,
          discount6MonthPercent: updated6M,
          discount12MonthPercent: updated12M,
        })
        setCurrentPolicy(res)
      }
      setDiscount3M(updated3M)
      setDiscount6M(updated6M)
      setDiscount12M(updated12M)
      showToast('Đã lưu cấu hình chiết khấu kỳ hạn thành công.')
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể lưu mức chiết khấu', true)
    } finally {
      setIsSavingDiscounts(false)
    }
  }

  // Handle Edit Single Discount Term
  const handleStartEditDiscount = (term: 3 | 6 | 12) => {
    setEditingDiscountTerm(term)
    const cur = term === 3 ? discount3M : term === 6 ? discount6M : discount12M
    setTempDiscountVal(String(cur))
  }

  const handleSaveEditDiscount = async () => {
    if (editingDiscountTerm === null) return
    const num = Number(tempDiscountVal)
    if (isNaN(num) || num < 0 || num > 100) {
      showToast('Mức chiết khấu phải là số từ 0% đến 100%', true)
      return
    }

    const u3 = editingDiscountTerm === 3 ? num : discount3M
    const u6 = editingDiscountTerm === 6 ? num : discount6M
    const u12 = editingDiscountTerm === 12 ? num : discount12M

    await handleSaveDiscounts(u3, u6, u12)
    setEditingDiscountTerm(null)
  }

  // Handle Delete / Reset Discount to 0%
  const handleConfirmDeleteDiscount = async () => {
    if (deleteConfirmTerm === null) return
    const u3 = deleteConfirmTerm === 3 ? 0 : discount3M
    const u6 = deleteConfirmTerm === 6 ? 0 : discount6M
    const u12 = deleteConfirmTerm === 12 ? 0 : discount12M

    await handleSaveDiscounts(u3, u6, u12)
    setDeleteConfirmTerm(null)
    showToast(`Đã xóa mức chiết khấu kỳ hạn ${deleteConfirmTerm} tháng (áp dụng 0%).`)
  }

  // Handle Active / Inactive Status Toggle
  const handleConfirmToggleStatus = async () => {
    if (!statusConfirmUnitType) return
    const newStatus = !statusConfirmUnitType.isActive

    try {
      await storageUnitService.updateUnitType(statusConfirmUnitType.id, {
        isActive: newStatus,
        priceChangeReason: `Chuyển trạng thái hoạt động sang ${newStatus ? 'Hoạt động' : 'Tạm ngưng'}`,
      })
      showToast(
        `Đã ${newStatus ? 'kích hoạt' : 'tạm ngưng'} loại kho "${statusConfirmUnitType.typeName}".`
      )
      setStatusConfirmUnitType(null)
      await loadUnitTypes()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể cập nhật trạng thái', true)
    }
  }

  const getUnitTypeSpec = (ut: UnitType) => {
    const area = ut.areaSqm || 0
    const name = (ut.typeName || '').toLowerCase()
    if (name.includes('cold') || name.includes('mát') || (area >= 4.5 && area <= 5.5)) {
      return {
        volume: ut.volumeM3 ? `${ut.volumeM3} m³` : '14 m³',
        areaLabel: ut.areaSqm ? `${ut.areaSqm} m²` : '5.0 m²',
        boxes: ut.capacityBoxes ? `${ut.capacityBoxes} boxes` : '85 boxes (Căn hộ 2PN lớn)',
        category: 'Kho Mát A/C (18-22°C)',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      }
    }
    if (area <= 1.5) {
      return {
        volume: ut.volumeM3 ? `${ut.volumeM3} m³` : '1 m³',
        areaLabel: ut.areaSqm ? `${ut.areaSqm} m²` : '1.0 m²',
        boxes: ut.capacityBoxes ? `${ut.capacityBoxes} boxes` : '6 boxes',
        category: 'Tủ cá nhân (Mini)',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
      }
    }
    if (area <= 3.5) {
      return {
        volume: ut.volumeM3 ? `${ut.volumeM3} m³` : '8 m³',
        areaLabel: ut.areaSqm ? `${ut.areaSqm} m²` : '3.0 m²',
        boxes: ut.capacityBoxes ? `${ut.capacityBoxes} boxes` : '48 boxes',
        category: 'Studio (Vừa)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      }
    }
    if (area <= 7.0) {
      return {
        volume: ut.volumeM3 ? `${ut.volumeM3} m³` : '16 m³',
        areaLabel: ut.areaSqm ? `${ut.areaSqm} m²` : '6.0 m²',
        boxes: ut.capacityBoxes ? `${ut.capacityBoxes} boxes` : '100 boxes (Căn hộ 3PN)',
        category: 'Tiêu chuẩn 3PN',
        badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      }
    }
    return {
      volume: ut.volumeM3 ? `${ut.volumeM3} m³` : '24 m³',
      areaLabel: ut.areaSqm ? `${ut.areaSqm} m²` : '12.0 m²',
      boxes: ut.capacityBoxes ? `${ut.capacityBoxes} boxes` : '160 boxes (Kho logistics lớn)',
      category: 'Logistics / Thương mại lớn',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-slide-up ${
            toastIsError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {toastIsError ? 'error' : 'check_circle'}
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-700">
              <span className="material-symbols-outlined text-[24px]">price_change</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('Cấu Hình Quy Tắc Kinh Doanh & Chính Sách Giá Động')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('Thiết lập đơn giá Tiêu Chuẩn & Máy Lạnh A/C cho các loại kho chuẩn và chính sách kinh doanh ')}
              </p>
            </div>
          </div>

          {/* Facility Selector: Task 5.5 explicitly removes "Toàn cơ sở" / "all" */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <select
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">{t('Tất cả cơ sở (Toàn hệ thống)')}</option>
              {facilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name}
                </option>
              ))}
            </select>
            {canManagePolicies && (
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    <span>{t('Đang lưu...')}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>{t('Lưu quy tắc kinh doanh')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 4 Feature Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Bảng giá niêm yết theo từng loại kho (Tiêu chuẩn & Máy lạnh A/C) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600 text-[20px]">sell</span>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{unitTypes.length}</h3>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded border border-cyan-200">
              3 Kỳ hạn
            </span>
          </div>

          {/* Card 2: Tiền cọc */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-cyan-600 text-[20px]">account_balance_wallet</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t('Quy định tiền cọc')}</h3>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="depositOption"
                  disabled={!canManagePolicies}
                  checked={depositOption === '1month'}
                  onChange={() => setDepositOption('1month')}
                  className="text-cyan-700"
                />
                <span>Cọc 01 tháng tiền thuê (100%)</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="depositOption"
                  disabled={!canManagePolicies}
                  checked={depositOption === '2months'}
                  onChange={() => setDepositOption('2months')}
                  className="text-cyan-700"
                />
                <span>Cọc 02 tháng tiền thuê (200%)</span>
              </label>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                * Tiền cọc được giữ an toàn trên tài khoản ký quỹ trung gian và hoàn trả theo quy định SLA.
              </p>
            </div>
          </div>

          {/* Card 3: Chiết khấu dài hạn */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-cyan-600 text-[20px]">percent</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t('Chiết khấu kỳ hạn')}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Thuê 3 tháng:</span>
                <input
                  type="text"
                  disabled={!canManagePolicies}
                  value={discount3M}
                  onChange={(e) => setDiscount3M(e.target.value)}
                  className="w-16 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono font-bold text-emerald-700 text-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Thuê 6 tháng:</span>
                <input
                  type="text"
                  disabled={!canManagePolicies}
                  value={discount6M}
                  onChange={(e) => setDiscount6M(e.target.value)}
                  className="w-16 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono font-bold text-emerald-700 text-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Thuê 12 tháng:</span>
                <input
                  type="text"
                  disabled={!canManagePolicies}
                  value={discount12M}
                  onChange={(e) => setDiscount12M(e.target.value)}
                  className="w-16 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono font-bold text-emerald-700 text-center"
                />
              </div>
            </div>
          </div>

            {/* 12 Months Discount Row */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-indigo-600 text-lg">verified</span>
                <div>
                  <div className="text-xs font-bold text-slate-800">{t('Thuê 12 tháng')}</div>
                  <div className="text-[10px] text-slate-400">Kỳ hạn dài hạn tiết kiệm tối đa</div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Phạt trễ hạn (VND/ngày):</label>
                <input
                  type="text"
                  disabled={!canManagePolicies}
                  value={lateFee}
                  onChange={(e) => setLateFee(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-rose-600"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Khóa SmartLock tự động:</label>
                <input
                  type="text"
                  disabled={!canManagePolicies}
                  value={lockoutDay}
                  onChange={(e) => setLockoutDay(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Task 3 & Task 5: Dynamic Catalog Table of Unit Types */}
        <div className="pt-2">
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600 text-[20px]">
                  view_in_ar
                </span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('Danh mục các loại kho chuẩn & giá niêm yết hiện hành (Tiêu chuẩn vs Máy lạnh A/C)')}
                </span>
              </div>
              {/* Task 3.1: Dynamic Count of Unit Types */}
              <span className="text-[11px] font-mono font-bold text-cyan-800 bg-cyan-100 px-2.5 py-0.5 rounded-full border border-cyan-200">
                {unitTypes.length} {t('Loại kho')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-white text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-3.5">{t('Quy mô / Thể tích')}</th>
                    <th className="py-3 px-3.5">{t('Tên loại kho')}</th>
                    <th className="py-3 px-3.5">{t('Kích thước quy chuẩn')}</th>
                    <th className="py-3 px-3.5">{t('Diện tích / Sức chứa')}</th>
                    <th className="py-3 px-3.5 min-w-[130px]">{t('Giá Tiêu chuẩn / tháng')}</th>
                    <th className="py-3 px-3.5 min-w-[140px]">{t('Giá Máy lạnh A/C / tháng')}</th>
                    <th className="py-3 px-3.5 text-center">{t('Trạng thái')}</th>
                    <th className="py-3 px-3.5 text-right">{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {unitTypes.map((ut) => {
                    const dbBase = Number(ut.basePricePerMonth || 0)
                    const dbAc = Number(
                      ut.acPricePerMonth != null
                        ? ut.acPricePerMonth
                        : Math.round(dbBase * 1.2)
                    )
                    const spec = getUnitTypeSpec(ut)
                    const isActive = ut.isActive ?? true

                    return (
                      <tr
                        key={ut.id}
                        className={`hover:bg-slate-50/60 transition ${
                          !isActive ? 'opacity-65 bg-slate-50/40' : ''
                        }`}
                      >
                        {/* 1. Quy mô / Thể tích */}
                        <td className="py-3 px-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${spec.badgeClass}`}
                          >
                            {spec.volume}
                          </span>
                        </td>

                        {/* 2. Tên loại kho */}
                        <td className="py-3 px-3.5 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{ut.typeName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {spec.category}
                          </div>
                        </td>

                        {/* 3. Kích thước */}
                        <td className="py-3 px-3.5 font-mono text-slate-600">
                          {ut.dimensions ||
                            (ut.lengthM && ut.widthM && ut.heightM
                              ? `${ut.lengthM}m x ${ut.widthM}m x ${ut.heightM}m`
                              : '—')}
                        </td>

                        {/* 4. Diện tích & Sức chứa */}
                        <td className="py-3 px-3.5 font-mono text-slate-600">
                          <div>{spec.areaLabel}</div>
                          <div className="text-[10px] text-slate-400">{spec.boxes}</div>
                        </td>

                        {/* 5. Giá Tiêu chuẩn */}
                        <td className="py-2.5 px-3">
                          <div className="relative max-w-[140px]">
                            <input
                              type="text"
                              disabled={!canManagePolicies}
                              value={currentVal}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '')
                                const formatted = raw ? Number(raw).toLocaleString('vi-VN') : ''
                                setUnitTypePrices((prev) => ({ ...prev, [ut.id]: formatted }))
                              }}
                              className={`w-full bg-white border rounded-lg px-2 py-1 text-xs font-mono font-bold pr-5 ${
                                isStdModified ? 'border-amber-400 bg-amber-50/30 text-amber-700' : 'border-slate-200 text-slate-800'
                              }`}
                            />
                            <span className="absolute right-1.5 top-1 text-[10px] text-slate-400 font-mono">đ</span>
                          </div>
                          {isStdModified && (
                            <div className="text-[9px] text-slate-400 mt-0.5">Gốc: {dbBase.toLocaleString('vi-VN')} đ</div>
                          )}
                        </td>

                        {/* 6. Giá Máy lạnh A/C */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 max-w-[160px]">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                disabled={!canManagePolicies}
                                value={currentAcVal}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, '')
                                  const formatted = raw ? Number(raw).toLocaleString('vi-VN') : ''
                                  setUnitTypeAcPrices((prev) => ({ ...prev, [ut.id]: formatted }))
                                }}
                                className={`w-full bg-blue-50/20 border rounded-lg px-2 py-1 text-xs font-mono font-bold pr-5 ${
                                  isAcModified ? 'border-amber-400 bg-amber-50/30 text-amber-700' : 'border-blue-200 text-blue-900'
                                }`}
                              />
                              <span className="absolute right-1.5 top-1 text-[10px] text-blue-400 font-mono">đ</span>
                            </div>
                            {canManagePolicies && (
                              <button
                                type="button"
                                onClick={() => handleAutoCalcAc(ut.id)}
                                title={t('Tự động tính +20% từ giá tiêu chuẩn')}
                                className="px-1.5 py-1 text-[10px] rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-mono font-semibold cursor-pointer shrink-0"
                              >
                                +20%
                              </button>
                            )}
                          </div>
                          {isAcModified && (
                            <div className="text-[9px] text-slate-400 mt-0.5">Gốc: {dbAc.toLocaleString('vi-VN')} đ</div>
                          )}
                        </td>

                        {/* 7. Thao tác */}
                        <td className="py-2.5 px-3 text-right">
                          {canManagePolicies && (
                            <button
                              type="button"
                              disabled={!isModified || isBusy || isSaving}
                              onClick={() => handleQuickUpdateSingleUnitType(ut)}
                              className="px-2.5 py-1 rounded-md bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold text-[11px] transition border border-cyan-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                              title={t('Cập nhật cả giá Tiêu chuẩn và Máy lạnh A/C cho loại kho này (BR-RULE-011)')}
                            >
                              {isBusy ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
                              ) : (
                                <span className="material-symbols-outlined text-[14px]">price_change</span>
                              )}
                              <span>{t('Lưu giá')}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Unit Type Modal (Task 3.3 & Task 5.1-5.4) */}
      {isEditModalOpen && selectedUnitTypeToEdit && (
        <EditUnitTypeModal
          unitType={selectedUnitTypeToEdit}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedUnitTypeToEdit(null)
          }}
          onSuccess={() => {
            showToast('Đã lưu thông tin loại kho thành công!')
            void loadUnitTypes()
          }}
        />
      )}

      {/* Confirmation Dialog: Delete Discount (Task 4.2) */}
      {deleteConfirmTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 max-w-sm w-full space-y-3 animate-scale-in">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
              <h4 className="text-sm font-bold text-slate-900">
                {t('Xóa mức chiết khấu')} {deleteConfirmTerm} {t('tháng')}
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t(
                `Bạn có chắc chắn muốn xóa mức chiết khấu kỳ hạn ${deleteConfirmTerm} tháng? Sau khi xóa, mức chiết khấu sẽ về 0% và không ảnh hưởng đến các hợp đồng cũ đã ký.`
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTerm(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t('Hủy bỏ')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDiscount}
                disabled={isSavingDiscounts}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                {t('Xác nhận xóa')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Toggle Unit Type Status (Task 5.3) */}
      {statusConfirmUnitType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 max-w-sm w-full space-y-3 animate-scale-in">
            <div className="flex items-center gap-2.5 text-amber-600">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h4 className="text-sm font-bold text-slate-900">
                {statusConfirmUnitType.isActive
                  ? t('Tạm ngưng loại kho')
                  : t('Kích hoạt loại kho')}
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {statusConfirmUnitType.isActive
                ? t(
                    `Bạn có chắc muốn tạm ngưng loại kho "${statusConfirmUnitType.typeName}"? Khách hàng sẽ bị chặn không thể đặt chỗ mới với loại kho này (các hợp đồng cũ vẫn duy trì bình thường).`
                  )
                : t(
                    `Bạn có chắc muốn kích hoạt lại loại kho "${statusConfirmUnitType.typeName}"? Khách hàng sẽ có thể đặt chỗ loại kho này ngay lập tức.`
                  )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusConfirmUnitType(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t('Hủy bỏ')}
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs ${
                  statusConfirmUnitType.isActive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {t('Xác nhận')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
