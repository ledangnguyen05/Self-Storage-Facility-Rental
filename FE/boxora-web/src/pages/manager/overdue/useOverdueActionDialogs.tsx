import { useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog, useToast } from '@/components/ui'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'
import { formatCurrency, formatNumber } from '@/lib/format'
import { overdueService, type OverdueLedgerItem } from '@/services/overdueService'
import type { SealingRecordResponse } from '@/services/sealingService'
import { AssetSealingModal, type SealingTarget } from '../modals/AssetSealingModal'
import { LockAccessDialog } from '../modals/LockAccessDialog'
import { RestoreAccessDialog, type RestoreAccessTarget } from '../modals/RestoreAccessDialog'
import { UnsealDialog, type UnsealTarget } from '../modals/UnsealDialog'
import { SealingProtocolModal } from '../sealing/SealingProtocolModal'
import type { OverdueRowActions } from './OverdueTable'

interface ProtocolView {
  record?: SealingRecordResponse
  recordId?: string
  notice?: { notified?: boolean; message?: string }
}

export interface OverdueActionDialogs {
  /** Row actions for the ledger table. */
  actions: OverdueRowActions
  sealUnit: (target: SealingTarget, facilityId: string | undefined) => void
  restore: (target: RestoreAccessTarget) => void
  unseal: (target: UnsealTarget) => void
  viewProtocol: (view: ProtocolView) => void
  /** Render once in the page. */
  dialogs: ReactNode
}

function unsealTargetOf(record: SealingRecordResponse): UnsealTarget {
  return {
    sealingRecordId: record.id,
    protocolNumber: record.protocolNumber,
    unitCode: record.unitCode,
    customerName: record.customerName,
    sealedAt: record.sealedAt,
  }
}

/**
 * Remind, lock, restore, seal, unseal and protocol dialogs shared by the overdue page and the facility dashboard.
 * Every action reports the real backend outcome and calls `onChanged` so the lists reload.
 */
