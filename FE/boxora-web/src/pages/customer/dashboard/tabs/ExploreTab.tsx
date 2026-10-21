import { useMemo, useState, type ReactNode } from 'react'
import { Warehouse } from 'lucide-react'
import { Alert, Button, EmptyState, Pagination, SearchInput, Select } from '@/components/ui'
import { getFacilityLabel } from '@/components/layout/useFacilityScope'
import { floorOptionsOf, normalizeFloor } from '@/data/floorLabels'
import { useAsyncData } from '@/hooks/useAsyncData'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { storageUnitService } from '@/services/storageUnitService'
import type { Facility, StorageUnit } from '@/types'
import { AvailableUnitCard } from '../components/AvailableUnitCard'
import { CardGridSkeleton } from '../components/CardGridSkeleton'
import { UNIT_SIZE_OPTIONS, matchesUnitSize, type UnitSizeFilter } from '../constants'
import { matchesSearch } from '../lib/portal'
import { BookingCreateModal, type BookingCreatedResult } from '../modals/BookingCreateModal'

const ALL = 'all'
const PAGE_SIZES = [12, 24, 48]
const EMPTY_UNITS: StorageUnit[] = []

interface ExploreTabProps {
  facilities: Facility[]
  /** Facility preselected from the portal scope, if any. */
  initialFacilityId?: string
  onBookingCreated: (result: BookingCreatedResult) => void
  onViewBookings: () => void
}

/** "Thuê thêm": available units with a filter bar, and the booking wizard. */
export function ExploreTab({ facilities, initialFacilityId, onBookingCreated, onViewBookings }: ExploreTabProps) {
  const [facilityId, setFacilityId] = useState(initialFacilityId || ALL)
  const [floor, setFloor] = useState(ALL)
  const [size, setSize] = useState<UnitSizeFilter>('all')
  const [search, setSearch] = useState('')
  const [bookingUnit, setBookingUnit] = useState<StorageUnit | null>(null)

  // The facility filter is applied by the backend; floor, size and search narrow the loaded list.
  const { data = EMPTY_UNITS, error, isLoading, reload } = useAsyncData(
    signal =>
      storageUnitService
        .getUnits({ status: 'AVAILABLE', facilityId: facilityId === ALL ? undefined : facilityId }, { signal })
        .then(units => (Array.isArray(units) ? units : EMPTY_UNITS)),
    [facilityId],
    { initialData: EMPTY_UNITS },
  )

  // One option per floor: `Floor 1` and `Tầng 1` are the same floor, so the filter matches on the normalised key.
  const floors = useMemo(() => floorOptionsOf(data.map(unit => unit.floorLevel)), [data])
  const filtered = data.filter(
    unit =>
      (floor === ALL || normalizeFloor(unit.floorLevel).key === floor) &&
      matchesUnitSize(unit.areaSqMeters, size) &&
      matchesSearch(search, [unit.unitCode, unit.unitTypeName, unit.facilityName]),
  )
  const pager = usePagination({ items: filtered, initialPageSize: PAGE_SIZES[0] })
  const rows = pager.slice(filtered)
  const hasFilters = facilityId !== ALL || floor !== ALL || size !== 'all' || search.trim() !== ''

  const update = (apply: () => void) => {
    apply()
    pager.reset()
  }
  const clearFilters = () =>
    update(() => {
      setFacilityId(ALL)
      setFloor(ALL)
      setSize('all')
      setSearch('')
    })

  let content: ReactNode
  if (isLoading) {
    content = <CardGridSkeleton count={6} className="md:grid-cols-2 lg:grid-cols-3" />
  } else if (error) {
    content = (
      <Alert
        tone="danger"
        title="Không tải được danh sách kho trống"
        action={
          <Button size="sm" variant="secondary" onClick={() => void reload()}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  } else if (filtered.length === 0) {
    content = (
      <EmptyState
        icon={Warehouse}
        title={hasFilters ? 'Không có kho trống phù hợp' : 'Hiện chưa có kho trống'}
        description={hasFilters ? 'Thử chọn cơ sở, tầng hoặc kích thước khác.' : 'Vui lòng quay lại sau hoặc liên hệ hotline để được tư vấn.'}
        action={
          hasFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Xóa bộ lọc
            </Button>
          ) : null
        }
        className="rounded-lg border border-line bg-surface"
      />
    )
  } else {
    content = (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(unit => (
            <AvailableUnitCard key={unit.id} unit={unit} onBook={setBookingUnit} />
          ))}
        </div>
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
          pageSizeOptions={PAGE_SIZES}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput
          value={search}
          onValueChange={value => update(() => setSearch(value))}
          placeholder="Tìm mã kho hoặc loại kho"
          className="w-full lg:w-64"
        />
        <Select
          aria-label="Cơ sở"
          value={facilityId}
          onChange={event =>
            update(() => {
              setFacilityId(event.target.value)
              setFloor(ALL)
            })
          }
          options={[{ value: ALL, label: 'Tất cả cơ sở' }, ...facilities.map(facility => ({ value: facility.id, label: getFacilityLabel(facility) }))]}
          className="w-full lg:w-56"
        />
        <Select
          aria-label="Tầng"
          value={floor}
          onChange={event => update(() => setFloor(event.target.value))}
          options={[{ value: ALL, label: 'Tất cả tầng' }, ...floors.map(option => ({ value: option.key, label: option.label }))]}
          className="w-full lg:w-40"
        />
        <Select
          aria-label="Kích thước"
          value={size}
          onChange={event => update(() => setSize(event.target.value as UnitSizeFilter))}
          options={UNIT_SIZE_OPTIONS}
          className="w-full lg:w-52"
        />
        {hasFilters ? (
          <Button variant="link" size="sm" onClick={clearFilters}>
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>

      {content}

      {bookingUnit ? (
        <BookingCreateModal
          key={bookingUnit.id}
          unit={bookingUnit}
          onClose={() => setBookingUnit(null)}
          onViewBookings={() => {
            setBookingUnit(null)
            onViewBookings()
          }}
          onCreated={result => {
            void reload()
            if (result.payOnline) setBookingUnit(null)
            onBookingCreated(result)
          }}
        />
      ) : null}
    </div>
  )
}
