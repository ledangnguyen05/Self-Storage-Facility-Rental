import { useState } from 'react'
import { Eye, FileText, Gavel, KeyRound, Lock, LockOpen, Wrench } from 'lucide-react'
import { Alert, Badge, Button, DescriptionList, Drawer } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import type { OverdueLedgerItem } from '@/services/overdueService'
import { sealingService, type SealingRecordResponse } from '@/services/sealingService'
import type { StorageUnit } from '@/types'
import { OVERDUE_STAGES, getOverdueStage } from '../overdue/overdueModel'
import { UnitActivityLog } from './UnitActivityLog'
import { canToggleMaintenance, formatUnitFloor, getUnitStatusInfo, getUnitZone, normalizeUnitStatus } from './unitModel'

export interface UnitDrawerActions {
  onToggleMaintenance: (unit: StorageUnit) => Promise<void>
  onViewBooking: (unit: StorageUnit) => void
  onSeal: (unit: StorageUnit, overdueItem?: OverdueLedgerItem) => void
  onLock: (item: OverdueLedgerItem) => void
  onRestore: (item: OverdueLedgerItem) => void
  onViewProtocol: (record: SealingRecordResponse) => void
  onUnseal: (record: SealingRecordResponse) => void
  /** Omitted for roles that may not reissue a PIN (business manager). */
  onResetPin?: (unit: StorageUnit) => void
}

interface UnitDrawerProps extends UnitDrawerActions {
  unit: StorageUnit | null
  facilityName?: string
  /** Matching row of the overdue ledger, when the unit's contract is overdue. */
  overdueItem?: OverdueLedgerItem
  onClose: () => void
}

const dateRange = (start?: string, end?: string) => {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
  return end ? `Đến ${formatDate(end)}` : undefined
}

