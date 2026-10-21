import React from 'react'
import { BuildingComplex, ChevronsUpDown, Globe, Lock, RefreshCw } from 'lucide-react'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Skeleton,
  Tooltip,
} from '../ui'
import { cn } from '../ui/cn'
import type { Facility } from '../../types'
import { ALL_FACILITIES } from './dashboardContext'
import { formatFacilityName } from './useFacilityScope'

export interface FacilitySwitcherProps {
  facilities: Facility[]
  selectedFacility: string
  onSelect: (id: string) => void
  isFacilityScoped: boolean
  assignedFacilityLabel: string
  /** Hide the "all facilities" option (facility-manager pages need one facility). */
  requiresConcreteFacility: boolean
  isLoading: boolean
  hasError: boolean
  onRetry: () => void
  className?: string
}

/** Topbar facility scope: a fixed pill for scoped roles, a menu for everyone else. */
export function FacilitySwitcher({
  facilities,
  selectedFacility,
  onSelect,
  isFacilityScoped,
  assignedFacilityLabel,
  requiresConcreteFacility,
  isLoading,
  hasError,
  onRetry,
  className,
}: FacilitySwitcherProps) {
  if (isFacilityScoped) {
    return (
      <Tooltip content="Tài khoản được gán cố định cho cơ sở này" side="bottom" className={className}>
        <span
          tabIndex={0}
          className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 text-sm text-fg"
        >
          <BuildingComplex size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" />
          <span className="hidden max-w-56 truncate font-medium sm:inline">{assignedFacilityLabel}</span>
          <span className="sr-only sm:hidden">{assignedFacilityLabel}</span>
          <Badge size="sm" icon={Lock} className="hidden md:inline-flex">
            Cố định
          </Badge>
        </span>
      </Tooltip>
    )
  }

  const current = facilities.find(facility => facility.id === selectedFacility)
  const currentLabel =
    selectedFacility === ALL_FACILITIES
      ? 'Toàn hệ thống'
      : current
        ? formatFacilityName(current.name)
        : isLoading
          ? 'Đang tải cơ sở…'
          : 'Chọn cơ sở'

  return (
    <DropdownMenu
      aria-label="Chọn cơ sở làm việc"
      align="start"
      className="max-h-96 w-72"
      trigger={
        <Button
          variant="secondary"
          className={cn('min-w-0 max-w-64 justify-start', className)}
          aria-label={`Cơ sở làm việc: ${currentLabel}`}
        >
          <BuildingComplex size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" />
          <span className="hidden truncate sm:inline">{currentLabel}</span>
          <ChevronsUpDown size={14} strokeWidth={1.75} aria-hidden="true" className="ml-auto shrink-0 text-fg-subtle" />
        </Button>
      }
    >
      <DropdownMenuLabel>Cơ sở làm việc</DropdownMenuLabel>
      {!requiresConcreteFacility ? (
        <>
          <DropdownMenuItem
            icon={Globe}
            selected={selectedFacility === ALL_FACILITIES}
            onSelect={() => onSelect(ALL_FACILITIES)}
            description="Dữ liệu của tất cả cơ sở"
          >
            Toàn hệ thống
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      ) : null}
      {isLoading && facilities.length === 0 ? (
        <div className="flex flex-col gap-2 px-2 py-2" aria-label="Đang tải danh sách cơ sở">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : null}
      {facilities.map(facility => (
        <DropdownMenuItem
          key={facility.id}
          selected={facility.id === selectedFacility}
          onSelect={() => onSelect(facility.id)}
          trailing={facility.code ? <span className="font-mono">{facility.code}</span> : undefined}
        >
          {formatFacilityName(facility.name)}
        </DropdownMenuItem>
      ))}
      {!isLoading && facilities.length === 0 && !hasError ? (
        <p className="px-2 py-2 text-dense text-fg-muted">Chưa có cơ sở nào.</p>
      ) : null}
      {hasError ? (
        <>
          <p className="px-2 pt-2 text-dense text-danger">Không tải được danh sách cơ sở.</p>
          <DropdownMenuItem icon={RefreshCw} onSelect={onRetry} keepOpen>
            Thử lại
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenu>
  )
}
