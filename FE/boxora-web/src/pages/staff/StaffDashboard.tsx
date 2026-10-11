import React, { useState } from 'react'

export const StaffDashboard: React.FC = () => {
  // Stepper state for Spotlight Handover (Trần Minh Tuấn - #A-112)
  const [handoverStep, setHandoverStep] = useState(4)
  const [handoverCompleted, setHandoverCompleted] = useState(false)

  // Inspection Return state (Công ty CP Thương mại ABC - #C-302)
  const [returnConfirmed, setReturnConfirmed] = useState(false)
  const [returnDepositPaid] = useState(2000000)
  const [damageFee, setDamageFee] = useState(0)
  const [cleaningFee, setCleaningFee] = useState(0)
  const [lostCardFee, setLostCardFee] = useState(0)
  const totalDeduction = damageFee + cleaningFee + lostCardFee
  const netRefundAmount = Math.max(0, returnDepositPaid - totalDeduction)
  const reviewState = totalDeduction > 0 ? 'PENDING_ACCOUNTING_REVIEW' : 'AUTO_REFUND_APPROVED'
  const refundSlaDays = 5

  // Ticket status state
  const [tickets, setTickets] = useState([
    {
      id: '#TK-402',
      title: 'Khách báo kẹt ổ khóa điện tử Smart Lock',
      detail: 'Khách hàng Hoàng Long đang ở trước cửa kho, mã PIN báo đúng nhưng chốt cơ khí không bung ra.',
      location: 'Kho #B-104 (Hành lang Tây - Tầng 1)',
      priority: 'HIGH',
      staff: 'Hoàng Nam (Kỹ thuật)',
      time: '12 phút trước',
      status: 'IN_PROGRESS'
    },
    {
      id: '#TK-405',
      title: 'Yêu cầu mở cổng xe tải giao hàng sớm',
      detail: 'Xe tải 5 tấn giao kiện hàng cho kho #C-005 xin phép vào sân tiếp nhận sớm 30 phút.',
      location: 'Cổng tiếp vận Loading Bay #01',
      priority: 'MEDIUM',
      staff: 'Nguyễn Quỳnh Anh (Trực ca)',
      time: '28 phút trước',
      status: 'IN_PROGRESS'
    },
    {
      id: '#TK-408',
      title: 'Quên mã PIN mở kho #A-108',
      detail: 'Khách hàng liên hệ qua app yêu cầu kiểm tra và gửi lại mã số thẻ mở cửa cuốn qua SMS.',
      location: 'Kho #A-108 (Tầng 1)',
      priority: 'LOW',
      staff: 'Quỳnh Anh (NV-842)',
      time: 'Vừa xong',
      status: 'RESOLVED'
    }
  ])

  // Quick Walkin Modal
  const [isWalkinOpen, setIsWalkinOpen] = useState(false)
  const [walkinName, setWalkinName] = useState('')
  const [walkinPhone, setWalkinPhone] = useState('')
  const [walkinSuccess, setWalkinSuccess] = useState(false)

  const handleWalkinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setWalkinSuccess(true)
    setTimeout(() => {
      setWalkinSuccess(false)
      setIsWalkinOpen(false)
      setWalkinName('')
      setWalkinPhone('')
    }, 1500)
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto">
      
      {/* Top Operational Banner: Live Status & Staff Shift Context */}
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-md">
              <span className="material-symbols-outlined text-[26px]">desktop_windows</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline text-xl font-bold text-slate-900">
                  Bàn Vận Hành Quầy &amp; Tiếp Đón Thực Địa
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold uppercase tracking-wider">
                  Ca sáng: 08:00 - 16:30
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-1">
                Trực ca: <strong className="text-slate-900">Nguyễn Quỳnh Anh (NV-842)</strong> • Phụ trách tiếp đón, kiểm toán hiện trường và giải quyết sự cố phát sinh.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsWalkinOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Khách Walk-in Vãng Lai</span>
            </button>
            <button
              onClick={() => alert('Lệnh khẩn cấp: Cửa sảnh và cửa kiểm soát Barrier đã được mở cưỡng bức trong 60 giây.')}
              className="px-4 py-2.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>Mở Cửa Sảnh Khẩn Cấp</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Stats Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* Metric 1 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                Lịch Check-in Hôm Nay
              </span>
              <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-headline text-3xl font-extrabold text-slate-900">12</span>
              <span className="text-xs text-slate-500">lịch hẹn</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500"></span>
              <span className="text-xs text-slate-800 font-semibold">4 khách đã tới sảnh</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                Yêu Cầu Trả Kho Cần Khảo Sát
              </span>
              <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-orange-600">
                <span className="material-symbols-outlined text-[18px]">assignment_return</span>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-headline text-3xl font-extrabold text-orange-600">5</span>
              <span className="text-xs text-slate-500">hợp đồng tất toán</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <span>2 đơn đang chờ thủ kho nghiệm thu</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-red-700">
                Sự Cố Tại Chỗ (On-site)
              </span>
              <span className="w-8 h-8 rounded-lg bg-white border border-red-200 flex items-center justify-center text-red-600">
                <span className="material-symbols-outlined text-[18px]">warning</span>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-headline text-3xl font-extrabold text-red-600">3</span>
              <span className="text-xs text-slate-500">ticket đang mở</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 font-bold">
              <span>1 ca mức độ Cao (Cần giải quyết ngay)</span>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                Tỷ Lệ Lấp Đầy Hiện Hữu
              </span>
              <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                <span className="material-symbols-outlined text-[18px]">pie_chart</span>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-headline text-3xl font-extrabold text-slate-900">92.5%</span>
              <span className="font-unit-code text-xs text-slate-500">148/160 KHO</span>
            </div>
            <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-slate-900 h-full rounded-full" style={{ width: '92.5%' }}></div>
            </div>
          </div>

        </div>

        {/* Quick Search & Filters */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm nhanh tên khách hàng, SĐT, mã đặt chỗ #RES-2025-XXXX, hoặc mã số kho..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-200 focus:outline-none focus:bg-white focus:border-slate-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-slate-500">Khu vực kho:</span>
              <select className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer">
                <option value="all">Tất cả tầng (Mega Central)</option>
                <option value="f1">Tầng 1 (Kho Standard &amp; Garage)</option>
                <option value="f2">Tầng 2 (Kho Climate Control)</option>
                <option value="f3">Tầng 3 (Locker cá nhân)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-slate-500">Khung giờ:</span>
              <select className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer">
                <option value="current">Ca Hiện Tại (08:00 - 12:00)</option>
                <option value="today">Trọn Vẹn Hôm Nay</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual Workspace: Check-in Queue + Return Inspections */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Live Check-in & Handover Stepper Card (Col 8) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-orange-600 text-[24px]">badge</span>
                <div>
                  <h2 className="font-headline text-lg font-bold text-slate-900">
                    Lịch Tiếp Đón Check-in &amp; Bàn Giao Mặt Bằng
                  </h2>
                  <span className="text-xs text-slate-500">
                    Thực hiện tuần tự quy trình bàn giao 4 bước và cấp phát mã truy cập số
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping"></span>
                <span className="font-unit-code text-xs text-orange-600 font-bold">1 ĐANG CHECK-IN TẠI QUẦY</span>
              </div>
            </div>

            {/* Spotlight Active Session: Trần Minh Tuấn */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-sm">
                    TT
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline text-base font-bold text-slate-900">Trần Minh Tuấn</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-unit-code text-[11px] font-bold">
                        #RES-8921
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium">
                        Đến lúc: 09:18 AM
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-slate-600 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">call</span> 0912.345.678
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">domain</span> Kho Tiêu Chuẩn 6m²
                      </span>
                      <span className="flex items-center gap-1 font-unit-code text-slate-900 font-bold">
                        <span className="material-symbols-outlined text-[14px] text-orange-600">meeting_room</span>
                        Kho #A-112 (Tầng 1)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span> Giờ hẹn: 09:30 Sáng
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-end justify-between shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-bold text-[10px] uppercase">
                    Khách Đã Tới Quầy
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1">Hợp đồng thuê 12 tháng</span>
                </div>
              </div>

              {/* The 4-Step Handover Stepper Pipeline */}
              <div className="mt-4 pt-2 grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Step 1 */}
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Bước 1</span>
                    <span className="material-symbols-outlined text-orange-600 text-[18px]">check_circle</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">Đối chiếu CCCD</span>
                  <span className="text-[11px] text-slate-500">Số: 001092003891</span>
                  <span className="mt-2 text-[10px] font-bold text-emerald-600 font-mono">✓ ĐÃ DUYỆT OCR</span>
                </div>

                {/* Step 2 */}
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Bước 2</span>
                    <span className="material-symbols-outlined text-orange-600 text-[18px]">check_circle</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">Thu Tiền Cọc</span>
                  <span className="text-[11px] text-slate-500">Cọc kho + Thẻ từ</span>
                  <span className="mt-2 text-[10px] font-bold text-slate-800 font-mono">✓ ĐÃ THU 1.500.000đ</span>
                </div>

                {/* Step 3 */}
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Bước 3</span>
                    <span className="material-symbols-outlined text-orange-600 text-[18px]">key</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">Cấp Thẻ &amp; PIN Smart</span>
                  <div className="bg-slate-50 px-2 py-0.5 rounded mt-1 flex items-center justify-between border border-slate-100">
                    <span className="font-unit-code text-xs text-orange-600 font-bold tracking-wider">739215</span>
                    <span 
                      onClick={() => alert('Mã PIN 739215 đã được sao chép!')}
                      className="material-symbols-outlined text-[14px] text-slate-400 cursor-pointer" 
                      title="Sao chép PIN"
                    >
                      content_copy
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Thẻ RFID: #RF-409</span>
                </div>

                {/* Step 4 */}
                <div className={`p-3 rounded-xl shadow-sm flex flex-col justify-between transition-all ${
                  handoverCompleted 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                    : 'bg-slate-900 text-white'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] uppercase font-bold ${handoverCompleted ? 'text-emerald-700' : 'text-slate-400'}`}>
                      Bước 4
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      {handoverCompleted ? 'check_circle' : 'draw'}
                    </span>
                  </div>
                  <span className="text-xs font-bold">Bàn Giao Thực Địa</span>
                  <span className={`text-[11px] ${handoverCompleted ? 'text-emerald-700' : 'text-slate-300'}`}>
                    Dẫn khách tới kho #A-112
                  </span>
                  <button
                    onClick={() => {
                      setHandoverCompleted(true)
                      alert('Đã xác nhận hoàn tất bàn giao thực địa kho #A-112 cho anh Trần Minh Tuấn!')
                    }}
                    disabled={handoverCompleted}
                    className={`mt-2 py-1 px-2 rounded text-[11px] font-bold text-center transition-all ${
                      handoverCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                  >
                    {handoverCompleted ? 'ĐÃ BÀN GIAO XONG' : 'Hoàn Tất Bàn Giao'}
                  </button>
                </div>
              </div>

              {/* Handover Notes & Quick Actions */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-orange-600">info</span>
                  <span>Ghi chú của khách: Cần hỗ trợ mượn xe đẩy tải trọng 300kg khi dỡ đồ vào kho.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert('Đang in phiếu bàn giao & nghiệm thu kho #A-112 (PDF)...')}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded text-slate-800 text-xs font-semibold transition-colors"
                  >
                    In Phiếu Nhận Kho (PDF)
                  </button>
                  <button
                    onClick={() => alert('Đã gửi tin nhắn Zalo kèm mã QR và hướng dẫn tự mở khóa cho anh Tuấn!')}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded text-slate-800 text-xs font-semibold transition-colors"
                  >
                    Gửi Hướng Dẫn Qua Zalo/SMS
                  </button>
                </div>
              </div>
            </div>

            {/* Upcoming Appointments Table */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Danh sách hẹn tiếp theo trong ngày
              </span>
              <span className="text-xs text-slate-400">Hiển thị 3 / 11 lịch còn lại</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider">
                    <th className="py-2.5 px-3 rounded-l-lg">Khách hàng</th>
                    <th className="py-2.5 px-3">Mã Hẹn</th>
                    <th className="py-2.5 px-3">Kho Đăng Ký</th>
                    <th className="py-2.5 px-3">Giờ Hẹn</th>
                    <th className="py-2.5 px-3">Hồ sơ CCCD</th>
                    <th className="py-2.5 px-3">Cọc Giữ Chỗ</th>
                    <th className="py-2.5 px-3 rounded-r-lg text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">Lê Thị Hoàng Yến</div>
                      <div className="text-slate-400 font-data-tabular text-[11px]">0988.219.002</div>
                    </td>
                    <td className="py-3 px-3 font-unit-code text-slate-800">#RES-8924</td>
                    <td className="py-3 px-3">
                      <span className="font-unit-code font-bold text-slate-900">Kho #B-205</span>
                      <span className="text-slate-400 block text-[10px]">Climate Control 12m²</span>
                    </td>
                    <td className="py-3 px-3 font-data-tabular">10:15 Sáng</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        Đã tải lên app
                      </span>
                    </td>
                    <td className="py-3 px-3 font-data-tabular font-bold text-slate-900">2.500.000đ (Đã TT)</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => alert('Đã chuẩn bị hồ sơ cho chị Lê Thị Hoàng Yến')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px]"
                      >
                        Tiếp đón
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">Cty TNHH Logistics Vận Phát</div>
                      <div className="text-slate-400 font-data-tabular text-[11px]">0903.111.458 (Anh Hùng)</div>
                    </td>
                    <td className="py-3 px-3 font-unit-code text-slate-800">#RES-8930</td>
                    <td className="py-3 px-3">
                      <span className="font-unit-code font-bold text-slate-900">Kho #A-004</span>
                      <span className="text-slate-400 block text-[10px]">Kho sỉ thương mại 35m²</span>
                    </td>
                    <td className="py-3 px-3 font-data-tabular">11:00 Sáng</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold">
                        Chưa xuất trình ĐKKD
                      </span>
                    </td>
                    <td className="py-3 px-3 font-data-tabular font-bold text-orange-600">6.000.000đ (Chờ thu)</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => alert('Đang mở file hồ sơ của công ty Vận Phát')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px]"
                      >
                        Chuẩn bị hồ sơ
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">Vũ Đức Thắng</div>
                      <div className="text-slate-400 font-data-tabular text-[11px]">0944.890.123</div>
                    </td>
                    <td className="py-3 px-3 font-unit-code text-slate-800">#RES-8935</td>
                    <td className="py-3 px-3">
                      <span className="font-unit-code font-bold text-slate-900">Kho #C-118</span>
                      <span className="text-slate-400 block text-[10px]">Kho mini gia dụng 4m²</span>
                    </td>
                    <td className="py-3 px-3 font-data-tabular">14:00 Chiều</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        Đã duyệt hợp đồng
                      </span>
                    </td>
                    <td className="py-3 px-3 font-data-tabular font-bold text-slate-900">1.000.000đ (Đã TT)</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => alert('Mở chi tiết đặt chỗ #RES-8935')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px]"
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Radar Block A Floor Indicator */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-slate-700">map</span>
                  <span className="font-headline text-xs font-bold text-slate-900">
                    Sơ Đồ Lô Kho Bàn Giao (Khu Vực Tầng 1 - Block A)
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">Tọa độ tiếp vận lối cửa A2</span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl font-unit-code text-center">
                <div className="p-2 rounded bg-slate-200 text-slate-600 text-xs">#A-108<br/><span className="text-[10px] text-slate-400 font-normal">Đang thuê</span></div>
                <div className="p-2 rounded bg-slate-200 text-slate-600 text-xs">#A-109<br/><span className="text-[10px] text-slate-400 font-normal">Đang thuê</span></div>
                <div className="p-2 rounded bg-slate-200 text-slate-600 text-xs">#A-110<br/><span className="text-[10px] text-slate-400 font-normal">Đang thuê</span></div>
                <div className="p-2 rounded bg-slate-200 text-slate-600 text-xs">#A-111<br/><span className="text-[10px] text-slate-400 font-normal">Đang thuê</span></div>
                <div className="p-2 rounded bg-orange-600 text-white font-bold text-xs shadow-sm animate-pulse">#A-112<br/><span className="text-[10px] uppercase">BÀN GIAO</span></div>
                <div className="p-2 rounded bg-white border border-slate-200 text-slate-800 text-xs">#A-113<br/><span className="text-[10px] text-emerald-600 font-bold">TRỐNG</span></div>
                <div className="p-2 rounded bg-white border border-slate-200 text-slate-800 text-xs">#A-114<br/><span className="text-[10px] text-emerald-600 font-bold">TRỐNG</span></div>
                <div className="p-2 rounded bg-slate-200 text-slate-600 text-xs">#A-115<br/><span className="text-[10px] text-slate-400 font-normal">Đang thuê</span></div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Side: Return & Condition Inspection Flow (Col 4) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-600 text-[22px]">fact_check</span>
                  <h2 className="font-headline text-base font-bold text-slate-900">Nghiệm Thu Trả Kho</h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                  #FLOW-RET-07
                </span>
              </div>

              {/* Target Contract Profile */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Hồ Sơ Cần Nghiệm Thu</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[10px] font-bold">
                    HĐ: #CTR-2024-098
                  </span>
                </div>
                <div className="mt-1">
                  <span className="font-bold text-slate-900 text-sm block">Công ty CP Thương mại ABC</span>
                  <span className="text-xs text-slate-500">Đại diện: Hoàng Văn Nam (0977.654.321)</span>
                </div>
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-unit-code">
                  <span className="text-slate-800">Vị trí: <strong>Kho #C-302 (15m²)</strong></span>
                  <span className="text-orange-600 font-bold">Hết hạn: Hôm nay</span>
                </div>
              </div>

              {/* 5 Inspection Checklist Items (BR-RULE-013) */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Biên bản thẩm định hiện trường (BR-RULE-013)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">5/5 tiêu chuẩn</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">garage</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800">1. Tình trạng cửa cuốn</span>
                      <span className="text-[10px] text-slate-400">Mở êm, không móp méo, ray dẫn tốt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    Tốt
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">cleaning_services</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800">2. Vệ sinh kho &amp; sàn</span>
                      <span className="text-[10px] text-slate-400">Đã dọn sạch rác, không ẩm ướt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    Sạch sẽ
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">lock</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800">3. Ổ khóa Smart Lock</span>
                      <span className="text-[10px] text-slate-400">Cảm biến nhạy, pin 92%, chốt khóa tốt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    Bình thường
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">thermostat</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800">4. Cảm biến nhiệt / ẩm</span>
                      <span className="text-[10px] text-slate-400">22°C • 48% RH (Chuẩn kỹ thuật)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    Chuẩn
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">grid_view</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800">5. Tường vách &amp; kết cấu kho</span>
                      <span className="text-[10px] text-slate-400">Không nứt vỡ móp méo, nguyên vẹn</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    Nguyên vẹn
                  </span>
                </div>

                {/* Proof Photos */}
                <div className="mt-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase">
                      Ảnh chụp hiện trường (Bắt buộc &ge; 2 ảnh)
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold font-mono">2/2 ảnh đạt</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative rounded-lg overflow-hidden h-20 shadow-sm bg-slate-200">
                      <img 
                        className="w-full h-full object-cover" 
                        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80" 
                        alt="Toàn cảnh kho"
                      />
                      <span className="absolute bottom-1 left-1 px-1 bg-slate-900/80 text-white text-[9px] rounded font-mono">
                        Toàn cảnh kho
                      </span>
                    </div>
                    <div className="relative rounded-lg overflow-hidden h-20 shadow-sm bg-slate-200">
                      <img 
                        className="w-full h-full object-cover" 
                        src="https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=400&q=80" 
                        alt="Ổ khóa số"
                      />
                      <span className="absolute bottom-1 left-1 px-1 bg-slate-900/80 text-white text-[9px] rounded font-mono">
                        Ổ khóa số
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khấu trừ chi phí hư hại / vệ sinh (BR-RULE-014) */}
                <div className="mt-1 p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Khấu Trừ Chi Phí (Nếu có)</span>
                    <span className="text-[10px] text-slate-400">BR-RULE-014</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Phí hư hại (đ)</label>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={damageFee || ''}
                        onChange={(e) => setDamageFee(Number(e.target.value) || 0)}
                        placeholder="0"
                        disabled={returnConfirmed}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Phí vệ sinh (đ)</label>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={cleaningFee || ''}
                        onChange={(e) => setCleaningFee(Number(e.target.value) || 0)}
                        placeholder="0"
                        disabled={returnConfirmed}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Settlement Summary & Review State (BR-RULE-014 & BR-RULE-015) */}
                <div className="mt-1 p-3 rounded-lg bg-slate-100 border border-slate-200 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền cọc giữ ban đầu:</span>
                    <span className="font-data-tabular font-bold text-slate-800">
                      {returnDepositPaid.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tổng khấu trừ (Hư hại/Vệ sinh):</span>
                    <span className={`font-data-tabular font-semibold ${totalDeduction > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      -{totalDeduction.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-900 pt-1.5 border-t border-slate-200">
                    <span className="font-bold">Số tiền hoàn trả khách:</span>
                    <span className="font-unit-code text-sm text-orange-600 font-extrabold">
                      {netRefundAmount.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                    <span>SLA cam kết hoàn tiền:</span>
                    <span className="font-semibold text-slate-700">{refundSlaDays} ngày làm việc</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Quy trình xét duyệt:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      totalDeduction > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {totalDeduction > 0 ? 'Chờ Kế Toán Đối Soát (Review State)' : 'Tự Động Hoàn Cọc (Direct SLA)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setReturnConfirmed(true)
                const reviewMsg = totalDeduction > 0
                  ? `Đã khấu trừ ${totalDeduction.toLocaleString('vi-VN')}đ. Hồ sơ hoàn cọc ${netRefundAmount.toLocaleString('vi-VN')}đ đã chuyển sang Kế Toán đối soát duyệt chi (SLA ${refundSlaDays} ngày).`
                  : `Kho đạt chuẩn 5/5. Lệnh hoàn cọc 100% (${netRefundAmount.toLocaleString('vi-VN')}đ) đã chuyển sang cổng thanh toán tự động (SLA ${refundSlaDays} ngày).`
                alert(`Nghiệm thu hoàn trả kho #C-302 thành công!\n- Mã PIN SmartLock: ĐÃ THU HỒI\n- Trạng thái kho: AVAILABLE (Sẵn sàng phục vụ khách mới)\n- ${reviewMsg}`)
              }}
              disabled={returnConfirmed}
              className={`mt-4 w-full py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
                returnConfirmed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {returnConfirmed ? 'check_circle' : 'assignment_turned_in'}
              </span>
              <span>
                {returnConfirmed ? 'ĐÃ HOÀN CỌC & TRẢ KHO' : 'Xác Nhận Trả Kho & Hoàn Trả Cọc'}
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Workspace: On-Site Incident & Ticket Handling Queue */}
      <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">build_circle</span>
            </div>
            <div>
              <h2 className="font-headline text-base font-bold text-slate-900">
                Danh Sách Ticket Xử Lý Sự Cố Tại Chỗ (On-site Issue Queue)
              </h2>
              <span className="text-xs text-slate-500">
                Điều phối nhân sự kỹ thuật, an ninh và xử lý tức thời các vấn đề phần cứng
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              const code = `#TK-${Math.floor(400 + Math.random() * 100)}`
              const newTk = {
                id: code,
                title: 'Khách hàng báo cấn cửa cuốn khi đóng',
                detail: 'Khu vực Tầng 1 - Cửa kho trượt nặng cần bảo dưỡng dầu bôi trơn.',
                location: 'Kho #A-110 (Tầng 1)',
                priority: 'MEDIUM',
                staff: 'Nguyễn Quỳnh Anh (Trực ca)',
                time: 'Vừa xong',
                status: 'IN_PROGRESS'
              }
              setTickets([newTk, ...tickets])
            }}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">add_alert</span>
            <span>Tạo Báo Cáo Mới</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider">
                <th className="py-2.5 px-3 rounded-l-lg">Mã Ticket</th>
                <th className="py-2.5 px-3">Mô Tả Chi Tiết Sự Cố</th>
                <th className="py-2.5 px-3">Vị Trí &amp; Kho</th>
                <th className="py-2.5 px-3">Mức Độ</th>
                <th className="py-2.5 px-3">Nhân Viên Phụ Trách</th>
                <th className="py-2.5 px-3">Thời Gian</th>
                <th className="py-2.5 px-3 rounded-r-lg text-right">Thao tác xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {tickets.map((tk) => (
                <tr 
                  key={tk.id} 
                  className={`hover:bg-slate-50/70 transition-colors ${
                    tk.priority === 'HIGH' ? 'bg-red-50/30' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-unit-code text-xs font-bold text-slate-900">
                    {tk.id}
                  </td>
                  <td className="py-3 px-3 max-w-xs">
                    <span className="font-bold text-slate-900 block">{tk.title}</span>
                    <span className="text-[11px] text-slate-500 line-clamp-1">{tk.detail}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800">{tk.location}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                      tk.priority === 'HIGH'
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : tk.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        tk.priority === 'HIGH' ? 'bg-red-600' : tk.priority === 'MEDIUM' ? 'bg-amber-600' : 'bg-slate-400'
                      }`}></span>
                      {tk.priority === 'HIGH' ? 'Ưu tiên Cao' : tk.priority === 'MEDIUM' ? 'Bình thường' : 'Thấp'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700">{tk.staff}</td>
                  <td className="py-3 px-3 text-slate-400 font-mono">{tk.time}</td>
                  <td className="py-3 px-3 text-right">
                    {tk.status === 'RESOLVED' ? (
                      <span className="text-emerald-600 font-bold text-[11px]">✓ Đã giải quyết</span>
                    ) : (
                      <button
                        onClick={() => {
                          setTickets(prev => prev.map(t => t.id === tk.id ? { ...t, status: 'RESOLVED' } : t))
                          alert(`Đã hoàn tất xử lý ticket ${tk.id}`)
                        }}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[11px] transition-colors"
                      >
                        Xong tại chỗ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Walkin Modal */}
      {isWalkinOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {walkinSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Đã Đăng Ký Khách Vãng Lai!
                </h3>
                <p className="text-xs text-slate-600">
                  Mã thẻ tạm #WALK-{Math.floor(100 + Math.random() * 900)} đã được kích hoạt cho khách tham quan.
                </p>
              </div>
            ) : (
              <form onSubmit={handleWalkinSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Tiếp Đón Khách Vãng Lai (Walk-in)
                  </h3>
                  <button type="button" onClick={() => setIsWalkinOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Họ và tên khách</label>
                  <input
                    type="text"
                    required
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Số điện thoại liên hệ</label>
                  <input
                    type="tel"
                    required
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Nhu cầu kho dự kiến</label>
                  <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none">
                    <option value="mini">Kho Mini (2-5 m²)</option>
                    <option value="home">Kho Gia Đình (6-12 m²)</option>
                    <option value="biz">Kho Doanh Nghiệp (15-30 m²)</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWalkinOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    Cấp Thẻ Tham Quan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

