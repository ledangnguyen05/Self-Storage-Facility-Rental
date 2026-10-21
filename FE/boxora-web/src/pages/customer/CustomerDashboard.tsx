import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, LifeBuoy, Package, Plus, ReceiptText, Search } from 'lucide-react'
import { Button, PageHeader, TabPanel, Tabs } from '@/components/ui'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { useAuth } from '@/context/AuthContext'
import { contractService } from '@/services/contractService'
import type { RentalContract } from '@/types'
import { DashboardDialogs } from './dashboard/components/DashboardDialogs'
import { DashboardKpis } from './dashboard/components/DashboardKpis'
import type { DashboardTab } from './dashboard/constants'
import { useCustomerPortalData } from './dashboard/hooks/useCustomerPortalData'
import { useDashboardTab } from './dashboard/hooks/useDashboardTab'
import { useUnitPin } from './dashboard/hooks/useUnitPin'
import { buildBookingNoticeMap } from './dashboard/lib/bookingScenario'
import { findNearestEnding, isHeldContract, isOverdueContract, isPendingCheckIn, sumMonthlyFees } from './dashboard/lib/portal'
import type { BookingCreatedResult } from './dashboard/modals/BookingCreateModal'
import { BookingsTab } from './dashboard/tabs/BookingsTab'
import { ContractsTab } from './dashboard/tabs/ContractsTab'
import { ExploreTab } from './dashboard/tabs/ExploreTab'
import { MyUnitsTab } from './dashboard/tabs/MyUnitsTab'
import { SupportTab } from './dashboard/tabs/SupportTab'
import type { DashboardDialog, TicketPreset } from './dashboard/types'

const TABS_ID = 'customer-portal'

/**
 * Customer portal (/portal/customer). The active tab is `?tab=`; `?unit=`
 * highlights a unit card and `?bookingId=` opens a reservation.
 */
