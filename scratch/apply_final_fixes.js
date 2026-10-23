const fs = require('fs');

// --- FIX 1: StaffDashboard.tsx ---
let staffContent = fs.readFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', 'utf8');

// 1. Remove duplicate searchParams declaration if present
staffContent = staffContent.replace(
  "  type StaffTab = 'pending_orders' | 'reception' | 'renewals'\r\n  const [searchParams, setSearchParams] = useSearchParams()",
  "  type StaffTab = 'pending_orders' | 'reception' | 'renewals'"
);
staffContent = staffContent.replace(
  "  type StaffTab = 'pending_orders' | 'reception' | 'renewals'\n  const [searchParams, setSearchParams] = useSearchParams()",
  "  type StaffTab = 'pending_orders' | 'reception' | 'renewals'"
);

// 2. Add missing state hooks and helpers to StaffDashboard
if (!staffContent.includes('const [isEmergencyModalOpen, setIsEmergencyModalOpen] =')) {
  const staffStateBlock = `  const isAdmin = user?.role?.name === 'ADMIN' || user?.roleName === 'ADMIN' || (user as any)?.role === 'ADMIN'
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null)

  // Master Key Emergency Override Modal (BR-RULE-009)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
  const [emergencyFacilityId, setEmergencyFacilityId] = useState('')
  const [emergencyReason, setEmergencyReason] = useState('Sự cố kẹt khóa điện tử khẩn cấp tại cửa phân khu')
  const [emergencyCategory, setEmergencyCategory] = useState<'MAINTENANCE_EMERGENCY' | 'FIRE_HAZARD' | 'POLICE_WARRANT' | 'ABANDONED_AUCTION' | 'INTERNAL_AUDIT'>('MAINTENANCE_EMERGENCY')
  const [emergencySeverity, setEmergencySeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL')
  const [witnessStaffId, setWitnessStaffId] = useState('')
  const [witnessPassword, setWitnessPassword] = useState('')
  const [isEmergencyCalling, setIsEmergencyCalling] = useState(false)
  const [emergencyResult, setEmergencyResult] = useState<string | null>(null)
  const [emergencyError, setEmergencyError] = useState<string | null>(null)

  const assignedFacilityName = useMemo(() => {
    return facilities.find(f => f.id === selectedFacility)?.name || 'Cơ sở Boxora'
  }, [facilities, selectedFacility])

  const closeBookingDetail = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('bookingId')
      return next
    })
  }
`;

  staffContent = staffContent.replace(
    "  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{",
    staffStateBlock + "\n  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{"
  );
}

// 3. Add unitMapByCodeAndFacility
if (!staffContent.includes('const unitMapByCodeAndFacility =')) {
  const unitMapBlock = `
  const unitMapByCodeAndFacility = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach((u) => {
      if (u.unitCode && u.facilityId) {
        map.set(\`\${u.facilityId}#\${u.unitCode.trim().toUpperCase()}\`, u)
      }
    })
    return map
  }, [radarUnits])
`;
  staffContent = staffContent.replace(
    "  const unitMapById = useMemo(() => {",
    unitMapBlock + "\n  const unitMapById = useMemo(() => {"
  );
}

// 4. Fix QrCameraCheckInModal call in StaffDashboard
staffContent = staffContent.replace(
  `      <QrCameraCheckInModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onCheckInSuccess={(bookingId, result) => {
          setActiveBookingId(bookingId)
          setCheckInSuccessMsg(\`Check-in qua QR Camera thành công! PIN cấp: \${result.accessPin} (Thẻ: \${result.rfidCard})\`)
        }}
        onSelectBookingForWorkbench={(bookingId) => {
          setActiveBookingId(bookingId)
        }}
      />`,
  `      <QrCameraCheckInModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onSelectBookingForWorkbench={(bookingId) => {
          setActiveBookingId(bookingId)
        }}
      />`
);

fs.writeFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', staffContent, 'utf8');
console.log('StaffDashboard updated.');

// --- FIX 2: CustomerDashboard.tsx ---
let custContent = fs.readFileSync('FE/boxora-web/src/pages/customer/CustomerDashboard.tsx', 'utf8');

