import { Card, CardContent, CardHeader, DescriptionList, cn } from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { ResolvedFacilityPolicy } from '@/utils/facilityPolicyDefaults'

const days = (value: number) => `${formatNumber(value)} ngày`
const hours = (value: number) => `${formatNumber(value)} giờ`

/** Read-only policy numbers grouped by topic. Values must come from `resolvePolicy()`. */
export function PolicySummary({ policy, className }: { policy: ResolvedFacilityPolicy; className?: string }) {
  const sections = [
    {
      title: 'Tiền cọc và kỳ hạn',
      items: [
        { label: 'Tỷ lệ tiền cọc', value: `${formatNumber(policy.depositPercentage)}%` },
        { label: 'Thuê tối thiểu', value: `${formatNumber(policy.minimumRentalMonths)} tháng` },
        { label: 'Mở gia hạn trước', value: `${days(policy.renewalWindowDays)} khi hết hạn` },
      ],
    },
    {
      title: 'Hủy đặt kho và hoàn tiền',
      items: [
        { label: 'Hoàn 100%', value: `Hủy trước nhận kho từ ${hours(policy.cancellationFullRefundHours)}` },
        {
          label: `Hoàn ${formatNumber(policy.cancellationPartialRefundPercent)}%`,
          value: `Hủy trước nhận kho từ ${hours(policy.cancellationPartialRefundHours)}`,
        },
        { label: 'Không hoàn cọc', value: `Hủy dưới ${hours(policy.cancellationPartialRefundHours)}` },
      ],
    },
    {
      title: 'Trả kho và hoàn cọc',
      items: [
        {
          label: 'Báo trước khi trả kho',
          value: policy.returnNoticeDays > 0 ? days(policy.returnNoticeDays) : 'Không bắt buộc',
        },
        { label: 'Hạn hoàn cọc', value: days(policy.depositRefundSlaDays) },
      ],
    },
    {
      title: 'Quá hạn và niêm phong',
      items: [
        { label: 'Ân hạn không phạt', value: days(policy.overdueGraceDays) },
        { label: 'Phí trễ hạn mỗi ngày', value: `${formatCurrency(policy.dailyLateFee)}, tính sau thời gian ân hạn` },
        { label: 'Khóa truy cập', value: `Từ ngày thứ ${formatNumber(policy.overdueAccessDisableDays)} quá hạn` },
        { label: 'Niêm phong', value: `Từ ngày thứ ${formatNumber(policy.overdueSealingDays)} quá hạn` },
      ],
    },
  ]

  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}>
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader title={section.title} divider />
          <CardContent>
            <DescriptionList columns={1} layout="inline" items={section.items} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
