import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'
import { BrandLogo } from '../../components/common/BrandLogo'
import { SmartLockerDynamicHero } from '../../components/home/SmartLockerDynamicHero'
import {
  CinematicProcessSection,
  ProcessStepNumber
} from '../../components/home/CinematicProcessSection'
import { CinematicIotVaultSection } from '../../components/home/CinematicIotVaultSection'
import { CinematicServicesSection } from '../../components/home/CinematicServicesSection'
import { CinematicVolumetricAtelier } from '../../components/home/CinematicVolumetricAtelier'
import {
  CinematicPoliciesAndFaq,
  PolicyTabKey,
  FaqCategoryKey
} from '../../components/home/CinematicPoliciesAndFaq'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { useLanguage } from '../../context/LanguageContext'
import { SizeTierKey } from '../../components/booking/LandingBookingWizardModal'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'


// ============================================================================
// MAIN HOMEPAGE COMPONENT — CINEMATIC ARCHITECTURAL STORYTELLING
// ============================================================================
export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const { t } = useLanguage()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  const isCustomer = user?.role?.name === 'CUSTOMER'
  const canAccessPortal = !isCustomer || checkCustomerPortalAccess(user).hasAccess

  // Interactive 6-Step Process State (Synced with 6-step BookingPage flow)
  const [activeProcessStep, setActiveProcessStep] = useState<ProcessStepNumber>(1)

  // Interactive Size Guide State
  const [selectedSizeTier, setSelectedSizeTier] = useState<SizeTierKey>('STANDARD')

  // Policies active tab state
  const [activePolicyTab, setActivePolicyTab] = useState<PolicyTabKey>('deposit')

  // FAQ active filter and item state
  const [faqFilter, setFaqFilter] = useState<FaqCategoryKey>('ALL')
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(0)

  // Booking Navigation
  const handleOpenBooking = (tier?: SizeTierKey) => {
    const selected = tier || selectedSizeTier
    navigate(`/booking?type=${selected}`)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white overflow-x-clip">
        
        {/* ============================================================ */}
        {/* 1. TOP UNIFIED NAVIGATION BAR (STICKY WITH BACKDROP BLUR)    */}
        {/* ============================================================ */}
        <header className="sticky top-0 z-[100] border-b border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl transition-colors">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
            
            {/* Brand Logo */}
            <BrandLogo size="sm" subtitle="KHO TỰ QUẢN THÔNG MINH" />

            {/* Nav Links (Desktop) */}
            <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 dark:text-slate-300 lg:flex">
              <a href="#process" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                {t('Cách hoạt động')}
              </a>
              <a href="#iot-access" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                {t('Công nghệ')}
              </a>
              <a href="#services" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                {t('Dịch vụ')}
              </a>
              <a href="#size-guide" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                {t('Kích cỡ & Giá')}
              </a>
              <a href="#policies" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                {t('Chính sách')}
              </a>
              <a href="#faq" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                {t('Hỗ trợ')}
              </a>
            </nav>

            {/* Action CTAs */}
            <div className="flex items-center gap-3">
              <QuickThemeLanguageToggle />

              {isAuthenticated ? (
                <UserAvatarDropdown
                  user={user}
                  role={user?.role?.name || 'CUSTOMER'}
                  onOpenProfile={() => setIsProfileModalOpen(true)}
                  onOpenSettings={() => setIsSettingsModalOpen(true)}
                  onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
                  extraActions={
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                      {canAccessPortal ? (
                        <button
                          type="button"
                          onClick={() => navigate(isCustomer ? '/portal/customer' : '/portal')}
                          className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 text-white font-semibold text-xs flex items-center justify-between hover:bg-blue-700 shadow-xs transition-all shadow-xs cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                            <span>{isCustomer ? t('Vào Portal Quản Lý Kho (Khóa IoT)') : t('Vào Trang Điều Hành Portal')}</span>
                          </span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate('/my-bookings')}
                          className="w-full py-2.5 px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold text-xs flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-xs cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">calendar_month</span>
                            <span>{t('Đơn Đặt Giữ Chỗ Của Tôi')}</span>
                          </span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      )}
                    </div>
                  }
                />
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-3 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 transition-colors hover:text-slate-950 dark:hover:text-white dark:hover:text-white"
                  >
                    {t('Đăng Nhập')}
                  </Link>
                  <Link
                    to="/booking"
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 hover:bg-blue-800 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors shadow-xs"
                  >
                    <span>{t('Thuê Kho Ngay')}</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </>
              )}
            </div>

          </div>
        </header>

        {/* ============================================================ */}
        {/* 2. PROTECTED REGION: BOXORA AUTONOMOUS INTERACTIVE HERO       */}
        {/*    (100% Untouched as requested by the user)                 */}
        {/* ============================================================ */}
        <SmartLockerDynamicHero onBookNow={() => handleOpenBooking()} />

        {/* ============================================================ */}
        {/* 3. CHAPTER 01: 6-STEP AUTONOMOUS BOOKING BLUEPRINT           */}
        {/* ============================================================ */}
        <CinematicProcessSection
          activeProcessStep={activeProcessStep}
          setActiveProcessStep={setActiveProcessStep}
          onBookNow={() => handleOpenBooking()}
        />

        {/* ============================================================ */}
        {/* 4. CHAPTER 02: THE DARK VAULT — IOT TELEMETRY & ACCESS       */}
        {/* ============================================================ */}
        <CinematicIotVaultSection />

        {/* ============================================================ */}
        {/* 5. CHAPTER 03: SPATIAL TYPOLOGIES & 4 STRATEGIC HUBS         */}
        {/* ============================================================ */}
        <CinematicServicesSection onBookNow={() => handleOpenBooking()} />

        {/* ============================================================ */}
        {/* 6. CHAPTER 04: THE VOLUMETRIC ATELIER (16 SIZES 1M³ - 24M³)  */}
        {/* ============================================================ */}
        <CinematicVolumetricAtelier
          selectedSizeTier={selectedSizeTier}
          setSelectedSizeTier={setSelectedSizeTier}
          onBookTier={(tier) => handleOpenBooking(tier)}
        />

        {/* ============================================================ */}
        {/* 7. CHAPTER 05, 06 & 07: POLICIES, DISPATCH FAQ & FINALE      */}
        {/* ============================================================ */}
        <CinematicPoliciesAndFaq
          activePolicyTab={activePolicyTab}
          setActivePolicyTab={setActivePolicyTab}
          faqFilter={faqFilter}
          setFaqFilter={setFaqFilter}
          activeFaqIndex={activeFaqIndex}
          setActiveFaqIndex={setActiveFaqIndex}
          onBookNow={() => handleOpenBooking()}
        />

        {/* ============================================================ */}
        {/* 8. SITE FOOTER (4 COLUMNS ENTERPRISE ARCHITECTURE)           */}
        {/* ============================================================ */}
        <footer className="pt-16 pb-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-400">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
              
              {/* Column 1: Brand & Credentials */}
              <div className="space-y-4">
                <BrandLogo size="md" subtitle="SMART STORAGE SYSTEMS" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hệ thống phòng kho tự quản thông minh đầu tiên tại Việt Nam ứng dụng khóa bảo mật IoT, kiểm soát vi khí hậu 24/7 và cấp mã PIN truy cập số hóa tức thời.
                </p>
              </div>

              {/* Column 2: Loại Buồng Kho & Kích Cỡ */}
              <div className="space-y-4">
                <h4 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Loại Kho &amp; Kích Cỡ
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li>
                    <a href="#services" className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Buồng Kho Tiêu Chuẩn (Non-A/C)</span>
                    </a>
                  </li>
                  <li>
                    <a href="#services" className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Buồng Kho Máy Lạnh A/C (18–22°C)</span>
                    </a>
                  </li>
                  <li>
                    <a href="#size-guide" onClick={() => setSelectedSizeTier('LOCKER')} className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Cỡ Kho Mini &amp; Nhỏ (1m³ – 4m³)</span>
                    </a>
                  </li>
                  <li>
                    <a href="#size-guide" onClick={() => setSelectedSizeTier('STANDARD')} className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Cỡ Kho Tiêu Chuẩn (5m³ – 9m³)</span>
                    </a>
                  </li>
                  <li>
                    <a href="#size-guide" onClick={() => setSelectedSizeTier('LARGE')} className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Cỡ Kho Lớn (10m³ – 24m³)</span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 3: Chính Sách & Quy Định */}
              <div className="space-y-4">
                <h4 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Chính Sách &amp; Quy Định
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li>
                    <a href="#policies" onClick={() => setActivePolicyTab('deposit')} className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Chính Sách Tiền Cọc &amp; Hoàn Trả</span>
                    </a>
                  </li>
                  <li>
                    <a href="#policies" onClick={() => setActivePolicyTab('insurance')} className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Bảo Hiểm Tài Sản 50–500 Triệu</span>
                    </a>
                  </li>
                  <li>
                    <a href="#policies" onClick={() => setActivePolicyTab('contract')} className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Gia Hạn &amp; Đổi Cỡ Kho Miễn Phí</span>
                    </a>
                  </li>
                  <li>
                    <a href="#policies" onClick={() => setActivePolicyTab('prohibited')} className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Danh Mục Hàng Cấm &amp; PCCC</span>
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-600">chevron_right</span>
                      <span>Câu Hỏi Thường Gặp (FAQs)</span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 4: Hệ Thống Cơ Sở & Liên Hệ */}
              <div className="space-y-4">
                <h4 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Hệ Thống 4 Cơ Sở Kho
                </h4>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">Cơ Sở 1 • Boxora Quận 1:</div>
                    <p className="text-slate-500">123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP.HCM</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">Cơ Sở 2 • Boxora Quận 7 (Nam Sài Gòn):</div>
                    <p className="text-slate-500">456 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7, TP.HCM</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">Cơ Sở 3 • Boxora Thủ Đức Hub:</div>
                    <p className="text-slate-500">789 Võ Văn Ngân, P. Linh Chiểu, TP. Thủ Đức, TP.HCM</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">Cơ Sở 4 • Boxora Tân Bình Mega Hub:</div>
                    <p className="text-slate-500">102 Trường Sơn, Phường 2, Quận Tân Bình, TP.HCM</p>
                  </div>
                  <div className="pt-2 text-blue-700 font-mono font-bold text-xs">
                    Hotline: 1900-BOXORA (24/7)
                  </div>
                </div>
              </div>

            </div>

            {/* Sub-footer Bottom Line */}
            <div className="pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-slate-500">
              <div>
                © 2026 Boxora Smart Storage. Tất cả các quyền được bảo lưu.
              </div>
              <div className="flex items-center gap-6">
                <Link to="/booking" className="hover:text-slate-900 text-blue-700 font-bold transition-colors">
                  Dashboard Tìm Kho
                </Link>
                <Link to="/login" className="hover:text-slate-900 transition-colors">
                  Đăng Nhập
                </Link>
                <Link to="/register" className="hover:text-slate-900 transition-colors">
                  Đăng Ký
                </Link>
              </div>
            </div>

          </div>
        </footer>

        {/* Floating Action Speed-Dial Widget (Scroll Top, Zalo, Hotline, Maps) */}
        <FloatingContactWidget />

        <AccountProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
        <WebSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
        <LogoutConfirmModal
          isOpen={isLogoutConfirmOpen}
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={async () => {
            await logout()
            navigate('/login')
          }}
          userName={user?.fullName || user?.username}
          userEmail={user?.email}
          userRole={user?.role?.name || 'CUSTOMER'}
        />

      </div>
    </MotionConfig>
  )
}
