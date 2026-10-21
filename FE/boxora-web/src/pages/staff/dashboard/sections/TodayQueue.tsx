import React, { useMemo, useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { Button, Card, CardHeader, SearchInput, Select, Tabs } from '@/components/ui'
import type { Booking } from '@/types'
import type { FrontDeskData } from '../hooks/useFrontDeskData'
import {
  ARRIVAL_WINDOW_OPTIONS,
  RETURN_WINDOW_OPTIONS,
  formatFloor,
  isArrivalInWindow,
  isReturnDue,
  matchesQuery,
  sortFloors,
  type ArrivalWindow,
  type ReturnQueueItem,
  type ReturnWindow,
  type ShiftWindow,
} from '../utils/frontDesk'
import { ArrivalsTable } from './ArrivalsTable'
import { ReturnsTable } from './ReturnsTable'

export type QueueTab = 'arrivals' | 'returns'

interface TodayQueueProps {
  tab: QueueTab
  onTabChange: (tab: QueueTab) => void
  data: FrontDeskData
  today: string
  shift: ShiftWindow
  selectedArrivalId?: string
  selectedReturnId?: string
  onSelectArrival: (booking: Booking) => void
  onSelectReturn: (item: ReturnQueueItem) => void
}

const ALL_FLOORS = 'all'

/** "Hôm nay" work queue: arrivals and returns with search, floor and time filters. */
export function TodayQueue({
  tab,
  onTabChange,
  data,
  today,
  shift,
  selectedArrivalId,
  selectedReturnId,
  onSelectArrival,
  onSelectReturn,
}: TodayQueueProps) {
  const [query, setQuery] = useState('')
  const [floor, setFloor] = useState(ALL_FLOORS)
  const [arrivalWindow, setArrivalWindow] = useState<ArrivalWindow>('today')
  const [returnWindow, setReturnWindow] = useState<ReturnWindow>('due')

  const floorByUnitCode = useMemo(() => new Map(data.units.map((unit) => [unit.unitCode, unit.floorLevel])), [data.units])

  const floorOptions = useMemo(() => {
    const labels = [
      ...data.units.map((unit) => formatFloor(unit.floorLevel)),
      ...data.arrivals.map((booking) => formatFloor(booking.floorLevel || floorByUnitCode.get(booking.unitCode))),
      ...data.returns.map((item) => formatFloor(item.floorLevel)),
    ]
    return sortFloors(labels).map((label) => ({ value: label, label }))
  }, [data.units, data.arrivals, data.returns, floorByUnitCode])

  const arrivals = useMemo(
    () =>
      data.arrivals.filter((booking) => {
        if (!isArrivalInWindow(booking, arrivalWindow, today, shift)) return false
        if (floor !== ALL_FLOORS && formatFloor(booking.floorLevel || floorByUnitCode.get(booking.unitCode)) !== floor) return false
        return matchesQuery(query, booking.customerName, booking.customerPhone, booking.bookingCode, booking.unitCode)
      }),
    [data.arrivals, arrivalWindow, today, shift, floor, floorByUnitCode, query],
  )

  const returns = useMemo(
    () =>
      data.returns.filter((item) => {
        if (returnWindow === 'due' && !isReturnDue(item, today)) return false
        if (floor !== ALL_FLOORS && formatFloor(item.floorLevel) !== floor) return false
        return matchesQuery(query, item.customerName, item.customerPhone, item.bookingCode, item.unitCode)
      }),
    [data.returns, returnWindow, today, floor, query],
  )

  const hasSearchFilters = query.trim() !== '' || floor !== ALL_FLOORS
  const windowNarrowed = tab === 'arrivals' ? arrivalWindow !== 'all' : returnWindow !== 'all'
  const hasFilters = hasSearchFilters || windowNarrowed
  const clearSearchFilters = () => {
    setQuery('')
    setFloor(ALL_FLOORS)
  }
  /** Empty-state action: drop search filters first, then widen the time window of the current tab. */
  const widenResults = () => {
    if (hasSearchFilters) clearSearchFilters()
    else if (tab === 'arrivals') setArrivalWindow('all')
    else setReturnWindow('all')
  }
  // Remount the table when filters change so pagination returns to page 1.
  const filterKey = `${tab}|${query}|${floor}|${arrivalWindow}|${returnWindow}`

  const emptyAction = hasFilters ? (
    <Button variant="secondary" size="sm" onClick={widenResults}>
      {hasSearchFilters ? 'Xóa bộ lọc' : tab === 'arrivals' ? 'Xem tất cả lịch hẹn' : 'Xem tất cả hợp đồng'}
    </Button>
  ) : undefined

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Hôm nay"
        description="Lượt nhận kho và trả kho cần xử lý tại quầy. Chọn một dòng để mở quy trình."
      />
      <div className="px-5 pt-3">
        <Tabs
          aria-label="Hàng chờ quầy"
          value={tab}
          onValueChange={onTabChange}
          items={[
            { value: 'arrivals', label: 'Nhận kho', icon: LogIn, count: data.arrivalsState.isLoading ? undefined : arrivals.length },
            { value: 'returns', label: 'Trả kho', icon: LogOut, count: data.returnsState.isLoading ? undefined : returns.length },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Tìm tên khách, số điện thoại, mã đặt chỗ, mã kho…"
          className="sm:w-80"
        />
        {floorOptions.length > 1 ? (
          <Select
            aria-label="Lọc theo tầng"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            options={[{ value: ALL_FLOORS, label: 'Tất cả tầng' }, ...floorOptions]}
            className="sm:w-40"
          />
        ) : null}
        {tab === 'arrivals' ? (
          <Select
            aria-label="Khung thời gian"
            value={arrivalWindow}
            onChange={(e) => setArrivalWindow(e.target.value as ArrivalWindow)}
            options={ARRIVAL_WINDOW_OPTIONS}
            className="sm:w-48"
          />
        ) : (
          <Select
            aria-label="Phạm vi hợp đồng"
            value={returnWindow}
            onChange={(e) => setReturnWindow(e.target.value as ReturnWindow)}
            options={RETURN_WINDOW_OPTIONS}
            className="sm:w-48"
          />
        )}
        {hasSearchFilters ? (
          <Button variant="link" size="sm" onClick={clearSearchFilters}>
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>

      {tab === 'arrivals' ? (
        <ArrivalsTable
          key={filterKey}
          rows={arrivals}
          isLoading={data.arrivalsState.isLoading}
          error={data.arrivalsState.error}
          onRetry={() => void data.arrivalsState.reload()}
          selectedId={selectedArrivalId}
          onSelect={onSelectArrival}
          floorByUnitCode={floorByUnitCode}
          today={today}
          emptyTitle={hasFilters ? 'Không có lượt nhận kho phù hợp' : 'Chưa có lịch nhận kho'}
          emptyDescription={
            hasSearchFilters
              ? 'Thử từ khóa khác hoặc bỏ lọc tầng.'
              : windowNarrowed
                ? 'Không có khách hẹn nhận kho trong khung thời gian này.'
                : 'Các booking đã xác nhận sẽ xuất hiện tại đây.'
          }
          emptyAction={emptyAction}
        />
      ) : (
        <ReturnsTable
          key={filterKey}
          rows={returns}
          isLoading={data.returnsState.isLoading}
          error={data.returnsState.error}
          onRetry={() => void data.returnsState.reload()}
          selectedId={selectedReturnId}
          onSelect={onSelectReturn}
          today={today}
          emptyTitle={hasFilters ? 'Không có hợp đồng phù hợp' : 'Chưa có hợp đồng đang thuê'}
          emptyDescription={
            hasSearchFilters
              ? 'Thử từ khóa khác hoặc bỏ lọc tầng.'
              : windowNarrowed
                ? 'Không có hợp đồng đến hạn hoặc yêu cầu trả kho.'
                : 'Hợp đồng đang thuê tại cơ sở sẽ xuất hiện tại đây.'
          }
          emptyAction={emptyAction}
        />
      )}
    </Card>
  )
}
