import React, { useState, useEffect } from 'react'
import { facilityService } from '../../services/facilityService'
import { FacilityPolicy } from '../../types'
import { createDefaultFacilityPolicy } from '../../utils/facilityPolicyDefaults'
import axios from 'axios'

interface CustomerPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId?: string
  facilityName?: string
}

type PolicyTab = 'rental' | 'payment' | 'cancellation' | 'return' | 'overdue'

export const CustomerPolicyModal: React.FC<CustomerPolicyModalProps> = ({
  isOpen,
  onClose,
  facilityId,
  facilityName = 'Hệ thống Boxora Self-Storage',
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTab>('rental')
  const [policy, setPolicy] = useState<FacilityPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const loadPolicy = async () => {
      if (!facilityId) {
        setPolicy(createDefaultFacilityPolicy('default'))
        return
      }

      setIsLoading(true)
      try {
        const res = await facilityService.getPolicyByFacilityId(facilityId)
        if (isMounted) setPolicy(res)
      } catch (err: unknown) {
        if (!isMounted) return
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setPolicy(createDefaultFacilityPolicy(facilityId))
        } else {
          setPolicy(createDefaultFacilityPolicy(facilityId))
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadPolicy()
    return () => {
      isMounted = false
    }
  }, [isOpen, facilityId])

  if (!isOpen) return null

  const depositPercent = policy?.depositPercentage ?? policy?.depositPercent ?? 100
  const minMonths = policy?.minimumRentalMonths ?? 1
  const renewalDays = policy?.renewalWindowDays ?? 7
  const cancelFullHours = policy?.cancellationFullRefundHours ?? 48
  const cancelPartHours = policy?.cancellationPartialRefundHours ?? 24
  const cancelPartPercent = policy?.cancellationPartialRefundPercent ?? 50
  const returnNoticeDays = policy?.returnNoticeDays ?? 3
  const depositRefundSla = policy?.depositRefundSlaDays ?? 3
  const dailyLateFee = Number(policy?.dailyLateFee ?? policy?.lateFeePerDay ?? 50000)
  const graceDays = policy?.overdueGraceDays ?? policy?.gracePeriodDays ?? 3
  const accessDisableDays = policy?.overdueAccessDisableDays ?? 5
  const sealingDays = policy?.overdueSealingDays ?? 7

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chính Sách Thuê Kho, Hợp Đồng &amp; Thanh Toán
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {facilityName} • Áp dụng cho khách hàng sử dụng dịch vụ Boxora
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-800/20 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('rental')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'rental'
                ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">warehouse</span>
            <span>1. Thuê kho &amp; Hợp đồng</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'payment'
                ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">payments</span>
            <span>2. Cọc &amp; Thanh toán</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cancellation')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'cancellation'
                ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">cancel</span>
            <span>3. Hủy &amp; Hoàn cọc</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('return')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'return'
                ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">assignment_return</span>
            <span>4. Trả kho &amp; SLA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'overdue'
                ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">lock_clock</span>
            <span>5. Xử lý Quá hạn</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-700 dark:text-slate-300 space-y-4">
          {isLoading && (
            <div className="p-4 text-center text-xs text-slate-500">
              Đang tải chính sách áp dụng tại cơ sở...
            </div>
          )}

          {/* TAB 1: Thuê kho & Hợp đồng */}
          {activeTab === 'rental' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/40">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-cyan-600 text-[18px]">gavel</span>
                  Quy định ký kết hợp đồng điện tử
                </h4>
                <ul className="text-xs space-y-2 list-disc pl-5 leading-relaxed">
                  <li>
                    Hợp đồng thuê kho được khởi tạo và ký kết hoàn toàn trực tuyến bằng chữ ký điện tử vẽ theo đúng quy định pháp lý.
                  </li>
                  <li>
                    Thời hạn thuê tối thiểu là <strong>{minMonths} tháng</strong>. Hết thời hạn thuê, quý khách có thể gia hạn linh hoạt.
                  </li>
                  <li>
                    Cổng gia hạn mở trước <strong>{renewalDays} ngày</strong> so với ngày hết hạn hợp đồng. Quý khách có thể thao tác gia hạn ngay trên tài khoản.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-600 text-[18px]">inventory_2</span>
                  Quyền lưu trữ &amp; An ninh tài sản
                </h4>
                <ul className="text-xs space-y-1.5 list-disc pl-5 leading-relaxed">
                  <li>Khách hàng được toàn quyền sử dụng kho lưu trữ 24/7 qua hệ thống SmartLock (Mã PIN &amp; Ứng dụng Boxora).</li>
                  <li>Không lưu trữ hàng cấm, vũ khí, chất cháy nổ hoặc hàng hóa có mùi hôi, phân hủy.</li>
                  <li>Mọi lượt ra vào đều được ghi nhận nhật ký tự động phục vụ an ninh bảo vệ tài sản của khách hàng.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: Cọc & Thanh toán */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40">
                  <span className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400 block mb-1">
                    Tiền ký quỹ đặt cọc (Deposit)
                  </span>
                  <div className="text-2xl font-black font-mono text-amber-950 dark:text-amber-200">
                    {depositPercent}%
                  </div>
                  <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-1">
                    Tương đương 1 tháng tiền thuê. Khoản tiền cọc được bảo lưu giữ hộ và hoàn trả 100% khi thanh lý hợp đồng đúng hạn.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40">
                  <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-400 block mb-1">
                    Phương thức thanh toán
                  </span>
                  <div className="text-base font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-[20px]">credit_card</span>
                    <span>VNPay QR &amp; Ngân hàng</span>
                  </div>
                  <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 mt-2">
                    Xác nhận thanh toán tự động theo thời gian thực (Real-time). Hóa đơn điện tử được gửi qua email.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <span className="font-bold text-slate-900 dark:text-white uppercase block">Chu kỳ thanh toán</span>
                <p className="leading-relaxed">
                  Cước thuê được thanh toán theo kỳ (1, 3, 6 hoặc 12 tháng). Hệ thống sẽ gửi thông báo nhắc hạn trước khi kỳ thuê mới bắt đầu.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Hủy & Hoàn cọc */}
          {activeTab === 'cancellation' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">rule</span>
                  Mốc thời gian hủy đơn giữ chỗ &amp; Tỷ lệ hoàn cọc
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Hủy trước giờ nhận kho &ge; {cancelFullHours} giờ:
                    </span>
                    <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      Hoàn lại 100% tiền cọc
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                    <span className="font-semibold text-amber-900 dark:text-amber-200">
                      Hủy trước giờ nhận kho từ {cancelPartHours}h đến &lt; {cancelFullHours}h:
                    </span>
                    <strong className="font-mono font-bold text-amber-700 dark:text-amber-400">
                      Hoàn lại {cancelPartPercent}% tiền cọc
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                    <span className="font-semibold text-rose-900 dark:text-rose-200">
                      Hủy dưới {cancelPartHours} giờ hoặc không đến nhận kho:
                    </span>
                    <strong className="font-mono font-bold text-rose-700 dark:text-rose-400">
                      Không hoàn tiền cọc
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Trả kho & SLA */}
          {activeTab === 'return' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40">
                  <span className="text-[11px] font-bold uppercase text-blue-800 dark:text-blue-400 block mb-1">
                    Báo trước khi trả kho
                  </span>
                  <div className="text-2xl font-black font-mono text-blue-950 dark:text-blue-200">
                    {returnNoticeDays} ngày
                  </div>
                  <p className="text-[11px] text-blue-900/80 dark:text-blue-300/80 mt-1">
                    Quý khách chỉ cần bấm &quot;Yêu cầu trả kho&quot; trên ứng dụng trước {returnNoticeDays} ngày để nhân sự trạm chuẩn bị đón tiếp.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40">
                  <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-400 block mb-1">
                    SLA hoàn cọc (Cam kết thời gian)
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-950 dark:text-emerald-200">
                    {depositRefundSla} ngày làm việc
                  </div>
                  <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 mt-1">
                    Tiền cọc được hoàn trả trực tiếp về số tài khoản ngân hàng của quý khách sau khi hoàn tất biên bản nghiệm thu.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-bold text-slate-900 dark:text-white uppercase block mb-1.5">
                  Tiêu chuẩn nghiệm thu hoàn cọc 100%
                </span>
                <ul className="space-y-1 list-disc pl-5 leading-relaxed text-slate-600 dark:text-slate-400">
                  <li>Đã dọn sạch đồ đạc và vệ sinh kho ngăn nắp.</li>
                  <li>Không làm hư hại vách ngăn, cửa cuốn hoặc khóa thông minh SmartLock.</li>
                  <li>Đã thanh toán đầy đủ các khoản cước thuê phát sinh đến ngày trả kho.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: Quá hạn */}
          {activeTab === 'overdue' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                <h4 className="font-bold text-rose-900 dark:text-rose-200 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Quy trình xử lý quá hạn thanh toán
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-700 dark:text-slate-300">Thời gian ân hạn miễn phạt:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{graceDays} ngày</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-700 dark:text-slate-300">Phí phạt trễ hạn mỗi ngày:</span>
                    <strong className="text-rose-600 font-mono font-bold">
                      {dailyLateFee.toLocaleString('vi-VN')} đ/ngày
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-700 dark:text-slate-300">Vô hiệu hóa mã PIN SmartLock:</span>
                    <strong className="text-rose-700 font-mono">Ngày thứ {accessDisableDays} quá hạn</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-700 dark:text-slate-300">Quy trình niêm phong &amp; xử lý tài sản:</span>
                    <strong className="text-rose-800 font-mono">Ngày thứ {sealingDays} quá hạn</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Hệ thống Boxora cam kết minh bạch chính sách và bảo vệ quyền lợi khách hàng.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Đã hiểu &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
