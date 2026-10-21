import React from 'react'
import { Navigation } from 'lucide-react'
import { Badge, Button } from '../../../components/ui'
import { getUnitStatusMeta } from '../../../constants/statusMeta'
import type { StorageUnitType } from '../../../data/storageUnitsData'
import { formatCurrency, formatNumber } from '../../../lib/format'

/** Status badge from `statusMeta` (never the raw enum). */
export function UnitStatusBadge({ status }: { status: StorageUnitType['status'] }) {
  const meta = getUnitStatusMeta(status)
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}

export function UnitDistance({ unit }: { unit: StorageUnitType }) {
  if (unit.distanceKm == null) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone="accent" size="sm" icon={Navigation}>
        <span className="tabular-nums">~{formatNumber(unit.distanceKm, { maximumFractionDigits: 1 })} km</span>
      </Badge>
      {unit.isNearest ? (
        <Badge tone="success" size="sm">
          Gần bạn nhất
        </Badge>
      ) : null}
    </span>
  )
}

export function UnitPrice({ unit, align = 'left' }: { unit: StorageUnitType; align?: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      <p className="text-lg font-semibold leading-6 text-fg tabular-nums">
        {formatCurrency(unit.monthlyPrice)}
        <span className="text-sm font-normal text-fg-muted"> / tháng</span>
      </p>
      {unit.depositAmount != null ? (
        <p className="text-xs text-fg-subtle tabular-nums">Đặt cọc {formatCurrency(unit.depositAmount)}</p>
      ) : null}
    </div>
  )
}

/** Why a non-available unit cannot be rented (button copy, not a status label). */
function unavailableLabel(status: StorageUnitType['status']): string {
  if (status === 'OCCUPIED' || status === 'OVERDUE_LOCKED') return 'Đã có người thuê'
  if (status === 'RESERVED') return 'Đang được giữ chỗ'
  return 'Tạm không khả dụng'
}

interface UnitActionsProps {
  unit: StorageUnitType
  onDetail: (unit: StorageUnitType) => void
  onRent: (unit: StorageUnitType) => void
  size?: 'sm' | 'md'
  fullWidth?: boolean
}

export function UnitActions({ unit, onDetail, onRent, size = 'md', fullWidth = false }: UnitActionsProps) {
  return (
    <div className={fullWidth ? 'grid grid-cols-2 gap-2' : 'flex items-center gap-2'}>
      <Button variant="secondary" size={size} onClick={() => onDetail(unit)}>
        Chi tiết
      </Button>
      {unit.isAvailable ? (
        <Button size={size} onClick={() => onRent(unit)}>
          Thuê kho
        </Button>
      ) : (
        <Button size={size} variant="secondary" disabled>
          {unavailableLabel(unit.status)}
        </Button>
      )}
    </div>
  )
}
