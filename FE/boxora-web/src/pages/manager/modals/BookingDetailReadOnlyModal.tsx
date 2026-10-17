import React, { useEffect, useState } from 'react'
import { handoverService, HandoverPrerequisites } from '../../../services/handoverService'
import { bookingService } from '../../../services/bookingService'
import { Booking } from '../../../types'

interface BookingDetailReadOnlyModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId?: string
  unitCode?: string
  unitBackendId?: string
}

export const BookingDetailReadOnlyModal: React.FC<BookingDetailReadOnlyModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  unitCode,
  unitBackendId,
}) => {
  const [loading, setLoading] = useState<boolean>(true)
  const [prereq, setPrereq] = useState<HandoverPrerequisites | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPrereq(null)
      setBooking(null)
      setError(null)
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        let targetBookingId = bookingId

        // If bookingId was not provided, try to find active booking for this unit
        if (!targetBookingId && unitBackendId) {
          const res = await bookingService.getAll({ size: 100 })
          const matched = res?.content?.find(b => 
            (b.storageUnitId === unitBackendId || b.unitCode === unitCode) &&
            (b.status === 'CONFIRMED' || b.status === 'PENDING_APPROVAL' || b.status === 'PENDING_PAYMENT' || b.status === 'ACTIVE')
          )
          if (matched) {
            targetBookingId = matched.id
            setBooking(matched)
          }
        } else if (targetBookingId) {
          try {
            const b = await bookingService.getById(targetBookingId)
            setBooking(b)
          } catch {
            // fallback
          }
        }

        if (targetBookingId) {
          const prereqData = await handoverService.getCheckInPrerequisites(targetBookingId)
          setPrereq(prereqData)
        } else {
          setError('Không tìm thấy thông tin đặt chỗ hiệu lực cho ngăn kho này.')
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Không thể tải điều kiện bàn giao của đặt chỗ này.'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [isOpen, bookingId, unitBackendId, unitCode])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px] text-blue-600">visibility</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline text-base font-bold text-slate-900">
                  Hồ Sơ Đặt Kho &amp; Điều Kiện Bàn Giao
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  CHẾ ĐỘ GIÁM SÁT
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kho giám sát: <strong className="font-mono text-slate-900">#{unitCode || prereq?.unitCode || 'N/A'}</strong> • Mã đơn: <span className="font-mono">{booking?.bookingCode || prereq?.bookingCode || bookingId || 'N/A'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-3xl text-blue-600 animate-spin">progress_activity</span>
            <span className="text-xs text-slate-500 font-medium">Đang tải đối soát 4 điều kiện tiên quyết...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <div className="flex items-center gap-2 font-bold mb-1">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>Thông tin giám sát</span>
            </div>
            <p>{error}</p>
          </div>
        ) : prereq ? (
          <div className="flex flex-col gap-4">
            
            {/* Customer & Booking Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Khách hàng</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">{prereq.customerName || 'N/A'}</span>
                <span className="text-slate-600 font-mono">{prereq.customerPhone || 'N/A'} • {prereq.customerEmail || 'Chưa có email'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Cơ sở &amp; Kho</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{prereq.facilityName || 'N/A'}</span>
                <span className="font-mono text-cyan-800 font-bold">Mã kho #{prereq.unitCode}</span>
              </div>
            </div>

            {/* Overall Eligibility Status */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              prereq.eligibleForCheckIn 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2 text-xs">
                <span className="material-symbols-outlined text-[20px]">
                  {prereq.eligibleForCheckIn ? 'verified' : 'pending_actions'}
                </span>
                <span className="font-bold">
                  {prereq.eligibleForCheckIn 
                    ? 'Đơn đặt kho đã đủ 4 điều kiện sẵn sàng bàn giao thực địa' 
                    : 'Đơn đặt kho chưa hoàn tất đủ 4 điều kiện tiên quyết'}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                prereq.eligibleForCheckIn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {prereq.eligibleForCheckIn ? 'SẴN SÀNG BÀN GIAO' : 'CHỜ BỔ SUNG'}
              </span>
            </div>

            {/* 4 Prerequisites Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Điều kiện 1: Đủ tiền cọc */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-blue-600">savings</span>
                      1. Tiền đặt cọc giữ chỗ
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      prereq.depositSatisfied ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {prereq.depositSatisfied ? 'Đã thu đủ' : 'Chưa đủ'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Đã nộp:</span>
                      <strong className="font-mono text-slate-900">{(prereq.depositPaid || 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Yêu cầu:</span>
                      <span className="font-mono text-slate-500">{(prereq.requiredDeposit || 0).toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Điều kiện 2: Đủ tiền thuê tháng đầu */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-cyan-600">calendar_month</span>
                      2. Tiền thuê tháng đầu
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      prereq.firstMonthRentSatisfied ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {prereq.firstMonthRentSatisfied ? 'Đã thu đủ' : 'Chưa đóng'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Đã nộp:</span>
                      <strong className="font-mono text-slate-900">{(prereq.firstMonthRentPaid || 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Yêu cầu:</span>
                      <span className="font-mono text-slate-500">{(prereq.requiredFirstMonthRent || 0).toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Điều kiện 3: Hợp đồng điện tử */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-purple-600">history_edu</span>
                      3. Hợp đồng điện tử
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      prereq.contractSigned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {prereq.contractSigned ? 'Đã ký xác thực điện tử' : 'Chưa ký xác nhận'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Mã HĐ:</span>
                      <strong className="font-mono text-slate-900">{prereq.contractCode || 'Chưa tạo'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Trạng thái:</span>
                      <span className="font-mono text-slate-500">{prereq.contractStatus || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Điều kiện 4: Đối soát CCCD */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-teal-600">badge</span>
                      4. Đối soát CCCD gốc
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      prereq.identityVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {prereq.identityVerified ? 'Đã xác minh' : 'Chờ kiểm tra quầy'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Số giấy tờ:</span>
                      <strong className="font-mono text-slate-900">{prereq.idCardNumber || 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Thực hiện tại:</span>
                      <span className="text-slate-500">Quầy tiếp đón cơ sở</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Missing items list if any */}
            {prereq.missingPrerequisites && prereq.missingPrerequisites.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <span className="font-bold block mb-1">Các hạng mục cần bổ sung trước khi bàn giao:</span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {prereq.missingPrerequisites.map((m: string, idx: number) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Scope separation notice */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0 mt-0.5">policy</span>
              <div>
                <strong>Quy định phân quyền:</strong> Đây là chế độ xem hồ sơ giám sát của <strong>Quản lý cơ sở</strong>. Các thao tác tiếp đón khách, đối soát CCCD, nghiệm thu 5 hạng mục hiện trường và phát hành mã PIN bàn giao được thực hiện trực tiếp bởi <strong>Nhân viên quầy (Facility Staff)</strong> tại Bàn Vận Hành Quầy &amp; Tiếp Đón.
              </div>
            </div>

          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Đóng bảng giám sát
          </button>
        </div>

      </div>
    </div>
  )
}