export function useOverdueActionDialogs(onChanged: () => void): OverdueActionDialogs {
  const toast = useToast()
  const [remindTarget, setRemindTarget] = useState<OverdueLedgerItem | null>(null)
  const [lockTarget, setLockTarget] = useState<OverdueLedgerItem | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<RestoreAccessTarget | null>(null)
  const [sealState, setSealState] = useState<{ target: SealingTarget; facilityId?: string } | null>(null)
  const [unsealTarget, setUnsealTarget] = useState<UnsealTarget | null>(null)
  const [protocol, setProtocol] = useState<ProtocolView | null>(null)

  const actions = useMemo<OverdueRowActions>(
    () => ({
      onRemind: setRemindTarget,
      onLock: setLockTarget,
      onRestore: (item) =>
        setRestoreTarget({
          contractId: item.contractId,
          contractCode: item.contractCode,
          unitCode: item.unitCode,
          customerName: item.customerName,
          daysOverdue: item.daysOverdue,
          totalDebt: item.totalDebt,
        }),
      onSeal: (item) =>
        setSealState({
          facilityId: item.facilityId ?? undefined,
          target: {
            unitCode: item.unitCode ?? '—',
            unitId: item.unitId ?? undefined,
            contractId: item.contractId,
            contractCode: item.contractCode,
            tenantName: item.customerName ?? undefined,
            overdueDays: item.daysOverdue,
            totalDebt: item.totalDebt,
            sealingDays: item.sealingDays,
          },
        }),
      onUnseal: (item) =>
        item.sealingRecordId
          ? setUnsealTarget({
              sealingRecordId: item.sealingRecordId,
              protocolNumber: item.sealingProtocolNumber,
              unitCode: item.unitCode,
              customerName: item.customerName,
              sealedAt: item.sealedAt,
            })
          : undefined,
      onViewProtocol: (item) => (item.sealingRecordId ? setProtocol({ recordId: item.sealingRecordId }) : undefined),
    }),
    [],
  )

  const confirmReminder = async () => {
    if (!remindTarget) return
    try {
      const result = await overdueService.sendReminder(remindTarget.contractId)
      toast.success('Đã gửi email nhắc nợ', `Tới ${result.sentTo} · kho ${remindTarget.unitCode ?? ''}`)
      setRemindTarget(null)
      onChanged()
    } catch (error) {
      // A refused repeat (429) means a reminder just went out: nothing left to retry, so close the dialog.
      if (getApiErrorStatus(error) === 429) setRemindTarget(null)
      toast.error('Chưa gửi được email nhắc nợ', getApiErrorMessage(error))
      onChanged()
    }
  }

  const dialogs = (
    <>
      <ConfirmDialog
        open={remindTarget !== null}
        onClose={() => setRemindTarget(null)}
        title="Gửi email nhắc nợ?"
        description={
          remindTarget
            ? `Gửi ngay tới ${remindTarget.customerName ?? 'khách thuê'}${remindTarget.customerEmail ? ` (${remindTarget.customerEmail})` : ''}: quá hạn ${formatNumber(remindTarget.daysOverdue)} ngày, tổng cần thanh toán ${formatCurrency(remindTarget.totalDebt)} cho kho ${remindTarget.unitCode ?? ''}. Hệ thống chỉ báo thành công khi máy chủ email đã nhận thư.`
            : undefined
        }
        confirmLabel="Gửi email"
        tone="primary"
        onConfirm={confirmReminder}
      />

      {lockTarget ? (
        <LockAccessDialog
          open
          onClose={() => setLockTarget(null)}
          item={lockTarget}
          onLocked={(result) => {
            toast.success(
              `Đã khóa truy cập kho ${lockTarget.unitCode ?? ''}`.trim(),
              [result.message, result.notificationMessage].filter(Boolean).join(' '),
            )
            setLockTarget(null)
            onChanged()
          }}
        />
      ) : null}

      {restoreTarget ? (
        <RestoreAccessDialog
          open
          onClose={() => setRestoreTarget(null)}
          target={restoreTarget}
          onRestored={(result) => {
            setRestoreTarget(null)
            toast.success(
              `Đã mở khóa truy cập kho ${result.unitCode ?? restoreTarget.unitCode ?? ''}`.trim(),
              [result.message, result.notificationMessage].filter(Boolean).join(' '),
            )
            onChanged()
          }}
        />
      ) : null}

      {sealState ? (
        <AssetSealingModal
          open
          onClose={() => setSealState(null)}
          target={sealState.target}
          facilityId={sealState.facilityId}
          onSealed={(record) => {
            setSealState(null)
            toast.success(`Đã lập biên bản niêm phong ${record.protocolNumber ?? ''}`.trim(), `Kho ${record.unitCode ?? sealState.target.unitCode} đã bị khóa.`)
            setProtocol({ record, notice: { notified: record.customerNotified, message: record.notificationMessage } })
            onChanged()
          }}
        />
      ) : null}

      {unsealTarget ? (
        <UnsealDialog
          open
          onClose={() => setUnsealTarget(null)}
          target={unsealTarget}
          onUnsealed={(record) => {
            setUnsealTarget(null)
            setProtocol(null)
            const details = [record.accessRestoration?.message, record.notificationMessage].filter(Boolean).join(' ')
            toast.success(`Đã gỡ niêm phong kho ${record.unitCode ?? unsealTarget.unitCode ?? ''}`.trim(), details || undefined)
            onChanged()
          }}
        />
      ) : null}

      <SealingProtocolModal
        open={protocol !== null}
        onClose={() => setProtocol(null)}
        record={protocol?.record}
        recordId={protocol?.recordId}
        notice={protocol?.notice}
        onUnseal={(record) => {
          setProtocol(null)
          setUnsealTarget(unsealTargetOf(record))
        }}
      />
    </>
  )

  return {
    actions,
    sealUnit: (target, facilityId) => setSealState({ target, facilityId }),
    restore: setRestoreTarget,
    unseal: setUnsealTarget,
    viewProtocol: setProtocol,
    dialogs,
  }
}
