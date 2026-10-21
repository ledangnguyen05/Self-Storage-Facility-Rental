import { useState, type ReactNode } from 'react'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { BookingCancelModal } from '@/components/modals/BookingCancelModal'
import { BookingRescheduleModal } from '@/components/modals/BookingRescheduleModal'
import { ContractDocumentModal } from '@/components/modals/ContractDocumentModal'
import { CustomerPolicyModal } from '@/components/modals/CustomerPolicyModal'
import { ContractSigningFlow } from '@/components/modals/contract/ContractSigningFlow'
import type { BookingPinData } from '@/services/bookingService'
import type { Booking } from '@/types'
import { getBookingNoticeInfo, type BookingNoticeInfo } from '../lib/bookingScenario'
import { BookingDetailsModal } from '../modals/BookingDetailsModal'
import { BookingPaymentModal } from '../modals/BookingPaymentModal'
import { ChangePinModal } from '../modals/ChangePinModal'
import { MoveOutRequestModal } from '../modals/MoveOutRequestModal'
import { OutstandingPaymentModal } from '../modals/OutstandingPaymentModal'
import { RenewalModal } from '../modals/RenewalModal'
import { RenewalSigningModal } from '../modals/RenewalSigningModal'
import type { DashboardDialog } from '../types'

interface DashboardDialogsProps {
  dialog: DashboardDialog | null
  onDialogChange: (dialog: DashboardDialog | null) => void
  /** Latest bookings, so an open details dialog shows fresh data after polling. */
  bookingsById: Map<string, Booking>
  noticeMap: Map<string, BookingNoticeInfo>
  onPinUpdated: (contractId: string, data: Pick<BookingPinData, 'pin' | 'qrAccessToken'>) => void
  reloadContracts: () => Promise<void>
  reloadPayments: () => Promise<void>
  refreshBookingLists: () => Promise<void>
  reloadAfterBookingChange: () => Promise<void>
  /** Money changed (payment link, renewal, refund): unit balances and refunds reload. */
  onBalancesChanged: () => void
}

/** Renders the single page-level dialog (see DashboardDialog) and refreshes data after each flow. */
export function DashboardDialogs({
  dialog,
  onDialogChange,
  bookingsById,
  noticeMap,
  onPinUpdated,
  reloadContracts,
  reloadPayments,
  refreshBookingLists,
  reloadAfterBookingChange,
  onBalancesChanged,
}: DashboardDialogsProps) {
  const [historyKey, setHistoryKey] = useState(0)
  const [rescheduled, setRescheduled] = useState<Booking | null>(null)
  const close = () => onDialogChange(null)
  const closeAndRefreshMoney = () => {
    close()
    onBalancesChanged()
    void reloadContracts()
    void reloadPayments()
  }

  const reschedule = dialog?.type === 'reschedule' ? dialog : null
  const cancel = dialog?.type === 'cancel' ? dialog : null
  const policy = dialog?.type === 'policy' ? dialog : null

  let content: ReactNode = null
  switch (dialog?.type) {
    case 'renew':
      content = (
        <RenewalModal
          key={dialog.contract.id}
          contract={dialog.contract}
          initialRenewal={dialog.renewal}
          onClose={closeAndRefreshMoney}
          onChanged={() => {
            void reloadContracts()
            void reloadPayments()
            onBalancesChanged()
          }}
          onSignInApp={(renewal, contract) => onDialogChange({ type: 'renewal-sign', renewal, contract })}
        />
      )
      break
    case 'renewal-sign': {
      const { renewal, contract } = dialog
      content = (
        <RenewalSigningModal
          renewal={renewal}
          onClose={() => (contract ? onDialogChange({ type: 'renew', contract, renewal }) : close())}
          onSigned={updated => {
            void reloadContracts()
            onBalancesChanged()
            if (contract) onDialogChange({ type: 'renew', contract, renewal: updated })
            else close()
          }}
        />
      )
      break
    }
    case 'pay-outstanding':
      content = (
        <OutstandingPaymentModal
          contract={dialog.contract}
          onClose={closeAndRefreshMoney}
          onRenew={contract => onDialogChange({ type: 'renew', contract })}
        />
      )
      break
    case 'move-out':
      content = (
        <MoveOutRequestModal
          contract={dialog.contract}
          booking={dialog.booking}
          onClose={close}
          onRequested={() => void reloadAfterBookingChange()}
        />
      )
      break
    case 'change-pin': {
      const contractId = dialog.contract.id
      content = <ChangePinModal contract={dialog.contract} onClose={close} onUpdated={data => onPinUpdated(contractId, data)} />
      break
    }
    case 'contract':
      content = (
        <ContractDocumentModal contract={dialog.contract} onClose={close} onSignNow={contract => onDialogChange({ type: 'sign', contract })} />
      )
      break
    case 'sign':
      content = (
        <ContractSigningFlow
          key={dialog.contract.id}
          contract={dialog.contract}
          onClose={close}
          onSigned={() => {
            // The signing dialog itself confirms the signature with one toast.
            close()
            void reloadAfterBookingChange()
          }}
        />
      )
      break
    case 'booking-details': {
      const booking = bookingsById.get(dialog.booking.id) ?? dialog.booking
      content = (
        <BookingDetailsModal
          booking={booking}
          info={noticeMap.get(booking.id) ?? getBookingNoticeInfo(booking)}
          historyKey={historyKey}
          onClose={close}
          onReschedule={target => onDialogChange({ type: 'reschedule', booking: target, returnToDetails: true })}
          onPay={target => onDialogChange({ type: 'pay', booking: target })}
          onSign={contract => onDialogChange({ type: 'sign', contract })}
          onViewPolicy={target => onDialogChange({ type: 'policy', facilityId: target.facilityId, facilityName: target.facilityName })}
        />
      )
      break
    }
    case 'pay':
      content = (
        <BookingPaymentModal
          key={dialog.booking.id}
          booking={dialog.booking}
          fallbackAmount={dialog.fallbackAmount}
          onClose={() => {
            close()
            void reloadAfterBookingChange()
          }}
        />
      )
      break
    default:
      break
  }

  return (
    <>
      {content}

      <BookingRescheduleModal
        isOpen={Boolean(reschedule)}
        booking={reschedule?.booking ?? null}
        onClose={() => {
          if (reschedule?.returnToDetails) onDialogChange({ type: 'booking-details', booking: rescheduled ?? reschedule.booking })
          else close()
          setRescheduled(null)
        }}
        onSuccess={updated => {
          setRescheduled(updated)
          setHistoryKey(key => key + 1)
          void refreshBookingLists()
        }}
      />

      <BookingCancelModal
        isOpen={Boolean(cancel)}
        booking={cancel?.booking ?? null}
        onClose={close}
        onSuccess={() => {
          onBalancesChanged()
          void reloadAfterBookingChange()
        }}
      />

      <CustomerPolicyModal
        isOpen={Boolean(policy)}
        onClose={close}
        facilityId={policy?.facilityId}
        facilityName={policy?.facilityName ? formatFacilityName(policy.facilityName) : undefined}
      />
    </>
  )
}
