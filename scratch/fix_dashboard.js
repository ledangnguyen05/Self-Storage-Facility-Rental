const fs = require('fs');
let c = fs.readFileSync('FE/boxora-web/src/pages/customer/CustomerDashboard.tsx', 'utf8');

// 1. Add NotificationCenter import
if (!c.includes('import NotificationCenter')) {
  c = c.replace(
    "import { checkCustomerPortalAccess } from '../../utils/rentalAccess'",
    "import { checkCustomerPortalAccess } from '../../utils/rentalAccess'\nimport NotificationCenter from '../../components/layout/NotificationCenter'"
  );
}

// 2. Add safeFormatDateTime before export const CustomerDashboard
if (!c.includes('const safeFormatDateTime =')) {
  c = c.replace(
    'export const CustomerDashboard: React.FC<CustomerDashboardProps>',
    `const safeFormatDateTime = (dateVal?: string | null, fallback = ''): string => {
  if (!dateVal) return fallback
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return fallback || String(dateVal)
    return d.toLocaleString('vi-VN')
  } catch {
    return fallback || String(dateVal)
  }
}

export const CustomerDashboard: React.FC<CustomerDashboardProps>`
  );
}

// 3. Fix getRenewals call
c = c.replace('const res = await contractService.getMyRenewals()', 'const res = await contractService.getRenewals()');

// 4. Fix handleTabChange signature to include 'requests'
c = c.replace(
  "const handleTabChange = (tab: 'my-units' | 'bookings' | 'explore' | 'contracts' | 'support') => {",
  "const handleTabChange = (tab: 'my-units' | 'requests' | 'bookings' | 'explore' | 'contracts' | 'support') => {"
);

// 5. Add missing states in CustomerDashboard
if (!c.includes('const [requestToPay, setRequestToPay] =')) {
  c = c.replace(
    'const [highlightedUnitCode, setHighlightedUnitCode] = useState<string | null>(null)',
    `const [highlightedUnitCode, setHighlightedUnitCode] = useState<string | null>(null)
  const [requestToPay, setRequestToPay] = useState<Booking | null>(null)
  const [bookingCreated, setBookingCreated] = useState<boolean>(false)
  const [isCustomerPolicyModalOpen, setIsCustomerPolicyModalOpen] = useState<boolean>(false)
  const [customerPolicyModalTab, setCustomerPolicyModalTab] = useState<PolicyTab>('cancellation')
  const [customerPolicyFacility, setCustomerPolicyFacility] = useState<{ id?: string; name?: string } | null>(null)`
  );
}

