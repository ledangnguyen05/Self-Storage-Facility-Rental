import React, { useState } from 'react'

interface FacilitySurveyModalProps {
  isOpen: boolean
  onClose: () => void
  facilityName: string
  onSubmitSurvey: (ticketCode: string) => void
}

interface ChecklistItem {
  id: string
  category: string
  title: string
  status: 'PASS' | 'WARN' | 'FAIL'
  note?: string
}

export const FacilitySurveyModal: React.FC<FacilitySurveyModalProps> = ({
  isOpen,
  onClose,
  facilityName,
  onSubmitSurvey
}) => {
  const [ticketCode] = useState(() => `PKS-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`)
  const [inspectorName, setInspectorName] = useState('Nguyễn Văn An (Quản lý Cơ sở)')
  const [overallRating, setOverallRating] = useState<'EXCELLENT' | 'GOOD' | 'NEEDS_MAINTENANCE'>('EXCELLENT')
  const [generalNotes, setGeneralNotes] = useState('Hệ thống PCCC áp lực ổn định. Cửa cuốn 32 kho vận hành trơn tru. Vi khí hậu Zone C đạt chuẩn 20.4°C.')
  
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: 'pccc',
      category: 'PCCC & An Toàn Khẩn Cấp',
      title: 'Áp lực nước đầu phun Sprinkler & Bình chữa cháy bột CO2',
      status: 'PASS',
      note: 'Áp lực đạt 0.35 MPa, bình CO2 còn tem niêm phong'
    },
    {
      id: 'escape',
      category: 'PCCC & An Toàn Khẩn Cấp',
      title: 'Lối thoát hiểm Aisle North & Aisle South thông thoáng',
      status: 'PASS',
      note: 'Không có vật cản lối thoát hiểm 24/7'
    },
    {
      id: 'smartlock',
      category: 'Hạ Tầng Điện Tử',
      title: 'SmartLock 32 kho & Cổng phân khu quét thẻ RFID',
      status: 'PASS',
      note: 'Pin trung bình >94%, thời gian mở 0.2s'
    },
    {
      id: 'climate',
      category: 'Vi Khí Hậu & Kho Lạnh',
      title: 'Máy hút ẩm & Hệ thống lạnh HVAC Zone C Tầng 2',
      status: 'PASS',
      note: 'Nhiệt độ 20.4°C, ẩm độ 52% RH đạt ngưỡng'
    },
    {
      id: 'ups',
      category: 'Hạ Tầng Điện Tử',
      title: 'Bộ lưu điện UPS & Máy phát điện dự phòng trung tâm',
      status: 'PASS',
      note: 'Ắc quy nạp 100%, sẵn sàng chuyển mạch tự động'
    }
  ])

  if (!isOpen) return null

  const handleToggleStatus = (id: string, nextStatus: 'PASS' | 'WARN' | 'FAIL') => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, status: nextStatus } : item))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmitSurvey(ticketCode)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100 text-orange-900">
              <span className="material-symbols-outlined text-[26px]">assignment_add</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Phiếu Khảo Sát &amp; Kiểm Định Cơ Sở</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                  {ticketCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {facilityName} &bull; Chu kỳ kiểm định an toàn hạ tầng định kỳ
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

        {/* Development State Warning Banner */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
          <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0">construction</span>
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span>TÍNH NĂNG ĐANG PHÁT TRIỂN &bull; CHƯA KẾT NỐI PHẦN CỨNG THỰC TẾ</span>
              <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 font-mono text-[10px] rounded font-bold uppercase">Thử nghiệm</span>
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Biểu mẫu kiểm định an toàn PCCC và vi khí hậu đang trong giai đoạn phát triển tích hợp với thiết bị đo đạc cầm tay. Kết quả khảo sát hiện tại mang tính chất xem trước quy trình số hóa.
            </p>
          </div>
        </div>

        {/* Content Form Scrollable */}
        <form onSubmit={handleSave} className="flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Surveyor Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Cán bộ thực hiện khảo sát</label>
              <input
                type="text"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                required
              />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Kết luận đánh giá tổng thể</label>
              <select
                value={overallRating}
                onChange={(e) => setOverallRating(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              >
                <option value="EXCELLENT">Đạt chuẩn 100% - Hạ tầng an toàn xuất sắc</option>
                <option value="GOOD">Đạt - Có một số lưu ý kỹ thuật cần theo dõi</option>
                <option value="NEEDS_MAINTENANCE">Cần can thiệp bảo trì sửa chữa khẩn cấp</option>
              </select>
            </div>
          </div>

          {/* Interactive Checklist */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
              Danh mục kiểm định an toàn thực địa
            </span>

            <div className="flex flex-col gap-2 divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 bg-white">
              {checklist.map(item => (
                <div key={item.id} className="pt-2 first:pt-0 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                        {item.category}
                      </span>
                      <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                    </div>

                    {/* Status Pill Selectors */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, 'PASS')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          item.status === 'PASS'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">check</span> Đạt
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, 'WARN')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          item.status === 'WARN'
                            ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">warning</span> Theo dõi
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, 'FAIL')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          item.status === 'FAIL'
                            ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">cancel</span> Lỗi
                      </button>
                    </div>
                  </div>

                  {item.note && (
                    <span className="text-[11px] text-slate-500 font-mono italic">
                      &bull; Ghi chú: {item.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* General Notes Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú bổ sung của Quản lý Cơ sở
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              placeholder="Nhập nhận xét hoặc khuyến nghị xử lý..."
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>Lưu &amp; Ký Phiếu Khảo Sát</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
