import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, Plus, RefreshCw } from 'lucide-react'
import { Alert, Button, ConfirmDialog, EmptyState, PageHeader, Skeleton, TabPanel, Tabs, useToast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getApiErrorMessage } from '@/lib/apiError'
import { usePageTitle } from '@/pages/public/components/usePageTitle'
import { formatNumber } from '@/lib/format'
import { bookingService } from '@/services/bookingService'
import type { OverdueLedgerItem } from '@/services/overdueService'
import { storageUnitService } from '@/services/storageUnitService'
import type { Booking, StorageUnit } from '@/types'
import { DashboardKpis } from './dashboard/DashboardKpis'
import { FloorMapTab } from './dashboard/FloorMapTab'
import { HandoversTab } from './dashboard/HandoversTab'
import { MasterKeyTab } from './dashboard/MasterKeyTab'
import { PerformanceTab } from './dashboard/PerformanceTab'
import { PolicyTab } from './dashboard/PolicyTab'
import { TicketsTab } from './dashboard/TicketsTab'
import { UnitDrawer } from './dashboard/UnitDrawer'
import { isOpenTicket } from './dashboard/ticketModel'
import { normalizeUnitStatus, type UnitStatusFilter } from './dashboard/unitModel'
import { useManagerDashboardData } from './dashboard/useManagerDashboardData'
import { AssignReceptionDialog } from './modals/AssignReceptionDialog'
import { BookingDetailReadOnlyModal } from './modals/BookingDetailReadOnlyModal'
import { CreateStorageUnitModal } from './modals/CreateStorageUnitModal'
import { FacilityPolicyViewModal } from './modals/FacilityPolicyViewModal'
import { PinResetDialog } from './modals/PinResetDialog'
import { useOverdueActionDialogs } from './overdue/useOverdueActionDialogs'
import { useManagerFacility } from './shared/useManagerFacility'

const TAB_VALUES = ['overview', 'handovers-returns', 'tickets', 'performance', 'policy', 'master-key'] as const
type ManagerTab = (typeof TAB_VALUES)[number]
const TABS_ID = 'manager-dashboard-tabs'

/** Roles the backend lets reissue a door PIN (PUT /bookings/unit/{id}/access-pin); business managers only read. */
const PIN_RESET_ROLES = new Set(['ADMIN', 'FACILITY_MANAGER'])

const parseTab = (value: string | null): ManagerTab =>
  (TAB_VALUES as readonly string[]).includes(value ?? '') ? (value as ManagerTab) : 'overview'

/** Finds the overdue-ledger row that belongs to a unit. */
const findOverdueItem = (items: OverdueLedgerItem[] | undefined, unit: StorageUnit): OverdueLedgerItem | undefined =>
  items?.find((item) => (item.unitId && item.unitId === unit.id) || (item.contractId && item.contractId === unit.contractId))

