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
                {t('3. Quy Tắc Kinh Doanh & Giá Động (Pricing Matrix)')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t(
                  'Quản lý chiết khấu kỳ hạn và danh mục loại kho chuẩn theo quy chuẩn vận hành Boxora.'
                )}
              </p>
            </div>
          </div>

          {/* Facility Selector: Task 5.5 explicitly removes "Toàn cơ sở" / "all" */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
              <span className="material-symbols-outlined text-slate-500 text-sm">store</span>
              <span className="text-xs font-semibold text-slate-600">{t('Cơ sở:')}</span>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Task 4: ONLY CARD 3 (Chiết khấu kỳ hạn) is kept. Cards 1, 2, 4 are removed. */}
        <div className="max-w-2xl bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600 text-[22px]">percent</span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t('Chiết khấu kỳ hạn')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('Tự động áp dụng chiết khấu khi khách hàng thanh toán trước theo kỳ hạn.')}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded border border-cyan-200">
              3 Kỳ hạn
            </span>
          </div>

          <div className="space-y-3">
            {/* 3 Months Discount Row */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-600 text-lg">calendar_today</span>
                <div>
                  <div className="text-xs font-bold text-slate-800">{t('Thuê 3 tháng')}</div>
                  <div className="text-[10px] text-slate-400">Kỳ hạn ngắn tiêu chuẩn</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {editingDiscountTerm === 3 ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={tempDiscountVal}
                      onChange={(e) => setTempDiscountVal(e.target.value)}
                      className="w-16 px-2 py-1 text-xs font-mono font-bold rounded border border-cyan-400 outline-none text-center"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                    <button
                      type="button"
                      onClick={handleSaveEditDiscount}
                      disabled={isSavingDiscounts}
                      className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      title="Lưu"
                    >
                      <span className="material-symbols-outlined text-sm">done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDiscountTerm(null)}
                      className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                      title="Hủy"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        discount3M > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {discount3M > 0 ? `-${discount3M}%` : '0%'}
                    </span>
                    {canManagePolicies && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditDiscount(3)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 transition"
                          title="Chỉnh sửa mức chiết khấu"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        {discount3M > 0 && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTerm(3)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa mức chiết khấu (áp dụng 0%)"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 6 Months Discount Row */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-teal-600 text-lg">event_repeat</span>
                <div>
                  <div className="text-xs font-bold text-slate-800">{t('Thuê 6 tháng')}</div>
                  <div className="text-[10px] text-slate-400">Kỳ hạn trung bình ưu đãi</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {editingDiscountTerm === 6 ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={tempDiscountVal}
                      onChange={(e) => setTempDiscountVal(e.target.value)}
                      className="w-16 px-2 py-1 text-xs font-mono font-bold rounded border border-cyan-400 outline-none text-center"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                    <button
                      type="button"
                      onClick={handleSaveEditDiscount}
                      disabled={isSavingDiscounts}
                      className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      title="Lưu"
                    >
                      <span className="material-symbols-outlined text-sm">done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDiscountTerm(null)}
                      className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                      title="Hủy"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        discount6M > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {discount6M > 0 ? `-${discount6M}%` : '0%'}
                    </span>
                    {canManagePolicies && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditDiscount(6)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 transition"
                          title="Chỉnh sửa mức chiết khấu"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        {discount6M > 0 && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTerm(6)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa mức chiết khấu (áp dụng 0%)"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
              <div className="flex items-center gap-3">
                {editingDiscountTerm === 12 ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={tempDiscountVal}
                      onChange={(e) => setTempDiscountVal(e.target.value)}
                      className="w-16 px-2 py-1 text-xs font-mono font-bold rounded border border-cyan-400 outline-none text-center"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                    <button
                      type="button"
                      onClick={handleSaveEditDiscount}
                      disabled={isSavingDiscounts}
                      className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      title="Lưu"
                    >
                      <span className="material-symbols-outlined text-sm">done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDiscountTerm(null)}
                      className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                      title="Hủy"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        discount12M > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {discount12M > 0 ? `-${discount12M}%` : '0%'}
                    </span>
                    {canManagePolicies && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditDiscount(12)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 transition"
                          title="Chỉnh sửa mức chiết khấu"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        {discount12M > 0 && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTerm(12)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa mức chiết khấu (áp dụng 0%)"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                  {t('Danh mục các loại kho chuẩn & giá niêm yết hiện hành')}
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

                        {/* 5. Giá Tiêu chuẩn (Task 5.4: synchronized directly) */}
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-800">
                          {dbBase.toLocaleString('vi-VN')} đ
                        </td>

                        {/* 6. Giá Máy lạnh A/C (Task 5.4: no double +20%) */}
                        <td className="py-3 px-3.5 font-mono font-bold text-teal-700">
                          {dbAc.toLocaleString('vi-VN')} đ
                        </td>

                        {/* 7. Trạng thái (Task 5.3) */}
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {isActive ? t('Hoạt động') : t('Tạm ngưng')}
                          </span>
                        </td>

                        {/* 8. Thao tác: Task 5.1 "Lưu giá" -> "Edit" */}
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canManagePolicies && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUnitTypeToEdit(ut)
                                    setIsEditModalOpen(true)
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold text-xs transition border border-cyan-200 flex items-center gap-1 cursor-pointer"
                                  title={t('Chỉnh sửa thông tin loại kho')}
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  <span>{t('Chỉnh sửa')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatusConfirmUnitType(ut)}
                                  className={`p-1 rounded-lg transition border cursor-pointer ${
                                    isActive
                                      ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200'
                                      : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                                  }`}
                                  title={
                                    isActive
                                      ? t('Tạm ngưng loại kho này')
                                      : t('Kích hoạt lại loại kho này')
                                  }
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {isActive ? 'pause_circle' : 'play_circle'}
                                  </span>
                                </button>
                              </>
                            )}
                          </div>
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
