import React, { useState, useEffect } from 'react'
import { facilityService } from '../../../services/facilityService'
import { FacilityPolicy } from '../../../types'
import axios from 'axios'

interface FacilityPolicyViewModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId: string
  facilityName: string
  canEdit?: boolean
}

const EDITABLE_POLICY_FIELDS = [
  ['depositPercentage', 'Tỷ lệ tiền cọc (%)', 0, 100],
  ['cancellationFullRefundHours', 'Hạn hủy hoàn 100% (giờ)', 0, 720],
  ['cancellationPartialRefundPercent', 'Tỷ lệ hủy trong 24-48h (%)', 0, 100],
  ['cancellationAfter48hRefundPercent', 'Tỷ lệ hoàn sau 48h đặt (%)', 0, 100],
  ['depositRefundSlaDays', 'SLA hoàn cọc (ngày làm việc)', 0, 365],
  ['dailyLateFee', 'Tỷ lệ phí phạt trễ hạn (% ngày / loại kho)', 0, 500],
  ['overdueGraceDays', 'Ân hạn nợ (ngày)', 0, 365],
  ['overdueAccessDisableDays', 'Khóa PIN ra vào (ngày)', 0, 365],
  ['overdueSealingDays', 'Niêm phong kho (ngày)', 0, 365],
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
        setErrorMsg('Chưa có chính sách được lưu cho cơ sở này.')
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

  const depositPct = policy?.depositPercentage ?? policy?.depositPercent
  const cancelFullHours = policy?.cancellationFullRefundHours
  const cancelPartHours = policy?.cancellationPartialRefundHours
  const cancelPartPct = policy?.cancellationPartialRefundPercent
  const slaDays = policy?.depositRefundSlaDays
  const lateFee = policy?.dailyLateFee ?? policy?.lateFeePerDay
  const graceDays = policy?.overdueGraceDays ?? policy?.gracePeriodDays
  const lockDays = policy?.overdueAccessDisableDays
  const sealDays = policy?.overdueSealingDays

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

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">info</span>
            <span>{errorMsg}</span>
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
        {!isEditing && policy && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-1">
          {/* Card 1: Tiền Cọc */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-700 dark:text-blue-400 text-[20px]">account_balance_wallet</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">1. Quy định Tiền cọc</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Tỷ lệ tiền cọc (%):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{depositPct == null ? '—' : `${depositPct}%`}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Hủy Booking & Hoàn Cọc */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">cancel</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">2. Chính sách Hủy đặt kho &amp; Hoàn tiền cọc</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Hạn hủy hoàn 100% (giờ):</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">Trong vòng &le; {cancelFullHours ?? '24'}h kể từ khi đặt</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Tỷ lệ hủy trong 24-48h (%):</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{cancelPartPct == null ? '70' : `${cancelPartPct}`}%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Tỷ lệ hoàn sau 48h đặt (%):</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{policy?.cancellationAfter48hRefundPercent ?? '50'}%</span>
              </div>
            </div>
          </div>

          {/* Card 3: Trả Kho & Hoàn Cọc */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-[20px]">published_with_changes</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">3. Quy định Trả kho &amp; Hoàn cọc</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">SLA hoàn cọc (ngày làm việc):</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{slaDays == null ? '—' : `${slaDays} ngày làm việc`}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Quá Hạn & Niêm Phong */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[20px]">lock_clock</span>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100">4. Quy trình Xử lý Quá hạn &amp; Niêm phong</h3>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Tỷ lệ phí phạt trễ hạn (% ngày / loại kho):</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{lateFee == null || Number(lateFee) > 500 ? '100%' : `${Number(lateFee)}%`}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Ân hạn nợ (ngày):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{graceDays == null ? '—' : `${graceDays} ngày`}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Khóa PIN ra vào (ngày):</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{lockDays == null ? '—' : `Ngày thứ ${lockDays} quá hạn`}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Niêm phong kho (ngày):</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{sealDays == null ? '—' : `Ngày thứ ${sealDays} quá hạn`}</span>
              </div>
            </div>
          </div>
        </div>}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Hệ thống chính sách được đồng bộ tự động từ hệ thống
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

