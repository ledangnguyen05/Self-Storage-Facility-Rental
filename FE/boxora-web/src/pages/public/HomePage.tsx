import React from 'react'
import { PublicLayout } from './components/PublicLayout'
import { usePageTitle } from './components/usePageTitle'
import { FacilitiesSection } from './home/FacilitiesSection'
import { FaqSection } from './home/FaqSection'
import { FeaturesSection } from './home/FeaturesSection'
import { FinalCtaSection } from './home/FinalCtaSection'
import { HeroSection } from './home/HeroSection'
import { HowItWorksSection } from './home/HowItWorksSection'
import { SizeGuideSection } from './home/SizeGuideSection'
import { TrustStrip } from './home/TrustStrip'
import { useHashScroll } from './home/useHashScroll'
import { useHomeData } from './home/useHomeData'

/** Public landing page: a thin composition of the sections under `./home`. */
export const HomePage: React.FC = () => {
  usePageTitle('Thuê kho tự quản thông minh')
  useHashScroll()
  const data = useHomeData()

  return (
    <PublicLayout>
      <HeroSection summary={data.summary} />
      <TrustStrip />
      <HowItWorksSection />
      <SizeGuideSection prices={data.tierPrices} isLoading={data.tierPricesLoading} />
      <FeaturesSection />
      <FacilitiesSection
        facilities={data.facilities}
        isLoading={data.facilitiesLoading}
        error={data.facilitiesError}
        onRetry={() => void data.reloadFacilities()}
      />
      <FaqSection />
      <FinalCtaSection />
    </PublicLayout>
  )
}

export default HomePage
