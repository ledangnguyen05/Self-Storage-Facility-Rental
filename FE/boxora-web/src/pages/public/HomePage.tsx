import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { SizeTierKey } from '../../components/booking/LandingBookingWizardModal'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { SiteHeader } from '../../components/home/v2/SiteHeader'
import { HeroSection } from '../../components/home/v2/HeroSection'
import { BrandIntro } from '../../components/home/v2/BrandIntro'
import { HowItWorks } from '../../components/home/v2/HowItWorks'
import { StorageSolutions } from '../../components/home/v2/StorageSolutions'
import { TechSecurity } from '../../components/home/v2/TechSecurity'
import { PricingSize } from '../../components/home/v2/PricingSize'
import { TrustExperience } from '../../components/home/v2/TrustExperience'
import { FaqSection } from '../../components/home/v2/FaqSection'
import { FinalCta } from '../../components/home/v2/FinalCta'
import { SiteFooter } from '../../components/home/v2/SiteFooter'

// ============================================================================
// HOMEPAGE v2 — premium corporate layout, each section lives in components/home/v2
// Booking flow, auth, portal navigation and profile modals are unchanged.
// ============================================================================
export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  const isCustomer = user?.role?.name === 'CUSTOMER'
  const canAccessPortal = !isCustomer || checkCustomerPortalAccess(user).hasAccess

  const handleOpenBooking = (tier?: SizeTierKey) => {
    navigate(tier ? `/booking?type=${tier}` : '/booking?type=STANDARD')
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-clip bg-white font-sans text-slate-900 selection:bg-sky-600 selection:text-white dark:bg-slate-950 dark:text-slate-100">
        <SiteHeader
          isAuthenticated={isAuthenticated}
          user={user}
          isCustomer={isCustomer}
          canAccessPortal={canAccessPortal}
          onNavigate={(path) => navigate(path)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
        />

        <main>
          <HeroSection onBookNow={() => handleOpenBooking()} />
          <BrandIntro />
          <HowItWorks onBookNow={() => handleOpenBooking()} />
          <StorageSolutions onBookNow={() => handleOpenBooking()} />
          <TechSecurity />
          <PricingSize onBookTier={(tier) => handleOpenBooking(tier)} />
          <TrustExperience onBookNow={() => handleOpenBooking()} />
          <FaqSection />
          <FinalCta onBookNow={() => handleOpenBooking()} />
        </main>

        <SiteFooter />

        <FloatingContactWidget />

        <AccountProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        <WebSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
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