export const ManagerDashboard: React.FC = () => {
  usePageTitle('Tổng quan cơ sở')
  const toast = useToast()
  const { user, role } = useAuth()
  const { facilityId, facility, facilityName, facilities, isLoadingFacilities } = useManagerFacility()
  const data = useManagerDashboardData(facilityId, user?.id)
  const overdueDialogs = useOverdueActionDialogs(() => {
    void data.overdue.reload()
    void data.units.reload()
  })

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const setTab = (next: ManagerTab) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'overview') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )

  const [statusFilter, setStatusFilter] = useState<UnitStatusFilter>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isPolicyOpen, setIsPolicyOpen] = useState(false)
  const [bookingTarget, setBookingTarget] = useState<{ bookingId?: string; unitCode?: string } | null>(null)
  const [pinTarget, setPinTarget] = useState<StorageUnit | null>(null)
  const [receptionTarget, setReceptionTarget] = useState<{ booking: Booking; mode: 'assign' | 'approve' } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null)
  const canResetPin = PIN_RESET_ROLES.has(String(role ?? '').toUpperCase())

  const selectedUnit = useMemo(
    () => data.units.items.find((unit) => unit.id === selectedUnitId) ?? null,
    [data.units.items, selectedUnitId],
  )
  const overdueItems = data.overdue.data?.items
  const openTicketCount = data.tickets.items.filter(isOpenTicket).length

  const handleToggleMaintenance = async (unit: StorageUnit) => {
    try {
      const updated = await storageUnitService.toggleMaintenance(unit.id)
      const inMaintenance = normalizeUnitStatus(updated.status) === 'UNDER_MAINTENANCE'
      toast.success(inMaintenance ? `Kho ${unit.unitCode} đã chuyển sang bảo trì` : `Kho ${unit.unitCode} đã mở lại để cho thuê`)
      await data.units.reload()
    } catch (error) {
      toast.error('Không thể đổi trạng thái kho', getApiErrorMessage(error))
    }
  }

  /** Dialogs never stack on top of the drawer: close it first. */
  const fromDrawer =
    <Args extends unknown[]>(action: (...args: Args) => void) =>
    (...args: Args) => {
      setSelectedUnitId(null)
      action(...args)
    }

  const openSealing = (unit: StorageUnit, item?: OverdueLedgerItem) =>
    overdueDialogs.sealUnit(
      {
        unitCode: unit.unitCode,
        unitId: unit.id,
        contractId: item?.contractId ?? unit.contractId,
        contractCode: item?.contractCode ?? unit.contractCode,
        tenantName: item?.customerName ?? unit.tenantName,
        overdueDays: item?.daysOverdue,
        totalDebt: item?.totalDebt,
        sealingDays: item?.sealingDays,
      },
      item?.facilityId ?? unit.facilityId ?? facilityId,
    )

  const confirmReject = async () => {
    if (!rejectTarget) return
    try {
      await bookingService.decideRequest(rejectTarget.id, false)
      toast.success('Đã từ chối yêu cầu thuê kho', `Đơn ${rejectTarget.bookingCode}, kho ${rejectTarget.unitCode ?? ''} đã được giải phóng.`)
      setRejectTarget(null)
      void data.pendingApprovals.reload()
      void data.units.reload()
    } catch (error) {
      toast.error('Không thể từ chối yêu cầu', getApiErrorMessage(error))
    }
  }

  const showLockedUnits = () => {
    setStatusFilter('OVERDUE_LOCKED')
    setTab('overview')
  }

  const header = (
    <PageHeader
      title="Tổng quan cơ sở"
      description={
        facilityName
          ? `${facilityName}${data.units.items.length > 0 ? ` · ${formatNumber(data.units.items.length)} kho` : ''}`
          : 'Theo dõi kho, khách thuê, sự cố và chính sách tại cơ sở của bạn.'
      }
      actions={
        <>
          <Button
            variant="secondary"
            leftIcon={RefreshCw}
            loading={data.isRefreshing}
            disabled={!facilityId}
            onClick={() => void data.reloadAll()}
          >
            Làm mới
          </Button>
          <Button leftIcon={Plus} disabled={!facilityId} onClick={() => setIsCreateOpen(true)}>
            Tạo kho
          </Button>
        </>
      }
    />
  )

  if (!facilityId) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {isLoadingFacilities ? (
          <Skeleton className="h-64" aria-busy="true" />
        ) : (
          <EmptyState
            icon={Building2}
            title="Chưa có cơ sở để quản lý"
            description="Tài khoản chưa được gán cơ sở nào. Liên hệ quản trị viên để được phân công."
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <DashboardKpis
        units={data.units.items}
        unitsLoading={data.units.isLoading}
        overdue={data.overdue.data}
        arrivals={data.arrivals.items}
        arrivalsLoading={data.arrivals.isLoading}
        tickets={data.tickets.items}
        ticketsLoading={data.tickets.isLoading}
        onShowLockedUnits={showLockedUnits}
        onShowArrivals={() => setTab('handovers-returns')}
        onShowTickets={() => setTab('tickets')}
      />

      {data.overdue.error && !data.overdue.isLoading ? (
        <Alert
          tone="warning"
          title="Không tải được sổ nợ quá hạn"
          action={
            <Button size="sm" variant="secondary" onClick={() => void data.overdue.reload()}>
              Thử lại
            </Button>
          }
        >
          Số liệu hợp đồng quá hạn có thể chưa đầy đủ. {getApiErrorMessage(data.overdue.error)}
        </Alert>
      ) : null}

      <Tabs
        id={TABS_ID}
        aria-label="Các mục quản lý cơ sở"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'overview', label: 'Sơ đồ kho' },
          {
            value: 'handovers-returns',
            label: 'Bàn giao và trả kho',
            count: data.arrivals.items.length + data.pendingApprovals.items.length,
          },
          { value: 'tickets', label: 'Sự cố', count: openTicketCount },
          { value: 'performance', label: 'Hiệu suất' },
          { value: 'policy', label: 'Chính sách' },
          { value: 'master-key', label: 'Chìa khóa tổng' },
        ]}
      />

      <TabPanel tabsId={TABS_ID} value={tab}>
        {tab === 'overview' ? (
          <FloorMapTab
            units={data.units.items}
            isLoading={data.units.isLoading}
            error={data.units.error}
            onRetry={() => void data.units.reload()}
            facility={facility}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            selectedUnitId={selectedUnitId}
            onSelectUnit={(unit) => setSelectedUnitId(unit.id)}
            onCreateUnit={() => setIsCreateOpen(true)}
          />
        ) : null}
        {tab === 'handovers-returns' ? (
          <HandoversTab
            arrivals={data.arrivals}
            pendingApprovals={data.pendingApprovals}
            activeRentals={data.activeRentals}
            onViewBooking={(booking) => setBookingTarget({ bookingId: booking.id, unitCode: booking.unitCode })}
            onAssignReception={(booking) => setReceptionTarget({ booking, mode: 'assign' })}
            onApproveRequest={(booking) => setReceptionTarget({ booking, mode: 'approve' })}
            onRejectRequest={setRejectTarget}
          />
        ) : null}
        {tab === 'tickets' ? <TicketsTab tickets={data.tickets} stats={data.ticketStats} /> : null}
        {tab === 'performance' ? (
          <PerformanceTab
            units={data.units.items}
            unitsLoading={data.units.isLoading}
            unitsError={data.units.error}
            onRetryUnits={() => void data.units.reload()}
            report={data.overdue}
          />
        ) : null}
        {tab === 'policy' ? (
          <PolicyTab
            facilityName={facilityName}
            policy={data.policy}
            hasPolicyException={data.hasPolicyException}
            onEditException={() => setIsPolicyOpen(true)}
          />
        ) : null}
        {tab === 'master-key' ? <MasterKeyTab facilityId={facilityId} units={data.units.items} /> : null}
      </TabPanel>

      <UnitDrawer
        unit={selectedUnit}
        facilityName={facilityName}
        overdueItem={selectedUnit ? findOverdueItem(overdueItems, selectedUnit) : undefined}
        onClose={() => setSelectedUnitId(null)}
        onToggleMaintenance={handleToggleMaintenance}
        onViewBooking={fromDrawer((unit: StorageUnit) => setBookingTarget({ bookingId: unit.bookingId, unitCode: unit.unitCode }))}
        onSeal={fromDrawer(openSealing)}
        onLock={fromDrawer(overdueDialogs.actions.onLock)}
        onRestore={fromDrawer(overdueDialogs.actions.onRestore)}
        onViewProtocol={fromDrawer((record) => overdueDialogs.viewProtocol({ record }))}
        onUnseal={fromDrawer((record) =>
          overdueDialogs.unseal({
            sealingRecordId: record.id,
            protocolNumber: record.protocolNumber,
            unitCode: record.unitCode,
            customerName: record.customerName,
            sealedAt: record.sealedAt,
          }),
        )}
        onResetPin={canResetPin ? fromDrawer(setPinTarget) : undefined}
      />

      <CreateStorageUnitModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        facilities={facilities}
        defaultFacilityId={facilityId}
        onCreated={(unit) => {
          setIsCreateOpen(false)
          toast.success(`Đã tạo kho ${unit.unitCode}`)
          void data.units.reload()
        }}
      />

      <BookingDetailReadOnlyModal
        open={bookingTarget !== null}
        onClose={() => setBookingTarget(null)}
        bookingId={bookingTarget?.bookingId}
        unitCode={bookingTarget?.unitCode}
      />

      {pinTarget ? (
        <PinResetDialog
          open
          onClose={() => setPinTarget(null)}
          unitId={pinTarget.id}
          unitCode={pinTarget.unitCode}
          tenantName={pinTarget.tenantName}
        />
      ) : null}

      {receptionTarget ? (
        <AssignReceptionDialog
          open
          onClose={() => setReceptionTarget(null)}
          booking={receptionTarget.booking}
          mode={receptionTarget.mode}
          facilityId={facilityId}
          onAssigned={(booking) => {
            const approved = receptionTarget.mode === 'approve'
            setReceptionTarget(null)
            if (approved) {
              toast.success(
                'Đã duyệt yêu cầu thuê kho',
                `Đơn ${booking.bookingCode}${booking.assignedStaffName ? ` · tiếp đón: ${booking.assignedStaffName}` : ''}`,
              )
              void data.pendingApprovals.reload()
            } else {
              toast.success('Đã phân công nhân viên tiếp đón', `${booking.assignedStaffName ?? ''} · đơn ${booking.bookingCode}`.trim())
            }
            void data.arrivals.reload()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        tone="danger"
        title="Từ chối yêu cầu thuê kho?"
        description={
          rejectTarget
            ? `Đơn ${rejectTarget.bookingCode} của ${rejectTarget.customerName || 'khách hàng'} sẽ bị hủy và kho ${rejectTarget.unitCode ?? ''} trở lại trạng thái trống. Yêu cầu chưa thanh toán nên không phát sinh hoàn tiền.`
            : undefined
        }
        confirmLabel="Từ chối yêu cầu"
        onConfirm={confirmReject}
      />

      {overdueDialogs.dialogs}

      <FacilityPolicyViewModal
        isOpen={isPolicyOpen}
        onClose={() => setIsPolicyOpen(false)}
        facilityId={facilityId}
        facilityName={facilityName ?? 'cơ sở'}
        canEdit={data.hasPolicyException}
        onSaved={() => {
          void data.policy.reload()
          void data.overdue.reload()
        }}
      />
    </div>
  )
}
