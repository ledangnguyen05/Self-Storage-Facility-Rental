import React from 'react'
import { ContractRenewal, RentalContract } from '../../types'

interface RenewalDocumentModalProps {
  renewal: ContractRenewal | null
  contract?: RentalContract | null
  onClose: () => void
  onViewOriginalContract?: () => void
}

function formatDate(val?: string) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return val
  }
}

export const RenewalDocumentModal: React.FC<RenewalDocumentModalProps> = ({
  renewal,
  contract,
  onClose,
  onViewOriginalContract,
}) => {
  if (!renewal) return null

  const handlePrint = () => {
    window.print()
  }

  const isCompleted = renewal.status === 'COMPLETED'
  const isPendingSignature = renewal.status === 'PENDING_SIGNATURE'
  const isPendingPayment = renewal.status === 'PENDING_PAYMENT'

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">

        {/* Modal Top Bar - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-400">
                  PLGH-{renewal.contractCode || renewal.id.slice(0, 8)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isPendingPayment
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : isPendingSignature
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {isCompleted
                    ? 'ĐÃ KÝ & THANH TOÁN (COMPLETED)'
                    : isPendingPayment
                    ? 'ĐÃ KÝ • CHỜ THANH TOÁN'
                    : isPendingSignature
                    ? 'CHỜ KÝ PHỤ LỤC'
                    : renewal.status}
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-100">
                Văn Bản Phụ Lục Gia Hạn Hợp Đồng Thuê Kho Tự Quản
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onViewOriginalContract && (
              <button
                type="button"
                onClick={onViewOriginalContract}
                className="px-3.5 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-500/40"
                title="Xem văn bản hợp đồng gốc ban đầu"
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                <span className="hidden sm:inline">Xem Hợp Đồng Gốc</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="In hoặc lưu PDF"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span className="hidden sm:inline">In Phụ Lục</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content - Formatted as Legal Document */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 text-slate-800 font-sans leading-relaxed print:p-0 print:overflow-visible">
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
                PHỤ LỤC GIA HẠN HỢP ĐỒNG THUÊ KHO TỰ QUẢN THÔNG MINH
              </h1>
              <p className="font-sans text-xs text-slate-500 mt-1">
                (ADDENDUM TO SMART SELF-STORAGE LEASE CONTRACT &bull; BOXORA CLOUD)
              </p>
              <div className="inline-block mt-3 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md font-mono text-xs font-bold text-blue-900">
                Số Phụ Lục: PLGH-{renewal.contractCode} &bull; Căn cứ Hợp đồng số: #{renewal.contractCode}
              </div>
            </div>
          </div>

          {/* Legal preamble */}
          <div className="my-6 text-xs text-slate-600 italic">
            Căn cứ Bộ luật Dân sự số 91/2015/QH13 và Luật Giao dịch Điện tử số 20/2023/QH15 của Quốc hội Nước CHXHCN Việt Nam;
            <br />
            Căn cứ Hợp đồng thuê kho tự quản thông minh số <strong>#{renewal.contractCode}</strong> đã ký kết giữa Bên Cho Thuê và Bên Thuê;
            <br />
            Hôm nay, các bên tiếp tục thỏa thuận và ký kết Phụ lục gia hạn hợp đồng thuê kho như sau:
          </div>

          {/* Party A & Party B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 p-4 bg-slate-50 rounded-xl border border-slate-200 font-sans text-xs print:bg-white print:border-slate-300">
            {/* Party A */}
            <div className="space-y-1.5">
              <div className="font-bold text-blue-900 uppercase tracking-wide border-b border-slate-200 pb-1">
                BÊN CHO THUÊ (BÊN A)
              </div>
              <div className="font-bold text-slate-900 text-sm">CÔNG TY CỔ PHẦN DỊCH VỤ LƯU TRỮ BOXORA</div>
              <div><strong>Cơ sở chi nhánh:</strong> {renewal.facilityName || contract?.facilityName || 'Boxora Facility'}</div>
              <div><strong>Đại diện pháp lý:</strong> Giám Đốc Chi Nhánh / Quản Lý Cơ Sở</div>
              <div><strong>Mã số doanh nghiệp:</strong> 0317892345 &bull; Cấp bởi Sở KH&amp;ĐT TP.HCM</div>
              <div><strong>Hotline an ninh 24/7:</strong> 1900 6868 &bull; <strong>Email:</strong> support@boxora.vn</div>
            </div>

            {/* Party B */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
                BÊN THUÊ KHO (BÊN B)
              </div>
              <div className="font-bold text-slate-900 text-sm">{renewal.customerName || contract?.customerName || 'Khách hàng Boxora'}</div>
              <div><strong>Email định danh:</strong> {renewal.customerEmail || contract?.customerEmail}</div>
              <div><strong>Số điện thoại:</strong> {contract?.customerPhone || '0901 234 567'}</div>
              <div><strong>Mã khách hàng:</strong> {renewal.customerId ? `KH-${renewal.customerId.slice(0, 8).toUpperCase()}` : 'CUST-VERIFIED'}</div>
              <div><strong>Kho đang thuê:</strong> <span className="font-mono font-semibold text-slate-900">#{renewal.unitCode}</span></div>
              <div><strong>Tài khoản hệ thống:</strong> Đã xác thực giao kết số trên Boxora Cloud Portal</div>
            </div>
          </div>

          {/* Terms Articles */}
          <div className="space-y-6 text-xs text-slate-800">
            {/* Article 1 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">1</span>
                Điều 1: ĐIỀU CHỈNH THỜI HẠN THUÊ KHO GIA HẠN
              </h4>
              <p className="text-justify leading-relaxed pl-7">
                1.1. Hai bên đồng ý gia hạn thời gian thuê ô kho lưu trữ cá nhân thông minh có mã số định danh <strong>#{renewal.unitCode}</strong> đặt tại cơ sở <strong>{renewal.facilityName || contract?.facilityName}</strong>.
              </p>
              <div className="pl-7 grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 font-sans">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Thời hạn hợp đồng trước gia hạn:</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    Đến hết ngày {formatDate(renewal.oldEndDate)}
                  </strong>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-blue-700 block text-[11px] font-semibold">Thời gian gia hạn thêm:</span>
                  <strong className="text-blue-900 text-sm font-mono">
                    + {renewal.cycleMonths} Tháng
                  </strong>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-emerald-700 block text-[11px] font-semibold">Thời hạn kết thúc mới sau gia hạn:</span>
                  <strong className="text-emerald-900 text-sm font-mono">
                    Đến hết ngày {formatDate(renewal.newEndDate)}
                  </strong>
                </div>
              </div>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                1.2. Toàn bộ quyền truy cập ô kho qua mã PIN bảo mật cá nhân, mã QR thông minh và điều khiển khóa điện tử Smart Lock trên Boxora App được hệ thống gia hạn tự động tương ứng theo thời hạn mới.
              </p>
            </div>

            {/* Article 2 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">2</span>
                Điều 2: PHÍ GIA HẠN VÀ PHƯƠNG THỨC THANH TOÁN
              </h4>
              <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-3 my-2 font-sans">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Tổng cước phí gia hạn kỳ này:</span>
                  <strong className="text-blue-700 text-base font-mono">
                    {Number(renewal.renewalFee || 0).toLocaleString('vi-VN')} ₫
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    (Đã bao gồm VAT và ưu đãi theo chính sách của Boxora)
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Hình thức thanh toán:</span>
                  <strong className="text-slate-900 text-sm">
                    {renewal.paymentMethod || 'Ký online + Chuyển khoản trực tuyến VNPay'}
                  </strong>
                  {renewal.receiptVoucherCode && (
                    <span className="block text-[10px] font-mono text-emerald-700 mt-0.5 font-bold">
                      Số biên lai / GD: {renewal.receiptVoucherCode}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-justify leading-relaxed pl-7">
                2.1. Bên B đã hoàn tất nghĩa vụ thanh toán hoặc cam kết thanh toán đầy đủ phí gia hạn nêu trên theo đúng quy định.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                2.2. Tiền đặt cọc lưu ký bảo chứng đã đóng tại Hợp đồng gốc vẫn được giữ nguyên trạng tại tài khoản bảo chứng của Boxora Cloud và tiếp tục có giá trị bảo lãnh đến hết thời hạn mới.
              </p>
            </div>

            {/* Article 3 */}
            <div>
              <h4 className="font-bold text-slate-900 font-sans uppercase text-xs mb-1.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">3</span>
                Điều 3: ĐIỀU KHOẢN CHUNG VÀ HIỆU LỰC PHÁP LÝ
              </h4>
              <p className="text-justify leading-relaxed pl-7">
                3.1. Phụ lục gia hạn này là bộ phận không thể tách rời của Hợp đồng thuê kho tự quản thông minh số <strong>#{renewal.contractCode}</strong>.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                3.2. Mọi điều khoản, quyền và nghĩa vụ khác của hai bên đã quy định trong Hợp đồng gốc mà không bị thay đổi bởi Phụ lục này vẫn giữ nguyên hiệu lực thi hành đầy đủ.
              </p>
              <p className="text-justify leading-relaxed pl-7 mt-1">
                3.3. Phụ lục này được xác thực và ký kết bằng hình thức điện tử hoặc trực tiếp tại quầy cơ sở, có đầy đủ giá trị pháp lý ràng buộc hai bên theo quy định của Luật Giao dịch Điện tử.
              </p>
            </div>
          </div>

          {/* Signatures & Seal Section */}
          <div className="mt-12 pt-8 border-t border-slate-300 font-sans">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              {/* Representative Party A */}
              <div className="flex flex-col items-center">
                <span className="font-bold uppercase text-slate-900">ĐẠI DIỆN BÊN CHO THUÊ (BÊN A)</span>
                <span className="text-[11px] text-slate-500 italic mt-0.5">Xác nhận gia hạn &amp; đóng dấu số</span>

                <div className="my-4 w-52 h-36 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-between p-3 relative shadow-inner">
                  <div className="flex-1 w-full flex flex-col items-center justify-center p-1">
                    <div className="w-12 h-12 rounded-full border-2 border-red-600 border-dashed flex items-center justify-center text-red-600 mb-1">
                      <span className="text-[9px] font-black uppercase text-center leading-tight">
                        BOXORA<br />SEAL
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-red-700">ĐÃ CHỨNG THỰC ĐIỆN TỬ</span>
                  </div>
                  <div className="w-full pt-1.5 border-t border-slate-200 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-800">
                      {renewal.reviewedByName || renewal.cashierStaffName || 'Quản lý cơ sở Boxora'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {renewal.reviewedAt ? new Date(renewal.reviewedAt).toLocaleString('vi-VN') : 'Hệ thống tự động phê duyệt'}
                    </span>
                  </div>
                </div>

                <span className="font-bold text-slate-900">CÔNG TY CP DỊCH VỤ LƯU TRỮ BOXORA</span>
                <span className="text-[10px] text-slate-500 font-mono">Chi nhánh: {renewal.facilityName || 'Boxora Cloud'}</span>
              </div>

              {/* Representative Party B */}
              <div className="flex flex-col items-center">
                <span className="font-bold uppercase text-slate-900">ĐẠI DIỆN BÊN THUÊ KHO (BÊN B)</span>
                <span className="text-[11px] text-slate-500 italic mt-0.5">Khách hàng xác thực chữ ký</span>

                {renewal.signedAt || renewal.signatureData ? (
                  (() => {
                    const actualSignature = renewal.signatureData

                    const isDataOrImageUrl =
                      typeof actualSignature === 'string' &&
                      (actualSignature.startsWith('data:image/') ||
                        actualSignature.startsWith('http://') ||
                        actualSignature.startsWith('https://') ||
                        actualSignature.startsWith('blob:'))

                    const isRawSvg =
                      typeof actualSignature === 'string' &&
                      actualSignature.trim().startsWith('<svg')

                    return (
                      <div className="my-4 w-52 h-36 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-between p-3 relative shadow-inner">
                        <div className="flex-1 w-full flex items-center justify-center p-1 overflow-hidden">
                          {isDataOrImageUrl ? (
                            <img
                              src={actualSignature}
                              alt="Chữ ký tay điện tử của khách hàng"
                              className="max-h-20 max-w-full object-contain filter drop-shadow select-none"
                            />
                          ) : isRawSvg ? (
                            <div
                              className="max-h-20 max-w-full flex items-center justify-center select-none filter drop-shadow-sm"
                              dangerouslySetInnerHTML={{ __html: actualSignature }}
                            />
                          ) : (
                            <div className="px-2 text-center text-[11px] font-semibold leading-relaxed text-emerald-700">
                              Chữ ký điện tử đã được xác thực DocuSeal.
                            </div>
                          )}
                        </div>
                        <div className="w-full pt-1.5 border-t border-slate-200 flex flex-col items-center">
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold font-sans">
                            <span className="material-symbols-outlined text-[13px]">verified</span>
                            <span>Chữ ký tay điện tử hợp lệ</span>
                          </div>
                          {renewal.signedAt && (
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {new Date(renewal.signedAt).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="my-4 w-48 h-36 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-3 text-slate-400 text-xs">
                    {renewal.status}
                  </div>
                )}

                <span className="font-bold text-slate-900">{renewal.customerName || 'Khách hàng'}</span>
                <span className="text-[10px] text-slate-500 font-mono">{renewal.customerEmail}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center font-sans text-[10px] text-slate-400">
            Bản phụ lục gia hạn số PLGH-{renewal.contractCode} được lưu trữ đồng bộ trên Boxora Cloud. Giá trị pháp lý gắn liền Hợp đồng số #{renewal.contractCode}.
          </div>
        </div>

        {/* Modal Bottom Bar - Hidden when printing */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="material-symbols-outlined text-[18px] text-blue-600">verified</span>
            <span>Phụ lục gia hạn đã được kích hoạt và có giá trị pháp lý tương đương hợp đồng gốc.</span>
          </div>

          <div className="flex items-center gap-2">
            {onViewOriginalContract && (
              <button
                type="button"
                onClick={onViewOriginalContract}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                <span>Xem Hợp Đồng Gốc</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>In Phụ Lục</span>
            </button>

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
