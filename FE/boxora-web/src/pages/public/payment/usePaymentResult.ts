import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { usePolling } from '../../../hooks/usePolling'
import { getApiErrorMessage, getApiErrorStatus } from '../../../lib/apiError'
import { bookingService } from '../../../services/bookingService'
import { contractService } from '../../../services/contractService'
import { paymentService, type PaymentItem } from '../../../services/paymentService'
import type { Booking, RentalContract } from '../../../types'
import {
  RECONCILE_INTERVAL_MS,
  RECONCILE_MAX_ATTEMPTS,
  failureReasonOf,
  isContractSigned,
  isKnownNotCharged,
  mayHaveBeenCharged,
  isPaymentWindowOpen,
  isRefundPending,
  isServerConfirmedPaid,
  isServerFailed,
  pickPayment,
  purposeOf,
  readPaymentParams,
  resolveAmountVnd,
  type PaymentOutcomeKind,
} from './paymentResultModel'

interface PaymentResultData {
  payment?: PaymentItem
  booking?: Booking
  contract: RentalContract | null
}

/**
 * State of the VNPay return page. The payment (by transaction reference), its booking and its contract
 * come from the server; the URL result is only a hint. While a payment the server has not confirmed yet
 * is expected, the page re-checks it a few times and stops as soon as it is settled.
 */
export function usePaymentResult() {
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const params = useMemo(() => readPaymentParams(searchParams), [searchParams])
  const [attempts, setAttempts] = useState(0)
  const [signedContract, setSignedContract] = useState<RentalContract | null>(null)

  const hasTarget = Boolean(params.txnRef || params.bookingId || params.contractId)
  const canLoad = isAuthenticated && hasTarget
  const query = useAsyncData<PaymentResultData>(
    async signal => {
      let payment: PaymentItem | undefined
      if (params.txnRef) {
        // A forbidden (another customer's) or unknown transaction is an error to show, never "not recorded yet".
        payment = await paymentService.getByTransactionId(params.txnRef, { signal })
      }
      const bookingId = params.bookingId || payment?.bookingId || ''
      const contractId = params.contractId || payment?.contractId || ''
      const booking = bookingId ? await bookingService.getById(bookingId, { signal }) : undefined
      if (!payment && bookingId) {
        const payments = await paymentService.getByBookingId(bookingId, { signal }).catch(() => [])
        payment = pickPayment(payments, params.txnRef)
      }
      const contract = bookingId
        ? await contractService.getContractByBookingId(bookingId, { signal })
        : contractId
          ? await contractService.getById(contractId, { signal }).catch(() => null)
          : null
      return { payment, booking, contract }
    },
    [params.txnRef, params.bookingId, params.contractId, isAuthenticated],
    { enabled: canLoad },
  )

  const booking = query.data?.booking
  const payment = query.data?.payment
  const contract = signedContract ?? query.data?.contract ?? null
  const purpose = purposeOf(payment, params)
  const refund = isRefundPending(payment, params)
  const paid = !refund && isServerConfirmedPaid(booking, payment, purpose)
  const failed = isServerFailed(payment) || (!payment && (params.status === 'FAILED' || Boolean(params.error)))

  const shouldReconcile = canLoad && !paid && !refund && !failed && !query.error && attempts < RECONCILE_MAX_ATTEMPTS
  const reconcile = useCallback(async () => {
    setAttempts(count => count + 1)
    await query.reload()
  }, [query])
  usePolling(reconcile, RECONCILE_INTERVAL_MS, shouldReconcile)

  const checkAgain = useCallback(async () => {
    setAttempts(0)
    await query.reload()
  }, [query])

  let kind: PaymentOutcomeKind
  if (!hasTarget) kind = params.status === 'FAILED' || params.error ? 'failed' : 'unknown'
  else if (!isAuthenticated) kind = params.status === 'FAILED' ? 'failed' : 'unverified'
  else if (query.isLoading && !query.data) kind = 'loading'
  else if (query.error && !query.data) kind = 'error'
  else if (refund) kind = 'refund'
  else if (paid) kind = 'paid'
  else if (failed) kind = 'failed'
  else kind = 'pending'

  const loadErrorStatus = query.error ? getApiErrorStatus(query.error) : undefined
  const loadErrorMessage = query.error
    ? loadErrorStatus === 401 || loadErrorStatus === 403
      ? 'Bạn không có quyền xem thông tin thanh toán này.'
      : loadErrorStatus === 404
        ? 'Không tìm thấy giao dịch này. Hãy kiểm tra lại đường dẫn hoặc xem lịch sử thanh toán trong cổng khách hàng.'
        : getApiErrorMessage(query.error, 'Không thể tải thông tin thanh toán từ máy chủ.')
    : ''

  return {
    kind,
    purpose,
    params,
    booking,
    payment,
    contract,
    contractSigned: isContractSigned(contract),
    amountVnd: resolveAmountVnd({ payment, booking, params }),
    transactionRef: payment?.transactionId || params.txnRef,
    /** Only the initial booking payment can be retried from this page; rent and renewals go back to the portal. */
    canRetryPayment: purpose === 'booking' && isPaymentWindowOpen(booking),
    /** True while the page is still re-checking with the server. */
    isReconciling: kind === 'pending' && shouldReconcile,
    attempts,
    loadErrorMessage,
    /** 403 / 404: retrying cannot help, the page offers the portal instead. */
    loadErrorFinal: loadErrorStatus === 401 || loadErrorStatus === 403 || loadErrorStatus === 404,
    failureReason: failureReasonOf(payment, params),
    mayHaveBeenCharged: mayHaveBeenCharged(payment, params),
    knownNotCharged: isKnownNotCharged(payment, params),
    checkAgain,
    onContractSigned: (signed: RentalContract) => setSignedContract(signed),
    reload: query.reload,
  }
}

export type PaymentResultState = ReturnType<typeof usePaymentResult>
