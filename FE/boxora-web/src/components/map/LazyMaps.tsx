import { Suspense, lazy } from 'react'
import { Alert, Button, Skeleton } from '@/components/ui'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import type { CoordinatePickerMapProps } from './CoordinatePickerMap'
import type { FacilityMapProps } from './FacilityMap'

// Leaflet is only needed on pages that show a map, so it loads on demand and stays out of the main bundle.
const FacilityMapImpl = lazy(() => import('./FacilityMap'))
const CoordinatePickerMapImpl = lazy(() => import('./CoordinatePickerMap'))

function MapFallback({ heightClassName }: { heightClassName: string }) {
  return <Skeleton className={`w-full rounded-lg ${heightClassName}`} aria-hidden="true" />
}

function MapError({ retry }: { retry: () => void }) {
  return (
    <Alert
      tone="warning"
      title="Không tải được bản đồ"
      action={
        <Button size="sm" variant="secondary" onClick={retry}>
          Thử lại
        </Button>
      }
    >
      Bản đồ cần kết nối mạng để tải. Bạn vẫn có thể xem địa chỉ và bấm Chỉ đường ở danh sách bên dưới.
    </Alert>
  )
}

/** Branch map with pins, popups, directions links and the visitor's position. */
export function LazyFacilityMap(props: FacilityMapProps) {
  const heightClassName = props.heightClassName ?? 'h-80 sm:h-96'
  return (
    <ErrorBoundary fallback={({ retry }) => <MapError retry={retry} />}>
      <Suspense fallback={<MapFallback heightClassName={heightClassName} />}>
        <FacilityMapImpl {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}

/** Small map where the admin places or drags a branch pin. */
export function LazyCoordinatePickerMap(props: CoordinatePickerMapProps) {
  const heightClassName = props.heightClassName ?? 'h-56'
  return (
    <ErrorBoundary fallback={({ retry }) => <MapError retry={retry} />}>
      <Suspense fallback={<MapFallback heightClassName={heightClassName} />}>
        <CoordinatePickerMapImpl {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}
