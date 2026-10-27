import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { handoverService, HandoverPrerequisites } from '../../../services/handoverService'
import { bookingService } from '../../../services/bookingService'
import { Booking } from '../../../types'
import { toast } from '../../../utils/toast'

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
  const { role } = useAuth()
  const isAdmin = role === 'ADMIN'
  const [loading, setLoading] = useState<boolean>(true)
  const [prereq, setPrereq] = useState<HandoverPrerequisites | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState<boolean>(false)
  const [uploadedProofUrl, setUploadedProofUrl] = useState<string | null>(null)
  const [openingDocUrl, setOpeningDocUrl] = useState<string | null>(null)
  const [proofMessage, setProofMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setPrereq(null)
      setBooking(null)
      setError(null)
      setUploadedProofUrl(null)
      setProofMessage(null)
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

  const activeBookingId = bookingId || booking?.id || prereq?.bookingId

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!activeBookingId) {
      setProofMessage('Không tìm thấy mã đặt chỗ để tải ảnh.')
      return
    }
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setProofMessage('Dung lượng tệp vượt quá giới hạn 10MB.')
      return
    }

    setUploadingProof(true)
    setProofMessage(null)
    try {
      const res = await handoverService.uploadHandoverDocument(activeBookingId, file, 'PAYMENT_PROOF')
      if (res?.fileUrl) {
        setUploadedProofUrl(res.fileUrl)
        setProofMessage('Đã tải lên ảnh chuyển khoản thành công!')
        const fresh = await handoverService.getCheckInPrerequisites(activeBookingId)
        setPrereq(fresh)
      }
    } catch (err: any) {
      setProofMessage(err?.response?.data?.message || err?.message || 'Lỗi khi tải ảnh chuyển khoản lên hệ thống.')
    } finally {
      setUploadingProof(false)
      e.target.value = ''
    }
  }

  const handleOpenDoc = async (url: string) => {
    if (!activeBookingId || !url) return
    setOpeningDocUrl(url)
    try {
      const blobUrl = await handoverService.viewAuthorizedDocument(activeBookingId, url)
      window.open(blobUrl, '_blank')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể xem tài liệu đối soát.')
    } finally {
      setOpeningDocUrl(null)
    }
  }

  if (!isOpen) return null

  const isDepositMet = prereq ? prereq.depositSatisfied : false
  const isRentMet = prereq ? prereq.firstMonthRentSatisfied : false
  const isPaymentMet = isDepositMet && isRentMet

  const totalRequired = ((prereq?.requiredDeposit || 0) + (prereq?.requiredFirstMonthRent || 0))
  const totalPaid = ((prereq?.depositPaid || 0) + (prereq?.firstMonthRentPaid || 0))
  const totalRemaining = ((prereq?.depositRemaining || 0) + (prereq?.firstMonthRentRemaining || 0))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px] text-blue-600">visibility</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline text-base font-bold text-slate-900">
                  Hồ Sơ Đặt Kho &amp; Đối Soát 3 Điều Kiện Bàn Giao
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
            <span className="text-xs text-slate-500 font-medium">Đang tải đối soát 3 điều kiện tiên quyết...</span>
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
                    ? 'Đơn đặt kho đã đủ 3 điều kiện sẵn sàng bàn giao thực địa' 
                    : 'Đơn đặt kho chưa hoàn tất đủ 3 điều kiện tiên quyết'}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                prereq.eligibleForCheckIn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {prereq.eligibleForCheckIn ? 'SẴN SÀNG BÀN GIAO' : 'CHỜ BỔ SUNG'}
              </span>
            </div>

            {/* 3 Prerequisites Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              
              {/* Điều kiện 1: Hợp đồng thuê kho */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs mb-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                      <span className="material-symbols-outlined text-[16px] text-purple-600 shrink-0">history_edu</span>
                      <span>1. Hợp đồng thuê kho</span>
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 whitespace-nowrap ${
                      prereq.contractSigned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {prereq.contractSigned ? 'Đã ký hợp lệ' : 'Chưa ký xác nhận'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Mã HĐ:</span>
                      <strong className="font-mono text-slate-900 ml-auto text-right break-all sm:break-normal">{prereq.contractCode || 'Chưa tạo'}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Phương thức:</span>
                      <span className="font-medium text-slate-700 ml-auto text-right whitespace-nowrap">
                        {prereq.contractSigningMethod === 'PAPER' ? '🏢 Ký Giấy Tại Quầy' : '✍️ Ký Điện Tử'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Trạng thái:</span>
                      <span className="font-mono text-slate-500 ml-auto text-right">{prereq.contractStatus || 'N/A'}</span>
                    </div>
                    {prereq.paperContractUrl && (
                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-slate-500 text-[11px] shrink-0 whitespace-nowrap">Bản scan:</span>
                        <button
                          type="button"
                          onClick={() => handleOpenDoc(prereq.paperContractUrl!)}
                          disabled={openingDocUrl === prereq.paperContractUrl}
                          className="text-cyan-700 hover:text-cyan-800 font-bold text-[11px] inline-flex items-center gap-0.5 cursor-pointer ml-auto shrink-0"
                        >
                          <span className="material-symbols-outlined text-[13px]">attachment</span>
                          <span>{openingDocUrl === prereq.paperContractUrl ? '...' : 'Xem scan'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Điều kiện 2: Bằng chứng chuyển khoản toàn bộ tiền cọc & thuê trong toàn bộ thời hạn */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs mb-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                      <span className="material-symbols-outlined text-[16px] text-cyan-600 shrink-0">payments</span>
                      <span>2. Chuyển khoản cọc &amp; thuê</span>
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 whitespace-nowrap ${
                      isPaymentMet ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isPaymentMet ? 'Đã thu đủ' : 'Chưa đủ'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Tổng phải thu:</span>
                      <strong className="font-mono text-slate-900 ml-auto whitespace-nowrap">{totalRequired.toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Đã nộp:</span>
                      <strong className="font-mono text-emerald-700 ml-auto whitespace-nowrap">{totalPaid.toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Còn thiếu:</span>
                      <strong className={`font-mono ml-auto whitespace-nowrap ${totalRemaining > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {totalRemaining.toLocaleString('vi-VN')} đ
                      </strong>
                    </div>
                    <div className="pt-1.5 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="shrink-0 whitespace-nowrap">• Tiền cọc:</span>
                        <span className="font-mono font-medium ml-auto whitespace-nowrap">{(prereq.depositPaid || 0).toLocaleString('vi-VN')}đ / {(prereq.requiredDeposit || 0).toLocaleString('vi-VN')}đ {isDepositMet ? '✓' : ''}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="shrink-0 whitespace-nowrap">• Tiền thuê toàn hạn:</span>
                        <span className="font-mono font-medium ml-auto whitespace-nowrap">{(prereq.firstMonthRentPaid || 0).toLocaleString('vi-VN')}đ / {(prereq.requiredFirstMonthRent || 0).toLocaleString('vi-VN')}đ {isRentMet ? '✓' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Upload message if any */}
                  {proofMessage && (
                    <div className="mt-2 p-1.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[11px]">
                      {proofMessage}
                    </div>
                  )}

                  {/* Uploaded proof pill */}
                  {uploadedProofUrl && (
                    <div className="mt-2 p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0">Ảnh vừa tải lên:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(uploadedProofUrl)}
                        disabled={openingDocUrl === uploadedProofUrl}
                        className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] cursor-pointer ml-auto shrink-0"
                      >
                        {openingDocUrl === uploadedProofUrl ? '...' : 'Xem ảnh'}
                      </button>
                    </div>
                  )}

                  {/* Existing payment receipts */}
                  {prereq.paymentHistory && prereq.paymentHistory.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                      {prereq.paymentHistory.map((p) => (
                        <div key={p.id} className="p-1 rounded bg-slate-50 text-[10px] flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-700 whitespace-nowrap">
                            {p.paymentType === 'DEPOSIT' ? '[Cọc]' : '[Thuê]'} {p.amount.toLocaleString('vi-VN')}đ
                          </span>
                          <div className="flex items-center gap-1 ml-auto shrink-0">
                            {p.proofDocumentUrl && (
                              <button
                                type="button"
                                onClick={() => handleOpenDoc(p.proofDocumentUrl!)}
                                disabled={openingDocUrl === p.proofDocumentUrl}
                                className="px-1 py-0.2 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[9px] cursor-pointer"
                              >
                                {openingDocUrl === p.proofDocumentUrl ? '...' : 'Xem UNC'}
                              </button>
                            )}
                            <span className={`px-1 py-0.2 rounded font-bold text-[9px] whitespace-nowrap ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {p.status === 'PAID' ? 'Đã thu' : p.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload Button: Chế độ giám sát của Admin không được thực hiện thao tác upload */}
                {!isAdmin && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleUploadProof}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingProof}
                      className="w-full py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px] shrink-0">
                        {uploadingProof ? 'hourglass_top' : 'upload_file'}
                      </span>
                      <span className="truncate">{uploadingProof ? 'Đang Tải...' : 'Upload Ảnh Chuyển Khoản'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Điều kiện 3: Đối soát CCCD */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs mb-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                      <span className="material-symbols-outlined text-[16px] text-teal-600 shrink-0">badge</span>
                      <span>3. Đối soát CCCD gốc</span>
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 whitespace-nowrap ${
                      prereq.identityVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {prereq.identityVerified ? 'Đã xác minh' : 'Chờ kiểm tra quầy'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Số giấy tờ:</span>
                      <strong className="font-mono text-slate-900 ml-auto whitespace-nowrap">{prereq.idCardNumber || 'N/A'}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Loại thẻ:</span>
                      <span className="font-mono text-slate-700 ml-auto whitespace-nowrap">{prereq.idCardType || 'CCCD'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="shrink-0 whitespace-nowrap">Thực hiện tại:</span>
                      <span className="text-slate-500 ml-auto text-right">Quầy tiếp đón cơ sở</span>
                    </div>
                    {prereq.identityVerifiedByName && (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="shrink-0 whitespace-nowrap">Nhân viên:</span>
                        <span className="font-medium text-emerald-700 ml-auto text-right">{prereq.identityVerifiedByName}</span>
                      </div>
                    )}
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
                <strong>Quy định phân quyền:</strong> {isAdmin ? (
                  <span>Tài khoản <strong>Quản Trị Viên (Admin)</strong> đang theo dõi ở chế độ chỉ đọc giám sát toàn hệ thống. Mọi thao tác thu tiền, bổ sung chứng từ, kiểm tra CCCD và bàn giao kho thuộc thẩm quyền của Nhân viên quầy và Quản lý cơ sở.</span>
                ) : (
                  <span>Đây là chế độ xem hồ sơ giám sát của <strong>Quản lý cơ sở</strong>. Các thao tác tiếp đón khách, đối soát CCCD, nghiệm thu 5 hạng mục hiện trường và phát hành mã PIN bàn giao được thực hiện trực tiếp bởi <strong>Nhân viên quầy (Facility Staff)</strong> tại Bàn Vận Hành Quầy &amp; Tiếp Đón.</span>
                )}
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
