import React, { useState } from 'react'

interface AssetSealingModalProps {
  isOpen: boolean
  onClose: () => void
  unitCode: string
  tenantName: string
  contractCode: string
  overdueDays: number
  totalDebt: string
  onCompleteSealing: (msg: string) => void
}

export const AssetSealingModal: React.FC<AssetSealingModalProps> = ({
  isOpen,
  onClose,
  unitCode,
  tenantName,
  contractCode,
  overdueDays,
  totalDebt,
  onCompleteSealing
}) => {
  const [sealReportCode] = useState(() => `BB-NP-${new Date().getFullYear()}${Math.floor(100 + Math.random() * 900)}`)
  const [sealStickerCode] = useState('TEM-BOXORA-88992')
  const [witness1] = useState('Nguyễn Văn An (Quản lý Cơ sở)')
  const [witness2] = useState('Lê Hoàng Nam (Kỹ thuật Trưởng)')
  const [witness3] = useState('Trần Thùy Linh (Điều phối Vận hành)')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleConfirm = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      onCompleteSealing(`Đã hoàn tất lập và lưu Biên bản Niêm phong điện tử ${sealReportCode} cho kho #${unitCode}!`)
      onClose()
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100 text-orange-900">
              <span className="material-symbols-outlined text-[26px]">gavel</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Biên Bản Niêm Phong &amp; Kê Biên Kho</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                  {sealReportCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Văn bản pháp lý số hóa ghi nhận biện pháp cưỡng chế an ninh Boxora
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

        {/* Legal Document Sheet Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-xl border border-slate-200 font-sans text-xs flex flex-col gap-3">
          {/* Header Quốc Hiệu */}
          <div className="text-center pb-2 border-b border-slate-200">
            <p className="font-bold text-slate-900 uppercase tracking-widest text-[11px]">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </p>
            <p className="text-slate-600 text-[11px] italic">Độc lập - Tự do - Hạnh phúc</p>
            <div className="w-16 h-0.5 bg-slate-400 mx-auto my-1.5"></div>
            <h3 className="text-sm font-black text-slate-900 uppercase mt-1">
              BIÊN BẢN NIÊM PHONG KHO HÀNG &amp; KÊ BIÊN TÀI SẢN
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 italic">
              (Do vi phạm nghĩa vụ thanh toán cước thuê kho vượt quá thời hạn cam kết)
            </p>
          </div>

          {/* Basis */}
          <div className="text-slate-700 leading-relaxed text-[11px]">
            <p>&bull; <strong>Căn cứ:</strong> Hợp đồng dịch vụ thuê kho tự quản số <strong>{contractCode}</strong>.</p>
            <p>&bull; <strong>Căn cứ:</strong> Điều 8 Quy chế quản lý &amp; xử lý tài sản vi phạm nợ cước của Hệ thống Boxora.</p>
            <p>&bull; <strong>Thời điểm lập:</strong> {new Date().toLocaleTimeString('vi-VN')} ngày {new Date().toLocaleDateString('vi-VN')}.</p>
          </div>

          {/* Parties Involved */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              1. Thông tin đối tượng vi phạm &amp; Tài sản niêm phong
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>&bull; Phòng kho: <strong className="font-mono text-slate-900">Kho #{unitCode}</strong></div>
              <div>&bull; Khách thuê: <strong>{tenantName}</strong></div>
              <div>&bull; Quá hạn: <span className="text-rose-700 font-bold">{overdueDays} ngày</span></div>
              <div>&bull; Tổng cước nợ &amp; phạt: <strong className="font-mono text-rose-700">{totalDebt}</strong></div>
            </div>
          </div>

          {/* Council & Witnesses */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              2. Thành phần hội đồng thực hiện niêm phong
            </span>
            <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
              <li>Đại diện Ban Quản Lý: <strong>{witness1}</strong></li>
              <li>Cán bộ phụ trách Kỹ thuật: <strong>{witness2}</strong></li>
              <li>Nhân chứng hiện trường: <strong>{witness3}</strong></li>
            </ul>
          </div>

          {/* Enforcement Steps */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              3. Hiện trạng &amp; Biện pháp cưỡng chế áp dụng
            </span>
            <div className="text-[11px] text-slate-700 flex flex-col gap-1">
              <p>&bull; Ngắt kết nối mã PIN cá nhân trên ổ khóa SmartLock, chuyển sang chế độ Khóa cưỡng chế Master.</p>
              <p>&bull; Dán tem niêm phong an ninh số hiệu: <span className="font-mono font-bold text-orange-700 px-1 bg-orange-50 rounded border border-orange-200">{sealStickerCode}</span> trên khe cửa cuốn.</p>
              <p>&bull; Kích hoạt giám sát camera trực diện 24/7 cảnh báo rung chấn và xâm nhập trái phép.</p>
              <p>&bull; Thời hạn giải quyết: Khách hàng có <strong>05 ngày làm việc</strong> để tất toán công nợ và hoàn tất thủ tục mở khóa.</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-lg bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            In / Xuất PDF
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSubmitting ? 'animate-spin' : ''}`}>
                {isSubmitting ? 'sync' : 'verified'}
              </span>
              <span>{isSubmitting ? 'Đang ký số...' : 'Lưu & Ký Số Biên Bản'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
