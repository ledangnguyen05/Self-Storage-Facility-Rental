import { Badge, Button, Card, CardFooter, DescriptionList } from '@/components/ui'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { getUnitStatusMeta } from '@/constants/statusMeta'
import { formatCurrency } from '@/lib/format'
import type { StorageUnit } from '@/types'
import { formatArea, formatFloor } from '../lib/portal'

interface AvailableUnitCardProps {
  unit: StorageUnit
  onBook: (unit: StorageUnit) => void
}

/** An available unit with the facts the backend provides (no stock photos or invented features). */
export function AvailableUnitCard({ unit, onBook }: AvailableUnitCardProps) {
  const status = getUnitStatusMeta(unit.status || 'AVAILABLE')
  const hasPrice = typeof unit.pricePerMonth === 'number' && unit.pricePerMonth > 0

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="font-mono text-base font-semibold text-fg">Kho {unit.unitCode}</h3>
          <p className="truncate text-dense text-fg-muted">{unit.unitTypeName || 'Kho tiêu chuẩn'}</p>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-xl font-semibold tabular-nums text-fg">
          {hasPrice ? formatCurrency(unit.pricePerMonth) : 'Giá theo báo giá'}
          {hasPrice ? <span className="text-dense font-normal text-fg-muted"> / tháng</span> : null}
        </p>
        <DescriptionList
          columns={2}
          items={[
            { label: 'Cơ sở', value: unit.facilityName ? formatFacilityName(unit.facilityName) : '—', full: true },
            { label: 'Vị trí', value: formatFloor(unit.floorLevel) },
            { label: 'Diện tích', value: formatArea(unit.areaSqMeters) },
            { label: 'Tiền cọc', value: unit.depositAmount ? formatCurrency(unit.depositAmount) : '—', full: true },
          ]}
        />
      </div>
      <CardFooter>
        <Button variant="secondary" fullWidth onClick={() => onBook(unit)}>
          Đặt giữ chỗ
        </Button>
      </CardFooter>
    </Card>
  )
}
