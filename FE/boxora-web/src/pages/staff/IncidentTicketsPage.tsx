import { useCallback, useState } from 'react'
import { Eye, Plus, RefreshCw } from 'lucide-react'
import { Alert, Button, Card, PageHeader, Pagination } from '@/components/ui'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { useAuth } from '@/context/AuthContext'
import { getApiErrorMessage } from '@/lib/apiError'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { TicketFilters } from './tickets/components/TicketFilters'
import { TicketKpis } from './tickets/components/TicketKpis'
import { TicketTable } from './tickets/components/TicketTable'
import { useIncidentTickets } from './tickets/hooks/useIncidentTickets'
import { useTicketFilters } from './tickets/hooks/useTicketFilters'
import { useTicketPermissions } from './tickets/hooks/useTicketPermissions'
import { AssignTicketModal } from './tickets/modals/AssignTicketModal'
import { CloseTicketDialog } from './tickets/modals/CloseTicketDialog'
import { ContactBomModal } from './tickets/modals/ContactBomModal'
import { CreateTicketModal } from './tickets/modals/CreateTicketModal'
import { ReopenTicketModal } from './tickets/modals/ReopenTicketModal'
import { ResolveTicketModal } from './tickets/modals/ResolveTicketModal'
import { TicketDetailDrawer } from './tickets/modals/TicketDetailDrawer'
import type { TicketActionId, TicketDialogState } from './tickets/ticketActions'

/**
 * Support ticket queue for /portal/tickets, shared by STAFF, FACILITY_MANAGER
 * (who work tickets) and BUSINESS_MANAGER / ADMIN (who only watch).
 */
export function IncidentTicketsPage() {
  const { user, role } = useAuth()
  const permissions = useTicketPermissions(role, user)
  const { selectedFacility, setSelectedFacility, facilities, isFacilityScoped } = useDashboardContext()
  const facilityId = selectedFacility === ALL_FACILITIES ? undefined : selectedFacility

  const queue = useIncidentTickets(facilityId)
  const { filters, updateFilters, clearFilters, hasActiveFilters, filtered, pager, rows } = useTicketFilters(queue.tickets)

  const [dialog, setDialog] = useState<TicketDialogState>(null)
  const closeDialog = useCallback(() => setDialog(null), [])
  const openDetail = useCallback((ticket: SupportTicketRecord) => setDialog({ type: 'detail', ticket }), [])

  const { take } = queue
  const handleAction = useCallback(
    (action: TicketActionId, ticket: SupportTicketRecord) => {
      if (action === 'take') {
        setDialog(null)
        void take(ticket)
        return
      }
      setDialog({ type: action, ticket })
    },
    [take]
  )

  const hasTickets = queue.tickets.length > 0
  const showRefreshError = Boolean(queue.error) && hasTickets
  const createFacilityId = facilityId ?? user?.facilityId ?? facilities[0]?.id ?? ''

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ticket sự cố"
        description={permissions.description}
        actions={
          <>
            <Button variant="secondary" leftIcon={RefreshCw} loading={queue.isRefreshing} onClick={() => void queue.reload()}>
              Làm mới
            </Button>
            {permissions.canCreate ? (
              <Button leftIcon={Plus} onClick={() => setDialog({ type: 'create' })}>
                Tạo ticket
              </Button>
            ) : null}
          </>
        }
      />

      {permissions.isReadOnly ? (
        <Alert tone="info" icon={Eye} title="Chế độ chỉ xem">
          Vai trò của bạn chỉ theo dõi ticket. Phân công, cập nhật trạng thái và đóng ticket do nhân viên và quản lý cơ sở phụ trách.
        </Alert>
      ) : null}

      <TicketKpis kpis={queue.kpis} isLoading={queue.isLoading} />

      {showRefreshError ? (
        <Alert
          tone="warning"
          title="Không thể làm mới danh sách"
          action={
            <Button size="sm" variant="secondary" onClick={() => void queue.reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(queue.error)} Đang hiển thị dữ liệu đã tải trước đó.
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <TicketFilters
            filters={filters}
            onChange={updateFilters}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
            facility={
              isFacilityScoped
                ? undefined
                : { value: selectedFacility, options: facilities, onChange: setSelectedFacility }
            }
          />
        </div>
        <TicketTable
          rows={rows}
          isLoading={queue.isLoading}
          error={hasTickets ? null : queue.error}
          onRetry={() => void queue.reload()}
          hasActiveFilters={hasActiveFilters}
          permissions={permissions}
          takingId={queue.takingId}
          onAction={handleAction}
          onOpenDetail={openDetail}
        />
        {filtered.length > 0 ? (
          <div className="border-t border-line px-4 py-3">
            <Pagination
              page={pager.page}
              pageCount={pager.pageCount}
              total={pager.total}
              pageSize={pager.pageSize}
              onPageChange={pager.setPage}
              onPageSizeChange={pager.setPageSize}
            />
          </div>
        ) : null}
      </Card>

      {dialog?.type === 'detail' ? (
        <TicketDetailDrawer ticket={dialog.ticket} permissions={permissions} onClose={closeDialog} onAction={handleAction} />
      ) : null}
      {dialog?.type === 'assign' ? (
        <AssignTicketModal
          ticket={dialog.ticket}
          fallbackFacilityId={user?.facilityId}
          onClose={closeDialog}
          onSubmit={queue.assign}
        />
      ) : null}
      {dialog?.type === 'resolve' ? (
        <ResolveTicketModal ticket={dialog.ticket} onClose={closeDialog} onSubmit={queue.resolve} />
      ) : null}
      {dialog?.type === 'close' ? (
        <CloseTicketDialog ticket={dialog.ticket} onClose={closeDialog} onSubmit={queue.close} />
      ) : null}
      {dialog?.type === 'reopen' ? (
        <ReopenTicketModal ticket={dialog.ticket} onClose={closeDialog} onSubmit={queue.reopen} />
      ) : null}
      {dialog?.type === 'contact' ? <ContactBomModal ticket={dialog.ticket} onClose={closeDialog} /> : null}
      {dialog?.type === 'create' ? (
        <CreateTicketModal
          facilities={facilities}
          defaultFacilityId={createFacilityId}
          lockFacility={isFacilityScoped}
          onClose={closeDialog}
          onSubmit={queue.create}
        />
      ) : null}
    </div>
  )
}
