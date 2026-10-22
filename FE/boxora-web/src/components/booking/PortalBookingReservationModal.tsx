import React, { useEffect, useMemo, useState } from 'react'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { pricingService, PricingQuoteResponse } from '../../services/pricingService'
import { useLanguage } from '../../context/LanguageContext'

export interface PortalBookingUnitData {
    id: string
    unitCode: string
    name: string
    facilityId?: string
    facilityName: string
    facilityStatus?: string
    priceFormatted: string
    priceNumber: number
    depositNumber: number
    areaSqMeters?: number
    floorLevel?: string
}

type BookingWorkflow = 'HOLD_ONLY' | 'ONLINE_NOW'
type BookingPackage = '15d' | '1m' | '3m' | '6m' | '12m' | '24m' | 'custom'

interface PortalBookingReservationModalProps {
  unit: PortalBookingUnitData
  onClose: () => void
  onRefresh?: () => Promise<void> | void
  onNavigate?: (destination: 'bookings' | 'my-units') => void
}

export const PortalBookingReservationModal: React.FC<PortalBookingReservationModalProps> = ({ unit, onClose, onRefresh, onNavigate }) => {
  const selectedBookingUnit = unit
  const { language, t } = useLanguage()
  const displayFacilityName = selectedBookingUnit.facilityName || (language === 'vi' ? 'Hệ thống kho Boxora' : 'Boxora Storage Facility')
  const isFacilitySuspended = Boolean(selectedBookingUnit.facilityStatus && selectedBookingUnit.facilityStatus !== 'ACTIVE')
  const facilitySuspendedMessage = selectedBookingUnit.facilityStatus === 'MAINTENANCE'
    ? (language === 'vi' ? `Chi nhánh ${displayFacilityName} hiện đang trong thời gian bảo trì kỹ thuật, tạm ngưng nhận đơn đặt giữ chỗ mới.` : `The branch ${displayFacilityName} is currently under maintenance and cannot accept new reservations.`)
    : (language === 'vi' ? `Chi nhánh ${displayFacilityName} hiện đang tạm ngưng hoạt động, tạm ngưng nhận đơn đặt giữ chỗ mới.` : `The branch ${displayFacilityName} is currently inactive/suspended and cannot accept new reservations.`)
  const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ${language === 'vi' ? String.fromCharCode(8363) : 'VND'}`
  const localizedUnitName = (name: string) => {
    if (language === 'vi') return name
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (normalized.includes('locker') || normalized.includes('mini') || normalized.includes('ca nhan')) return 'Personal storage'
    if (normalized.includes('climate') || normalized.includes('cold') || normalized.includes('lanh') || normalized.includes('dieu hoa')) return 'Climate-controlled storage'
    if (normalized.includes('business') || normalized.includes('commercial') || normalized.includes('doanh nghiep')) return 'Business storage'
    if (normalized.includes('standard') || normalized.includes('tieu chuan')) return 'Standard storage'
    return name.replace(/^Kho\s+/i, 'Storage unit ')
  }
  const localizedError = (message: string | undefined, fallbackEnglish: string) => {
    if (language === 'vi') return message
    if (!message) return fallbackEnglish
    const translated = t(message)
    return !/[\u00C0-\u024F\u1E00-\u1EFF]/.test(translated) ? translated : fallbackEnglish
  }
  const [serverBookingQuote, setServerBookingQuote] = useState<PricingQuoteResponse | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [bookingModalError, setBookingModalError] = useState<string | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [createdBookingResult, setCreatedBookingResult] = useState<{
    bookingCode: string
    facilityName: string
    expectedCheckInAt?: string | null
    holdExpiresAt?: string | null
    paymentStatus?: string | null
  } | null>(null)
  const [bookingPackage, setBookingPackage] = useState<BookingPackage>('3m')
  const [bookingCustomDays, setBookingCustomDays] = useState(45)
  const [bookingStartDate, setBookingStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [bookingCheckInDate, setBookingCheckInDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })
  const [bookingCheckInTime, setBookingCheckInTime] = useState('09:00')
  const [identityCardNumber, setIdentityCardNumber] = useState('')
  const [identityCardType, setIdentityCardType] = useState<'CCCD' | 'PASSPORT'>('CCCD')
  const [bookingPolicyAccepted, setBookingPolicyAccepted] = useState(false)
  const [bookingWorkflow, setBookingWorkflow] = useState<BookingWorkflow>('HOLD_ONLY')
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)

  // Validation: Check-in appointment must be at least 5 hours from current time
  const minAllowedDateTime = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const minAllowedYear = minAllowedDateTime.getFullYear()
  const minAllowedMonth = String(minAllowedDateTime.getMonth() + 1).padStart(2, '0')
  const minAllowedDay = String(minAllowedDateTime.getDate()).padStart(2, '0')
  const minAllowedDateStr = `${minAllowedYear}-${minAllowedMonth}-${minAllowedDay}`
  const minAllowedTimeStr = `${String(minAllowedDateTime.getHours()).padStart(2, '0')}:${String(minAllowedDateTime.getMinutes()).padStart(2, '0')}`

  const selectedCheckInDateTime = (bookingCheckInDate && bookingCheckInTime)
    ? new Date(`${bookingCheckInDate}T${bookingCheckInTime}:00`)
    : null
  const isCheckInTimeTooSoon = selectedCheckInDateTime
    ? selectedCheckInDateTime.getTime() < minAllowedDateTime.getTime()
    : false

  const earliestAllowedFormatted = minAllowedDateTime.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const handleCheckInDateChange = (val: string) => {
    setBookingCheckInDate(val)
    if (bookingModalError) setBookingModalError(null)
    if (val === minAllowedDateStr && bookingCheckInTime < minAllowedTimeStr) {
      setBookingCheckInTime(minAllowedTimeStr)
    }
  }

  const formatDisplayDate = (d?: string) => {
    if (!d) return String.fromCharCode(8212)
    if (d.includes('/')) return d
    const [year, month, day] = d.split('T')[0].split('-')
    if (year && month && day) return language === 'vi' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`
    return d
  }

  // Effect: Đồng bộ báo giá và chính sách chuẩn xác từ backend PricingService
  useEffect(() => {
    if (!selectedBookingUnit?.id) {
      setServerBookingQuote(null)
      setQuoteError(null)
      return
    }

    let isCurrent = true
    setIsLoadingQuote(true)
    setQuoteError(null)

    let months = 1
    if (bookingPackage === '15d' || bookingPackage === '1m') {
      months = 1
    } else if (bookingPackage === '3m') {
      months = 3
    } else if (bookingPackage === '6m') {
      months = 6
    } else if (bookingPackage === '12m') {
      months = 12
    } else if (bookingPackage === '24m') {
      months = 24
    } else if (bookingPackage === 'custom') {
      months = Math.max(1, Math.min(60, Math.round((bookingCustomDays || 30) / 30)))
    }

    pricingService.getQuote({
      storageUnitId: selectedBookingUnit.id,
      rentalMonths: months,
      startDate: bookingStartDate || undefined
    })
      .then(quote => {
        if (isCurrent) {
          setServerBookingQuote(quote)
          setQuoteError(null)
        }
      })
      .catch(err => {
        if (isCurrent) {
          console.warn('Could not fetch server quote:', err)
          const msg = err?.response?.data?.message || err?.message || 'Không thể tải báo giá và chính sách giá từ máy chủ.'
          setQuoteError(msg)
          setServerBookingQuote(null)
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingQuote(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [selectedBookingUnit?.id, bookingPackage, bookingCustomDays, bookingStartDate])

  const handleRetryQuote = () => {
    if (!selectedBookingUnit?.id) return
    setIsLoadingQuote(true)
    setQuoteError(null)
    let months = 1
    if (bookingPackage === '15d' || bookingPackage === '1m') months = 1
    else if (bookingPackage === '3m') months = 3
    else if (bookingPackage === '6m') months = 6
    else if (bookingPackage === '12m') months = 12
    else if (bookingPackage === '24m') months = 24
    else if (bookingPackage === 'custom') months = Math.max(1, Math.min(60, Math.round((bookingCustomDays || 30) / 30)))

    pricingService.getQuote({
      storageUnitId: selectedBookingUnit.id,
      rentalMonths: months,
      startDate: bookingStartDate || undefined
    })
      .then(quote => {
        setServerBookingQuote(quote)
        setQuoteError(null)
      })
      .catch(err => {
        setQuoteError(err?.response?.data?.message || err?.message || 'Không thể tải báo giá từ máy chủ.')
      })
      .finally(() => {
        setIsLoadingQuote(false)
      })
  }

  const bookingEstimate = useMemo(() => {
    if (!selectedBookingUnit) {
      return {
        days: 30,
        months: 1,
        rawRent: 0,
        discountPercent: 0,
        discountAmount: 0,
        rentAfterDiscount: 0,
        effectiveMonthly: 0,
        deposit: 0,
        totalPayment: 0,
        initialPayment: 0,
        endDate: '',
        condition: '',
        holdGraceHours: 1,
        maxHoldDays: 14,
        refundSlaDays: 5,
        cancellationPolicy: ''
      }
    }

    let days = 30
    let months = 1
    let condition = 'Áp dụng đơn giá tháng tiêu chuẩn'

    if (bookingPackage === '15d') {
      days = 15
      months = 1
      condition = 'Gói lưu trữ ngắn hạn 15 ngày (áp dụng mức cam kết tối thiểu 1 tháng theo chính sách cơ sở)'
    } else if (bookingPackage === '1m') {
      days = 30
      months = 1
      condition = 'Tiêu chuẩn thanh toán linh hoạt theo từng tháng'
    } else if (bookingPackage === '3m') {
      days = 90
      months = 3
      condition = 'Giảm 5% khi cam kết thuê từ 3 tháng'
    } else if (bookingPackage === '6m') {
      days = 180
      months = 6
      condition = 'Giảm 10% khi cam kết thuê từ 6 tháng'
    } else if (bookingPackage === '12m') {
      days = 365
      months = 12
      condition = 'Giảm 15% khi cam kết thuê gói năm (12 tháng)'
    } else if (bookingPackage === '24m') {
      days = 730
      months = 24
      condition = 'Giảm 20% khi cam kết thuê dài hạn 2 năm (24 tháng)'
    } else if (bookingPackage === 'custom') {
      days = Math.max(15, Math.min(1825, bookingCustomDays || 30))
      months = Math.max(1, Math.min(60, Math.round(days / 30)))
      if (months >= 24) condition = 'Giảm 20% thời hạn tùy chỉnh từ 2 năm trở lên'
      else if (months >= 12) condition = 'Giảm 15% thời hạn tùy chỉnh từ 1 năm trở lên'
      else if (months >= 6) condition = 'Giảm 10% thời hạn tùy chỉnh từ 6 tháng trở lên'
      else if (months >= 3) condition = 'Giảm 5% thời hạn tùy chỉnh từ 3 tháng trở lên'
      else condition = 'Đơn giá tiêu chuẩn theo số tháng thực tế'
    }

    if (serverBookingQuote) {
      return {
        days,
        months: serverBookingQuote.rentalMonths || months,
        rawRent: serverBookingQuote.subtotalRentalFee,
        discountPercent: serverBookingQuote.discountPercentage || 0,
        discountAmount: serverBookingQuote.discountAmount || 0,
        rentAfterDiscount: serverBookingQuote.totalRentalFee,
        effectiveMonthly: Math.round(serverBookingQuote.totalRentalFee / (serverBookingQuote.rentalMonths || 1)),
        deposit: serverBookingQuote.depositAmount,
        totalPayment: serverBookingQuote.totalContractValue,
        initialPayment: serverBookingQuote.initialPaymentAmount,
        endDate: serverBookingQuote.endDate,
        condition,
        holdGraceHours: serverBookingQuote.holdGraceHours ?? 1,
        maxHoldDays: serverBookingQuote.maxHoldDays || 14,
        refundSlaDays: serverBookingQuote.refundSlaDays || 5,
        cancellationPolicy: serverBookingQuote.cancellationPolicy
      }
    }

    const monthlyPrice = selectedBookingUnit.priceNumber || 1250000
    const deposit = selectedBookingUnit.depositNumber || monthlyPrice
    const rawRent = monthlyPrice * months
    let discountPercent = 0
    if (months >= 24) discountPercent = 20
    else if (months >= 12) discountPercent = 15
    else if (months >= 6) discountPercent = 10
    else if (months >= 3) discountPercent = 5
    const discountAmount = Math.round(rawRent * (discountPercent / 100))
    const rentAfterDiscount = rawRent - discountAmount
    const totalPayment = rentAfterDiscount + deposit
    const startObj = new Date(bookingStartDate || new Date())
    const endObj = new Date(startObj.getTime() + days * 24 * 60 * 60 * 1000)
    const endDate = endObj.toISOString().split('T')[0]

    return {
      days,
      months,
      rawRent,
      discountPercent,
      discountAmount,
      rentAfterDiscount,
      effectiveMonthly: Math.round(rentAfterDiscount / months),
      deposit,
      totalPayment,
      initialPayment: Math.round(rentAfterDiscount / months) + deposit,
      endDate,
      condition,
      holdGraceHours: 1,
      maxHoldDays: 14,
      refundSlaDays: 5,
      cancellationPolicy: ''
    }
  }, [selectedBookingUnit, serverBookingQuote, bookingPackage, bookingCustomDays, bookingStartDate])


  const handleConfirmBooking = async () => {
    if (!selectedBookingUnit) return
    setBookingModalError(null)

    if (!bookingPolicyAccepted) {
      setBookingModalError('Vui lòng đánh dấu xác nhận bạn đã đọc và đồng ý với các chính sách đặt giữ chỗ kho trước khi tiếp tục.')
      return
    }

    if (!identityCardNumber.trim()) {
      setBookingModalError('Vui lòng nhập số CCCD hoặc Hộ chiếu (Passport) của bạn để hoàn tất đặt giữ chỗ kho.')
      return
    }

    const trimmedId = identityCardNumber.trim().replace(/\s+/g, '')
    if (identityCardType === 'CCCD') {
      if (!/^\d{9}$|^\d{12}$/.test(trimmedId)) {
        setBookingModalError('Số Căn cước công dân (CCCD) phải bao gồm đúng 12 chữ số (hoặc 9 số với CMND cũ).')
        return
      }
    } else {
      if (trimmedId.length < 6 || trimmedId.length > 20) {
        setBookingModalError('Số Hộ chiếu (Passport) không hợp lệ (độ dài từ 6 đến 20 ký tự).')
        return
      }
    }

    if (quoteError) {
      setBookingModalError('Không thể hoàn tất đơn đặt chỗ do chưa tải được báo giá chính thức từ máy chủ. Vui lòng bấm "Thử lại".')
      return
    }

    if (isCheckInTimeTooSoon) {
      setBookingModalError(`Lịch hẹn nhận kho phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho (sớm nhất có thể chọn: ${earliestAllowedFormatted}).`)
      return
    }

    setIsSubmittingBooking(true)
    try {
      const months = Math.max(1, Math.round(bookingEstimate.months || 1))
      const expectedCheckInAt = `${bookingCheckInDate}T${bookingCheckInTime || '09:00'}:00`

      if (bookingWorkflow === 'ONLINE_NOW') {
        // Option B: Ký online & thanh toán: Tạo booking và chuyển tiếp ngay sang cổng VNPay Sandbox
        let bookingId = ''
        let createdBooking: any = null
        try {
          const res = await bookingService.createBooking({
            storageUnitId: selectedBookingUnit.id,
            startDate: bookingStartDate,
            rentalMonths: months,
            totalRentalFee: bookingEstimate.rentAfterDiscount,
            depositPaid: bookingEstimate.deposit,
            signingMethod: 'ONLINE',
            checkInTime: bookingCheckInTime || '09:00',
            expectedCheckInAt,
            identityCardNumber: trimmedId,
            identityCardType: identityCardType,
          })
          if (!res?.id) {
            throw new Error('Hệ thống không trả về mã đơn đặt kho hợp lệ.')
          }
          bookingId = res.id
          createdBooking = res
        } catch (bErr: any) {
          console.error('Booking creation error:', bErr)
          const errorMsg = bErr?.response?.data?.message || bErr?.message || 'Không thể tạo đơn đặt kho. Ngăn kho này có thể vừa được đặt hoặc đang có người giữ chỗ.'
          setBookingModalError(errorMsg)
          return
        }

        // Tạo giao dịch thanh toán VNPay Sandbox và lấy URL chính thức
        const paymentAmount = (createdBooking?.totalRentalFee != null && createdBooking?.depositAmount != null)
          ? Math.round(Number(createdBooking.totalRentalFee) + Number(createdBooking.depositAmount))
          : Math.round(bookingEstimate.totalPayment)

        try {
          const payment = await paymentService.createVNPayPayment({
            bookingId: bookingId,
            paymentType: 'BOOKING_PAYMENT',
            amount: paymentAmount,
            orderInfo: `Thanh toan dat cho ${selectedBookingUnit.name}`
          })
          if (payment?.paymentUrl) {
            window.location.href = payment.paymentUrl
            return
          }
          throw new Error('Cổng VNPay không phản hồi đường dẫn thanh toán.')
        } catch (payErr: any) {
          console.error('VNPay create payment error:', payErr)
          const errorMsg = payErr?.response?.data?.message || payErr?.message || 'Không thể khởi tạo giao dịch VNPay. Vui lòng thử lại.'
          let bookingReleased = false
          try {
            await bookingService.cancelBooking(bookingId, 'Không khởi tạo được cổng thanh toán trực tuyến')
            bookingReleased = true
          } catch (cancelErr) {
            console.warn('Could not immediately release the unpaid booking after payment setup failed:', cancelErr)
          }
          setBookingModalError(bookingReleased
            ? `Không thể mở cổng thanh toán: ${errorMsg} Đơn chưa hoàn tất đã được hủy và vị trí kho được trả lại kho trống.`
            : `Không thể mở cổng thanh toán: ${errorMsg} Đơn chưa hoàn tất sẽ tự hết hạn theo thời hạn thanh toán.`)
          await onRefresh?.()
        }
        return
      }

      // Option A: Giữ chỗ miễn phí theo lịch hẹn: Giữ chỗ theo lịch hẹn và hạn chính sách
      try {
        const res = await bookingService.createBooking({
          storageUnitId: selectedBookingUnit.id,
          startDate: bookingStartDate,
          rentalMonths: months,
          totalRentalFee: bookingEstimate.rentAfterDiscount,
          depositPaid: 0,
          signingMethod: 'IN_PERSON',
          checkInTime: bookingCheckInTime || '09:00',
          expectedCheckInAt,
          identityCardNumber: trimmedId,
          identityCardType: identityCardType,
        })
        if (!res?.id) {
          throw new Error('Hệ thống không trả về thông tin xác nhận.')
        }
        setCreatedBookingResult({
          bookingCode: res.bookingCode,
          facilityName: selectedBookingUnit.facilityName,
          expectedCheckInAt: res.expectedCheckInAt,
          holdExpiresAt: res.holdExpiresAt,
          paymentStatus: res.paymentStatus,
        })
        setBookingSuccess(true)
        await onRefresh?.()
      } catch (err: any) {
        console.error('In-person booking error:', err)
        const errorMsg = err?.response?.data?.message || err?.message || 'Không thể giữ chỗ kho này. Vui lòng kiểm tra lại.'
        setBookingModalError(errorMsg)
      }
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  return (
    <>
{selectedBookingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            {bookingSuccess ? (
              <div className="py-8 text-center space-y-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-xs ${
                  bookingWorkflow === 'HOLD_ONLY' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <span className="material-symbols-outlined text-[32px]">
                    {bookingWorkflow === 'HOLD_ONLY' ? 'bookmark_added' : 'check_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-slate-900">
                    {bookingWorkflow === 'HOLD_ONLY' ? 'Đặt Giữ Chỗ Kho Thành Công!' : 'Khởi Tạo Hợp Đồng Thuê Thành Công!'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Mã đặt chỗ của bạn: <strong className="font-mono text-slate-800">#{createdBookingResult?.bookingCode || 'Đã ghi nhận'}</strong>
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-left text-xs space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Cơ sở trực thuộc:</span>
                    <span className="font-semibold text-slate-800">{createdBookingResult?.facilityName || displayFacilityName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Thời hạn hợp đồng:</span>
                    <span className="font-semibold text-slate-800">{bookingEstimate.days} ngày ({formatDisplayDate(bookingStartDate)} → {formatDisplayDate(bookingEstimate.endDate)})</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Lịch hẹn nhận kho:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {createdBookingResult?.expectedCheckInAt
                        ? new Date(createdBookingResult.expectedCheckInAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
                        : `${formatDisplayDate(bookingCheckInDate)} lúc ${bookingCheckInTime}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Hạn giữ chỗ:</span>
                    <span className="font-mono font-bold text-amber-700">
                      {createdBookingResult?.holdExpiresAt
                        ? new Date(createdBookingResult.holdExpiresAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
                        : 'Theo thời gian hẹn nhận kho và chính sách cơ sở'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Trạng thái thanh toán:</span>
                    <span className="font-semibold text-slate-800">
                      {bookingWorkflow === 'HOLD_ONLY' ? 'Chưa thanh toán (Thanh toán tại quầy cơ sở)' : 'Chờ xác nhận thanh toán'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Phương thức:</span>
                    <span className="font-bold text-slate-700">
                      {bookingWorkflow === 'HOLD_ONLY' ? 'Giữ chỗ miễn phí theo lịch hẹn (Ký & thanh toán tại quầy)' : 'Ký điện tử & Thanh toán online'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                  {bookingWorkflow === 'HOLD_ONLY' 
                    ? 'Đơn đặt chỗ đã được ghi nhận theo loại kho và cơ sở. Vị trí cụ thể sẽ được xác nhận cùng nhân viên khi check-in.'
                    : 'Hợp đồng điện tử và yêu cầu thanh toán đã sẵn sàng. Mã PIN sẽ được kích hoạt sau khi hoàn tất thủ tục bàn giao theo quy định.'}
                </p>

                {onNavigate ? (
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      setBookingSuccess(false)
                      onClose()
                      onNavigate?.('bookings')
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Xem Danh Sách Đặt Chỗ
                  </button>
                  <button
                    onClick={() => {
                      setBookingSuccess(false)
                      onClose()
                      onNavigate?.('my-units')
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Đến Kho Của Tôi
                  </button>
                </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setBookingSuccess(false); onClose() }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Quay lại tìm kho
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Modal Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-lg font-bold text-slate-900">
                      Đặt giữ chỗ kho
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedBookingUnit.facilityName}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose()
                      setBookingModalError(null)
                      setQuoteError(null)
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Đóng"
                  >
                    ✕
                  </button>
                </div>

                {/* Unit Details Banner */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {localizedUnitName(selectedBookingUnit.name)}
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      Diện tích: <span className="font-semibold text-slate-800">{selectedBookingUnit.areaSqMeters || 6} m²</span> · Vị trí cụ thể được chọn khi check-in
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <span className="font-mono font-bold text-blue-600 text-base block">
                      {formatCurrency((serverBookingQuote?.monthlyRate || selectedBookingUnit.priceNumber || 1250000))}
                    </span>
                    <span className="text-[11px] text-slate-500 block">/tháng</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Giá niêm yết, chưa áp dụng ưu đãi kỳ hạn</span>
                  </div>
                </div>

                {/* Facility Suspended Warning Banner */}
                {isFacilitySuspended && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 shadow-xs animate-in fade-in">
                    <span className="material-symbols-outlined text-rose-600 text-[22px] shrink-0 mt-0.5">do_not_disturb_on</span>
                    <div className="flex-1 leading-relaxed">
                      <strong className="block font-bold text-sm text-rose-900 mb-0.5">
                        {selectedBookingUnit.facilityStatus === 'MAINTENANCE' ? 'Chi nhánh đang bảo trì kỹ thuật' : 'Chi nhánh đang tạm ngưng hoạt động'}
                      </strong>
                      <span>{facilitySuspendedMessage}</span>
                    </div>
                  </div>
                )}

                {/* 1. Chọn thời hạn thuê */}
                <div className="space-y-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      1. Chọn thời hạn thuê
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chọn kỳ hạn phù hợp với nhu cầu lưu trữ của bạn.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: '15d', title: '15 ngày', sub: 'Ngắn hạn' },
                      { id: '1m', title: '1 tháng', sub: 'Linh hoạt' },
                      { id: '3m', title: '3 tháng', sub: 'Giảm 5%' },
                      { id: '6m', title: '6 tháng', sub: 'Giảm 10%' },
                      { id: '12m', title: '12 tháng', sub: 'Giảm 15%' },
                      { id: '24m', title: '24 tháng', sub: 'Giảm 20%' },
                      { id: 'custom', title: 'Tùy chỉnh', sub: 'Chọn thời hạn' }
                    ].map(pkg => {
                      const isSelected = bookingPackage === pkg.id
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setBookingPackage(pkg.id as BookingPackage)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-500 text-blue-900 shadow-2xs ring-1 ring-blue-500'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                          } ${pkg.id === 'custom' ? 'col-span-2 sm:col-span-3' : ''}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-slate-900">{t(pkg.title)}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : pkg.sub.includes('Giảm') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {t(pkg.sub)}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {bookingPackage === 'custom' && (
                    <div className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-xl flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700 shrink-0">Nhập số ngày muốn thuê:</span>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="number"
                          min={15}
                          max={1825}
                          value={bookingCustomDays}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || '15', 10)
                            setBookingCustomDays(isNaN(val) ? 15 : Math.max(15, Math.min(1825, val)))
                          }}
                          className="h-9 w-24 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-slate-500 font-medium">
                          ngày (tương đương ~{Math.max(1, Math.round(bookingCustomDays / 30))} tháng hợp đồng)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Ưu đãi kỳ hạn Box */}
                  <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1 text-xs">
                    <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-blue-600 text-[16px]">loyalty</span>
                      Ưu đãi kỳ hạn · Chiết khấu theo thời hạn
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Mức giảm giá được áp dụng theo chính sách giá hiện hành của hệ thống Boxora cho các kỳ hạn đủ điều kiện (từ 3 tháng giảm 5%, từ 6 tháng giảm 10%, từ 12 tháng giảm 15%, từ 24 tháng giảm 20%). Giá và chiết khấu cuối cùng được máy chủ xác nhận theo thời gian thực.
                    </p>
                  </div>
                </div>

                {/* 2. Chọn lịch hẹn nhận kho & Lịch thuê */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      2. Chọn lịch hẹn nhận kho &amp; Lịch thuê
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kiểm tra kỹ ngày hẹn nhận kho và ngày bắt đầu hợp đồng trước khi xác nhận.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Ngày bắt đầu thuê chính thức */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Ngày bắt đầu thuê chính thức
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                        value={bookingStartDate}
                        onChange={(e) => setBookingStartDate(e.target.value)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Ngày bắt đầu thuê chính thức được xác lập khi hoàn tất bàn giao thực tế và hợp đồng có hiệu lực.
                      </p>
                    </div>

                    {/* Ngày & Giờ check-in dự kiến */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                          Lịch hẹn check-in dự kiến
                        </label>
                        <span className="text-[10px] text-slate-500 font-medium">Kho mở 24/7 · Tối thiểu trước 5h</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          type="date"
                          min={minAllowedDateStr}
                          max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                          value={bookingCheckInDate}
                          onChange={(e) => handleCheckInDateChange(e.target.value)}
                          className="col-span-3 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="time"
                          required
                          value={bookingCheckInTime}
                          onChange={(e) => {
                            setBookingCheckInTime(e.target.value)
                            if (bookingModalError) setBookingModalError(null)
                          }}
                          className={`col-span-2 h-9 px-2 bg-white border rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 ${
                            isCheckInTimeTooSoon
                              ? 'border-amber-400 bg-amber-50/40 focus:ring-amber-500/20 focus:border-amber-500 text-amber-900'
                              : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                          }`}
                        />
                      </div>

                      {/* Warning banner when check-in is sooner than 5 hours */}
                      {isCheckInTimeTooSoon && (
                        <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
                          <span className="material-symbols-outlined text-base text-amber-600 shrink-0 mt-0.5">warning</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-amber-900 text-[11px]">Giờ hẹn nhận kho phải cách hiện tại tối thiểu 5 tiếng</p>
                            <p className="text-[10px] text-amber-800 leading-relaxed">
                              Để cơ sở kịp chuẩn bị kho và mã PIN SmartLock, vui lòng chọn từ <strong>{earliestAllowedFormatted}</strong> trở đi.
                            </p>
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-500 leading-normal">
                        Ngày hẹn nhận kho không mặc nhiên là ngày bắt đầu thuê chính thức.
                      </p>
                    </div>
                  </div>

                  {/* Nhập số CCCD / Hộ chiếu (Passport) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-blue-600 text-[16px]">badge</span>
                        Số CCCD / Hộ chiếu (Passport)
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <div className="flex items-center gap-1 text-[11px] bg-slate-200/70 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setIdentityCardType('CCCD')
                            setBookingModalError(null)
                          }}
                          className={`px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            identityCardType === 'CCCD'
                              ? 'bg-white text-blue-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          CCCD
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIdentityCardType('PASSPORT')
                            setBookingModalError(null)
                          }}
                          className={`px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            identityCardType === 'PASSPORT'
                              ? 'bg-white text-blue-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Hộ chiếu
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={identityCardNumber}
                        onChange={(e) => {
                          setIdentityCardNumber(e.target.value)
                          if (e.target.value.trim()) setBookingModalError(null)
                        }}
                        placeholder={
                          identityCardType === 'CCCD'
                            ? 'Nhập 12 số Căn cước công dân (hoặc 9 số CMND)...'
                            : 'Nhập mã số hộ chiếu (ví dụ: B1234567)...'
                        }
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Thông tin dùng để đối soát danh tính khách hàng trực tiếp khi nhận bàn giao kho và xác lập hợp đồng thuê hợp pháp.
                    </p>
                  </div>

                  {/* Ngày kết thúc thuê dự kiến */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">Ngày kết thúc thuê dự kiến:</span>
                      <span className="text-[10px] text-slate-500">Được tính theo kỳ hạn và quy tắc tính thời hạn trong hợp đồng từ máy chủ</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                      {bookingEstimate.endDate || '—'}
                    </span>
                  </div>

                  {/* Warning: Ngày check-in sau ngày bắt đầu thuê */}
                  {bookingCheckInDate > bookingStartDate && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-xs">
                      <div className="font-bold text-amber-900 text-[11px] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-600 text-[16px]">info</span>
                        Ngày check-in sau ngày bắt đầu thuê
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Hợp đồng dự kiến bắt đầu trước ngày bạn nhận kho. Vui lòng xác nhận chính sách tính tiền cho khoảng thời gian chênh lệch trước khi ký. Hệ thống không tự động tính thêm phụ phí ngoài hợp đồng.
                      </p>
                    </div>
                  )}

                  {/* Trạng thái mã PIN */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">Trạng thái mã PIN SmartLock</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Chưa kích hoạt
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Mã PIN chỉ có hiệu lực khi hợp đồng, thanh toán và thủ tục bàn giao đáp ứng đủ điều kiện theo chính sách. Thanh toán thành công không đồng nghĩa với việc mã PIN đã hoạt động.
                    </p>
                  </div>
                </div>

                {/* 3. Bảng tính chi phí dự kiến */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      3. Bảng tính chi phí dự kiến
                    </h4>
                    {isLoadingQuote && (
                      <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium">
                        <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                        Đang đồng bộ báo giá máy chủ...
                      </span>
                    )}
                  </div>

                  {quoteError ? (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs">
                      <div className="font-bold text-rose-800 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
                        Không thể tải báo giá và chính sách từ máy chủ
                      </div>
                      <p className="text-rose-700 leading-relaxed text-[11px]">
                        {localizedError(quoteError || undefined, 'Unable to load the server quote.')}
                      </p>
                      <button
                        type="button"
                        onClick={handleRetryQuote}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5 text-xs">
                      {/* Row 1: Tiền thuê trước ưu đãi */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                        <div>
                          <div className="font-bold text-slate-800">Tiền thuê trước ưu đãi</div>
                          <div className="text-[10px] text-slate-500">
                            {bookingEstimate.months} tháng × {formatCurrency((serverBookingQuote?.monthlyRate || selectedBookingUnit.priceNumber || 1250000))}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {formatCurrency(bookingEstimate.rawRent)}
                        </div>
                      </div>

                      {/* Row 2: Chiết khấu kỳ hạn */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                        <div>
                          <div className="font-bold text-emerald-800">Chiết khấu kỳ hạn</div>
                          <div className="text-[10px] text-slate-500">
                            {language === 'vi' ? (bookingEstimate.discountPercent > 0 
                              ? `Giảm ${bookingEstimate.discountPercent}% theo chính sách kỳ hạn ${bookingEstimate.months} tháng`
                              : 'Chưa đủ điều kiện hưởng chiết khấu kỳ hạn (từ 3 tháng trở lên)') : (bookingEstimate.discountPercent > 0 ? `${bookingEstimate.discountPercent}% discount for a ${bookingEstimate.months}-month term` : 'Term discounts start at 3 months')}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-emerald-700 text-xs">
                          {bookingEstimate.discountAmount > 0 
                            ? `−${formatCurrency(bookingEstimate.discountAmount)}`
                            : '0 ₫'}
                        </div>
                      </div>

                      {/* Row 3: Tiền thuê sau ưu đãi */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60 bg-blue-50/40 -mx-2 px-2 rounded-lg">
                        <div>
                          <div className="font-bold text-blue-900">Tiền thuê sau ưu đãi</div>
                          <div className="text-[10px] text-blue-600">Tiền thuê thực tế phải trả cho toàn bộ kỳ hạn</div>
                        </div>
                        <div className="font-mono font-bold text-blue-700 text-xs">
                          {formatCurrency(bookingEstimate.rentAfterDiscount)}
                        </div>
                      </div>

                      {/* Row 4: Tiền cọc an ninh */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                        <div>
                          <div className="font-bold text-slate-800">Tiền cọc an ninh</div>
                          <div className="text-[10px] text-slate-500">
                            Khoản bảo đảm tài sản theo quy định cơ sở (hoàn trả 100% khi thanh lý hợp đồng)
                          </div>
                        </div>
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {formatCurrency(bookingEstimate.deposit)}
                        </div>
                      </div>

                      {/* Row 5: Tổng chi phí dự kiến */}
                      <div className="flex justify-between items-center pt-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">Tổng chi phí dự kiến</div>
                          <div className="text-[10px] text-slate-500">Bao gồm tiền thuê sau ưu đãi + tiền cọc an ninh</div>
                        </div>
                        <div className="font-mono font-bold text-blue-600 text-base">
                          {formatCurrency(bookingEstimate.totalPayment)}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 leading-relaxed">
                        Ghi chú: Đơn giá đã bao gồm VAT và dịch vụ tiêu chuẩn của Boxora. Tiền cọc an ninh được bảo lưu riêng biệt và không tính gộp vào tiền thuê. Số tiền thanh toán thực tế phụ thuộc vào phương thức tiếp nhận đã chọn bên dưới.
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Chọn phương thức tiếp nhận */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      4. Chọn phương thức tiếp nhận &amp; đặt chỗ
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chọn hình thức hoàn tất thủ tục phù hợp với thời gian của bạn.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option A: Giữ chỗ miễn phí theo lịch hẹn */}
                    <div
                      onClick={() => setBookingWorkflow('HOLD_ONLY')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        bookingWorkflow === 'HOLD_ONLY'
                          ? 'bg-blue-50/70 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-blue-600 text-[18px]">bookmark</span>
                            Phương thức A — Giữ chỗ theo lịch hẹn
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Miễn phí giữ chỗ
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-normal">
                          Đơn đặt chỗ được ghi nhận theo loại kho và cơ sở. Vị trí cụ thể sẽ được xác nhận khi check-in; thời gian giữ chỗ quá lịch hẹn tối đa {bookingEstimate.holdGraceHours} giờ.
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500 bg-white/80 p-2 rounded-lg border border-slate-100">
                          Quy trình tại cơ sở: Đến xem kho thực tế, ký biên bản bàn giao tại quầy và thanh toán cọc + tiền thuê nhận mã SmartLock.
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Thanh toán ngay</span>
                        <span className="font-mono font-bold text-emerald-600">0 ₫ (Thanh toán tại quầy)</span>
                      </div>
                    </div>

                    {/* Option B: Ký online & thanh toán ngay */}
                    <div
                      onClick={() => setBookingWorkflow('ONLINE_NOW')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        bookingWorkflow === 'ONLINE_NOW'
                          ? 'bg-blue-50/70 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-blue-600 text-[18px]">history_edu</span>
                            Phương thức B — Ký online &amp; thanh toán
                          </span>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            Ký điện tử &amp; Thanh toán trực tuyến
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-normal">
                          Xem điều khoản hợp đồng điện tử, xác nhận thông tin và thanh toán trực tuyến tiền cọc cùng cước phí qua cổng thanh toán bảo mật.
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500 bg-white/80 p-2 rounded-lg border border-slate-100">
                          Quy trình: Ký trực tuyến qua hệ thống Boxora, thanh toán xác nhận tức thì, nhân viên chỉ bàn giao mã mở kho khi đến nhận.
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Số tiền đến hạn thanh toán</span>
                        <span className="font-mono font-bold text-blue-600">
                          {formatCurrency(bookingEstimate.totalPayment)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Error Banner */}
                {bookingModalError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                    <span className="material-symbols-outlined text-rose-600 text-[18px] shrink-0 mt-0.5">error</span>
                    <div className="flex-1 leading-relaxed">
                      <strong className="block font-semibold">Không thể hoàn tất đặt chỗ:</strong>
                      <span>{localizedError(bookingModalError || undefined, 'The reservation could not be completed. Please review the details and try again.')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingModalError(null)}
                      className="text-rose-400 hover:text-rose-700 text-xs shrink-0 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Policy acceptance checkbox */}
                <label className="flex items-start gap-2.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={bookingPolicyAccepted}
                    onChange={(e) => {
                      setBookingPolicyAccepted(e.target.checked)
                      if (e.target.checked) setBookingModalError(null)
                    }}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    Tôi xác nhận đã đọc, hiểu rõ và đồng ý với các nội dung: (1) Kỳ hạn thuê đã chọn; (2) Ngày check-in và cách xác lập ngày bắt đầu thuê chính thức tại thời điểm bàn giao; (3) Chi phí dự kiến và tiền cọc an ninh; (4) Chính sách bảo lưu giữ chỗ của cơ sở; (5) Điều kiện hủy đơn và hoàn tiền cọc.
                  </span>
                </label>

                {/* Modal Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      setBookingModalError(null)
                      setQuoteError(null)
                    }}
                    disabled={isSubmittingBooking}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={isSubmittingBooking || !bookingPolicyAccepted || isLoadingQuote || !!quoteError || isCheckInTimeTooSoon || isFacilitySuspended}
                    className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      !bookingPolicyAccepted || isLoadingQuote || !!quoteError || isCheckInTimeTooSoon || isFacilitySuspended
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : bookingWorkflow === 'HOLD_ONLY'
                        ? 'bg-slate-900 hover:bg-slate-800'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isFacilitySuspended ? (
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px]">block</span>
                        <span>Chi Nhánh Đang Tạm Ngưng</span>
                      </span>
                    ) : isSubmittingBooking ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Đang xử lý đặt chỗ...</span>
                      </>
                    ) : bookingWorkflow === 'HOLD_ONLY' ? (
                      <span>Xác nhận giữ chỗ</span>
                    ) : (
                      <span>Xác nhận ký online &amp; thanh toán</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
