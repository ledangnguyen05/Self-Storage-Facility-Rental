import { Card, Skeleton, SkeletonText, cn } from '@/components/ui'

interface CardGridSkeletonProps {
  count?: number
  className?: string
}

/** Loading placeholder for the card grids of the portal (units, bookings, tickets). */
export function CardGridSkeleton({ count = 2, className }: CardGridSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2', className)} aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-20" />
          </div>
          <SkeletonText lines={3} />
          <Skeleton className="h-16 w-full" />
        </Card>
      ))}
    </div>
  )
}
