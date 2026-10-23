import React, { useState } from 'react'
import { Booking, RentalContract } from '../../types'

interface ContractDocumentModalProps {
  contract: RentalContract | null
  booking?: Booking | null
  onClose: () => void
  onSignNow?: (contract?: any) => void
  isSigning?: boolean
}

export const ContractDocumentModal: React.FC<ContractDocumentModalProps> = ({
  contract,
  booking,
  onClose,
  onSignNow,
  isSigning = false,
}) => {
  if (!contract) return null

  const isPaperContract = Boolean(contract.paperContractUrl || contract.signingMethod === 'IN_PERSON')
  const [activeViewTab, setActiveViewTab] = useState<'scan' | 'terms'>(isPaperContract && contract.paperContractUrl ? 'scan' : 'terms')
  const [imageError, setImageError] = useState<boolean>(false)

  const isPendingSignature = contract.status === 'PENDING_SIGNATURE'
  const isPendingActivation = contract.status === 'PENDING_ACTIVATION'
  const isActive = contract.status === 'ACTIVE'
  const isSigned = Boolean(contract.signedAt || contract.paperVerifiedAt || contract.paperContractUrl)

  const isBookingPaid = booking
    ? (booking.paymentStatus === 'PAID' || (booking.depositPaid && Number(booking.depositPaid) > 0))
    : (contract.depositHeld && Number(contract.depositHeld) > 0)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Top Bar - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isPaperContract
                ? 'bg-teal-500/20 border border-teal-500/40 text-teal-400'
                : 'bg-blue-600/30 border border-blue-500/40 text-blue-400'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {isPaperContract ? 'document_scanner' : 'description'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${isPaperContract ? 'text-teal-400' : 'text-blue-400'}`}>
                  #{contract.contractCode}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isPaperContract
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isPendingActivation
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : isPendingSignature
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {isPaperContract
                    ? 'HỢP ĐỒNG GIẤY TIẾP NHẬN TẠI CƠ SỞ'
                    : isActive
                    ? 'ĐANG HIỆU LỰC (ACTIVE)'
                    : isPendingActivation
                    ? isSigned ? 'ĐÃ KÝ • CHỜ KÍCH HOẠT NHẬN KHO' : 'CHỜ XÁC MINH CHỮ KÝ'
                    : isPendingSignature
                    ? 'CHỜ KÝ SỐ (PENDING)'
                    : contract.status}
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-100">
                {isPaperContract
                  ? 'Hồ Sơ Hợp Đồng Thuê Kho Ký Trực Tiếp Tại Cơ Sở'
                  : 'Văn Bản Hợp Đồng Thuê Kho Tự Quản Thông Minh'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher for paper contracts */}
            {isPaperContract && contract.paperContractUrl && (
              <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 mr-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveViewTab('scan')}
                  className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    activeViewTab === 'scan' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">image</span>
                  <span>Bản Scan Gốc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab('terms')}
                  className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    activeViewTab === 'terms' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">article</span>
                  <span>Điều Khoản Văn Bản</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="In hoặc lưu PDF"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span className="hidden sm:inline">In Hợp Đồng</span>
            </button>

            {/* Ký ngay chỉ hiển thị cho HỢP ĐỒNG ĐIỆN TỬ khi ĐÃ THANH TOÁN */}
            {!isPaperContract && isPendingSignature && onSignNow && isBookingPaid && (
              <button
                type="button"
                onClick={() => onSignNow(contract)}
                disabled={isSigning}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer animate-pulse"
              >
                <span className="material-symbols-outlined text-[16px]">edit_document</span>
                <span>{isSigning ? 'Đang chuẩn bị ký...' : 'Ký Ngay'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-slate-800 leading-relaxed print:p-0 print:overflow-visible">
          
          {/* A. PAPER CONTRACT VIEW (HIỂN THỊ HÌNH ẢNH SCAN ĐÃ ĐƯỢC TIẾP NHẬN TẠI QUẦY) */}
          {isPaperContract && activeViewTab === 'scan' ? (
            <div className="space-y-6">
              {/* Paper verification summary card */}
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50/50 border border-teal-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[22px]">verified</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-teal-950 font-sans">
                        Hồ Sơ Hợp Đồng Giấy Đã Tiếp Nhận &amp; Đối Chiếu Tại Cơ Sở
                      </h3>
                      <p className="text-xs text-teal-700 mt-0.5">
                        Bản số hóa scan hợp đồng có chữ ký tay trực tiếp được nhân viên quầy tiếp nhận và lưu trữ vào hệ thống Boxora Cloud.
                      </p>
                    </div>
                  </div>
                  {contract.paperContractUrl && (
                    <a
                      href={contract.paperContractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs w-fit"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Mở Ảnh Gốc</span>
                    </a>
                  )}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3.5 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Cơ sở tiếp nhận:</span>
                    <strong className="text-slate-900 font-semibold">{contract.facilityName || 'Boxora Facility'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Nhân viên tiếp nhận:</span>
                    <strong className="text-teal-900 font-semibold">
                      {contract.paperVerifiedByName || 'Ban Quản Lý Cơ Sở Boxora'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Thời gian tiếp nhận:</span>
                    <strong className="text-slate-900 font-mono">
                      {contract.paperVerifiedAt
                        ? new Date(contract.paperVerifiedAt).toLocaleString('vi-VN')
                        : contract.signedAt
                        ? new Date(contract.signedAt).toLocaleString('vi-VN')
                        : 'Đã xác minh khi check-in'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Vị trí lưu trữ bản gốc:</span>
                    <strong className="text-slate-900 font-semibold">
                      {contract.paperOriginalLocation || 'Tủ hồ sơ hợp đồng cơ sở Boxora'}
                    </strong>
                  </div>
                </div>

                {contract.paperNotes && (
                  <div className="mt-3 pt-3 border-t border-teal-100 text-xs flex items-center gap-1.5 text-teal-800">
                    <span className="material-symbols-outlined text-[15px] shrink-0">info</span>
                    <span><strong>Ghi chú:</strong> {contract.paperNotes}</span>
                  </div>
                )}
              </div>

              {/* Scanned Image Display */}
              <div className="bg-slate-100/80 rounded-2xl p-4 sm:p-6 border border-slate-200 flex flex-col items-center justify-center min-h-[420px]">
                {contract.paperContractUrl && !imageError ? (
                  <div className="relative max-w-full flex flex-col items-center">
                    <img
                      src={contract.paperContractUrl}
                      alt={`Bản scan hợp đồng #${contract.contractCode}`}
                      onError={() => setImageError(true)}
                      className="max-h-[750px] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-200 bg-white"
                    />
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 font-sans">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-teal-600">verified_user</span>
                        <span>Dấu mộc và chữ ký hợp lệ đã được xác thực</span>
                      </span>
                      <span>&bull;</span>
                      <a
                        href={contract.paperContractUrl}
                        download={`Hop-Dong-${contract.contractCode}.png`}
                        className="text-teal-700 hover:text-teal-800 font-semibold underline flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        <span>Tải file ảnh</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 px-4 max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-[32px]">inventory_2</span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1 font-sans">
                      Hợp Đồng Giấy Đang Lưu Trữ Tại Cơ Sở
                    </h4>
                    <p className="text-xs text-slate-500 mb-4 font-sans leading-relaxed">
                      Bản hợp đồng giấy gốc đã được ký và bàn giao trong quá trình check-in nhận kho. Quý khách có thể xem điều khoản chi tiết bằng cách chuyển qua tab bên dưới.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveViewTab('terms')}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Xem Điều Khoản Văn Bản Pháp Lý
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* B. STANDARD LEGAL DOCUMENT TEXT TERMS */
            <div className="font-serif">
              {/* Header Quốc Hiệu */}
              <div className="text-center pb-6 border-b border-slate-300">
                <h3 className="font-bold text-xs uppercase tracking-widest text-slate-900 font-sans">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </h3>
                <p className="font-bold text-xs text-slate-800 mt-1 font-sans">
                  Độc lập – Tự do – Hạnh phúc
                </p>
                <div className="w-32 h-[1px] bg-slate-400 mx-auto mt-2"></div>

                <div className="mt-8 mb-2">
                  <h1 className="font-bold text-xl sm:text-2xl text-slate-900 uppercase font-sans tracking-tight">
                    HỢP ĐỒNG THUÊ KHO TỰ QUẢN THÔNG MINH
                  </h1>
                  <p className="font-sans text-xs text-slate-500 mt-1">
                    (SMART SELF-STORAGE LEASE CONTRACT &bull; BOXORA CLOUD)
                  </p>
                  <div className="inline-block mt-3 px-3 py-1 bg-slate-100 rounded-md font-mono text-xs font-bold text-slate-700">
                    Số HĐ: {contract.contractCode} &bull; Hệ thống Boxora Cloud
                  </div>
                  {booking && (
                    <div className="mt-2 text-xs text-slate-600 font-sans">
                      Mã đặt thuê: <strong className="font-mono">{booking.bookingCode}</strong>
                      {' · '}Kỳ hạn: <strong>{booking.rentalMonths} tháng</strong>
                      {' · '}Tiền thuê kỳ hạn: <strong>{Number(booking.totalRentalFee || 0).toLocaleString('vi-VN')} ₫</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Legal intro */}
              <div className="py-5 text-xs text-slate-700 italic border-b border-slate-200">
                Hôm nay, ngày {new Date(contract.startDate || Date.now()).toLocaleDateString('vi-VN')}, tại cơ sở hệ thống Boxora Smart Storage, các bên tham gia giao kết Hợp đồng bao gồm:
              </div>

              {/* Parties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
                {/* Party A */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 font-sans">
                  <div className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-mono">A</span>
                    <span>BÊN CHO THUÊ (BÊN A)</span>
                  </div>
                  <div className="space-y-1.5 text-slate-700">
                    <div><strong>Công ty:</strong> CÔNG TY CỔ PHẦN BOXORA VIỆT NAM</div>
                    <div><strong>Cơ sở trực thuộc:</strong> {contract.facilityName || 'Boxora Mega Hub'}</div>
                    <div><strong>Đại diện:</strong> Ông / Bà Quản Lý Cơ Sở Boxora</div>
                    <div><strong>Hotline hỗ trợ:</strong> 1900-6868 (24/7)</div>
                    <div><strong>Hạ tầng IoT:</strong> Khóa điện tử SmartLock, cảm biến nhiệt độ &amp; độ ẩm đa lớp</div>
                  </div>
                </div>

                {/* Party B */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 font-sans">
                  <div className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">B</span>
                    <span>BÊN THUÊ KHO (BÊN B)</span>
                  </div>
                  <div className="space-y-1.5 text-slate-700">
                    <div><strong>Họ và tên:</strong> {contract.customerName || 'Khách hàng Boxora'}</div>
                    <div><strong>Email:</strong> {contract.customerEmail}</div>
                    <div><strong>Số điện thoại:</strong> {contract.customerPhone || 'Chưa cập nhật'}</div>
                    <div>
                      <strong>Số CCCD / Passport:</strong>{' '}
                      <span className="font-mono">{contract.identityCardNumber || 'Đã đối chiếu tại quầy'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contract Articles */}
              <div className="py-6 space-y-6 text-xs text-slate-800 leading-relaxed font-sans">
                {/* Article 1 */}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 mb-2">
                    ĐIỀU 1: ĐỐI TƯỢNG VÀ THỜI HẠN THUÊ KHO
                  </h4>
                  <p className="mb-2">
                    1.1. Bên A đồng ý cho Bên B thuê ô không gian tự quản thông minh mã số{' '}
                    <strong className="font-mono text-blue-700">#{contract.unitCode}</strong> tại cơ sở{' '}
                    <strong>{contract.facilityName}</strong>.
                  </p>
                  <p className="mb-2">
                    1.2. Thời hạn thuê tính từ ngày <strong>{contract.startDate}</strong> đến hết ngày{' '}
                    <strong>{contract.endDate}</strong>.
                  </p>
                </div>

                {/* Article 2 */}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 mb-2">
                    ĐIỀU 2: CƯỚC PHÍ VÀ TIỀN KÝ QUỸ (TIỀN CỌC)
                  </h4>
                  <p className="mb-2">
                    2.1. Cước thuê hàng tháng: <strong>{Number(contract.monthlyFee || 0).toLocaleString('vi-VN')} ₫ / tháng</strong> (đã bao gồm VAT và chi phí quản lý vận hành IoT).
                  </p>
                  <p className="mb-2">
                    2.2. Tiền ký quỹ bảo đảm thực hiện hợp đồng (tiền cọc):{' '}
                    <strong>{Number(contract.depositHeld || 0).toLocaleString('vi-VN')} ₫</strong>. Khoản cọc này được hoàn trả cho Bên B sau khi thanh lý hợp đồng và bàn giao kho nguyên trạng.
                  </p>
                </div>

                {/* Signatures Footer */}
                <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center font-sans">
                  <div>
                    <h5 className="font-bold text-xs uppercase text-slate-900">ĐẠI DIỆN BÊN CHO THUÊ (BÊN A)</h5>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">(Ký, đóng dấu số hóa)</p>
                    <div className="my-4 h-24 flex items-center justify-center">
                      <div className="w-32 h-16 border border-emerald-500/40 bg-emerald-50/40 rounded-lg flex flex-col items-center justify-center text-emerald-700 text-[10px] font-bold">
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span>BOXORA SMARTLOCK</span>
                        <span className="text-[8px] font-mono text-emerald-600">ĐÃ KÝ ĐIỆN TỬ</span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900">CÔNG TY CP BOXORA</span>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs uppercase text-slate-900">ĐẠI DIỆN BÊN THUÊ KHO (BÊN B)</h5>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      {isPaperContract ? '(Ký tay trực tiếp trên hợp đồng giấy)' : '(Ký số điện tử)'}
                    </p>

                    <div className="my-4 min-h-[96px] flex items-center justify-center">
                      {isPaperContract ? (
                        <div className="w-48 py-3 px-2 rounded-xl border border-teal-300 bg-teal-50/70 flex flex-col items-center justify-center text-center">
                          <span className="material-symbols-outlined text-2xl text-teal-600 mb-1">draw</span>
                          <span className="text-[11px] font-bold text-teal-900">ĐÃ KÝ BẢN GIẤY TẠI CƠ SỞ</span>
                          <span className="text-[9px] text-teal-700 mt-0.5">
                            {contract.paperVerifiedByName ? `Đối chiếu bởi: ${contract.paperVerifiedByName}` : 'Tiếp nhận & đối chiếu CCCD'}
                          </span>
                        </div>
                      ) : isSigned ? (
                        <div className="w-48 py-2 px-2 rounded-xl border border-emerald-300 bg-emerald-50/70 flex flex-col items-center justify-center text-center">
                          <span className="material-symbols-outlined text-2xl text-emerald-600 mb-1">verified</span>
                          <span className="text-[11px] font-bold text-emerald-900">CHỮ KÝ ĐIỆN TỬ HỢP LỆ</span>
                          {contract.signedAt && (
                            <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {new Date(contract.signedAt).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-48 py-3 px-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 flex flex-col items-center justify-center text-center">
                          <span className="material-symbols-outlined text-2xl text-amber-500 mb-1">draw</span>
                          <span className="text-[11px] font-bold text-amber-900">Chờ Quý khách ký số</span>
                          {onSignNow && isBookingPaid && (
                            <button
                              type="button"
                              onClick={() => onSignNow(contract)}
                              disabled={isSigning}
                              className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span className="material-symbols-outlined text-[12px]">edit</span>
                              <span>{isSigning ? 'Đang mở...' : 'Ký Ngay'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <span className="font-bold text-slate-900">{contract.customerName || 'Khách hàng'}</span>
                    <span className="text-[10px] text-slate-500 font-mono block">{contract.customerEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center font-sans text-[10px] text-slate-400">
            Bản hợp đồng số #{contract.contractCode} được số hóa và bảo mật trên hạ tầng Boxora Cloud.
          </div>
        </div>

        {/* Modal Bottom Bar - Hidden when printing */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="material-symbols-outlined text-[18px] text-teal-600">verified</span>
            <span>
              {isPaperContract
                ? 'Hợp đồng giấy đã được BQL cơ sở tiếp nhận và lưu trữ an toàn.'
                : 'Hợp đồng được lưu trữ an toàn trên máy chủ đám mây Boxora.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>In Hợp Đồng</span>
            </button>

            {!isPaperContract && isPendingSignature && onSignNow && isBookingPaid && (
              <button
                type="button"
                onClick={() => onSignNow(contract)}
                disabled={isSigning}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
              >
                <span className="material-symbols-outlined text-[16px]">edit_document</span>
                <span>{isSigning ? 'Đang chuẩn bị...' : 'Ký Ngay'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
