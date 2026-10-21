import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookingCheckoutModal, type BookingCheckoutUnit } from '../../components/modals/BookingCheckoutModal'
import { UnitDetailModal } from '../../components/modals/UnitDetailModal'
import { Drawer } from '../../components/ui'
import { buildLoginRedirect } from '../../constants/routes'
import type { StorageUnitType } from '../../data/storageUnitsData'
import { useAuth } from '../../context/AuthContext'
import { Container } from './components/Section'
import { PublicLayout } from './components/PublicLayout'
import { usePageTitle } from './components/usePageTitle'
import { UnitFiltersPanel } from './units/UnitFiltersPanel'
import { UnitsMapSection } from './units/UnitsMapSection'
import { UnitsResults } from './units/UnitsResults'
import { UnitsToolbar, type UnitsView } from './units/UnitsToolbar'
import { useUnitsExplorer } from './units/useUnitsExplorer'

const toCheckoutUnit = (unit: StorageUnitType): BookingCheckoutUnit => ({
  backendId: unit.id,
  code: unit.unitCode,
  name: unit.name,
  facilityName: unit.facilityName,
  monthlyPrice: unit.monthlyPrice,
  depositAmount: unit.depositAmount ?? unit.monthlyPrice,
  size: unit.areaSqMeters == null ? 'Chưa cập nhật' : `${unit.areaSqMeters} m²`,
  address: unit.facilityAddress,
})

/** Public unit search: filters in the URL, results grid/list, detail modal and checkout. */
export const UnitsExplorerPage: React.FC = () => {
  usePageTitle('Thuê kho')
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const explorer = useUnitsExplorer()
  const [view, setView] = useState<UnitsView>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [checkoutUnit, setCheckoutUnit] = useState<BookingCheckoutUnit | null>(null)

  const handleRent = (unit: StorageUnitType) => {
    if (!unit.isAvailable) return
    if (!isAuthenticated || !user) {
      navigate(buildLoginRedirect(`/units?unit=${encodeURIComponent(unit.id)}`))
      return
    }
    setCheckoutUnit(toCheckoutUnit(unit))
  }

  // A pin picked on the map narrows the list to that branch and brings the results into view.
  const handleSelectFacility = (facilityId: string) => {
    explorer.setFilter('facility', facilityId)
    document.getElementById('units-results')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <PublicLayout>
      <div className="border-b border-line bg-surface">
        <Container className="py-8">
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Thuê kho</h1>
          <p className="mt-2 max-w-2xl text-base text-fg-muted">
            Lọc theo cơ sở, diện tích và giá thuê để chọn kho phù hợp. Kho đã có người thuê vẫn được hiển thị và đánh dấu; chọn "Còn trống" để chỉ xem kho có thể thuê ngay.
          </p>
        </Container>
      </div>

      <Container className="py-6">
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside aria-label="Bộ lọc kho" className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-line bg-surface p-4">
              <h2 className="mb-4 text-base font-semibold text-fg">Bộ lọc</h2>
              <UnitFiltersPanel explorer={explorer} />
            </div>
          </aside>

          <section aria-label="Kết quả tìm kho" className="min-w-0 space-y-4">
            <UnitsMapSection explorer={explorer} onSelectFacility={handleSelectFacility} />
            <div id="units-results" className="scroll-mt-24" />
            <UnitsToolbar explorer={explorer} view={view} onViewChange={setView} onOpenFilters={() => setFiltersOpen(true)} />
            <UnitsResults explorer={explorer} view={view} onDetail={explorer.openUnit} onRent={handleRent} />
          </section>
        </div>
      </Container>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Bộ lọc" size="sm">
        <UnitFiltersPanel explorer={explorer} />
      </Drawer>

      <UnitDetailModal unit={explorer.inspectedUnit} isOpen={Boolean(explorer.inspectedUnit)} onClose={explorer.closeUnit} onRent={handleRent} />

      {checkoutUnit && user ? <BookingCheckoutModal unit={checkoutUnit} user={user} onClose={() => setCheckoutUnit(null)} /> : null}
    </PublicLayout>
  )
}

export default UnitsExplorerPage
