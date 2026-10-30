import React, { useState, useEffect } from 'react'
import { Facility, FacilityPolicy, FacilityPolicyCreateRequest, FacilityPolicyUpdateRequest, FacilityPolicyPrice, UnitType } from '../../types'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { storageUnitService } from '../../services/storageUnitService'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

interface DynamicPricingMatrixPanelProps {
  facilities: Facility[]
}

export const DynamicPricingMatrixPanel: React.FC<DynamicPricingMatrixPanelProps> = ({ facilities }) => {
  const { role, hasPermission } = useAuth()
  const { t } = useLanguage()
  const canManagePolicies = role === 'BUSINESS_MANAGER' || role === 'ADMIN' || hasPermission('POLICY_UPDATE') || hasPermission('UNIT_TYPE_UPDATE')

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all')
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [currentPolicy, setCurrentPolicy] = useState<FacilityPolicy | null>(null)

  // Pricing state: map of unitTypeId -> formatted price string (VND)
  const [unitTypePrices, setUnitTypePrices] = useState<Record<string, string>>({})

  // Rule states
  const [depositOption, setDepositOption] = useState<'1month' | '2months'>('1month')
  const [discount3M, setDiscount3M] = useState('-5')
  const [discount6M, setDiscount6M] = useState('-10')
  const [discount12M, setDiscount12M] = useState('-15')
  const [graceDays, setGraceDays] = useState('03 Ngày')
  const [lateFee, setLateFee] = useState('50.000')
  const [lockoutDay, setLockoutDay] = useState('Ngày thứ 05')

  const [isSaving, setIsSaving] = useState(false)
  const [isAdjustingId, setIsAdjustingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const parseCurrencyInput = (val: string) => {
    const cleaned = String(val).replace(/\D/g, '')
    return Number(cleaned) || 0
  }

  // Helper matching the 5 canonical customer-facing size tiers
  const getUnitTypeSpec = (ut: UnitType) => {
    const area = ut.areaSqm || 0
    const name = (ut.typeName || '').toLowerCase()
    if (name.includes('cold') || name.includes('mát') || (area >= 4.5 && area <= 5.5)) {
      return {
        volume: '14 m³',
        areaLabel: '5.0 m²',
        boxes: '85 boxes',
        category: 'Kho Mát A/C (18-22°C)',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      }
    }
    if (area <= 1.5) {
      return {
        volume: '1 m³',
        areaLabel: '1.0 m²',
        boxes: '6 boxes',
        category: 'Tủ cá nhân (Mini)',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
      }
    }
    if (area <= 3.5) {
      return {
        volume: '8 m³',
        areaLabel: '3.0 m²',
        boxes: '48 boxes',
        category: 'Studio (Vừa)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      }
    }
    if (area <= 7.0) {
      return {
        volume: '16 m³',
        areaLabel: '6.0 m²',
        boxes: '100 boxes',
        category: 'Căn hộ 3PN (Tiêu chuẩn)',
        badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      }
    }
    return {
      volume: '24 m³',
      areaLabel: '12.0 m²',
      boxes: '160 boxes',
      category: 'Logistics / Thương mại lớn',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    }
  }

  // Load Unit Types
  const loadUnitTypes = async () => {
    try {
      const uts = await storageUnitService.getUnitTypes()
      if (uts && Array.isArray(uts)) {
        // Sort ascending by area
        uts.sort((a, b) => (a.areaSqm || 0) - (b.areaSqm || 0))
        setUnitTypes(uts)
        setUnitTypePrices((prev) => {
          const newMap = { ...prev }
          uts.forEach((ut) => {
            if (!newMap[ut.id]) {
              newMap[ut.id] = Number(ut.basePricePerMonth || 0).toLocaleString('vi-VN')
            }
          })
          return newMap
        })
      }
    } catch (err) {
      console.warn('Failed to load unit types:', err)
    }
  }

  // Load current policy when facility changes
  const loadFacilityPolicy = async (facId: string) => {
    if (facId === 'all') {
      setCurrentPolicy(null)
      // Reset prices to system base prices from unitTypes
      const baseMap: Record<string, string> = {}
      unitTypes.forEach((ut) => {
        baseMap[ut.id] = Number(ut.basePricePerMonth || 0).toLocaleString('vi-VN')
      })
      setUnitTypePrices(baseMap)
      return
    }
    try {
      const pol = await facilityPolicyService.getByFacilityId(facId)
      if (pol) {
        setCurrentPolicy(pol)
        if (pol.dailyLateFee != null || pol.lateFeePerDay != null) {
          setLateFee(Number(pol.dailyLateFee ?? pol.lateFeePerDay).toLocaleString('vi-VN'))
        }
        if (pol.overdueGraceDays != null) {
          setGraceDays(`0${pol.overdueGraceDays} Ngày`.slice(-7))
        }
        if (pol.overdueAccessDisableDays != null) {
          setLockoutDay(`Ngày thứ 0${pol.overdueAccessDisableDays}`.slice(-11))
        }
        if (pol.depositPercentage != null) {
          setDepositOption(pol.depositPercentage >= 200 ? '2months' : '1month')
        }

        // Load facility specific prices if available
        const priceMap: Record<string, string> = {}
        unitTypes.forEach((ut) => {
          const matchPrice = pol.prices?.find((p) => p.unitTypeId === ut.id)
          if (matchPrice?.monthlyPrice != null) {
            priceMap[ut.id] = Number(matchPrice.monthlyPrice).toLocaleString('vi-VN')
          } else {
            priceMap[ut.id] = Number(ut.basePricePerMonth || 0).toLocaleString('vi-VN')
          }
        })
        setUnitTypePrices(priceMap)
      } else {
        setCurrentPolicy(null)
      }
    } catch {
      setCurrentPolicy(null)
    }
  }

  useEffect(() => {
    void loadUnitTypes()
  }, [])

  useEffect(() => {
    if (unitTypes.length > 0) {
      void loadFacilityPolicy(selectedFacilityId)
    }
  }, [selectedFacilityId, unitTypes.length])

  // Save single unit type price directly
  const handleQuickUpdateSingleUnitType = async (ut: UnitType) => {
    if (!canManagePolicies) return
    const newPrice = parseCurrencyInput(unitTypePrices[ut.id] || '0')
    if (!newPrice || newPrice <= 0) {
      showToast('Giá nhập vào không hợp lệ', true)
      return
    }
    setIsAdjustingId(ut.id)
    try {
      await storageUnitService.adjustUnitTypePrice(ut.id, {
        newPrice,
        reason: `Điều chỉnh đơn giá loại kho ${ut.typeName} theo quy chuẩn BR-RULE-011`,
        cascadeToAvailableUnits: true,
      })
      showToast(`Đã cập nhật giá mới cho loại kho "${ut.typeName}": ${newPrice.toLocaleString('vi-VN')} đ/tháng`)
      await loadUnitTypes()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể cập nhật giá loại kho.', true)
    } finally {
      setIsAdjustingId(null)
    }
  }

  // Save all policies & unit type prices
  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManagePolicies) return
    setIsSaving(true)
    try {
      const priceUpdates: string[] = []

      // 1. If 'all' facilities selected: update UnitType base prices in DB under BR-RULE-011
      if (selectedFacilityId === 'all') {
        for (const ut of unitTypes) {
          const currentVal = parseCurrencyInput(unitTypePrices[ut.id] || '0')
          const dbBase = Number(ut.basePricePerMonth || 0)
          if (currentVal > 0 && currentVal !== dbBase) {
            await storageUnitService.adjustUnitTypePrice(ut.id, {
              newPrice: currentVal,
              reason: `Điều chỉnh ma trận giá loại kho ${ut.typeName} từ Cấu hình chi nhánh theo BR-RULE-011`,
              cascadeToAvailableUnits: true,
            })
            priceUpdates.push(`${ut.typeName}: ${currentVal.toLocaleString('vi-VN')} đ`)
          }
        }
      }

      // 2. Save FacilityPolicy if a specific facility is selected
      let policySaved = false
      if (selectedFacilityId !== 'all') {
        const lateFeeNumber = parseCurrencyInput(lateFee) || 50000
        const graceDaysNumber = Number.parseInt(graceDays.replace(/\D/g, ''), 10) || 3
        const lockoutDayNumber = Number.parseInt(lockoutDay.replace(/\D/g, ''), 10) || 5

        // Prepare prices array for this facility's policy
        const policyPrices: FacilityPolicyPrice[] = unitTypes.map((ut) => {
          const p = parseCurrencyInput(unitTypePrices[ut.id] || '0') || Number(ut.basePricePerMonth)
          return {
            unitTypeId: ut.id,
            monthlyPrice: p,
            discount3MonthPercent: Math.abs(Number(discount3M)) || 0,
            discount6MonthPercent: Math.abs(Number(discount6M)) || 0,
            discount12MonthPercent: Math.abs(Number(discount12M)) || 0,
          }
        })

        if (currentPolicy?.id) {
          const updatePayload: FacilityPolicyUpdateRequest = {
            depositPercentage: depositOption === '2months' ? 200 : 100,
            dailyLateFee: lateFeeNumber,
            overdueGraceDays: graceDaysNumber,
            overdueAccessDisableDays: lockoutDayNumber,
            overdueSealingDays: Math.max(lockoutDayNumber + 2, 7),
            minimumRentalMonths: currentPolicy.minimumRentalMonths ?? 1,
            renewalWindowDays: currentPolicy.renewalWindowDays ?? 7,
            cancellationFullRefundHours: currentPolicy.cancellationFullRefundHours ?? 24,
            cancellationPartialRefundHours: currentPolicy.cancellationPartialRefundHours ?? 48,
            cancellationPartialRefundPercent: currentPolicy.cancellationPartialRefundPercent ?? 70,
            returnNoticeDays: currentPolicy.returnNoticeDays ?? 3,
            depositRefundSlaDays: currentPolicy.depositRefundSlaDays ?? 3,
            prices: policyPrices,
          }
          const saved = await facilityPolicyService.update(currentPolicy.id, updatePayload)
          setCurrentPolicy(saved)
          policySaved = true
        } else {
          const createPayload: FacilityPolicyCreateRequest = {
            facilityId: selectedFacilityId,
            depositPercentage: depositOption === '2months' ? 200 : 100,
            dailyLateFee: lateFeeNumber,
            overdueGraceDays: graceDaysNumber,
            overdueAccessDisableDays: lockoutDayNumber,
            overdueSealingDays: Math.max(lockoutDayNumber + 2, 7),
            minimumRentalMonths: 1,
            renewalWindowDays: 7,
            cancellationFullRefundHours: 24,
            cancellationPartialRefundHours: 48,
            cancellationPartialRefundPercent: 70,
            returnNoticeDays: 3,
            depositRefundSlaDays: 3,
            prices: policyPrices,
          }
          const saved = await facilityPolicyService.create(createPayload)
          setCurrentPolicy(saved)
          policySaved = true
        }
      }

      // 3. Re-fetch updated unit types
      await loadUnitTypes()
      if (selectedFacilityId !== 'all') {
        await loadFacilityPolicy(selectedFacilityId)
      }

      if (priceUpdates.length > 0 && policySaved) {
        showToast(`Đã lưu bảng giá (${priceUpdates.join(', ')}) và chính sách cơ sở thành công!`)
      } else if (priceUpdates.length > 0) {
        showToast(`Đã cập nhật bảng giá (${priceUpdates.join(', ')}) vào CSDL và StorageUnitPriceHistory (BR-RULE-011)!`)
      } else if (policySaved) {
        showToast(`Đã lưu bảng giá theo từng loại kho và chính sách cho ${facilities.find((f) => f.id === selectedFacilityId)?.name || 'cơ sở đã chọn'}.`)
      } else {
        showToast('Thông số chính sách và bảng giá hiện tại đã khớp CSDL.')
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Không lưu được chính sách hoặc bảng giá. Vui lòng thử lại.'
      showToast(errMsg, true)
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefaults = () => {
    const baseMap: Record<string, string> = {}
    unitTypes.forEach((ut) => {
      baseMap[ut.id] = Number(ut.basePricePerMonth || 0).toLocaleString('vi-VN')
    })
    setUnitTypePrices(baseMap)
    setDepositOption('1month')
    setDiscount3M('-5')
    setDiscount6M('-10')
    setDiscount12M('-15')
    setGraceDays('03 Ngày')
    setLateFee('50.000')
    setLockoutDay('Ngày thứ 05')
    showToast('Đã khôi phục thông số chính sách và bảng giá loại kho theo CSDL')
  }

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className={`material-symbols-outlined text-[20px] ${toastIsError ? 'text-rose-400' : 'text-emerald-400'}`}>
            {toastIsError ? 'error' : 'check_circle'}
          </span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Pricing Matrix Form */}
      <form onSubmit={handleSavePolicies} className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100 shrink-0">
              <span className="material-symbols-outlined text-[24px]">tune</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('Cấu Hình Quy Tắc Kinh Doanh & Chính Sách Giá Động (Pricing Matrix)')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('Thiết lập đơn giá cho 5 loại kho chuẩn và chính sách kinh doanh (áp dụng theo quy chuẩn BR-RULE-011).')}
              </p>
            </div>
          </div>
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
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              {t('Khôi phục mặc định')}
            </button>
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
          {/* Card 1: Bảng giá niêm yết theo từng loại kho */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600 text-[20px]">sell</span>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t('5 Loại Kho Chuẩn (BR-RULE-011)')}</h3>
                </div>
                <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded font-mono">
                  {unitTypes.length}/5 {t('loại kho')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 mb-2.5">
                {selectedFacilityId === 'all'
                  ? t('Đơn giá niêm yết theo từng cỡ kho (VND/tháng):')
                  : t('Giá áp dụng riêng tại cơ sở đã chọn:')}
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {unitTypes.map((ut) => {
                  const currentVal = unitTypePrices[ut.id] ?? ''
                  const dbBase = Number(ut.basePricePerMonth || 0)
                  const currentNum = parseCurrencyInput(currentVal)
                  const isModified = currentNum > 0 && currentNum !== dbBase
                  const spec = getUnitTypeSpec(ut)

                  return (
                    <div key={ut.id} className="p-2 bg-white rounded-lg border border-slate-200/80 hover:border-slate-300 transition">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded border shrink-0 ${spec.badgeClass}`}>
                            {spec.volume}
                          </span>
                          <label className="text-[11px] font-bold text-slate-800 truncate" title={ut.typeName}>
                            {ut.typeName}
                          </label>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                          {spec.areaLabel}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          disabled={!canManagePolicies}
                          value={currentVal}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '')
                            const formatted = raw ? Number(raw).toLocaleString('vi-VN') : ''
                            setUnitTypePrices((prev) => ({ ...prev, [ut.id]: formatted }))
                          }}
                          placeholder="0"
                          className={`w-full bg-slate-50/50 border rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 pr-8 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 transition ${
                            isModified ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1 text-[11px] text-slate-400 font-mono">đ</span>
                      </div>
                      {isModified && (
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-slate-400">Gốc: {dbBase.toLocaleString('vi-VN')} đ</span>
                          <span className="text-amber-600 font-medium">Chưa lưu</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
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

          {/* Card 4: Xử lý quá hạn */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-cyan-600 text-[20px]">lock_clock</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t('Xử lý quá hạn & Phạt')}</h3>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Thời gian ân hạn cước:</label>
                <input
                  type="text"
                  disabled={!canManagePolicies}
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800"
                />
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

        {/* Reference & Inline Unit Types Table */}
        <div className="pt-2">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600 text-[18px]">table_chart</span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('Danh mục 5 loại kho chuẩn & giá niêm yết hiện hành (CSDL)')}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {unitTypes.length} {t('loại kho đã chuẩn hóa')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-white text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-4">{t('Quy mô / Thể tích')}</th>
                    <th className="py-2.5 px-4">{t('Tên loại kho')}</th>
                    <th className="py-2.5 px-4">{t('Kích thước quy chuẩn')}</th>
                    <th className="py-2.5 px-4">{t('Diện tích / Sức chứa')}</th>
                    <th className="py-2.5 px-4">{t('Giá CSDL gốc')}</th>
                    <th className="py-2.5 px-4">{t('Giá điều chỉnh / tháng')}</th>
                    <th className="py-2.5 px-4 text-right">{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {unitTypes.map((ut) => {
                    const currentVal = unitTypePrices[ut.id] ?? ''
                    const dbBase = Number(ut.basePricePerMonth || 0)
                    const currentNum = parseCurrencyInput(currentVal)
                    const isModified = currentNum > 0 && currentNum !== dbBase
                    const isBusy = isAdjustingId === ut.id
                    const spec = getUnitTypeSpec(ut)

                    return (
                      <tr key={ut.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${spec.badgeClass}`}>
                            {spec.volume}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          <div>{ut.typeName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{spec.category}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {ut.dimensions || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          <div>{spec.areaLabel}</div>
                          <div className="text-[10px] text-slate-400">{spec.boxes}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">
                          {dbBase.toLocaleString('vi-VN')} đ/tháng
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative max-w-[150px]">
                            <input
                              type="text"
                              disabled={!canManagePolicies}
                              value={currentVal}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '')
                                const formatted = raw ? Number(raw).toLocaleString('vi-VN') : ''
                                setUnitTypePrices((prev) => ({ ...prev, [ut.id]: formatted }))
                              }}
                              className={`w-full bg-white border rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 pr-6 ${
                                isModified ? 'border-amber-400 bg-amber-50/30 text-amber-700' : 'border-slate-200 text-cyan-800'
                              }`}
                            />
                            <span className="absolute right-2 top-1 text-[10px] text-slate-400 font-mono">đ</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {canManagePolicies && (
                            <button
                              type="button"
                              disabled={!isModified || isBusy || isSaving}
                              onClick={() => handleQuickUpdateSingleUnitType(ut)}
                              className="px-2.5 py-1 rounded-md bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold text-[11px] transition border border-cyan-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                              title={t('Cập nhật giá riêng cho loại kho này (BR-RULE-011)')}
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
      </form>
    </div>
  )
}
