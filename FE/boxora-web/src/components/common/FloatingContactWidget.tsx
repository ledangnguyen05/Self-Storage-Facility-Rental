import { useLanguage } from '../../context/LanguageContext'
import React, { useState, useEffect, useRef, useCallback } from 'react'

export const FloatingContactWidget: React.FC = () => {
  const { t } = useLanguage();

  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [showZaloModal, setShowZaloModal] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const isDialogOpen = showBranchModal || showZaloModal

  const closeDialogs = useCallback(() => {
    setShowBranchModal(false)
    setShowZaloModal(false)
  }, [])

  // Track window scroll to display scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 150)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!isDialogOpen) return

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialogs()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleDialogKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      triggerRef.current?.focus()
    }
  }, [isDialogOpen, closeDialogs])



  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
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
          <div id="scroll-top-tooltip" role="tooltip" className="absolute right-full mr-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-bold whitespace-nowrap text-slate-800 dark:text-slate-100 opacity-0 shadow-xl border transition-all duration-200 group-hover:-translate-x-0.5 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none">
            {t('Cuộn lên đầu trang')}
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Cuộn lên đầu trang"
            aria-describedby="scroll-top-tooltip"
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 shadow-slate-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 cursor-pointer ${
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
        </div>

        {/* ========================================================== */}
        {/* BUTTON 2: ZALO CHAT / ONLINE SUPPORT                        */}
        {/* ========================================================== */}
        <div className="relative group">
          {/* Tooltip */}
          <div id="zalo-tooltip" role="tooltip" className="absolute right-full mr-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-bold whitespace-nowrap text-slate-800 dark:text-slate-100 opacity-0 shadow-xl border transition-all duration-200 group-hover:-translate-x-0.5 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none">
            {t('Chat Zalo tư vấn 24/7')}
          </div>

          {/* Pulse Ripple Effect Ring */}
          <div className="absolute inset-0 rounded-full bg-blue-500/25 animate-ping motion-reduce:animate-none pointer-events-none" />

          <button
            type="button"
            onClick={(event) => {
              triggerRef.current = event.currentTarget
              setShowBranchModal(false)
              setShowZaloModal(true)
            }}
            aria-label="Tư vấn qua Zalo"
            aria-haspopup="dialog"
            aria-expanded={showZaloModal}
            aria-controls="boxora-zalo-dialog"
            aria-describedby="zalo-tooltip"
            className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 cursor-pointer"
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
        {/* BUTTON 3: HOTLINE PHONE CALL                               */}
        {/* ========================================================== */}
        <div className="relative group">
          {/* Tooltip */}
          <div id="hotline-tooltip" role="tooltip" className="absolute right-full mr-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-bold whitespace-nowrap text-slate-800 dark:text-slate-100 opacity-0 shadow-xl border transition-all duration-200 group-hover:-translate-x-0.5 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none">
            Hotline: 1900-BOXORA (1900 269 672)
          </div>

          {/* Pulse Ring */}
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-pulse motion-reduce:animate-none pointer-events-none" />

          <a
            href="tel:1900269672"
            aria-label="Gọi hotline 1900-BOXORA"
            aria-describedby="hotline-tooltip"
            className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 shadow-slate-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 cursor-pointer"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-white transition-transform group-hover:rotate-[-8deg] motion-reduce:animate-none"
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
          <div id="branches-tooltip" role="tooltip" className="absolute right-full mr-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-bold whitespace-nowrap text-slate-800 dark:text-slate-100 opacity-0 shadow-xl border transition-all duration-200 group-hover:-translate-x-0.5 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none">
            Vị trí cơ sở Boxora
          </div>

          <button
            type="button"
            onClick={(event) => {
              triggerRef.current = event.currentTarget
              setShowZaloModal(false)
              setShowBranchModal(true)
            }}
            aria-label="Xem vị trí 3 cơ sở kho Boxora"
            aria-haspopup="dialog"
            aria-expanded={showBranchModal}
            aria-controls="boxora-branches-dialog"
            aria-describedby="branches-tooltip"
            className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 cursor-pointer"
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
        <div
          className="contact-modal-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && closeDialogs()}
        >
          <div
            id="boxora-zalo-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="boxora-zalo-title"
            tabIndex={-1}
            className="contact-modal-panel max-h-[calc(100svh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left shadow-[0_24px_80px_rgba(15,23,42,.28)] sm:p-6"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white shadow-xs">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                  </div>
                  <div>
                    <h4 id="boxora-zalo-title" className="font-headline text-base font-bold text-slate-900">Zalo Hỗ Trợ Boxora</h4>
                    <p className="text-[11px] text-slate-500 font-mono">Tư vấn viên trực tuyến 24/7</p>
                  </div>
                </div>
                <button
                  type="button"
                  ref={closeButtonRef}
                  onClick={closeDialogs}
                  aria-label="Đóng hộp thoại hỗ trợ Zalo"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="text-xs font-bold text-blue-950">Quý khách cần hỗ trợ nhanh?</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nhắn tin Zalo với chuyên viên Boxora để nhận hình ảnh buồng kho thực tế, bảng báo giá ưu đãi tháng này hoặc đặt lịch tham quan kho mẫu trực tiếp.
                </p>
              </div>

              <div className="space-y-2.5">
                <a
                  href="https://zalo.me/0901234567"
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-xs font-semibold text-white shadow-sm shadow-sm transition-all hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer"
                >
                  <span>Mở Zalo Chat Ngay (0901 234 567)</span>
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>

                <a
                  href="tel:1900269672"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-800 transition-all hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-blue-700">call</span>
                  <span>Hoặc gọi Hotline: 1900-BOXORA</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: 3 FACILITY HUBS LOCATIONS MODAL                     */}
      {/* ============================================================ */}
      {showBranchModal && (
        <div
          className="contact-modal-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && closeDialogs()}
        >
          <div
            id="boxora-branches-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="boxora-branches-title"
            tabIndex={-1}
            className="contact-modal-panel flex max-h-[min(88svh,48rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left shadow-[0_24px_80px_rgba(15,23,42,.28)] sm:p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-800 shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">location_on</span>
                </div>
                <div>
                  <h4 id="boxora-branches-title" className="font-headline text-base font-bold text-slate-900">Hệ Thống 3 Cơ Sở Kho Boxora</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Hoạt động tự quản liên tục 24/7/365</p>
                </div>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={closeDialogs}
                aria-label="Đóng danh sách cơ sở"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div role="region" aria-label="Danh sách ba cơ sở Boxora" tabIndex={0} className="mt-5 min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              
              {/* Branch 1 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 space-y-2">
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
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                  <span>Khoảng cách: ~1.8 km</span>
                  <span>•</span>
                  <span>Tiếp cận xe tải 5T</span>
                  <span>•</span>
                  <a
                    href="https://maps.google.com/?q=Lô+D2+Khu+Cong+Nghe+Cao+Thu+Duc"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-0.5 font-bold text-blue-800 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
                  >
                    <span>Chỉ đường</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>

              {/* Branch 2 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 space-y-2">
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
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                  <span>Kho mát 18°C</span>
                  <span>•</span>
                  <span>Thang máy tải hàng 2T</span>
                  <span>•</span>
                  <a
                    href="https://maps.google.com/?q=120+Duong+So+7+KDC+Trung+Son"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-0.5 font-bold text-blue-800 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
                  >
                    <span>Chỉ đường</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>

              {/* Branch 3 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 space-y-2">
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
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                  <span>Locker mini &amp; Vali</span>
                  <span>•</span>
                  <span>Bãi đỗ ô tô miễn phí</span>
                  <span>•</span>
                  <a
                    href="https://maps.google.com/?q=45+Bach+Dang+Phuong+2+Tan+Binh"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-0.5 font-bold text-blue-800 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
                  >
                    <span>Chỉ đường</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>

            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closeDialogs}
                className="min-h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer"
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
