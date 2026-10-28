import React, { useState, useEffect } from 'react'
import { facilityService } from '../../../services/facilityService'
import { FacilityPolicy } from '../../../types'
import axios from 'axios'
import { createDefaultFacilityPolicy } from '../../../utils/facilityPolicyDefaults'

interface StaffPolicyGuideModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId?: string
  facilityName?: string
}

export const StaffPolicyGuideModal: React.FC<StaffPolicyGuideModalProps> = ({
  isOpen,
  onClose,
  facilityId,
  facilityName = 'Cơ sở hiện tại'
}) => {
  const [policy, setPolicy] = useState<FacilityPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!isOpen || !facilityId) return

    let isCurrentRequest = true
    const loadPolicy = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      setPolicy(null)
      try {
        const res = await facilityService.getPolicyByFacilityId(facilityId)
        if (isCurrentRequest) setPolicy(res)
      } catch (error: unknown) {
        if (!isCurrentRequest) return
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setPolicy(createDefaultFacilityPolicy(facilityId))
        } else {
          setErrorMessage('Không thể tải chính sách của cơ sở. Vui lòng thử lại sau.')
        }
      } finally {
        if (isCurrentRequest) setIsLoading(false)
      }
    }

    void loadPolicy()
    return () => {
      isCurrentRequest = false
    }
  }, [isOpen, facilityId, reloadToken])

  if (!isOpen) return null

  const depositPct = policy?.depositPercentage ?? policy?.depositPercent ?? 100
  const minMonths = policy?.minimumRentalMonths ?? 1
  const renewalDays = policy?.renewalWindowDays ?? 3
  const cancelFullHours = policy?.cancellationFullRefundHours ?? 24
  const cancelPartHours = policy?.cancellationPartialRefundHours ?? 48
  const cancelPartPct = policy?.cancellationPartialRefundPercent ?? 70
  const noticeDays = policy?.returnNoticeDays ?? 0
  const slaDays = policy?.depositRefundSlaDays ?? 5
  const lateFee = Number(policy?.dailyLateFee ?? policy?.lateFeePerDay ?? 50000)
  const graceDays = policy?.overdueGraceDays ?? policy?.gracePeriodDays ?? 1
  const lockDays = policy?.overdueAccessDisableDays ?? 3
  const sealDays = policy?.overdueSealingDays ?? 7

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900">
              <span className="material-symbols-outlined text-[26px]">menu_book</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Hướng Dẫn Nghiệp Vụ Nhân Viên Trạm</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                  {facilityName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hướng dẫn nghiệp vụ tra cứu quy định phục vụ đón tiếp, bàn giao kho &amp; giải quyết sự cố
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Note phân quyền */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-950 text-xs">
          <span className="material-symbols-outlined text-[20px] text-blue-700 shrink-0">badge</span>
          <div>
            <span className="font-bold">HƯỚNG DẪN DÀNH CHO VAI TRÒ NHÂN VIÊN (FACILITY STAFF)</span>
            <p className="text-[11px] text-blue-900 mt-0.5 leading-relaxed">
              Nhân viên chỉ có quyền xem quy định này để đối chiếu nghiệp vụ hiện trường. Mọi thắc mắc hoặc đề xuất điều chỉnh phải báo cáo lên Quản lý Cơ sở (Facility Manager) hoặc Business Operations Manager.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setReloadToken((current) => current + 1)}
              className="shrink-0 font-bold underline"
            >
              Thử lại
            </button>
          </div>
        )}
        {isLoading && (
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs">
            Đang tải chính sách áp dụng...
          </div>
        )}
        {!isLoading && policy?.isActive === false && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            Policy của cơ sở đã ngừng áp dụng. Vui lòng xác nhận quy định mặc định hiện hành với quản lý cơ sở.
          </div>
        )}

        {/* Quy định thiết yếu */}
        {policy && !isLoading && !errorMessage && <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
          {/* 1. Bàn giao & Cọc */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-700 text-[18px]">verified</span>
              <h4 className="font-bold text-xs text-slate-900 uppercase">1. Quy định Tiền Cọc &amp; Bàn Giao (Check-in)</h4>
            </div>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-5">
              <li>Mức thu tiền cọc bắt buộc: <strong className="text-slate-900 font-mono">{depositPct}% tiền thuê</strong>.</li>
              <li>Thời gian thuê tối thiểu hợp đồng: <strong className="text-slate-900">{minMonths} tháng</strong>.</li>
              <li>Cửa sổ đăng ký gia hạn: <strong className="text-slate-900">{renewalDays} ngày trước khi hợp đồng hết hạn</strong>.</li>
              <li>Sau khi backend xác nhận đủ điều kiện, lập biên bản bàn giao và đối chiếu CCCD gốc. PIN phần mềm chưa được đồng bộ với khóa vật lý; không xác nhận khách đã mở được khóa nếu chưa kiểm tra trực tiếp tại cơ sở.</li>
            </ul>
          </div>

          {/* 2. Trả kho & Hoàn cọc */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-[18px]">task_alt</span>
              <h4 className="font-bold text-xs text-slate-900 uppercase">2. Nghiệm Thu Trả Kho &amp; Cam Kết SLA Hoàn Cọc</h4>
            </div>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-5">
              <li>Khách cần báo trước khi trả kho: <strong>{noticeDays > 0 ? `${noticeDays} ngày` : 'Không bắt buộc'}</strong>.</li>
              <li>Quy chuẩn hoàn cọc SLA: Cam kết hoàn trả tài khoản khách trong vòng <strong className="text-emerald-700 font-bold">{slaDays} ngày làm việc</strong>.</li>
              <li>Yêu cầu bắt buộc: Nhân viên phải chụp ảnh hiện trường, lập Biên bản kiểm định đạt chuẩn (Sạch sẽ, không hư hỏng chốt SmartLock).</li>
              <li>Nếu có hư hỏng tài sản trạm: Khấu trừ tiền cọc theo biểu phí vật tư trước khi ký kết thúc hợp đồng.</li>
            </ul>
          </div>

          {/* 3. Hủy booking */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">rule</span>
              <h4 className="font-bold text-xs text-slate-900 uppercase">3. Hướng Dẫn Khách Hủy Booking</h4>
            </div>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-5">
              <li>Hủy trong vòng &le; <strong>{cancelFullHours} giờ</strong> kể từ lúc đặt kho: Hoàn 100% tiền cọc tự động qua quy trình đối soát hoàn tiền.</li>
              <li>Hủy trong khoảng {cancelFullHours}h - {cancelPartHours}h kể từ lúc đặt kho: Hoàn <strong>{cancelPartPct}% tiền cọc</strong> (khấu trừ {100 - cancelPartPct}% phí giữ chỗ).</li>
              <li>Hủy quá <strong>{cancelPartHours} giờ</strong> kể từ lúc đặt kho: Hoàn <strong>50% tiền cọc</strong> (khấu trừ 50% phí cam kết giữ chỗ).</li>
            </ul>
          </div>

          {/* 4. Khóa nợ & Niêm phong */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
              <h4 className="font-bold text-xs text-slate-900 uppercase">4. Mốc Xử Lý Quá Hạn &amp; Niêm Phong Kho</h4>
            </div>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-5">
              <li>Thời gian ân hạn: <strong>{graceDays} ngày</strong> (Không tính phạt trễ hạn).</li>
              <li>Phí phạt quá hạn: <strong>{lateFee.toLocaleString('vi-VN')} đ/ngày</strong> bắt đầu từ ngày hết ân hạn.</li>
              <li>Ngắt mã PIN mở cửa: Tự động sau <strong>{lockDays} ngày</strong> quá hạn thanh toán.</li>
              <li>Niêm phong kho hàng &amp; dán tem: Sau <strong>{sealDays} ngày</strong> quá hạn (Phải có nhân chứng hiện trường).</li>
            </ul>
          </div>
        </div>}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-500">
            Hướng dẫn nghiệp vụ trích xuất từ quy định vận hành Boxora
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer"
          >
            Đóng bảng tra cứu
          </button>
        </div>
      </div>
    </div>
  )
}
