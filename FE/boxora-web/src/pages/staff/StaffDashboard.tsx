import React, { useState, useEffect } from 'react'
import { bookingService } from '../../services/bookingService'
import { handoverService } from '../../services/handoverService'
import { reportService } from '../../services/reportService'
import { Booking, OccupancyReport } from '../../types'
import { HandoverCheckInWorkbench } from './components/HandoverCheckInWorkbench'
import { QrCameraCheckInModal } from './components/QrCameraCheckInModal'

export const StaffDashboard: React.FC = () => {
  // Stepper state for Spotlight Handover (Trần Minh Tuấn - #A-112)
  const [handoverStep, setHandoverStep] = useState(4)
  const [handoverCompleted, setHandoverCompleted] = useState(false)
  const [isCheckInApiCalling, setIsCheckInApiCalling] = useState(false)
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null)

  // QR Code Scanner State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)

  // Dynamic arrivals from BE
  const [arrivals, setArrivals] = useState<Booking[]>([])
  const [activeBookingId, setActiveBookingId] = useState<string>('00000000-0000-0000-0000-000000000001')
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null)

  useEffect(() => {
    fetchArrivals()
    fetchOccupancy()
  }, [])

  const fetchOccupancy = async () => {
    try {
      const res = await reportService.getOccupancyReport()
      if (res) {
        setOccupancyData(res)
      }
    } catch {
      // Keep static defaults on network error
    }
  }

  const fetchArrivals = async () => {
    try {
      const res = await bookingService.getUpcomingArrivals()
      if (res && Array.isArray(res) && res.length > 0) {
        setArrivals(res)
      }
    } catch {
      // Fallback to static arrivals
    }
  }

  // Inspection Return state (Công ty CP Thương mại ABC - #C-302)
  const [returnConfirmed, setReturnConfirmed] = useState(false)

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
      
      {/* 1. TOP OPERATIONAL SHIFT HEADER */}
      <div className="w-full bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[26px] text-cyan-400">desktop_windows</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline text-xl font-bold text-slate-900">
                  Bàn Vận Hành Quầy &amp; Tiếp Đón Thực Địa
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold uppercase tracking-wider">
                  Ca sáng: 08:00 - 16:30
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang trực ca
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-1">
                Trực ca: <strong className="text-slate-900">Nguyễn Quỳnh Anh (NV-842)</strong> • Phụ trách tiếp đón, kiểm toán hiện trường và xử lý sự cố phát sinh.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Quét QR Check-in</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWalkinOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Khách Walk-in Vãng Lai</span>
            </button>
            <button
              type="button"
              onClick={() => alert('Lệnh khẩn cấp: Cửa sảnh và cửa kiểm soát Barrier đã được mở cưỡng bức trong 60 giây.')}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>Mở Cửa Khẩn Cấp</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. AUTONOMOUS 4-METRIC KPI DASHBOARD ROW (Eliminating Card-in-Card Nesting) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Lịch Check-in Hôm Nay
            </span>
            <span className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[var(--brand-teal,#0891b2)]">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-slate-900 tabular-nums">12</span>
            <span className="text-xs text-slate-500">lịch hẹn</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
            <span className="h-2 w-2 rounded-full bg-[var(--brand-teal,#0891b2)]"></span>
            <span>4 khách đã tới sảnh</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Yêu Cầu Nghiệm Thu Trả Kho
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[18px]">assignment_return</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-amber-700 tabular-nums">5</span>
            <span className="text-xs text-slate-500">hợp đồng tất toán</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <span>2 đơn đang chờ thủ kho nghiệm thu</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-rose-700 font-mono">
              Sự Cố Tại Chỗ (On-site)
            </span>
            <span className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-rose-600 tabular-nums">3</span>
            <span className="text-xs text-slate-500">ticket đang mở</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-700 font-bold">
            <span>1 ca mức độ Cao (Cần xử lý ngay)</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Tỷ Lệ Lấp Đầy Hiện Hữu
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <span className="material-symbols-outlined text-[18px]">pie_chart</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-headline text-3xl font-extrabold text-slate-900 tabular-nums">
              {occupancyData?.systemSummary?.occupancyRate ? `${occupancyData.systemSummary.occupancyRate.toFixed(1)}%` : '64.3%'}
            </span>
            <span className="font-mono text-xs text-slate-500">
              {occupancyData?.systemSummary?.occupiedUnits ?? 36}/{occupancyData?.systemSummary?.totalUnits ?? 56} KHO
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-[var(--brand-teal,#0891b2)] h-full rounded-full transition-all" 
              style={{ width: `${occupancyData?.systemSummary?.occupancyRate ?? 64.3}%` }}
            ></div>
          </div>
        </div>

      </div>

      {/* 3. TACTICAL SEARCH & LOCATION FILTER RIBBON */}
      <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm nhanh tên khách hàng, SĐT, mã đặt chỗ #RES-XXXX, hoặc mã số kho..."
            className="w-full pl-10 pr-3 py-2 bg-slate-50 text-slate-900 text-xs rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Khu vực:</span>
            <select className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer">
              <option value="all">Tất cả tầng (Mega Central)</option>
              <option value="f1">Tầng 1 (Kho Standard &amp; Garage)</option>
              <option value="f2">Tầng 2 (Kho Climate Control)</option>
              <option value="f3">Tầng 3 (Locker cá nhân)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Khung giờ:</span>
            <select className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer">
              <option value="current">Ca Hiện Tại (08:00 - 12:00)</option>
              <option value="today">Trọn Vẹn Hôm Nay</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Dual Workspace: Check-in Queue + Return Inspections */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Live Check-in & Handover Stepper Card (Col 8) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Handover & Check-in Operator Workbench */}
          <HandoverCheckInWorkbench
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            activeBookingId={activeBookingId}
            onHandoverComplete={(bookingId) => {
              setCheckInSuccessMsg(`Hoàn tất quy trình check-in bàn giao buồng kho cho đơn #${bookingId}`)
            }}
          />

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

            {/* Upcoming Appointments Table */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Danh sách hẹn tiếp theo trong ngày
              </span>
              <span className="text-xs text-slate-500 font-mono">Hiển thị 3 / 11 lịch còn lại</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 rounded-l-lg font-semibold">Khách hàng</th>
                    <th className="py-2.5 px-3 font-semibold">Mã Hẹn</th>
                    <th className="py-2.5 px-3 font-semibold">Kho Đăng Ký</th>
                    <th className="py-2.5 px-3 font-semibold">Giờ Hẹn</th>
                    <th className="py-2.5 px-3 font-semibold">Hồ sơ CCCD</th>
                    <th className="py-2.5 px-3 font-semibold">Cọc Giữ Chỗ</th>
                    <th className="py-2.5 px-3 rounded-r-lg text-right font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900 text-xs">Lê Thị Hoàng Yến</div>
                      <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">0988.219.002</div>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900">#RES-8924</td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold text-cyan-700">Kho #B-205</span>
                      <span className="text-slate-500 block text-[10px]">Climate Control 12m²</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono tabular-nums text-slate-700">10:15 Sáng</td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        Đã tải lên app
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900 tabular-nums">2.500.000đ (Đã TT)</td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => alert('Đã chuẩn bị hồ sơ cho chị Lê Thị Hoàng Yến')}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        Tiếp đón
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900 text-xs">Cty TNHH Logistics Vận Phát</div>
                      <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">0903.111.458 (Anh Hùng)</div>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900">#RES-8930</td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold text-cyan-700">Kho #A-004</span>
                      <span className="text-slate-500 block text-[10px]">Kho sỉ thương mại 35m²</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono tabular-nums text-slate-700">11:00 Sáng</td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
                        Chưa xuất trình ĐKKD
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-amber-700 tabular-nums">6.000.000đ (Chờ thu)</td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => alert('Đang mở file hồ sơ của công ty Vận Phát')}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        Chuẩn bị hồ sơ
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900 text-xs">Vũ Đức Thắng</div>
                      <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">0944.890.123</div>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900">#RES-8935</td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold text-cyan-700">Kho #C-118</span>
                      <span className="text-slate-500 block text-[10px]">Kho mini gia dụng 4m²</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono tabular-nums text-slate-700">14:00 Chiều</td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        Đã duyệt hợp đồng
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900 tabular-nums">1.000.000đ (Đã TT)</td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => alert('Mở chi tiết đặt chỗ #RES-8935')}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
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
                <div className="p-2 rounded bg-[var(--brand-teal,#0891b2)] text-white font-bold text-xs shadow-xs animate-pulse">#A-112<br/><span className="text-[10px] uppercase font-semibold">BÀN GIAO</span></div>
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
                  <span className="material-symbols-outlined text-[var(--brand-teal,#0891b2)] text-[22px]">fact_check</span>
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
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-800">Vị trí: <strong className="font-mono text-slate-900">Kho #C-302 (15m²)</strong></span>
                  <span className="text-amber-700 font-mono font-bold text-[11px]">Hết hạn: Hôm nay</span>
                </div>
              </div>

              {/* 4 Inspection Checklist Items */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-mono">
                    Biên bản thẩm định hiện trường
                  </span>
                  <span className="text-xs text-slate-500 font-mono">4/4 tiêu chuẩn</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">garage</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Tình trạng cửa cuốn</span>
                      <span className="text-[10px] text-slate-500">Mở êm, không móp méo, ray dẫn tốt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Tốt
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">cleaning_services</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Vệ sinh kho &amp; sàn</span>
                      <span className="text-[10px] text-slate-500">Đã dọn sạch rác, không ẩm ướt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Sạch sẽ
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">lock</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Ổ khóa Smart Lock</span>
                      <span className="text-[10px] text-slate-500">Cảm biến nhạy, pin 92%</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Bình thường
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">thermostat</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Cảm biến nhiệt / ẩm</span>
                      <span className="text-[10px] text-slate-500 font-mono">22°C • 48% RH (Chuẩn)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Chuẩn
                  </span>
                </div>

                {/* Proof Photos */}
                <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-900 uppercase font-mono">
                      Ảnh chụp hiện trường (Bắt buộc)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">2/2 ảnh</span>
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

                {/* Settlement Summary */}
                <div className="mt-2 p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền cọc giữ ban đầu:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">2.000.000đ</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Khấu trừ vệ sinh/hư hại:</span>
                    <span className="font-mono tabular-nums text-slate-500">0đ</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-900 pt-2 border-t border-slate-200">
                    <span className="font-bold">Số tiền hoàn trả khách:</span>
                    <span className="font-mono tabular-nums text-base text-emerald-600 font-extrabold">2.000.000đ</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setReturnConfirmed(true)
                alert('Đã hoàn tất nghiệm thu trả kho #C-302. Lệnh hoàn cọc 2.000.000đ đã được chuyển sang cổng thanh toán tự động.')
              }}
              disabled={returnConfirmed}
              className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
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
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
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
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_alert</span>
            <span>Tạo Báo Cáo Mới</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 rounded-l-lg font-semibold">Mã Ticket</th>
                <th className="py-2.5 px-3 font-semibold">Mô Tả Chi Tiết Sự Cố</th>
                <th className="py-2.5 px-3 font-semibold">Vị Trí &amp; Kho</th>
                <th className="py-2.5 px-3 font-semibold">Mức Độ</th>
                <th className="py-2.5 px-3 font-semibold">Nhân Viên Phụ Trách</th>
                <th className="py-2.5 px-3 font-semibold">Thời Gian</th>
                <th className="py-2.5 px-3 rounded-r-lg text-right font-semibold">Thao tác xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {tickets.map((tk) => (
                <tr 
                  key={tk.id} 
                  className={`hover:bg-slate-50/70 transition-colors ${
                    tk.priority === 'HIGH' ? 'bg-rose-50/40' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-mono text-xs font-bold text-slate-900">
                    {tk.id}
                  </td>
                  <td className="py-3 px-3 max-w-xs">
                    <span className="font-bold text-slate-900 block text-xs">{tk.title}</span>
                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{tk.detail}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-slate-800">{tk.location}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase inline-flex items-center gap-1 ${
                      tk.priority === 'HIGH'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : tk.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        tk.priority === 'HIGH' ? 'bg-rose-600' : tk.priority === 'MEDIUM' ? 'bg-amber-600' : 'bg-slate-400'
                      }`}></span>
                      {tk.priority === 'HIGH' ? 'Ưu tiên Cao' : tk.priority === 'MEDIUM' ? 'Bình thường' : 'Thấp'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">{tk.staff}</td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px] tabular-nums">{tk.time}</td>
                  <td className="py-3 px-3 text-right">
                    {tk.status === 'RESOLVED' ? (
                      <span className="text-emerald-600 font-mono font-bold text-[11px]">✓ Đã giải quyết</span>
                    ) : (
                      <button
                        onClick={() => {
                          setTickets(prev => prev.map(t => t.id === tk.id ? { ...t, status: 'RESOLVED' } : t))
                          alert(`Đã hoàn tất xử lý ticket ${tk.id}`)
                        }}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
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
                    className="flex-1 py-2.5 bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    Cấp Thẻ Tham Quan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Real-time HTML5-QRCode Camera Scanner Modal & Check-in API */}
      <QrCameraCheckInModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onCheckInSuccess={(bookingId, result) => {
          setActiveBookingId(bookingId)
          setCheckInSuccessMsg(`Check-in qua QR Camera thành công! PIN cấp: ${result.accessPin} (Thẻ: ${result.rfidCard})`)
        }}
        onSelectBookingForWorkbench={(bookingId) => {
          setActiveBookingId(bookingId)
        }}
      />

    </div>
  )
}

