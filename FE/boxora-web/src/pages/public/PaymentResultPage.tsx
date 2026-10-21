import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarClock, FileSignature, FileText, Landmark, LayoutDashboard, LogIn, Package, RefreshCw, Search } from 'lucide-react'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { ContractSigningFlow } from '../../components/modals/contract/ContractSigningFlow'
import { Button, useToast } from '../../components/ui'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { buildLoginRedirect, getPortalForRole } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorMessage } from '../../lib/apiError'
import { isSafePaymentUrl, paymentService } from '../../services/paymentService'
import type { RentalContract } from '../../types'
import { Container } from './components/Section'
import { PublicLayout } from './components/PublicLayout'
import { usePageTitle } from './components/usePageTitle'
import { PaymentOutcome } from './payment/PaymentOutcome'
import { usePaymentResult } from './payment/usePaymentResult'

const linkIcon = (Icon: typeof Package) => <Icon size={16} strokeWidth={1.75} aria-hidden="true" />

/** VNPay return page: the outcome comes from the server, never from the URL alone. */
export const PaymentResultPage: React.FC = () => {
  usePageTitle('Kết quả thanh toán')
  const toast = useToast()
  const location = useLocation()
  const { role } = useAuth()
  const state = usePaymentResult()
  const { booking, contract, purpose } = state

  const [isRetrying, setIsRetrying] = useState(false)
  const [signingContract, setSigningContract] = useState<RentalContract | null>(null)
  const [viewingContract, setViewingContract] = useState(false)

  const isCustomer = role === 'CUSTOMER'
  const portalPath = getPortalForRole(role)
  const portalLabel = isCustomer ? 'Về cổng khách hàng' : 'Về cổng làm việc'

  const retryPayment = async () => {
    if (!booking) return
    setIsRetrying(true)
    try {
      const payment = await paymentService.createVNPayPayment({ bookingId: booking.id })
      if (!isSafePaymentUrl(payment?.paymentUrl)) throw new Error('Cổng thanh toán trả về liên kết không hợp lệ.')
      window.location.assign(payment.paymentUrl)
    } catch (error) {
      toast.error('Không thể thanh toán lại', getApiErrorMessage(error, 'Vui lòng thử lại sau giây lát.'))
      setIsRetrying(false)
    }
  }

  const portalLink = (variant: 'primary' | 'secondary') => (
    <Link key="portal" to={portalPath} className={buttonVariants({ variant })}>
      {linkIcon(LayoutDashboard)}
      {portalLabel}
    </Link>
  )
  const myUnitsLink = (variant: 'primary' | 'secondary', label = 'Về Kho của tôi') => (
    <Link key="units" to={isCustomer ? '/portal/customer?tab=my-units' : portalPath} className={buttonVariants({ variant })}>
      {linkIcon(Package)}
      {label}
    </Link>
  )

  let actions: React.ReactNode
  switch (state.kind) {
    case 'paid':
      if (purpose !== 'booking') {
        actions = (
          <>
            {myUnitsLink('primary', purpose === 'renewal' ? 'Ký phụ lục và xem kho' : 'Về Kho của tôi')}
            {isCustomer ? (
              <Link key="contracts" to="/portal/customer?tab=contracts" className={buttonVariants({ variant: 'secondary' })}>
                {linkIcon(FileText)}
                Xem lịch sử thanh toán
              </Link>
            ) : null}
          </>
        )
      } else {
        actions = state.contractSigned ? (
          <>
            {portalLink('primary')}
            {contract ? (
              <Button key="view" variant="secondary" leftIcon={FileText} onClick={() => setViewingContract(true)}>
                Xem hợp đồng đã ký
              </Button>
            ) : null}
            {booking ? (
              <Link
                key="handover"
                to={`/portal/customer?tab=bookings&bookingId=${encodeURIComponent(booking.id)}`}
                className={buttonVariants({ variant: 'secondary' })}
              >
                {linkIcon(CalendarClock)}
                Xem lịch bàn giao
              </Link>
            ) : null}
          </>
        ) : (
          <>
            {contract && contract.status === 'PENDING_SIGNATURE' ? (
              <Button key="sign" leftIcon={FileSignature} onClick={() => setSigningContract(contract)}>
                Ký hợp đồng trực tuyến
              </Button>
            ) : (
              <Button key="refresh" leftIcon={RefreshCw} onClick={() => void state.checkAgain()}>
                Tải hợp đồng
              </Button>
            )}
            {portalLink('secondary')}
          </>
        )
      }
      break
    case 'refund':
      actions = (
        <>
          <Link key="refund" to={isCustomer ? '/portal/customer?tab=contracts' : portalPath} className={buttonVariants()}>
            {linkIcon(Landmark)}
            Cung cấp tài khoản nhận hoàn tiền
          </Link>
          <Link key="units" to="/units" className={buttonVariants({ variant: 'secondary' })}>
            {linkIcon(Search)}
            Tìm kho khác
          </Link>
        </>
      )
      break
    case 'pending':
      actions = (
        <>
          <Button key="check" leftIcon={RefreshCw} loading={state.isReconciling} onClick={() => void state.checkAgain()}>
            Kiểm tra lại
          </Button>
          {state.canRetryPayment ? (
            <Button key="retry" variant="secondary" loading={isRetrying} onClick={() => void retryPayment()}>
              Thanh toán lại
            </Button>
          ) : null}
          {purpose === 'booking' ? portalLink('secondary') : myUnitsLink('secondary')}
        </>
      )
      break
    case 'failed':
      actions =
        purpose !== 'booking' ? (
          myUnitsLink('primary', 'Thanh toán lại trong Kho của tôi')
        ) : (
          <>
            {state.canRetryPayment ? (
              <Button key="retry" loading={isRetrying} onClick={() => void retryPayment()}>
                Thanh toán lại
              </Button>
            ) : (
              <Link key="units" to="/units" className={buttonVariants()}>
                {linkIcon(Search)}
                Tìm kho khác
              </Link>
            )}
            {portalLink('secondary')}
          </>
        )
      break
    case 'unverified':
      actions = (
        <>
          <Link key="login" to={buildLoginRedirect(`${location.pathname}${location.search}`)} className={buttonVariants()}>
            {linkIcon(LogIn)}
            Đăng nhập
          </Link>
          <Link key="home" to="/" className={buttonVariants({ variant: 'secondary' })}>
            Về trang chủ
          </Link>
        </>
      )
      break
    case 'error':
      actions = state.loadErrorFinal ? (
        portalLink('primary')
      ) : (
        <>
          <Button key="reload" leftIcon={RefreshCw} onClick={() => void state.reload()}>
            Thử lại
          </Button>
          {portalLink('secondary')}
        </>
      )
      break
    default:
      actions = (
        <Link key="units" to="/units" className={buttonVariants()}>
          {linkIcon(Search)}
          Tìm kho
        </Link>
      )
  }

  return (
    <PublicLayout>
      <Container className="max-w-2xl py-10 sm:py-14">
        <PaymentOutcome state={state} actions={actions} />
      </Container>

      {signingContract ? (
        <ContractSigningFlow
          contract={signingContract}
          onClose={() => setSigningContract(null)}
          onSigned={signed => {
            // The signing dialog shows the success toast.
            setSigningContract(null)
            state.onContractSigned(signed)
          }}
        />
      ) : null}
      {viewingContract && contract ? <ContractDocumentModal contract={contract} onClose={() => setViewingContract(false)} /> : null}
    </PublicLayout>
  )
}

export default PaymentResultPage
