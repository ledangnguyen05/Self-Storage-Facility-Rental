import React, { useMemo, useState } from 'react'
import { LayoutGrid, LogIn, LogOut, RefreshCw } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DescriptionList,
  Drawer,
  EmptyState,
  IconButton,
  Skeleton,
  cn,
} from '@/components/ui'
import { UNIT_STATUS_VALUES, getUnitStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import type { Booking, StorageUnit } from '@/types'
import { TONE_TILE } from '../components/toneClasses'
import type { QueryState } from '../hooks/useFrontDeskData'
import { formatFloor, sortFloors, type ReturnQueueItem } from '../utils/frontDesk'

interface UnitMapProps {
  units: StorageUnit[]
  state: QueryState
  facilityId?: string
  arrivals: Booking[]
  returns: ReturnQueueItem[]
  onStartCheckIn: (booking: Booking) => void
  onStartReturn: (item: ReturnQueueItem) => void
}

const UNKNOWN_FLOOR = 'Chưa rõ tầng'

/**
 * Tiles are at least 5.5rem wide and as many fit per row as the card allows (3 in the narrow side column, more when
 * it is wider), so the unit code and status are never cut to "D1-A…" / "Đang th…". Long labels wrap instead.
 */
const TILE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2'

/** Floor map of the facility: tiles toned by unit status, a legend with counts, details in a drawer. */
export function UnitMap({ units, state, facilityId, arrivals, returns, onStartCheckIn, onStartReturn }: UnitMapProps) {
  const [selected, setSelected] = useState<StorageUnit | null>(null)

  const arrivalByUnit = useMemo(() => {
    const map = new Map<string, Booking>()
    for (const booking of arrivals) {
      if (booking.storageUnitId) map.set(booking.storageUnitId, booking)
      if (booking.unitCode) map.set(booking.unitCode, booking)
    }
    return map
  }, [arrivals])

  const returnByUnit = useMemo(() => {
    const map = new Map<string, ReturnQueueItem>()
    for (const item of returns) {
      map.set(item.bookingId, item)
      if (item.unitCode) map.set(item.unitCode, item)
    }
    return map
  }, [returns])

  const findArrival = (unit: StorageUnit) => arrivalByUnit.get(unit.id) ?? arrivalByUnit.get(unit.unitCode)
  const findReturn = (unit: StorageUnit) => (unit.bookingId ? returnByUnit.get(unit.bookingId) : undefined) ?? returnByUnit.get(unit.unitCode)

  const legend = useMemo(() => {
    const counts = new Map<string, number>()
    for (const unit of units) {
      const key = String(unit.status).toUpperCase() === 'MAINTENANCE' ? 'UNDER_MAINTENANCE' : String(unit.status).toUpperCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return UNIT_STATUS_VALUES.map((status) => ({ status, meta: getUnitStatusMeta(status), count: counts.get(status) ?? 0 }))
  }, [units])

  const pendingHandover = units.filter((unit) => findArrival(unit)).length

  const floors = useMemo(() => {
    const groups = new Map<string, StorageUnit[]>()
    for (const unit of units) {
      const label = formatFloor(unit.floorLevel) || UNKNOWN_FLOOR
      groups.set(label, [...(groups.get(label) ?? []), unit])
    }
    const order = sortFloors(Array.from(groups.keys()).filter((label) => label !== UNKNOWN_FLOOR))
    if (groups.has(UNKNOWN_FLOOR)) order.push(UNKNOWN_FLOOR)
    return order.map((label) => ({
      label,
      units: (groups.get(label) ?? []).slice().sort((a, b) => a.unitCode.localeCompare(b.unitCode, 'vi', { numeric: true })),
    }))
  }, [units])

  let content: React.ReactNode
  if (!facilityId) {
    content = <EmptyState icon={LayoutGrid} size="sm" title="Chưa chọn cơ sở" description="Chọn một cơ sở để xem sơ đồ kho." />
  } else if (state.isLoading) {
    content = (
      <div className={TILE_GRID} aria-busy="true">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
    )
  } else if (state.error) {
    content = (
      <Alert
        tone="danger"
        title="Không tải được sơ đồ kho"
        action={
          <Button size="sm" variant="secondary" onClick={() => void state.reload()}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(state.error)}
      </Alert>
    )
  } else if (units.length === 0) {
    content = <EmptyState icon={LayoutGrid} size="sm" title="Cơ sở chưa có kho" description="Kho được quản lý cơ sở tạo sẽ hiển thị tại đây." />
  } else {
    content = (
      <div className="flex flex-col gap-4">
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Chú thích trạng thái kho">
          {legend.map(({ status, meta, count }) => (
            <li key={status} className={cn('flex items-center gap-1.5 text-xs', count === 0 ? 'text-fg-subtle' : 'text-fg-muted')}>
              <span className={cn('size-3 rounded-sm border', TONE_TILE[meta.tone])} aria-hidden="true" />
              {meta.label}
              <span className="font-medium tabular-nums text-fg">{formatNumber(count)}</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-xs text-fg-muted">
            <LogIn size={12} strokeWidth={2} className="text-accent-text" aria-hidden="true" />
            Chờ bàn giao
            <span className="font-medium tabular-nums text-fg">{formatNumber(pendingHandover)}</span>
          </li>
        </ul>
        <div className="flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
          {floors.map((floor) => (
            <section key={floor.label} aria-label={floor.label}>
              <h4 className="mb-2 text-xs font-medium text-fg-subtle">
                {floor.label} · {formatNumber(floor.units.length)} kho
              </h4>
              <div className={TILE_GRID}>
                {floor.units.map((unit) => {
                  const meta = getUnitStatusMeta(unit.status)
                  const arrival = findArrival(unit)
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => setSelected(unit)}
                      aria-label={`Kho ${unit.unitCode}, ${meta.label}${arrival ? ', chờ bàn giao' : ''}`}
                      className={cn(
                        'relative flex min-w-0 flex-col items-start rounded-md border px-2 py-1.5 text-left transition-colors',
                        'hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        TONE_TILE[meta.tone],
                        selected?.id === unit.id && 'ring-2 ring-ring',
                      )}
                    >
                      <span className="w-full break-all pr-4 font-mono text-xs font-medium leading-tight text-fg">{unit.unitCode}</span>
                      <span className="w-full text-xs leading-tight">{meta.label}</span>
                      {arrival ? (
                        <LogIn size={12} strokeWidth={2} className="absolute right-1.5 top-1.5 text-accent-text" aria-hidden="true" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  const selectedArrival = selected ? findArrival(selected) : undefined
  const selectedReturn = selected ? findReturn(selected) : undefined
  const selectedMeta = selected ? getUnitStatusMeta(selected.status) : null

  return (
    <Card>
      <CardHeader
        title="Sơ đồ kho"
        description={facilityId && units.length > 0 ? `${formatNumber(units.length)} kho tại cơ sở` : 'Trạng thái từng kho theo tầng'}
        actions={
          facilityId ? (
            <IconButton icon={RefreshCw} size="sm" aria-label="Tải lại sơ đồ kho" tooltip onClick={() => void state.reload()} />
          ) : null
        }
      />
      <CardContent>{content}</CardContent>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Kho ${selected.unitCode}` : undefined}
        description={selected?.unitTypeName || undefined}
        footer={
          selectedArrival || selectedReturn ? (
            <>
              {selectedReturn ? (
                <Button
                  variant={selectedArrival ? 'secondary' : 'primary'}
                  leftIcon={LogOut}
                  onClick={() => {
                    setSelected(null)
                    onStartReturn(selectedReturn)
                  }}
                >
                  Nghiệm thu trả kho
                </Button>
              ) : null}
              {selectedArrival ? (
                <Button
                  leftIcon={LogIn}
                  onClick={() => {
                    setSelected(null)
                    onStartCheckIn(selectedArrival)
                  }}
                >
                  Mở quy trình nhận kho
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {selected && selectedMeta ? (
          <DescriptionList
            columns={1}
            layout="inline"
            items={[
              { label: 'Trạng thái', value: <Badge tone={selectedMeta.tone} dot>{selectedMeta.label}</Badge> },
              { label: 'Tầng', value: formatFloor(selected.floorLevel) || '—' },
              { label: 'Loại kho', value: selected.unitTypeName || '—' },
              { label: 'Diện tích', value: selected.areaSqMeters ? `${formatNumber(selected.areaSqMeters)} m²` : '—' },
              { label: 'Giá thuê', value: selected.pricePerMonth ? `${formatCurrency(selected.pricePerMonth)}/tháng` : '—' },
              { label: 'Khách thuê', value: selected.tenantName || selectedArrival?.customerName || '—' },
              { label: 'Mã hợp đồng', value: selected.contractCode || '—', mono: true },
              { label: 'Hạn hợp đồng', value: formatDate(selected.dueDate) },
              { label: 'Lịch nhận kho', value: selectedArrival ? formatDate(selectedArrival.startDate) : '—' },
            ]}
          />
        ) : null}
      </Drawer>
    </Card>
  )
}
