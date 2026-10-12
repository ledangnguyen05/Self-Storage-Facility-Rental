import React, { useState, useEffect } from 'react'

export const FloatingContactWidget: React.FC = () => {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [viewerCount, setViewerCount] = useState(37)
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [showZaloModal, setShowZaloModal] = useState(false)

  // Track window scroll to display scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 150)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Natural fluctuation for viewer count (between 35 and 43)
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1
        const next = prev + delta
        return next >= 35 && next <= 43 ? next : prev
      })
    }, 18000)
    return () => clearInterval(interval)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <>
      {/* Floating Action Speed-Dial Container (Fixed bottom-right) */}
      <div className="fixed right-4 sm:right-6 bottom-6 z-50 flex flex-col items-center gap-2.5 select-none print:hidden">
        
        {/* ========================================================== */}
        {/* BUTTON 1: SCROLL TO TOP & VIEWER COUNTER                   */}
        {/* ========================================================== */}
        <div className="flex flex-col items-center group relative">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
            Cuộn lên đầu trang
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Cuộn lên đầu trang"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1e293b] hover:bg-slate-900 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer ${
              showScrollTop ? 'opacity-100 scale-100' : 'opacity-85 scale-95'
            }`}
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-white transition-transform group-hover:-translate-y-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>

          {/* Viewer count pill right under button 1 */}
          <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-white/95 border border-slate-200/80 shadow-2xs font-mono text-[10px] sm:text-[11px] font-bold text-slate-700">
            <span className="material-symbols-outlined text-[12px] sm:text-[13px] text-slate-500">visibility</span>
            <span>{viewerCount}</span>
          </div>
        </div>

        {/* ========================================================== */}
        {/* BUTTON 2: ZALO CHAT / ONLINE SUPPORT                        */}
        {/* ========================================================== */}
        <div className="relative group">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-emerald-800 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
            Chat Zalo tư vấn 24/7
          </div>

          {/* Pulse Ripple Effect Ring */}
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />

          <button
            type="button"
            onClick={() => setShowZaloModal(true)}
            aria-label="Tư vấn qua Zalo"
            className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#22c55e] hover:bg-[#16a34a] text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <svg
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </button>
        </div>

        {/* ========================================================== */}
        {/* BUTTON 3: HOTLINE PHONE CALL (BLUE)                        */}
        {/* ========================================================== */}
        <div className="relative group">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-blue-800 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
            Hotline: 1900-BOXORA (1900 269 672)
          </div>

          {/* Pulse Ring */}
          <div className="absolute inset-0 rounded-full bg-blue-500/25 animate-pulse pointer-events-none" />

          <a
            href="tel:1900269672"
            aria-label="Gọi hotline 1900-BOXORA"
            className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-[wiggle_1.5s_ease-in-out_infinite]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z" />
            </svg>
          </a>
        </div>

        {/* ========================================================== */}
        {/* BUTTON 4: WAREHOUSE LOCATIONS & MAPS PIN (WHITE)           */}
        {/* ========================================================== */}
        <div className="relative group">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
            Vị trí cơ sở Boxora
          </div>

          <button
            type="button"
            onClick={() => setShowBranchModal(true)}
            aria-label="Xem vị trí 3 cơ sở kho Boxora"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 flex items-center justify-center shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <svg
              className="w-5 h-5 text-slate-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </button>
        </div>

      </div>

      {/* ============================================================ */}
      {/* MODAL 1: ZALO OA QUICK ASSISTANT DIALOG                      */}
      {/* ============================================================ */}
      {showZaloModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-slate-900 text-base">Zalo Hỗ Trợ Boxora</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Tư vấn viên trực tuyến 24/7</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowZaloModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
              <div className="text-xs font-bold text-emerald-950">Quý khách cần hỗ trợ nhanh?</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nhắn tin Zalo với chuyên viên Boxora để nhận hình ảnh buồng kho thực tế, bảng báo giá ưu đãi tháng này hoặc đặt lịch tham quan kho mẫu trực tiếp.
              </p>
            </div>

            <div className="space-y-2.5">
              <a
                href="https://zalo.me/0901234567"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <span>Mở Zalo Chat Ngay (0901 234 567)</span>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>

              <a
                href="tel:1900269672"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-blue-600">call</span>
                <span>Hoặc gọi Hotline: 1900-BOXORA</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: 3 FACILITY HUBS LOCATIONS MODAL                     */}
      {/* ============================================================ */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[var(--brand-teal,#0891b2)] flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">location_on</span>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-slate-900 text-base">Hệ Thống 3 Cơ Sở Kho Boxora</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Hoạt động tự quản liên tục 24/7/365</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              
              {/* Branch 1 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-headline font-bold text-slate-900 text-xs sm:text-sm">
                    Cơ Sở 1: TP. Thủ Đức (Hi-Tech Park)
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    Mở Cửa 24/7
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Lô D2, Khu Công Nghệ Cao, P. Tăng Nhơn Phú B, TP. Thủ Đức, TP.HCM
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Khoảng cách: ~1.8 km</span>
                  <span>•</span>
                  <span>Tiếp cận xe tải 5T</span>
                  <span>•</span>
                  <a
                    href="https://maps.google.com/?q=Lô+D2+Khu+Cong+Nghe+Cao+Thu+Duc"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-800 font-bold hover:underline ml-auto flex items-center gap-0.5"
                  >
                    <span>Chỉ đường</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>

              {/* Branch 2 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-headline font-bold text-slate-900 text-xs sm:text-sm">
                    Cơ Sở 2: Nam Sài Gòn (Giáp Q.7 / Trung Sơn)
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    Mở Cửa 24/7
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  120 Đường Số 7, KDC Trung Sơn, Xã Bình Hưng, TP.HCM (Cách cầu Kênh Xáng 300m)
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Kho mát 18°C</span>
                  <span>•</span>
                  <span>Thang máy tải hàng 2T</span>
                  <span>•</span>
                  <a
                    href="https://maps.google.com/?q=120+Duong+So+7+KDC+Trung+Son"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-800 font-bold hover:underline ml-auto flex items-center gap-0.5"
                  >
                    <span>Chỉ đường</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>

              {/* Branch 3 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-headline font-bold text-slate-900 text-xs sm:text-sm">
                    Cơ Sở 3: Tân Bình Hub (Sân Bay TSN)
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    Mở Cửa 24/7
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  45 Bạch Đằng, Phường 2, Quận Tân Bình, TP.HCM (Cách sân bay Tân Sơn Nhất 800m)
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Locker mini &amp; Vali</span>
                  <span>•</span>
                  <span>Bãi đỗ ô tô miễn phí</span>
                  <span>•</span>
                  <a
                    href="https://maps.google.com/?q=45+Bach+Dang+Phuong+2+Tan+Binh"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-800 font-bold hover:underline ml-auto flex items-center gap-0.5"
                  >
                    <span>Chỉ đường</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>

            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs text-slate-700 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
