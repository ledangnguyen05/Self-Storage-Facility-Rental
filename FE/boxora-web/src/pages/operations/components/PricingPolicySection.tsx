import { useState } from 'react'
import { Building2, ScrollText, Tags } from 'lucide-react'
import { Card, CardHeader, TabPanel, Tabs } from '@/components/ui'
import type { Facility } from '@/types'
import { FacilityPricePanel } from './pricing/FacilityPricePanel'
import { UnitTypePricingPanel } from './pricing/UnitTypePricingPanel'
import { PolicyRegistryPanel } from './policy/PolicyRegistryPanel'

type PricingPolicyTab = 'pricing' | 'facility-prices' | 'policies'

export interface PricingPolicySectionProps {
  facilities: readonly Facility[]
  /** Business manager edits prices and policies; admin gets the same tables read-only. */
  canManage: boolean
}

/** "Giá và chính sách": global unit type prices, per-branch prices with term discounts, and the facility policy registry. */
export function PricingPolicySection({ facilities, canManage }: PricingPolicySectionProps) {
  const [tab, setTab] = useState<PricingPolicyTab>('pricing')

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Giá và chính sách"
        description={
          canManage
            ? 'Điều chỉnh giá niêm yết, giá riêng từng cơ sở, chiết khấu theo kỳ hạn và quy định vận hành.'
            : 'Xem giá niêm yết, giá riêng từng cơ sở, chiết khấu theo kỳ hạn và quy định vận hành.'
        }
      />
      <div className="px-5">
        <Tabs
          id="pricing-policy"
          aria-label="Giá và chính sách"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'pricing', label: 'Bảng giá loại kho', icon: Tags },
            { value: 'facility-prices', label: 'Giá theo cơ sở', icon: Building2 },
            { value: 'policies', label: 'Chính sách cơ sở', icon: ScrollText },
          ]}
        />
      </div>
      <TabPanel tabsId="pricing-policy" value={tab}>
        {tab === 'pricing' ? (
          <UnitTypePricingPanel canEdit={canManage} />
        ) : tab === 'facility-prices' ? (
          <FacilityPricePanel facilities={facilities} canEdit={canManage} />
        ) : (
          <PolicyRegistryPanel facilities={facilities} canManage={canManage} />
        )}
      </TabPanel>
    </Card>
  )
}