/** Side sheet for one unit: details, tenant and contract, overdue and sealing state, activity and manager actions. */
export function UnitDrawer({ unit, facilityName, overdueItem, onClose, ...actions }: UnitDrawerProps) {
  const [isToggling, setIsToggling] = useState(false)

  const statusKey = unit ? normalizeUnitStatus(unit.status) : ''
  const isLocked = statusKey === 'OVERDUE_LOCKED'
  const isMaintenance = statusKey === 'UNDER_MAINTENANCE'
  const sealingQuery = useAsyncData(
    (signal) => sealingService.getActiveByUnitId(unit?.id as string, { signal }),
    [unit?.id],
    { enabled: Boolean(unit) && (isLocked || Boolean(overdueItem?.sealed)), keepPreviousData: false },
  )

  if (!unit) return null

  const { meta } = getUnitStatusInfo(unit)
  const activeSealing = sealingQuery.data && sealingQuery.data.status === 'SEALED' ? sealingQuery.data : null
  const hasTenant = !['AVAILABLE', 'UNDER_MAINTENANCE'].includes(statusKey)
  const canSeal = Boolean(overdueItem?.canSeal) && !activeSealing && !sealingQuery.isLoading
  const onResetPin = actions.onResetPin
  const canResetPin = Boolean(onResetPin) && statusKey === 'OCCUPIED' && Boolean(unit.bookingId) && !overdueItem?.accessLocked
  const stage = overdueItem ? OVERDUE_STAGES[getOverdueStage(overdueItem)] : null

  const toggleMaintenance = async () => {
    setIsToggling(true)
    try {
      await actions.onToggleMaintenance(unit)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Kho ${unit.unitCode}`}
      description={[unit.unitTypeName, formatUnitFloor(unit.floorLevel), `Khu ${getUnitZone(unit)}`].filter(Boolean).join(' · ')}
      footer={
        <>
          {unit.bookingId ? (
            <Button variant="secondary" leftIcon={Eye} onClick={() => actions.onViewBooking(unit)}>
              Xem hồ sơ đặt kho
            </Button>
          ) : null}
          {canResetPin && onResetPin ? (
            <Button variant="secondary" leftIcon={KeyRound} onClick={() => onResetPin(unit)}>
              Cấp lại mã PIN
            </Button>
          ) : null}
          {canToggleMaintenance(unit) ? (
            <Button variant="secondary" leftIcon={Wrench} loading={isToggling} onClick={() => void toggleMaintenance()}>
              {isMaintenance ? 'Hoàn tất bảo trì' : 'Chuyển sang bảo trì'}
            </Button>
          ) : null}
          {canSeal ? (
            <Button variant="danger" leftIcon={Gavel} onClick={() => actions.onSeal(unit, overdueItem)}>
              Lập biên bản niêm phong
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          {stage ? (
            <Badge tone={stage.tone} size="sm">
              {stage.label}
            </Badge>
          ) : null}
          <span className="text-dense text-fg-muted">{formatCurrency(unit.pricePerMonth)} mỗi tháng</span>
        </div>

        {sealingQuery.error ? (
          <Alert
            tone="warning"
            title="Không kiểm tra được tình trạng niêm phong"
            action={
              <Button size="sm" variant="secondary" onClick={() => void sealingQuery.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(sealingQuery.error)}
          </Alert>
        ) : null}

        {activeSealing ? (
          <Alert
            tone="danger"
            title="Kho đang niêm phong"
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" leftIcon={FileText} onClick={() => actions.onViewProtocol(activeSealing)}>
                  Xem biên bản
                </Button>
                <Button size="sm" variant="secondary" leftIcon={LockOpen} onClick={() => actions.onUnseal(activeSealing)}>
                  Gỡ niêm phong
                </Button>
              </div>
            }
          >
            {`Biên bản ${activeSealing.protocolNumber ?? '—'}, tem ${activeSealing.sealTagNumber}, lập lúc ${formatDateTime(activeSealing.sealedAt)}. Kho không được cho thuê hoặc bảo trì cho tới khi gỡ niêm phong.`}
          </Alert>
        ) : null}

        {overdueItem ? (
          <Alert
            tone={overdueItem.accessLocked ? 'danger' : 'warning'}
            title={`Quá hạn ${formatNumber(overdueItem.daysOverdue)} ngày${overdueItem.accessLocked && !activeSealing ? ' · đã khóa truy cập' : ''}`}
            action={
              !activeSealing && (overdueItem.canRestoreAccess || overdueItem.canLockout) ? (
                <div className="flex flex-wrap gap-2">
                  {overdueItem.canRestoreAccess ? (
                    <Button size="sm" variant="secondary" leftIcon={LockOpen} onClick={() => actions.onRestore(overdueItem)}>
                      Mở khóa truy cập
                    </Button>
                  ) : null}
                  {overdueItem.canLockout ? (
                    <Button size="sm" variant="secondary" leftIcon={Lock} onClick={() => actions.onLock(overdueItem)}>
                      Khóa truy cập
                    </Button>
                  ) : null}
                </div>
              ) : undefined
            }
          >
            {`Tổng nợ ${formatCurrency(overdueItem.totalDebt)}: tiền thuê quá hạn ${formatCurrency(overdueItem.unpaidRent)} và phí trễ hạn ${formatCurrency(overdueItem.totalLateFee)}${overdueItem.paidSinceDue > 0 ? `, đã trừ ${formatCurrency(overdueItem.paidSinceDue)} khách đã trả` : ''}. Khóa truy cập từ ngày thứ ${formatNumber(overdueItem.accessDisableDays)}, niêm phong từ ngày thứ ${formatNumber(overdueItem.sealingDays)}.`}
            {overdueItem.accessHoldUntil ? ` Đang giữ quyền truy cập đến ${formatDate(overdueItem.accessHoldUntil)}.` : ''}
          </Alert>
        ) : null}

        <section aria-label="Thông tin kho" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fg">Thông tin kho</h3>
          <DescriptionList
            items={[
              { label: 'Cơ sở', value: unit.facilityName ?? facilityName },
              { label: 'Loại kho', value: unit.unitTypeName },
              {
                label: 'Diện tích',
                value:
                  typeof unit.areaSqMeters === 'number' ? `${formatNumber(unit.areaSqMeters, { maximumFractionDigits: 1 })} m²` : undefined,
              },
              { label: 'Tiền cọc', value: unit.depositAmount !== undefined ? formatCurrency(unit.depositAmount) : undefined },
            ]}
          />
          {!canToggleMaintenance(unit) && !isLocked ? (
            <p className="text-xs text-fg-subtle">Chỉ chuyển sang bảo trì được khi kho đang trống.</p>
          ) : null}
        </section>

        <section aria-label="Khách thuê và hợp đồng" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fg">Khách thuê và hợp đồng</h3>
          {hasTenant ? (
            <DescriptionList
              items={[
                { label: 'Khách thuê', value: unit.tenantName ?? overdueItem?.customerName ?? undefined },
                { label: 'Mã hợp đồng', value: unit.contractCode ?? overdueItem?.contractCode, mono: true },
                { label: 'Thời hạn', value: dateRange(unit.startDate, unit.dueDate ?? overdueItem?.dueDate ?? undefined), full: true },
              ]}
            />
          ) : (
            <p className="text-dense text-fg-muted">
              {isMaintenance ? 'Kho đang bảo trì, chưa cho thuê.' : 'Kho đang trống, chưa có khách thuê.'}
            </p>
          )}
        </section>

        <section aria-label="Khóa thông minh" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fg">Khóa thông minh</h3>
          <DescriptionList
            items={[
              { label: 'Số seri khóa', value: unit.smartLockSerial, mono: true },
              { label: 'Pin khóa', value: unit.batteryLevel },
              { label: 'Truy cập gần nhất', value: unit.lastAccessTime ? formatDateTime(unit.lastAccessTime) : undefined, full: true },
            ]}
          />
          <p className="text-xs text-fg-subtle">
            Hệ thống chưa kết nối khóa điện tử. Mã PIN được quản lý trên Boxora; thông tin thiết bị chỉ hiển thị khi khóa gửi dữ liệu.
          </p>
        </section>

        <UnitActivityLog unitCode={unit.unitCode} facilityId={unit.facilityId} />
      </div>
    </Drawer>
  )
}