// 6. Add handleOpenPolicyModal, getContractDepositHeld, getCheckInNoticeInfo
if (!c.includes('const getCheckInNoticeInfo =')) {
  const helpers = `
  const handleOpenPolicyModal = (tab: PolicyTab = 'cancellation', facility?: { id?: string; name?: string }) => {
    setCustomerPolicyModalTab(tab)
    if (facility) setCustomerPolicyFacility(facility)
    setIsCustomerPolicyModalOpen(true)
  }

  const getContractDepositHeld = useCallback((contractItem: any) => {
    if (Number(contractItem?.depositHeld || 0) > 0) return Number(contractItem.depositHeld)
    const matchingPayment = customerPayments.find(
      (p) => (p.bookingId === contractItem?.bookingId || (p.unitCode && contractItem?.unitCode && p.unitCode.trim().toUpperCase() === contractItem.unitCode.trim().toUpperCase()))
        && p.paymentType === 'DEPOSIT' && (p.status === 'PAID' || p.status === 'SUCCESS')
    )
    if (matchingPayment?.amount && Number(matchingPayment.amount) > 0) return Number(matchingPayment.amount)
    const matchingBooking = customerBookings.find(
      (b) => b.id === contractItem?.bookingId || (b.unitCode && contractItem?.unitCode && b.unitCode.trim().toUpperCase() === contractItem.unitCode.trim().toUpperCase())
    )
    if (matchingBooking?.depositPaid && Number(matchingBooking.depositPaid) > 0) return Number(matchingBooking.depositPaid)
    if (matchingBooking?.depositAmount && Number(matchingBooking.depositAmount) > 0) return Number(matchingBooking.depositAmount)
    return Number(contractItem?.monthlyFee || 0)
  }, [customerPayments, customerBookings])

  const getCheckInNoticeInfo = useCallback((b: Booking) => {
    if (!b) return null
    if (b.status === 'ACTIVE' || b.status === 'CANCELLED' || b.status === 'OVERDUE' || b.status === 'COMPLETED') {
      return null
    }
    const rawDate = b.expectedCheckInAt || b.startDate
    if (!rawDate) return null
    const targetDate = new Date(rawDate)
    if (isNaN(targetDate.getTime())) return null
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()
    const diffMs = targetDayStart - todayStart
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
    const formattedDate = targetDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays)
      return {
        type: 'OVERDUE' as const,
        days: overdueDays,
        text: 'đã quá ' + overdueDays + ' ngày',
        alertTitle: 'Chú ý: Đã quá ' + overdueDays + ' ngày so với lịch hẹn nhận kho!',
        alertMessage: 'Lịch hẹn nhận kho ban đầu là ngày ' + formattedDate + '. Quý khách vui lòng đến cơ sở để hoàn tất nhận bàn giao kho.',
        formattedDate,
      }
    } else if (diffDays === 0) {
      return {
        type: 'TODAY' as const,
        days: 0,
        text: 'hôm nay',
        alertTitle: 'Hôm nay là ngày hẹn nhận kho!',
        alertMessage: 'Lịch hẹn nhận kho của quý khách là HÔM NAY (' + formattedDate + ')! Vui lòng mang CCCD gốc đến cơ sở Boxora.',
        formattedDate,
      }
    } else {
      return {
        type: 'UPCOMING' as const,
        days: diffDays,
        text: diffDays + ' ngày sắp tới',
        alertTitle: 'Lịch hẹn nhận kho: ' + diffDays + ' ngày sắp tới',
        alertMessage: 'Lịch hẹn nhận kho dự kiến trong ' + diffDays + ' ngày sắp tới (' + formattedDate + ').',
        formattedDate,
      }
    }
  }, [])
`;
  c = c.replace('const handleGoToMyUnit =', helpers + '\n  const handleGoToMyUnit =');
}

// 7. Fix availableUnits.map in explore cards grid
c = c.replace(
  'Array.from({ length: 6 }, (_, index) => <StorageUnitCardSkeleton key={index} />)',
  'Array.from({ length: 6 }, (_, index) => <div key={index} className="h-64 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />)'
);

c = c.replace(
  `availableUnits.filter(u => {
                if (filterFacility !== 'all' && u.facilityId !== filterFacility) return false
                const area = u.areaSqMeters || 6
                if (filterSize === 'mini' && area > 5) return false
                if (filterSize === 'family' && (area <= 5 || area > 10)) return false
                if (filterSize === 'business' && area <= 10) return false
                return true
              }).map((unit) => {
                return (`,
  `availableUnits.filter(u => {
                if (filterFacility !== 'all' && u.facilityId !== filterFacility) return false
                const area = u.areaSqMeters || 6
                if (filterSize === 'mini' && area > 5) return false
                if (filterSize === 'family' && (area <= 5 || area > 10)) return false
                if (filterSize === 'business' && area <= 10) return false
                return true
              }).map((unit) => {
                const bgImg = unit.imageUrl || unit.primaryImageUrl || (unit.images && unit.images[0]) || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
                const priceFormatted = Number(unit.pricePerMonth || 0).toLocaleString('vi-VN')
                const areaVal = unit.areaSqMeters ? \`\${unit.areaSqMeters} m²\` : '6 m²'
                const volumeVal = unit.areaSqMeters ? \`\${Math.round(unit.areaSqMeters * 2.8)} m³\` : '17 m³'
                return (`
);

// 8. Fix checkInNotice in Booking items
c = c.replace(
  'const isHighlighted = highlightedBookingCode === b.bookingCode || highlightedBookingCode === b.id',
  `const isHighlighted = highlightedBookingCode === b.bookingCode || highlightedBookingCode === b.id
                    const checkInNotice = getCheckInNoticeInfo(b)`
);

// 9. Fix SelectedBookingUnitData interface
c = c.replace(
  `  interface SelectedBookingUnitData {
    id: string
    unitCode: string
    name: string
    facilityName: string`,
  `  interface SelectedBookingUnitData {
    id: string
    unitCode: string
    name: string
    facilityId?: string
    facilityName: string
    facilityStatus?: string`
);

fs.writeFileSync('FE/boxora-web/src/pages/customer/CustomerDashboard.tsx', c, 'utf8');
console.log('CustomerDashboard updated successfully');

