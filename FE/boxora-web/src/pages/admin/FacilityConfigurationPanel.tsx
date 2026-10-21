import React, { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import { Alert, Button, EmptyState, SearchInput, Skeleton } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import type { Facility } from '@/types'
import { FacilityCard } from './facility/FacilityCard'

export interface FacilityConfigurationPanelProps {
  facilities: readonly Facility[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  /** Business manager and administrator can edit. */
  canManage: boolean
  /** Only the business manager can create or change a branch policy. */
  canEditPolicy: boolean
  onEdit: (facility: Facility) => void
  onCreate: () => void
}

const matches = (facility: Facility, query: string): boolean =>
  [facility.name, facility.code, facility.city, facility.address].some(value => value?.toLowerCase().includes(query))

/** Searchable grid of branch cards with loading, empty and error states. The editor itself lives in FacilityForm. */
export const FacilityConfigurationPanel: React.FC<FacilityConfigurationPanelProps> = ({ facilities, isLoading, error, onRetry, canManage, canEditPolicy, onEdit, onCreate }) => {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const visible = useMemo(() => (query ? facilities.filter(facility => matches(facility, query)) : [...facilities]), [facilities, query])

  if (error) {
    return (
      <Alert
        tone="danger"
        title="Không tải được danh sách chi nhánh"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map(index => (
          <Skeleton key={index} className="h-56 w-full" />
        ))}
      </div>
    )
  }

  if (facilities.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Chưa có chi nhánh nào"
        description={canManage ? 'Thêm chi nhánh đầu tiên để bắt đầu quản lý kho.' : 'Giám đốc vận hành hoặc quản trị viên sẽ thêm chi nhánh cho hệ thống.'}
        action={canManage ? <Button onClick={onCreate}>Thêm chi nhánh</Button> : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={search} onValueChange={setSearch} placeholder="Tìm theo tên, mã, địa chỉ…" className="sm:w-80" />
      {visible.length === 0 ? (
        <EmptyState
          icon={Building2}
          size="sm"
          title="Không có chi nhánh khớp từ khóa"
          action={
            <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
              Xóa tìm kiếm
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(facility => (
            <FacilityCard key={facility.id} facility={facility} canManage={canManage} canEditPolicy={canEditPolicy} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
