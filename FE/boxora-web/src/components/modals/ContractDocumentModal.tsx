import React from 'react'
import { RentalContract } from '../../types'

interface ContractDocumentModalProps {
  contract: RentalContract | null
  onClose: () => void
  onSignNow?: (contract: RentalContract) => void
  isSigning?: boolean
}

export const ContractDocumentModal: React.FC<ContractDocumentModalProps> = ({
  contract,
  onClose,
  onSignNow,
  isSigning = false,
}) => {
  if (!contract) return null

  const isPendingSignature = contract.status === 'PENDING_SIGNATURE'
  const isActive = contract.status === 'ACTIVE'

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Top Bar - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-[20px]">description</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-400">#{contract.contractCode}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isPendingSignature
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {isActive ? 'ĐANG HIỆU LỰC (ACTIVE)' : isPendingSignature ? 'CHỜ KÝ SỐ (PENDING)' : contract.status}
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-100">
                Văn Bản Hợp Đồng Thuê Kho Tự Quản Thông Minh
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="In hoặc lưu PDF"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span className="hidden sm:inline">In Hợp Đồng</span>
            </button>

            {isPendingSignature && onSignNow && (
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

        {/* Contract Content - Formatted as Legal Document */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 text-slate-800 font-serif leading-relaxed print:p-0 print:overflow-visible">
          
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
                Số HĐ: {contract.contractCode} &bull; Hệ thống mã hóa Boxora Cloud
              </div>
            </div>
          </div>

          {/* Legal preamble */}
          <div className="my-6 text-xs text-slate-600 italic">
            Căn cứ Bộ luật Dân sự số 91/2015/QH13 và Luật Giao dịch Điện tử số 20/2023/QH15 của Quốc hội Nước CHXHCN Việt Nam;
            Hôm nay, các bên tham gia giao kết hợp đồng dịch vụ lưu trữ tự quản thông minh gồm có:
          </div>

          {/* Party A & Party B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 p-4 bg-slate-50 rounded-xl border border-slate-200 font-sans text-xs print:bg-white print:border-slate-300">
            {/* Party A */}
            <div className="space-y-1.5">
              <div className="font-bold text-blue-900 uppercase tracking-wide border-b border-slate-200 pb-1">
                BÊN CHO THUÊ (BÊN A)
              </div>
              <div className="font-bold text-slate-900 text-sm">CÔNG TY CỔ PHẦN DỊCH VỤ LƯU TRỮ BOXORA</div>
              <div><strong>Cơ sở chi nhánh:</strong> {contract.facilityName || 'Boxora Facility'}</div>
              <div><strong>Đại diện pháp lý:</strong> Giám Đốc Chi Nhánh / Quản Lý Cơ Sở</div>
              <div><strong>Mã số doanh nghiệp:</strong> 0317892345 &bull; Cấp bởi Sở KH&amp;ĐT TP.HCM</div>
              <div><strong>Hotline an ninh 24/7:</strong> 1900 6868 &bull; <strong>Email:</strong> support@boxora.vn</div>
            </div>

            {/* Party B */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
                BÊN THUÊ KHO (BÊN B)
              </div>
              <div className="font-bold text-slate-900 text-sm">{contract.customerName || 'Khách hàng Boxora'}</div>
              <div><strong>Email định danh:</strong> {contract.customerEmail}</div>
              <div><strong>Số điện thoại:</strong> {contract.customerPhone || '0901 234 567'}</div>
              <div><strong>Mã khách hàng:</strong> {contract.customerId ? `KH-${contract.customerId.slice(0, 8).toUpperCase()}` : 'CUST-VERIFIED'}</div>
              <div><strong>Tài khoản hệ thống:</strong> Đã xác thực CCCD/E-KYC số trên Boxora Portal</div>
            </div>
          </div>

          {/* Terms Articles */}
          <div className="space-y-6 text-xs text-slate-800">
            {/* Article 1 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">1</span>
                Điều 1: ĐỐI TƯỢNG VÀ MỤC ĐÍCH THUÊ
              </h4>
              <p className="text-justify leading-relaxed pl-7">
                1.1. Bên A đồng ý cho Bên B thuê và Bên B đồng ý thuê vị trí ô kho lưu trữ cá nhân tự quản thông minh có mã số định danh <strong>#{contract.unitCode}</strong> đặt tại cơ sở <strong>{contract.facilityName}</strong>.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                1.2. Ô kho được trang bị hệ thống khóa thông minh Smart Lock điều khiển điện tử kết nối máy chủ Boxora Cloud, tích hợp cảm biến an toàn, giám sát phòng cháy chữa cháy và camera an ninh phân khu 24/7.
              </p>
            </div>

            {/* Article 2 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">2</span>
                Điều 2: THỜI HẠN THUÊ KHO
              </h4>
              <p className="text-justify leading-relaxed pl-7">
                2.1. Thời hạn thuê tính từ ngày <strong>{contract.startDate}</strong> đến hết ngày <strong>{contract.endDate}</strong>.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                2.2. Hợp đồng có thể được gia hạn tự động hoặc gia hạn chủ động theo chu kỳ trên Boxora Portal khi Bên B hoàn thành việc đóng phí thuê kỳ mới.
              </p>
            </div>

            {/* Article 3 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">3</span>
                Điều 3: GIÁ THUÊ, TIỀN KÝ QUỸ ĐẶT CỌC VÀ THANH TOÁN
              </h4>
              <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-3 my-2 font-sans">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Đơn giá thuê hàng tháng:</span>
                  <strong className="text-blue-700 text-sm font-mono">
                    {Number(contract.monthlyFee || 0).toLocaleString('vi-VN')} ₫ / tháng
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Tiền đặt cọc lưu ký bảo chứng:</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {Number(contract.depositHeld || 0).toLocaleString('vi-VN')} ₫
                  </strong>
                </div>
              </div>
              <p className="text-justify leading-relaxed pl-7">
                3.1. Tiền đặt cọc được lưu ký an toàn tại tài khoản bảo chứng Boxora Cloud và được hoàn trả cho Bên B sau khi thanh lý hợp đồng và nghiệm thu hoàn trả kho nguyên trạng.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                3.2. Phương thức thanh toán: Cổng thanh toán trực tuyến VNPay Sandbox / Thẻ thanh toán quốc tế / Chuyển khoản QR Napas.
              </p>
            </div>

            {/* Article 4 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">4</span>
                Điều 4: PHƯƠNG THỨC KÝ KẾT VĂN BẢN &amp; XÁC THỰC DOCUSEAL
              </h4>
              <p className="text-justify leading-relaxed pl-7">
                4.1. Hợp đồng này được tạo lập và ký kết bằng hình thức điện tử thông qua hạ tầng DocuSeal e-Signature Verification theo tiêu chuẩn mã hóa PKI SHA-256 hoặc ký trực tiếp tại quầy tiếp đón cơ sở.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                4.2. Chữ ký số và con dấu điện tử được chứng thực số liệu toàn vẹn trên hệ thống Boxora Cloud, có đầy đủ giá trị pháp lý ràng buộc quyền và nghĩa vụ của hai bên.
              </p>
            </div>

            {/* Article 5 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">5</span>
                Điều 5: QUYỀN RA VÀO VÀ NGHĨA VỤ BẢO VỆ TÀI SẢN
              </h4>
              <p className="text-justify leading-relaxed pl-7">
                5.1. Bên B được cấp quyền ra vào phân khu kho 24/7 thông qua mã PIN bảo mật cá nhân hoặc mã QR Access Token do Boxora sinh tự động trên ứng dụng.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                5.2. Nghiêm cấm lưu trữ chất cháy nổ, vũ khí, chất độc hại, động vật sống hoặc hàng cấm theo quy định của pháp luật Việt Nam.
              </p>
            </div>
          </div>

          {/* Signatures & Seal Section */}
          <div className="mt-12 pt-8 border-t border-slate-300 font-sans">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              
              {/* Representative Party A */}
              <div className="flex flex-col items-center">
                <span className="font-bold uppercase text-slate-900">ĐẠI DIỆN BÊN CHO THUÊ (BÊN A)</span>
                <span className="text-[11px] text-slate-500 italic mt-0.5">Ký tên, đóng dấu điện tử</span>

                {/* Digital Stamp of Boxora */}
                <div className="my-4 relative w-36 h-36 rounded-full border-4 border-dashed border-red-600 flex flex-col items-center justify-center text-red-600 p-2 shadow-inner select-none rotate-[-6deg]">
                  <div className="w-full text-center text-[8px] font-black uppercase tracking-tighter">
                    CÔNG TY CP BOXORA
                  </div>
                  <div className="material-symbols-outlined text-2xl my-0.5">verified_user</div>
                  <div className="text-[9px] font-extrabold uppercase">DOCUSEAL VERIFIED</div>
                  <div className="text-[7px] font-mono tracking-widest text-red-500">PKI #SHA256</div>
                  <div className="text-[7px] text-red-700 font-bold mt-0.5">BOXORA CLOUD</div>
                </div>

                <span className="font-bold text-slate-900">BOXORA FACILITY AUTHORITY</span>
                <span className="text-[10px] text-slate-500 font-mono">Đã chứng thực điện tử</span>
              </div>

              {/* Representative Party B */}
              <div className="flex flex-col items-center">
                <span className="font-bold uppercase text-slate-900">ĐẠI DIỆN BÊN THUÊ KHO (BÊN B)</span>
                <span className="text-[11px] text-slate-500 italic mt-0.5">Khách hàng xác thực chữ ký</span>

                {isActive ? (
                  <div className="my-4 w-48 h-36 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-3">
                    <span className="font-serif italic text-2xl text-blue-900 select-none">
                      {contract.customerName || 'Customer Signature'}
                    </span>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600 font-bold font-sans">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>Ký số DocuSeal thành công</span>
                    </div>
                    {contract.signedAt && (
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {new Date(contract.signedAt).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>
                ) : isPendingSignature ? (
                  <div className="my-4 w-48 h-36 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 flex flex-col items-center justify-center p-3 text-center">
                    <span className="material-symbols-outlined text-3xl text-amber-500 mb-1">draw</span>
                    <span className="text-[11px] font-bold text-amber-900">Chờ Quý khách ký số</span>
                    <span className="text-[9px] text-amber-700 mt-0.5">Nhấp nút &ldquo;Ký Ngay&rdquo; để hoàn tất</span>
                    {onSignNow && (
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
                ) : (
                  <div className="my-4 w-48 h-36 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-3 text-slate-400 text-xs">
                    {contract.status}
                  </div>
                )}

                <span className="font-bold text-slate-900">{contract.customerName || 'Khách hàng'}</span>
                <span className="text-[10px] text-slate-500 font-mono">{contract.customerEmail}</span>
              </div>
            </div>
<<<<<<< Updated upstream
          </div>
=======
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
                    1.1. Bên A đồng ý cho Bên B thuê ô không gian tự quản thông minh{' '}
                    {contract.unitCode ? <>mã số <strong className="font-mono text-blue-700">#{contract.unitCode}</strong></> : 'với vị trí kho được xác nhận khi khách hàng nhận kho'} tại cơ sở{' '}
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
>>>>>>> Stashed changes

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center font-sans text-[10px] text-slate-400">
            Bản hợp đồng số #{contract.contractCode} được số hóa và lưu trữ bảo mật trên hạ tầng Boxora Cloud. Chứng thư DocuSeal PKI.
          </div>
        </div>

        {/* Modal Bottom Bar - Hidden when printing */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="material-symbols-outlined text-[18px] text-blue-600">verified</span>
            <span>Hợp đồng được lưu trữ an toàn trên máy chủ đám mây Boxora.</span>
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

            {isPendingSignature && onSignNow && (
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
