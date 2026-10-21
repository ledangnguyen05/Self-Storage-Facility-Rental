import React, { Suspense, lazy, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ScanQrCode } from 'lucide-react'
import { Button, PageHeader, useToast } from '@/components/ui'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { useAuth } from '@/context/AuthContext'
import { todayISO } from '@/lib/format'
import type { Booking, HandoverRecord } from '@/types'
import { HandoverCheckInWorkbench } from './components/HandoverCheckInWorkbench'
import { StaffPolicyGuideModal } from './components/StaffPolicyGuideModal'
import { useFrontDeskData } from './dashboard/hooks/useFrontDeskData'
import { FrontDeskKpis } from './dashboard/sections/FrontDeskKpis'
import { ReturnInspectionWizard } from './dashboard/sections/ReturnInspectionWizard'
import { TodayQueue, type QueueTab } from './dashboard/sections/TodayQueue'
import { UnitMap } from './dashboard/sections/UnitMap'
import { getCurrentShift, type ReturnQueueItem } from './dashboard/utils/frontDesk'

// html5-qrcode is ~350 kB: load the scanner only when staff open it.
const QrCameraCheckInModal = lazy(() =>
  import('./components/QrCameraCheckInModal').then((m) => ({ default: m.QrCameraCheckInModal })),
)

/** /portal/staff: the front desk (arrivals, check-in wizard, return wizard, unit map) for one facility. */
export const StaffDashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { selectedFacility, facilities } = useDashboardContext()

  const facilityId = selectedFacility && selectedFacility !== ALL_FACILITIES ? selectedFacility : user?.facilityId || undefined
  const facilityName = facilities.find((facility) => facility.id === facilityId)?.name || user?.facilityName || undefined
  const staffName = user?.fullName || user?.username || ''
  const today = todayISO()
  const shift = getCurrentShift()

  const data = useFrontDeskData(facilityId)
  const [tab, setTab] = useState<QueueTab>('arrivals')
  const [checkInTarget, setCheckInTarget] = useState<Booking | null>(null)
  const [returnTarget, setReturnTarget] = useState<ReturnQueueItem | null>(null)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const workspaceRef = useRef<HTMLDivElement>(null)

  // A different facility means a different queue: drop the selections.
  const [scopedFacility, setScopedFacility] = useState(facilityId)
  if (scopedFacility !== facilityId) {
    setScopedFacility(facilityId)
    setCheckInTarget(null)
    setReturnTarget(null)
  }

  // Keep the selected booking fresh after reloads; once checked in it leaves the arrivals list but stays selected.
  const checkInBooking = checkInTarget ? (data.arrivals.find((booking) => booking.id === checkInTarget.id) ?? checkInTarget) : null
  const returnItem = returnTarget ? (data.returns.find((item) => item.bookingId === returnTarget.bookingId) ?? returnTarget) : null

  const revealWorkspace = useCallback(() => {
    window.requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [])

  const startCheckIn = useCallback(
    (booking: Booking) => {
      setTab('arrivals')
      setCheckInTarget(booking)
      revealWorkspace()
    },
    [revealWorkspace],
  )

  const startReturn = useCallback(
    (item: ReturnQueueItem) => {
      setTab('returns')
      setReturnTarget(item)
      revealWorkspace()
    },
    [revealWorkspace],
  )

  const handleHandoverComplete = (booking: Booking, record: HandoverRecord) => {
    // Never claim the email went out unless the server says so.
    toast.success(
      `Đã bàn giao kho ${booking.unitCode || ''}`.trim(),
      record.emailSent
        ? `${booking.customerName || 'Khách hàng'} đã nhận kho. Mã PIN đã được cấp và gửi tới email của khách.`
        : `${booking.customerName || 'Khách hàng'} đã nhận kho. Mã PIN đã được cấp.`,
    )
    void data.reloadOperational()
  }

  const handleReturnComplete = () => {
    setReturnTarget(null)
    void data.reloadOperational()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quầy lễ tân"
        description={`${facilityName || 'Tất cả cơ sở'} · ${shift.label} ${shift.range}${staffName ? ` · ${staffName}` : ''}`}
        actions={
          <>
            <Button variant="secondary" leftIcon={BookOpen} onClick={() => setIsGuideOpen(true)}>
              Hướng dẫn nghiệp vụ
            </Button>
            <Button leftIcon={ScanQrCode} onClick={() => setIsQrOpen(true)}>
              Quét QR nhận kho
            </Button>
          </>
        }
      />

      <FrontDeskKpis
        data={data}
        facilityId={facilityId}
        today={today}
        onShowArrivals={() => setTab('arrivals')}
        onShowReturns={() => setTab('returns')}
        onShowTickets={() => navigate('/portal/tickets')}
      />

      <TodayQueue
        tab={tab}
        onTabChange={setTab}
        data={data}
        today={today}
        shift={shift}
        selectedArrivalId={checkInBooking?.id}
        selectedReturnId={returnItem?.bookingId}
        onSelectArrival={startCheckIn}
        onSelectReturn={startReturn}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Both wizards stay mounted so in-memory drafts (photos, the issued PIN) survive a tab switch. */}
        <div ref={workspaceRef} className="min-w-0 scroll-mt-20 lg:col-span-2">
          <div hidden={tab !== 'arrivals'}>
            <HandoverCheckInWorkbench
              booking={checkInBooking}
              facilityName={facilityName}
              staffName={staffName}
              onHandoverComplete={handleHandoverComplete}
              onOpenQrScanner={() => setIsQrOpen(true)}
            />
          </div>
          <div hidden={tab !== 'returns'}>
            <ReturnInspectionWizard item={returnItem} onCompleted={handleReturnComplete} />
          </div>
        </div>
        <div className="min-w-0">
          <UnitMap
            units={data.units}
            state={data.unitsState}
            facilityId={facilityId}
            arrivals={data.arrivals}
            returns={data.returns}
            onStartCheckIn={startCheckIn}
            onStartReturn={startReturn}
          />
        </div>
      </div>

      {isQrOpen ? (
        <Suspense fallback={null}>
          <QrCameraCheckInModal
            isOpen={isQrOpen}
            onClose={() => setIsQrOpen(false)}
            arrivals={data.arrivals}
            facilityId={facilityId}
            onSelectBookingForWorkbench={startCheckIn}
          />
        </Suspense>
      ) : null}
      <StaffPolicyGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        facilityId={facilityId}
        facilityName={facilityName}
      />
    </div>
  )
}