// 1. Add missing state hooks
if (!custContent.includes('const [cancellingBookingTarget, setCancellingBookingTarget] =')) {
  custContent = custContent.replace(
    "  const [selectedBookingForModal, setSelectedBookingForModal] = useState<Booking | null>(null)",
    `  const [selectedBookingForModal, setSelectedBookingForModal] = useState<Booking | null>(null)
  const [cancellingBookingTarget, setCancellingBookingTarget] = useState<Booking | null>(null)
  const [selectedProofPayment, setSelectedProofPayment] = useState<PaymentItem | null>(null)
  const [closeTicketTarget, setCloseTicketTarget] = useState<SupportTicketRecord | null>(null)
  const [myRenewals, setMyRenewals] = useState<ContractRenewal[]>([])
  const [loadingRenewals, setLoadingRenewals] = useState<boolean>(false)`
  );
}

// 2. Add handleOpenPolicyModal, getContractDepositHeld, fetchCustomerTickets, fetchMyRenewals if not present
if (!custContent.includes('const handleOpenPolicyModal =')) {
  const custHelpers = `
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

  const fetchCustomerTickets = async () => {
    try {
      setLoadingTickets(true)
      const res = await supportTicketService.getMyTickets()
      if (Array.isArray(res)) {
        setCustomerTickets(res)
      }
    } catch (err) {
      console.error('Failed to load customer support tickets:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  const fetchMyRenewals = async () => {
    try {
      setLoadingRenewals(true)
      const res = await contractService.getRenewals()
      if (Array.isArray(res)) {
        setMyRenewals(res)
      }
    } catch (err) {
      console.error('Failed to fetch renewals:', err)
    } finally {
      setLoadingRenewals(false)
    }
  }
`;
  custContent = custContent.replace(
    "  const getCheckInNoticeInfo = useCallback((b: Booking) => {",
    custHelpers + "\n  const getCheckInNoticeInfo = useCallback((b: Booking) => {"
  );
}

// 3. Add checkInNotice inside filteredBookings.map
custContent = custContent.replace(
  `                {filteredBookings.map((b) => {
                  const isPendingCheckin = b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT'
                  const isActive = b.status === 'ACTIVE'`,
  `                {filteredBookings.map((b) => {
                  const isPendingCheckin = b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT'
                  const isActive = b.status === 'ACTIVE'
                  const checkInNotice = getCheckInNoticeInfo(b)`
);

// 4. Fix myRenewals.map row rendering
const badRenewalBlockRegex = /myRenewals\.map\(\(r\)\s*=>\s*\(\s*<tr key=\{r\.id\}[\s\S]*?<\/tr>\s*\)\)/;
const goodRenewalBlock = `myRenewals.map((r: ContractRenewal) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">#{r.id.slice(0, 8)}...</div>
                          <div className="text-[11px] text-slate-400">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-blue-600">#{r.contractCode || r.contractId?.slice(0, 8)}</div>
                          <div className="text-[11px] text-slate-500 font-medium">Kho #{r.unitCode || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {r.facilityName || 'Boxora Facility'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-emerald-700">{formatDisplayDate(r.newEndDate)}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">+{r.cycleMonths} tháng (từ {formatDisplayDate(r.oldEndDate)})</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                          {Number(r.renewalFee || 0).toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={\`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold \${
                            r.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'PENDING_REVIEW'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300'
                              : r.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }\`}>
                            {r.status === 'COMPLETED'
                              ? 'Hoàn tất'
                              : r.status === 'PENDING_REVIEW'
                              ? 'Chờ duyệt'
                              : r.status === 'REJECTED'
                              ? 'Từ chối'
                              : r.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {r.paymentMethod || 'Chuyển khoản / Quầy'}
                          </span>
                        </td>
                      </tr>
                    ))`;

if (badRenewalBlockRegex.test(custContent)) {
  custContent = custContent.replace(badRenewalBlockRegex, goodRenewalBlock);
  console.log('Replaced bad renewal map block');
} else {
  console.log('Regex did not match bad renewal block, attempting substring replace');
}

fs.writeFileSync('FE/boxora-web/src/pages/customer/CustomerDashboard.tsx', custContent, 'utf8');
console.log('CustomerDashboard updated.');

