import React, { useState, useEffect } from 'react'
import { facilityService } from '../../../services/facilityService'
import { FacilityPolicy } from '../../../types'
import axios from 'axios'
import { createDefaultFacilityPolicy } from '../../../utils/facilityPolicyDefaults'

interface FacilityPolicyViewModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId: string
  facilityName: string
  canEdit?: boolean
}

const EDITABLE_POLICY_FIELDS = [
  ['depositPercentage', 'Tỷ lệ tiền cọc (%)', 0, 100],
  ['minimumRentalMonths', 'Thời gian thuê tối thiểu (tháng)', 1, 36],
  ['renewalWindowDays', 'Cửa sổ gia hạn (ngày)', 0, 365],
  ['cancellationFullRefundHours', 'Mốc hoàn 100% (giờ)', 0, 720],
  ['cancellationPartialRefundHours', 'Mốc hoàn một phần (giờ)', 0, 720],
  ['cancellationPartialRefundPercent', 'Tỷ lệ hoàn một phần (%)', 0, 100],
  ['returnNoticeDays', 'Báo trước khi trả kho (ngày)', 0, 365],
  ['depositRefundSlaDays', 'SLA hoàn cọc (ngày)', 0, 365],
  ['dailyLateFee', 'Phí quá hạn mỗi ngày (đ)', 0, 100000000],
  ['overdueGraceDays', 'Ân hạn quá hạn (ngày)', 0, 365],
  ['overdueAccessDisableDays', 'Khóa truy cập sau (ngày)', 0, 365],
  ['overdueSealingDays', 'Niêm phong sau (ngày)', 0, 365],
] as const

