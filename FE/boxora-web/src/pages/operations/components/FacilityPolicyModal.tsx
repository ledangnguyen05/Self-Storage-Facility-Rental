import React, { useState, useEffect } from 'react'
import { Facility, FacilityPolicy, FacilityPolicyCreateRequest, FacilityPolicyUpdateRequest } from '../../../types'
import { facilityPolicyService } from '../../../services/facilityPolicyService'

interface FacilityPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (policy: FacilityPolicy, isNew: boolean) => void
  facility: Facility | null
  existingPolicy: FacilityPolicy | null
  availableFacilities?: Facility[]
}

export const FacilityPolicyModal: React.FC<FacilityPolicyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  facility,
  existingPolicy,
  availableFacilities = [],
}) => {
  const isEdit = Boolean(existingPolicy?.id)

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [isActive, setIsActive] = useState<boolean>(true)
  const [depositPercentage, setDepositPercentage] = useState<number>(100)
  const [minimumRentalMonths, setMinimumRentalMonths] = useState<number>(1)
  const [renewalWindowDays, setRenewalWindowDays] = useState<number>(7)

  const [cancellationFullRefundHours, setCancellationFullRefundHours] = useState<number>(24)
  const [cancellationPartialRefundHours, setCancellationPartialRefundHours] = useState<number>(48)
  const [cancellationPartialRefundPercent, setCancellationPartialRefundPercent] = useState<number>(70)

  const [returnNoticeDays, setReturnNoticeDays] = useState<number>(3)
  const [depositRefundSlaDays, setDepositRefundSlaDays] = useState<number>(3)

  const [dailyLateFee, setDailyLateFee] = useState<number>(50000)
  const [overdueGraceDays, setOverdueGraceDays] = useState<number>(3)
  const [overdueAccessDisableDays, setOverdueAccessDisableDays] = useState<number>(5)
  const [overdueSealingDays, setOverdueSealingDays] = useState<number>(7)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (!isOpen) return

    setErrorMsg(null)
    if (existingPolicy) {
      setSelectedFacilityId(existingPolicy.facilityId || facility?.id || '')
      setIsActive(existingPolicy.isActive ?? true)
      setDepositPercentage(existingPolicy.depositPercentage ?? existingPolicy.depositPercent ?? 100)
      setMinimumRentalMonths(existingPolicy.minimumRentalMonths ?? 1)
      setRenewalWindowDays(existingPolicy.renewalWindowDays ?? 7)
      setCancellationFullRefundHours(existingPolicy.cancellationFullRefundHours ?? 24)
      setCancellationPartialRefundHours(existingPolicy.cancellationPartialRefundHours ?? 48)
      setCancellationPartialRefundPercent(existingPolicy.cancellationPartialRefundPercent ?? 70)
      setReturnNoticeDays(existingPolicy.returnNoticeDays ?? 3)
      setDepositRefundSlaDays(existingPolicy.depositRefundSlaDays ?? 3)
      setDailyLateFee(existingPolicy.dailyLateFee ?? existingPolicy.lateFeePerDay ?? 50000)
      setOverdueGraceDays(existingPolicy.overdueGraceDays ?? existingPolicy.gracePeriodDays ?? 3)
      setOverdueAccessDisableDays(existingPolicy.overdueAccessDisableDays ?? 5)
      setOverdueSealingDays(existingPolicy.overdueSealingDays ?? 7)
    } else {
      setSelectedFacilityId(facility?.id || (availableFacilities[0]?.id ?? ''))
      setIsActive(true)
      setDepositPercentage(100)
      setMinimumRentalMonths(1)
      setRenewalWindowDays(7)
      setCancellationFullRefundHours(24)
      setCancellationPartialRefundHours(48)
      setCancellationPartialRefundPercent(70)
      setReturnNoticeDays(3)
      setDepositRefundSlaDays(3)
      setDailyLateFee(50000)
      setOverdueGraceDays(3)
      setOverdueAccessDisableDays(5)
      setOverdueSealingDays(7)
    }
  }, [isOpen, existingPolicy, facility, availableFacilities])

  if (!isOpen) return null

  const targetFacilityName =
    facility?.name ||
    availableFacilities.find((f) => f.id === selectedFacilityId)?.name ||
    existingPolicy?.facilityName ||
    'Cơ sở'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!selectedFacilityId) {
      setErrorMsg('Vui lòng chọn cơ sở áp dụng chính sách.')
      return
    }

    if (cancellationFullRefundHours > cancellationPartialRefundHours) {
      setErrorMsg('Mốc thời gian hủy hoàn cọc 100% (giờ) phải nhỏ hơn hoặc bằng mốc hoàn cọc một phần.')
      return
    }

    if (depositPercentage < 0 || depositPercentage > 100) {
      setErrorMsg('Tỷ lệ tiền cọc phải nằm trong khoảng từ 0% đến 100%.')
      return
    }

    if (cancellationPartialRefundPercent < 0 || cancellationPartialRefundPercent > 100) {
      setErrorMsg('Tỷ lệ hoàn tiền một phần phải nằm trong khoảng từ 0% đến 100%.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit && existingPolicy?.id) {
        const updatePayload: FacilityPolicyUpdateRequest = {
          isActive,
          depositPercentage: Number(depositPercentage),
          renewalWindowDays: Number(renewalWindowDays),
          cancellationFullRefundHours: Number(cancellationFullRefundHours),
          cancellationPartialRefundHours: Number(cancellationPartialRefundHours),
          cancellationPartialRefundPercent: Number(cancellationPartialRefundPercent),
          returnNoticeDays: Number(returnNoticeDays),
          depositRefundSlaDays: Number(depositRefundSlaDays),
          dailyLateFee: Number(dailyLateFee),
          overdueGraceDays: Number(overdueGraceDays),
          overdueAccessDisableDays: Number(overdueAccessDisableDays),
          overdueSealingDays: Number(overdueSealingDays),
          minimumRentalMonths: Number(minimumRentalMonths),
        }
        const updated = await facilityPolicyService.update(existingPolicy.id, updatePayload)
        onSuccess(updated, false)
      } else {
        const createPayload: FacilityPolicyCreateRequest = {
          facilityId: selectedFacilityId,
          isActive,
          depositPercentage: Number(depositPercentage),
          renewalWindowDays: Number(renewalWindowDays),
          cancellationFullRefundHours: Number(cancellationFullRefundHours),
          cancellationPartialRefundHours: Number(cancellationPartialRefundHours),
          cancellationPartialRefundPercent: Number(cancellationPartialRefundPercent),
          returnNoticeDays: Number(returnNoticeDays),
          depositRefundSlaDays: Number(depositRefundSlaDays),
          dailyLateFee: Number(dailyLateFee),
          overdueGraceDays: Number(overdueGraceDays),
          overdueAccessDisableDays: Number(overdueAccessDisableDays),
          overdueSealingDays: Number(overdueSealingDays),
          minimumRentalMonths: Number(minimumRentalMonths),
        }
        const created = await facilityPolicyService.create(createPayload)
        onSuccess(created, true)
      }
      onClose()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (isEdit ? 'Không thể cập nhật chính sách cơ sở. Vui lòng thử lại.' : 'Không thể tạo mới chính sách. Vui lòng thử lại.')
      setErrorMsg(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <span className="material-symbols-outlined text-[22px]">policy</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEdit ? 'Chỉnh sửa chính sách vận hành cơ sở' : 'Tạo mới chính sách cơ sở'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {targetFacilityName} • Thẩm quyền: Business Operations Manager (Ban hành, kích hoạt &amp; ngừng áp dụng)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Trạng thái Kích hoạt / Ngừng áp dụng chính sách */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'}`}>
                <span className="material-symbols-outlined text-[20px]">{isActive ? 'check_circle' : 'pause_circle'}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Trạng thái áp dụng chính sách
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isActive ? 'Chính sách đang ĐƯỢC KÍCH HOẠT và có hiệu lực trực tiếp tại cơ sở.' : 'Chính sách đang NGỪNG ÁP DỤNG (Tạm dừng tính phí & quy định theo cấu hình này).'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{isActive ? 'toggle_on' : 'toggle_off'}</span>
              <span>{isActive ? 'Đang kích hoạt' : 'Ngừng áp dụng'}</span>
            </button>
          </div>

          {/* Chọn cơ sở (nếu chưa cố định) */}
          {!facility && !isEdit && availableFacilities.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Chọn cơ sở áp dụng <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                required
              >
                {availableFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code}) - {f.address || f.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nhóm 1: Tiền cọc & Thời hạn hợp đồng */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
              <span className="material-symbols-outlined text-[16px]">payments</span>
              <span>1. Quy định Tiền cọc & Thời gian thuê kho</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tỷ lệ tiền cọc (%) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={depositPercentage}
                    onChange={(e) => setDepositPercentage(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                    required
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Thường là 100% tiền thuê 1 tháng</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Thuê tối thiểu (tháng) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={minimumRentalMonths}
                  onChange={(e) => setMinimumRentalMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Hợp đồng tối thiểu 1 tháng</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mở gia hạn trước hạn (ngày) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={renewalWindowDays}
                  onChange={(e) => setRenewalWindowDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Cho phép gia hạn trước N ngày</span>
              </div>
            </div>
          </div>

          {/* Nhóm 2: Hủy đặt kho & Hoàn tiền cọc */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              <span>2. Chính sách Hủy đặt kho & Hoàn tiền cọc</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hạn hủy hoàn 100% (giờ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="720"
                  value={cancellationFullRefundHours}
                  onChange={(e) => setCancellationFullRefundHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Hủy trong vòng N giờ kể từ khi đặt (vd: 24h)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hạn hủy hoàn một phần (giờ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="720"
                  value={cancellationPartialRefundHours}
                  onChange={(e) => setCancellationPartialRefundHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Khung hủy hoàn một phần kể từ khi đặt (vd: 48h)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tỷ lệ hoàn một phần (%) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={cancellationPartialRefundPercent}
                    onChange={(e) => setCancellationPartialRefundPercent(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                    required
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Hoàn lại % cọc đã thanh toán (vd: 70%)</span>
              </div>
            </div>
            {cancellationFullRefundHours > cancellationPartialRefundHours && (
              <p className="text-[11px] font-semibold text-rose-500">
                * Hạn hủy hoàn 100% phải nhỏ hơn hoặc bằng hạn hủy hoàn một phần.
              </p>
            )}
          </div>

          {/* Nhóm 3: Trả kho & SLA Hoàn cọc */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[16px]">published_with_changes</span>
              <span>3. Quy định Trả kho & Hoàn cọc (Return Inspection)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Báo trước khi trả kho (ngày) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={returnNoticeDays}
                  onChange={(e) => setReturnNoticeDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Khách cần gửi thông báo trước N ngày</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SLA hoàn cọc (ngày làm việc) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={depositRefundSlaDays}
                  onChange={(e) => setDepositRefundSlaDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Thời gian xử lý chuyển tiền hoàn cọc</span>
              </div>
            </div>
          </div>

          {/* Nhóm 4: Phí trễ hạn & Xử lý nợ quá hạn */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              <span className="material-symbols-outlined text-[16px]">lock_clock</span>
              <span>4. Quy trình Xử lý Quá hạn & Niêm phong</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phí phạt trễ hạn/ngày <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={dailyLateFee}
                    onChange={(e) => setDailyLateFee(Number(e.target.value))}
                    className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                    required
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">đ</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Phí tính theo mỗi ngày trễ</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ân hạn nợ (ngày) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={overdueGraceDays}
                  onChange={(e) => setOverdueGraceDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Chưa tính phạt trong N ngày</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Khóa PIN ra vào (ngày) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={overdueAccessDisableDays}
                  onChange={(e) => setOverdueAccessDisableDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Tự động vô hiệu hóa smartlock</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Niêm phong kho (ngày) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={overdueSealingDays}
                  onChange={(e) => setOverdueSealingDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Tiến hành thủ tục niêm phong</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-cyan-500/20 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{isEdit ? 'Lưu cập nhật chính sách' : 'Xác nhận tạo chính sách'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
