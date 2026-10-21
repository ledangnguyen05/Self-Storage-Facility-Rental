import React from 'react'
import { PackageSearch } from 'lucide-react'
import { Alert, Button, Card, CardContent, EmptyState, Pagination, Skeleton } from '../../../components/ui'
import type { StorageUnitType } from '../../../data/storageUnitsData'
import { getApiErrorMessage } from '../../../lib/apiError'
import { UnitCard } from './UnitCard'
import { UnitRow } from './UnitRow'
import type { UnitsView } from './UnitsToolbar'
import { PAGE_SIZE_OPTIONS, type UnitsExplorerState } from './useUnitsExplorer'

interface UnitsResultsProps {
  explorer: UnitsExplorerState
  view: UnitsView
  onDetail: (unit: StorageUnitType) => void
  onRent: (unit: StorageUnitType) => void
}

function ResultsSkeleton({ view }: { view: UnitsView }) {
  const count = view === 'grid' ? 6 : 4
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải danh sách kho"
      className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}
    >
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** Loading, error, empty and data states of the unit list. */
export function UnitsResults({ explorer, view, onDetail, onRent }: UnitsResultsProps) {
  const { isLoading, error, reload, results, pageItems, pager, hasActiveFilters, resetFilters, filters, setFilter, unitCount } = explorer

  if (isLoading) return <ResultsSkeleton view={view} />

  if (error) {
    return (
      <Alert
        tone="danger"
        title="Không tải được danh sách kho"
        action={
          <Button size="sm" variant="secondary" onClick={() => void reload()}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error, 'Không thể tải danh sách kho từ máy chủ. Vui lòng thử lại.')}
      </Alert>
    )
  }

  if (results.length === 0) {
    const onlyAvailable = filters.status === 'available'
    const noUnitsAtAll = unitCount === 0
    return (
      <Card>
        <EmptyState
          icon={PackageSearch}
          title={noUnitsAtAll ? 'Chưa có kho nào để thuê' : 'Không có kho phù hợp'}
          description={
            noUnitsAtAll
              ? 'Hiện chưa có kho nào được đăng. Vui lòng quay lại sau hoặc liên hệ hotline để được tư vấn.'
              : hasActiveFilters
                ? 'Thử đổi cơ sở, loại kho, diện tích hoặc khoảng giá để xem thêm kết quả.'
                : onlyAvailable
                  ? 'Hiện không còn kho trống. Bạn có thể xem cả những kho đã được thuê.'
                  : 'Không có kho nào khớp với lựa chọn của bạn.'
          }
          action={
            noUnitsAtAll ? undefined : hasActiveFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            ) : onlyAvailable ? (
              <Button variant="secondary" onClick={() => setFilter('status', 'all')}>
                Xem tất cả kho
              </Button>
            ) : undefined
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {view === 'grid' ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map(unit => (
            <li key={unit.id}>
              <UnitCard unit={unit} onDetail={onDetail} onRent={onRent} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {pageItems.map(unit => (
            <li key={unit.id}>
              <UnitRow unit={unit} onDetail={onDetail} onRent={onRent} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        total={pager.total}
        pageSize={pager.pageSize}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
