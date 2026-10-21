import { useState } from 'react'
import { ChevronDown, ExternalLink, MapPin, MapPinOff, Pencil } from 'lucide-react'
import { Badge, Button, Card, CardContent, cn } from '@/components/ui'
import { getFacilityStatusMeta } from '@/constants/statusMeta'
import { formatNumber } from '@/lib/format'
import { parseFacilityLayoutConfig } from '@/utils/facilityLayout'
import type { Facility } from '@/types'
import { PolicyPreview } from './PolicyPreview'

export interface FacilityCardProps {
  facility: Facility
  /** Business manager and administrator can edit the facility itself. */
  canManage: boolean
  /** Only the business manager sets policies and prices (SRS 3.1.2); the administrator sees them read-only. */
  canEditPolicy: boolean
  onEdit: (facility: Facility) => void
}

const mapUrl = (facility: Facility) =>
  `https://www.openstreetmap.org/?mlat=${facility.latitude}&mlon=${facility.longitude}#map=17/${facility.latitude}/${facility.longitude}`

/** One branch: address, GPS state, floor names and an expandable operating policy. */
export function FacilityCard({ facility, canManage, canEditPolicy, onEdit }: FacilityCardProps) {
  const [policyOpen, setPolicyOpen] = useState(false)
  const status = getFacilityStatusMeta(facility.status ?? 'ACTIVE')
  const layout = parseFacilityLayoutConfig(facility.layoutConfig)
  const hasCoordinates = facility.latitude != null && facility.longitude != null
  const address = [facility.address, facility.city].filter(Boolean).join(', ')

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-fg">{facility.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-fg-muted">{facility.code ?? '—'}</span>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            </div>
          </div>
          {canManage ? (
            <Button variant="secondary" size="sm" leftIcon={Pencil} onClick={() => onEdit(facility)}>
              Chỉnh sửa
            </Button>
          ) : null}
        </div>

        <p className="text-dense text-fg-muted">{address || 'Chưa có địa chỉ'}</p>

        <dl className="flex flex-col gap-2 text-dense">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-muted">Vị trí GPS</dt>
            <dd className={cn('flex items-center gap-1.5 text-right', hasCoordinates ? 'text-fg' : 'text-warning')}>
              {hasCoordinates ? <MapPin size={14} strokeWidth={1.75} aria-hidden="true" /> : <MapPinOff size={14} strokeWidth={1.75} aria-hidden="true" />}
              <span className="tabular-nums">{hasCoordinates ? `${Number(facility.latitude).toFixed(5)}, ${Number(facility.longitude).toFixed(5)}` : 'Chưa có tọa độ'}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-muted">Kho trống</dt>
            <dd className="text-right tabular-nums text-fg">
              {formatNumber(facility.availableUnits ?? 0)} / {formatNumber(facility.totalUnits ?? 0)} kho
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-muted">Mặt bằng</dt>
            <dd className="truncate text-right text-fg">
              {layout.floor1Name} · {layout.floor2Name}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <Button variant="ghost" size="sm" aria-expanded={policyOpen} rightIcon={<ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className={cn('transition-transform', policyOpen && 'rotate-180')} />} onClick={() => setPolicyOpen(open => !open)}>
            {policyOpen ? 'Ẩn chính sách' : 'Xem chính sách'}
          </Button>
          {hasCoordinates ? (
            <a
              href={mapUrl(facility)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm text-dense font-medium text-accent-text hover:underline"
            >
              Xem trên bản đồ
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
            </a>
          ) : null}
        </div>

        {policyOpen ? <PolicyPreview facility={facility} canEdit={canEditPolicy} /> : null}
      </CardContent>
    </Card>
  )
}