export const FacilityPolicyViewModal: React.FC<FacilityPolicyViewModalProps> = ({
  isOpen,
  onClose,
  facilityId,
  facilityName,
  canEdit = false,
}) => {
  const [policy, setPolicy] = useState<FacilityPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editValues, setEditValues] = useState<Partial<FacilityPolicy>>({})

  useEffect(() => {
    if (isOpen && facilityId) {
      loadPolicy()
    }
  }, [isOpen, facilityId])

  const loadPolicy = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    setPolicy(null)
    try {
      const res = await facilityService.getPolicyByFacilityId(facilityId)
      setPolicy(res)
      setEditValues(res)
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const defaults = createDefaultFacilityPolicy(facilityId)
        setPolicy(defaults)
        setEditValues(defaults)
      } else {
        setErrorMsg('Không thể tải chính sách của cơ sở. Vui lòng thử lại sau.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveException = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!policy?.id) return

    setIsSaving(true)
    setErrorMsg(null)
    try {
      const updated = await facilityService.updatePolicy(policy.id, editValues)
      setPolicy(updated)
      setEditValues(updated)
      setIsEditing(false)
    } catch (error: unknown) {
      setErrorMsg(axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : 'Không thể lưu ngoại lệ policy.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  // Fallbacks to system standard values if policy not provisioned
  const depositPct = policy?.depositPercentage ?? policy?.depositPercent ?? 100
  const minMonths = policy?.minimumRentalMonths ?? 1
  const renewalDays = policy?.renewalWindowDays ?? 3
  const cancelFullHours = policy?.cancellationFullRefundHours ?? 48
  const cancelPartHours = policy?.cancellationPartialRefundHours ?? 24
  const cancelPartPct = policy?.cancellationPartialRefundPercent ?? 50
  const noticeDays = policy?.returnNoticeDays ?? 0
  const slaDays = policy?.depositRefundSlaDays ?? 5
  const lateFee = Number(policy?.dailyLateFee ?? policy?.lateFeePerDay ?? 50000)
  const graceDays = policy?.overdueGraceDays ?? policy?.gracePeriodDays ?? 1
  const lockDays = policy?.overdueAccessDisableDays ?? 3
  const sealDays = policy?.overdueSealingDays ?? 7

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-5 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
              <span className="material-symbols-outlined text-[26px]">policy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Chính Sách Vận Hành Cơ Sở</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900">
                  {facilityName}
                </span>
                {policy?.isActive === false && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900">
                    Ngừng áp dụng
                  </span>
                )}
                {canEdit && policy?.id && !isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 cursor-pointer"
                  >
                    Sửa ngoại lệ
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Căn cứ thực hiện nghiệp vụ trạm do Business Operations Manager ban hành
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Thẩm quyền & Phạm vi */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-950 text-xs dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-200">
          <span className="material-symbols-outlined text-[20px] text-amber-700 dark:text-amber-400 shrink-0">verified_user</span>
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span>QUY CHUẨN PHÂN QUYỀN &bull; FACILITY MANAGER</span>
            </div>
            <p className="text-[11px] text-amber-900 dark:text-amber-300 mt-0.5 leading-relaxed">
              Quản lý cơ sở thực hiện nghiêm túc các nghiệp vụ thu cọc, nghiệm thu trả kho và niêm phong kho nợ đúng theo các mốc thời gian dưới đây. Mọi trường hợp điều chỉnh ngoại lệ phải được <strong>Business Operations Manager</strong> phê duyệt trước bằng văn bản.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">info</span>
            <span>{errorMsg}</span>
          </div>
        )}
        {!isLoading && policy?.isActive === false && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            Chính sách này hiện đã ngừng áp dụng. Cơ sở đang sử dụng quy định mặc định cho đến khi policy được kích hoạt lại.
          </div>
        )}
        {isLoading && (
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
            Đang tải chính sách áp dụng...
          </div>
        )}

        {canEdit && isEditing && (
          <form onSubmit={handleSaveException} className="grid grid-cols-1 gap-3 overflow-y-auto rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 sm:grid-cols-2 dark:border-indigo-900/60 dark:bg-indigo-950/30">
            <p className="sm:col-span-2 text-xs text-indigo-900 dark:text-indigo-300">
              Bạn có quyền sửa ngoại lệ policy của cơ sở này. Các thay đổi sẽ được ghi nhận trên policy đang áp dụng.
            </p>
            {EDITABLE_POLICY_FIELDS.map(([key, label, min, max]) => (
              <label key={key} className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {label}
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={editValues[key] ?? ''}
                  onChange={(event) => setEditValues((current) => ({
                    ...current,
                    [key]: Number(event.target.value),
                  }))}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => { setIsEditing(false); setEditValues(policy || {}) }}
                disabled={isSaving}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu ngoại lệ'}
              </button>
            </div>
          </form>
        )}

        {/* Content Body Grid */}
        {!isEditing && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-1">
          {/* Card 1: Tiền Cọc & Thuê Kho */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-700 dark:text-blue-400 text-[20px]">account_balance_wallet</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">1. Tiền Cọc &amp; Kỳ Hạn Hợp Đồng</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Tỷ lệ tiền cọc đảm bảo:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{depositPct}% tiền thuê (1 tháng)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Thời gian thuê tối thiểu:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{minMonths} tháng</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Cửa sổ mở gia hạn trước:</span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{renewalDays} ngày trước hết hạn</span>
              </div>
            </div>
          </div>

          {/* Card 2: Hủy Booking & Hoàn Cọc */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">event_busy</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">2. Hủy Đặt Kho &amp; Hoàn Tiền</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Hủy hoàn 100% tiền cọc:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">Trước check-in &ge; {cancelFullHours}h</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Hủy hoàn một phần ({cancelPartPct}%):</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">Trước check-in &ge; {cancelPartHours}h</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Hủy dưới {cancelPartHours}h:</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400">Không hoàn cọc (Tịch thu)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Trả Kho & Hoàn Cọc */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-[20px]">published_with_changes</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">3. Nghiệm Thu Trả Kho &amp; SLA Hoàn Cọc</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Thời hạn báo trước khi trả kho:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{noticeDays > 0 ? `${noticeDays} ngày` : 'Không bắt buộc'}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Cam kết hoàn cọc (SLA):</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{slaDays} ngày làm việc</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Điều kiện hoàn cọc:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">Đạt chuẩn biên bản bàn giao sạch</span>
              </div>
            </div>
          </div>

          {/* Card 4: Quá Hạn & Niêm Phong */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[20px]">gavel</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">4. Mốc Xử Lý Nợ &amp; Niêm Phong Kho</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Thời gian ân hạn miễn phạt:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{graceDays} ngày</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Phí phạt trễ hạn mỗi ngày:</span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{lateFee.toLocaleString('vi-VN')} đ/ngày</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Khóa quyền mở cửa SmartLock:</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400">Ngày thứ {lockDays} quá hạn</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Niêm phong &amp; Kê biên tài sản:</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400">Ngày thứ {sealDays} quá hạn</span>
              </div>
            </div>
          </div>
        </div>}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Hệ thống chính sách được đồng bộ tự động từ API FacilityPolicyController
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-neutral-800 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all cursor-pointer"
          >
            Đã hiểu &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

