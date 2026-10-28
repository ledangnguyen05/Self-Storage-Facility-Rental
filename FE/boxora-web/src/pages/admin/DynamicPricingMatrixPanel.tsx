import React, { useState, useEffect } from 'react'
import { Facility, FacilityPolicy, FacilityPolicyCreateRequest, FacilityPolicyUpdateRequest, UnitType } from '../../types'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { storageUnitService } from '../../services/storageUnitService'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

interface DynamicPricingMatrixPanelProps {
  facilities: Facility[]
}

export const DynamicPricingMatrixPanel: React.FC<DynamicPricingMatrixPanelProps> = ({ facilities }) => {
  const { role } = useAuth()
  const { t } = useLanguage()
  const canManagePolicies = role === 'BUSINESS_MANAGER'

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all')
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [currentPolicy, setCurrentPolicy] = useState<FacilityPolicy | null>(null)

  // Pricing & Rule states
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

  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Load Unit Types
  const loadUnitTypes = async () => {
    try {
      const uts = await storageUnitService.getUnitTypes()
      if (uts && Array.isArray(uts)) {
        setUnitTypes(uts)
        const mini = uts.find((ut) => ut.typeName.toLowerCase().includes('mini'))
        const standard = uts.find((ut) => ut.typeName.toLowerCase().includes('standard') || ut.typeName.toLowerCase().includes('tiêu chuẩn'))
        const climate = uts.find((ut) => ut.typeName.toLowerCase().includes('cold') || ut.typeName.toLowerCase().includes('climate') || ut.typeName.toLowerCase().includes('mát'))
        if (mini?.basePricePerMonth != null) setMiniPrice(Number(mini.basePricePerMonth).toLocaleString('vi-VN'))
        if (standard?.basePricePerMonth != null) setStandardPrice(Number(standard.basePricePerMonth).toLocaleString('vi-VN'))
        if (climate?.basePricePerMonth != null) setClimatePrice(Number(climate.basePricePerMonth).toLocaleString('vi-VN'))
      }
    } catch (err) {
      console.warn('Failed to load unit types:', err)
    }
  }

  // Load current policy when facility changes
  const loadFacilityPolicy = async (facId: string) => {
    if (facId === 'all') {
      setCurrentPolicy(null)
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
    void loadFacilityPolicy(selectedFacilityId)
  }, [selectedFacilityId])

  const parseCurrencyInput = (val: string) => {
    const cleaned = String(val).replace(/\D/g, '')
    return Number(cleaned) || 0
  }

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManagePolicies) return
    setIsSaving(true)
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
          reason: 'Điều chỉnh ma trận giá loại kho Mini từ Cấu hình chi nhánh theo BR-RULE-011',
          cascadeToAvailableUnits: true,
        })
        priceUpdates.push(`Mini: ${miniVal.toLocaleString('vi-VN')} đ`)
      }

      if (standardUt && standardVal > 0 && standardVal !== Number(standardUt.basePricePerMonth)) {
        await storageUnitService.adjustUnitTypePrice(standardUt.id, {
          newPrice: standardVal,
          reason: 'Điều chỉnh ma trận giá loại kho Tiêu Chuẩn từ Cấu hình chi nhánh theo BR-RULE-011',
          cascadeToAvailableUnits: true,
        })
        priceUpdates.push(`Tiêu chuẩn: ${standardVal.toLocaleString('vi-VN')} đ`)
      }

      if (climateUt && climateVal > 0 && climateVal !== Number(climateUt.basePricePerMonth)) {
        await storageUnitService.adjustUnitTypePrice(climateUt.id, {
          newPrice: climateVal,
          reason: 'Điều chỉnh ma trận giá loại kho Mát từ Cấu hình chi nhánh theo BR-RULE-011',
          cascadeToAvailableUnits: true,
        })
        priceUpdates.push(`Kho Mát: ${climateVal.toLocaleString('vi-VN')} đ`)
      }

      // 2. Save FacilityPolicy if a specific facility is selected
      let policySaved = false
      if (selectedFacilityId !== 'all') {
        const lateFeeNumber = parseCurrencyInput(lateFee) || 50000
        const graceDaysNumber = Number.parseInt(graceDays.replace(/\D/g, ''), 10) || 3
        const lockoutDayNumber = Number.parseInt(lockoutDay.replace(/\D/g, ''), 10) || 5

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
          }
          const saved = await facilityPolicyService.create(createPayload)
          setCurrentPolicy(saved)
          policySaved = true
        }
      }

      // 3. Re-fetch updated unit types
      await loadUnitTypes()

      if (priceUpdates.length > 0 && policySaved) {
        showToast(`Đã lưu bảng giá (${priceUpdates.join(', ')}) và chính sách cơ sở thành công!`)
      } else if (priceUpdates.length > 0) {
        showToast(`Đã cập nhật bảng giá (${priceUpdates.join(', ')}) vào CSDL và StorageUnitPriceHistory (BR-RULE-011)!`)
      } else if (policySaved) {
        showToast(`Đã lưu chính sách cơ sở cho ${facilities.find((f) => f.id === selectedFacilityId)?.name || 'cơ sở đã chọn'}.`)
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
    const mini = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('mini'))
    const standard = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('standard') || ut.typeName.toLowerCase().includes('tiêu chuẩn'))
    const climate = unitTypes.find((ut) => ut.typeName.toLowerCase().includes('cold') || ut.typeName.toLowerCase().includes('climate') || ut.typeName.toLowerCase().includes('mát'))
    setMiniPrice(mini?.basePricePerMonth ? Number(mini.basePricePerMonth).toLocaleString('vi-VN') : '450.000')
    setStandardPrice(standard?.basePricePerMonth ? Number(standard.basePricePerMonth).toLocaleString('vi-VN') : '1.250.000')
    setClimatePrice(climate?.basePricePerMonth ? Number(climate.basePricePerMonth).toLocaleString('vi-VN') : '2.400.000')
    setDepositOption('1month')
    setDiscount3M('-5')
    setDiscount6M('-10')
    setDiscount12M('-15')
    setGraceDays('03 Ngày')
    setLateFee('50.000')
    setLockoutDay('Ngày thứ 05')
    showToast('Đã khôi phục thông số chính sách và bảng giá loại kho')
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
                {t('Lưu các trường chính sách được API hỗ trợ cho cơ sở đang chọn. Bảng giá theo diện tích áp dụng quy chuẩn BR-RULE-011.')}
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
          {/* Card 1: Bảng giá niêm yết cơ sở */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-cyan-600 text-[20px]">sell</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t('Giá cơ bản / tháng (BR-RULE-011)')}</h3>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Kho Mini (0.5 - 2 m²):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!canManagePolicies}
                    value={miniPrice}
                    onChange={(e) => setMiniPrice(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 pr-8"
                  />
                  <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-mono">đ</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Kho Tiêu chuẩn (3 - 6 m²):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!canManagePolicies}
                    value={standardPrice}
                    onChange={(e) => setStandardPrice(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 pr-8"
                  />
                  <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-mono">đ</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Kho Mát / Cold-storage:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!canManagePolicies}
                    value={climatePrice}
                    onChange={(e) => setClimatePrice(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 pr-8"
                  />
                  <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-mono">đ</span>
                </div>
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

        {/* Reference Unit Types Table */}
        <div className="pt-2">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {t('Danh mục loại kho & giá niêm yết hiện hành (CSDL)')}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {unitTypes.length} {t('loại kho đã kích hoạt')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-white text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-4">{t('Mã / Tên loại kho')}</th>
                    <th className="py-2.5 px-4">{t('Kích thước quy chuẩn')}</th>
                    <th className="py-2.5 px-4">{t('Diện tích / Thể tích')}</th>
                    <th className="py-2.5 px-4">{t('Giá niêm yết hiện hành')}</th>
                    <th className="py-2.5 px-4">{t('Mô tả đặc điểm')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {unitTypes.map((ut) => (
                    <tr key={ut.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-bold text-slate-800">{ut.typeName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {ut.dimensions || '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {ut.areaSqm ? `${ut.areaSqm} m²` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-cyan-800">
                        {Number(ut.basePricePerMonth).toLocaleString('vi-VN')} đ/tháng
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">{ut.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