export const CustomerDashboard = () => {
  const { user } = useAuth()
  const { facilities, selectedFacility } = useDashboardContext()
  const { tab, setTab, searchParams, updateParams } = useDashboardTab()
  const data = useCustomerPortalData(user?.id, { pollBookings: tab === 'my-units' || tab === 'bookings' })
  const pins = useUnitPin()
  const [dialog, setDialog] = useState<DashboardDialog | null>(null)
  const [ticketPreset, setTicketPreset] = useState<TicketPreset | null>(null)
  const [balanceKey, setBalanceKey] = useState(0)
  const bumpBalances = useCallback(() => setBalanceKey(key => key + 1), [])

  const contracts = data.contracts.data
  const bookings = data.bookings.data
  const requests = data.requests.data
  const reloadTickets = data.tickets.reload
  const reloadAfterBookingChange = data.reloadAfterBookingChange

  const heldContracts = useMemo(() => contracts.filter(isHeldContract), [contracts])
  const overdueCount = useMemo(() => heldContracts.filter(isOverdueContract).length, [heldContracts])
  const nearestEnding = useMemo(() => findNearestEnding(heldContracts), [heldContracts])
  const monthlyTotal = useMemo(() => sumMonthlyFees(heldContracts), [heldContracts])
  const pendingCheckInCount = useMemo(() => bookings.filter(isPendingCheckIn).length, [bookings])
  const bookingsById = useMemo(() => new Map(bookings.map(booking => [booking.id, booking])), [bookings])
  // One scenario per booking (and per request not yet in the booking list), matched to contracts by bookingId.
  const noticeMap = useMemo(
    () => buildBookingNoticeMap([...bookings, ...requests.filter(request => !bookingsById.has(request.id))], contracts),
    [bookings, requests, bookingsById, contracts],
  )

  // `?bookingId=` (e.g. from the payment result page) opens that reservation; the parameter is consumed on the next dialog change.
  // `?mockSignContractId=` / `?mockSignRenewalId=`: in-app signing links of the test environment (DocuSeal not configured).
  const bookingIdParam = searchParams.get('bookingId')
  const signContractParam = searchParams.get('mockSignContractId')
  const signRenewalParam = searchParams.get('mockSignRenewalId')
  const bookingsLoading = data.bookings.isLoading
  const deepLinkedBooking = bookingIdParam && !bookingsLoading ? bookingsById.get(bookingIdParam) : undefined
  const deepLinkedContract =
    signContractParam && !data.contracts.isLoading ? contracts.find(contract => contract.id === signContractParam) : undefined
  const deepLinkDialog: DashboardDialog | null = deepLinkedBooking
    ? { type: 'booking-details', booking: deepLinkedBooking }
    : deepLinkedContract && deepLinkedContract.status === 'PENDING_SIGNATURE'
      ? { type: 'sign', contract: deepLinkedContract }
      : null
  const activeDialog: DashboardDialog | null = dialog ?? deepLinkDialog
  const changeDialog = useCallback(
    (next: DashboardDialog | null) => {
      if (bookingIdParam || signContractParam || signRenewalParam) {
        updateParams({ bookingId: null, mockSignContractId: null, mockSignRenewalId: null }, { replace: true })
      }
      setDialog(next)
    },
    [bookingIdParam, signContractParam, signRenewalParam, updateParams],
  )

  useEffect(() => {
    if (!signRenewalParam || !user?.id || data.contracts.isLoading) return undefined
    const controller = new AbortController()
    contractService
      .getRenewal(signRenewalParam, { signal: controller.signal })
      .then(renewal => {
        const contract = contracts.find(item => item.id === renewal.contractId)
        setDialog(renewal.signed || renewal.status === 'COMPLETED' || renewal.status === 'CANCELLED'
          ? contract ? { type: 'renew', contract, renewal } : null
          : { type: 'renewal-sign', renewal, contract })
      })
      .catch(() => undefined)
      .finally(() => updateParams({ mockSignRenewalId: null }, { replace: true }))
    return () => controller.abort()
    // Only when the link parameter appears; the contract list is read once it is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signRenewalParam, user?.id, data.contracts.isLoading])

  const goToTab = useCallback(
    (next: DashboardTab) => {
      setTab(next)
      if (next === 'support') void reloadTickets()
    },
    [setTab, reloadTickets],
  )

  const goToUnit = useCallback((unitCode: string) => setTab('my-units', { unit: unitCode, unitCode: null }), [setTab])

  const reportIssue = useCallback(
    (contract: RentalContract) => {
      setTicketPreset({ contractId: contract.id, nonce: Date.now() })
      goToTab('support')
    },
    [goToTab],
  )

  const handleBookingCreated = useCallback(
    (result: BookingCreatedResult) => {
      void reloadAfterBookingChange()
      if (result.payOnline) changeDialog({ type: 'pay', booking: result.booking, fallbackAmount: result.initialPaymentAmount })
    },
    [reloadAfterBookingChange, changeDialog],
  )

  const highlightedUnit = searchParams.get('unit') || searchParams.get('unitCode')
  const displayName = user?.fullName || user?.username || 'quý khách'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Xin chào, ${displayName}`}
        description="Quản lý kho đang thuê, mã PIN truy cập, đơn đặt chỗ và hợp đồng của bạn."
        actions={
          <Button leftIcon={Plus} onClick={() => goToTab('explore')}>
            Thuê thêm kho
          </Button>
        }
      />

      <DashboardKpis
        heldCount={heldContracts.length}
        overdueCount={overdueCount}
        pendingCheckInCount={pendingCheckInCount}
        bookingCount={bookings.length}
        monthlyTotal={monthlyTotal}
        nearestEnding={nearestEnding}
        contractsLoading={data.contracts.isLoading}
        bookingsLoading={bookingsLoading}
        onOpenBookings={() => goToTab('bookings')}
      />

      <div className="flex flex-col gap-4">
        <Tabs<DashboardTab>
          id={TABS_ID}
          aria-label="Cổng khách thuê"
          value={tab}
          onValueChange={goToTab}
          items={[
            { value: 'my-units', label: 'Kho của tôi', icon: Package, count: heldContracts.length },
            { value: 'bookings', label: 'Đặt chỗ', icon: CalendarCheck, count: bookings.length },
            { value: 'explore', label: 'Thuê thêm', icon: Search },
            { value: 'contracts', label: 'Hợp đồng và thanh toán', icon: ReceiptText, count: contracts.length },
            { value: 'support', label: 'Hỗ trợ', icon: LifeBuoy, count: data.tickets.data.length || undefined },
          ]}
        />

        <TabPanel tabsId={TABS_ID} value={tab}>
          {tab === 'my-units' ? (
            <MyUnitsTab
              contracts={heldContracts}
              contractsLoading={data.contracts.isLoading}
              contractsError={data.contracts.error}
              onRetryContracts={() => void data.contracts.reload()}
              requests={requests}
              requestsError={data.requests.error}
              onRetryRequests={() => void data.requests.reload()}
              bookingsById={bookingsById}
              noticeMap={noticeMap}
              pendingCheckInCount={pendingCheckInCount}
              pins={pins}
              highlightedUnit={highlightedUnit}
              onClearHighlight={() => updateParams({ unit: null, unitCode: null }, { replace: true })}
              onOpenDialog={changeDialog}
              onReportIssue={reportIssue}
              onGoToTab={goToTab}
              balanceRefreshKey={balanceKey}
            />
          ) : null}
          {tab === 'bookings' ? (
            <BookingsTab
              bookings={bookings}
              isLoading={bookingsLoading}
              isRefreshing={data.bookings.isRefreshing}
              error={data.bookings.error}
              onRetry={() => void data.refreshBookingLists()}
              noticeMap={noticeMap}
              onOpenDialog={changeDialog}
              onGoToUnit={goToUnit}
              onGoToTab={goToTab}
            />
          ) : null}
          {tab === 'explore' ? (
            <ExploreTab
              facilities={facilities}
              initialFacilityId={selectedFacility !== ALL_FACILITIES ? selectedFacility : undefined}
              onBookingCreated={handleBookingCreated}
              onViewBookings={() => goToTab('bookings')}
            />
          ) : null}
          {tab === 'contracts' ? (
            <ContractsTab
              user={user}
              contracts={contracts}
              heldContractCount={heldContracts.length}
              contractsLoading={data.contracts.isLoading}
              contractsError={data.contracts.error}
              onRetryContracts={() => void data.contracts.reload()}
              payments={data.payments.data}
              paymentsLoading={data.payments.isLoading}
              paymentsError={data.payments.error}
              onRetryPayments={() => void data.payments.reload()}
              onOpenDialog={changeDialog}
              refundsRefreshKey={balanceKey}
            />
          ) : null}
          {tab === 'support' ? (
            <SupportTab
              customerId={user?.id}
              heldContracts={heldContracts}
              tickets={data.tickets.data}
              isLoading={data.tickets.isLoading}
              isRefreshing={data.tickets.isRefreshing}
              error={data.tickets.error}
              onReload={reloadTickets}
              preset={ticketPreset}
            />
          ) : null}
        </TabPanel>
      </div>

      <DashboardDialogs
        dialog={activeDialog}
        onDialogChange={changeDialog}
        bookingsById={bookingsById}
        noticeMap={noticeMap}
        onPinUpdated={pins.setPin}
        reloadContracts={data.contracts.reload}
        reloadPayments={data.payments.reload}
        refreshBookingLists={data.refreshBookingLists}
        reloadAfterBookingChange={reloadAfterBookingChange}
        onBalancesChanged={bumpBalances}
      />
    </div>
  )
}

export default CustomerDashboard
