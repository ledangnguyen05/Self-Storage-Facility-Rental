import { Badge, cn } from '../../ui'
import { formatPercent } from '../../../lib/format'

interface RefundMilestonesProps {
  /** `milestoneStage` of the cancellation preview. */
  stage: string
  /** Facility policy hours / percent (already resolved with defaults). */
  fullRefundHours: number
  partialRefundHours: number
  partialRefundPercent: number
}

interface Milestone {
  stage: string
  range: string
  outcome: string
  note: string
  activeClass: string
}

/** The three refund milestones of the facility policy; the one in force for this booking is marked. */
export function RefundMilestones({ stage, fullRefundHours, partialRefundHours, partialRefundPercent }: RefundMilestonesProps) {
  const milestones: Milestone[] = [
    {
      stage: 'STAGE_1_FULL_REFUND',
      range: `Từ ${fullRefundHours} giờ trở lên`,
      outcome: 'Hoàn 100% tiền cọc',
      note: 'Tính trước giờ hẹn nhận kho',
      activeClass: 'border-success-line bg-success-subtle',
    },
    {
      stage: 'STAGE_2_PARTIAL_REFUND',
      range: `Từ ${partialRefundHours} đến dưới ${fullRefundHours} giờ`,
      outcome: `Hoàn ${formatPercent(partialRefundPercent)} tiền cọc`,
      note: `Khấu trừ ${formatPercent(100 - partialRefundPercent)} phí giữ chỗ`,
      activeClass: 'border-warning-line bg-warning-subtle',
    },
    {
      stage: 'STAGE_3_NO_REFUND',
      range: `Dưới ${partialRefundHours} giờ`,
      outcome: 'Không hoàn cọc',
      note: 'Khấu trừ toàn bộ tiền cọc',
      activeClass: 'border-danger-line bg-danger-subtle',
    },
  ]

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Mốc hoàn tiền cọc theo chính sách">
      {milestones.map(item => {
        const active = item.stage === stage
        return (
          <li
            key={item.stage}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'flex flex-col gap-1 rounded-lg border p-3',
              active ? item.activeClass : 'border-line bg-surface text-fg-muted',
            )}
          >
            <span className="text-dense text-fg-muted">{item.range}</span>
            <span className="text-sm font-semibold text-fg">{item.outcome}</span>
            <span className="text-xs text-fg-subtle">{item.note}</span>
            {active ? (
              <Badge tone="neutral" size="sm" className="mt-1 self-start bg-surface">
                Đang áp dụng
              </Badge>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
