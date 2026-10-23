const fs = require('fs');

// ==========================================
// 1. StaffDashboard.tsx
// ==========================================
let staff = fs.readFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', 'utf8');

// Imports: ensure paymentService, PaymentItem, OccupancyReport are imported
if (!staff.includes("import { paymentService, PaymentItem } from '../../services/paymentService'")) {
  staff = staff.replace(
    "import { bookingService } from '../../services/bookingService'",
    "import { bookingService } from '../../services/bookingService'\nimport { paymentService, PaymentItem } from '../../services/paymentService'"
  );
}

staff = staff.replace(
  "import { Booking, StorageUnit, Facility, FacilityPolicy } from '../../types'",
  "import { Booking, StorageUnit, Facility, FacilityPolicy, OccupancyReport } from '../../types'"
);

// Fix selectedFacility ordering and declare currentTargetFacility & resolvedRole
const oldHeaderBlock = `  const isAdmin = user?.role?.name === 'ADMIN' || user?.roleName === 'ADMIN' || (user as any)?.role === 'ADMIN'
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

  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}`;

const newHeaderBlock = `  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}
  const isAdmin = user?.role?.name === 'ADMIN' || user?.roleName === 'ADMIN' || (user as any)?.role === 'ADMIN'
  const resolvedRole = (typeof user?.role === 'string' ? user?.role : user?.role?.name || user?.roleName || 'STAFF').toUpperCase()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null)

  const currentTargetFacility = selectedFacility || (facilities.length > 0 ? facilities[0].id : '')

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
  }`;

staff = staff.replace(oldHeaderBlock, newHeaderBlock);

// Remove the first loadFacilities duplicate definition
const firstLoadFacilities = `  const loadFacilities = async () => {
    try {
      if (contextFacilities && contextFacilities.length > 0) {
        setFacilities(contextFacilities)
        return
      }
      const res = await facilityService.getFacilities()
      if (res?.content) {
        setFacilities(res.content)
      }
    } catch {
      // fallback
    }
  }`;

staff = staff.replace(firstLoadFacilities, '');

// Fix facility params in occupancy calculations
staff = staff.replace(
  'const fallbackReportTotal = selectedFacility && selectedFacility !== \'ALL\'\n    ? facilityOccupancy?.totalUnits || 0\n    : occupancyData?.byFacility?.reduce((sum, facility) => sum + facility.totalUnits, 0) || 0',
  'const fallbackReportTotal = selectedFacility && selectedFacility !== \'ALL\'\n    ? facilityOccupancy?.totalUnits || 0\n    : occupancyData?.byFacility?.reduce((sum: number, facility: any) => sum + (facility.totalUnits || 0), 0) || 0'
);
staff = staff.replace(
  'const fallbackReportOccupied = selectedFacility && selectedFacility !== \'ALL\'\n    ? facilityOccupancy?.occupiedUnits || 0\n    : occupancyData?.byFacility?.reduce((sum, facility) => sum + facility.occupiedUnits, 0) || 0',
  'const fallbackReportOccupied = selectedFacility && selectedFacility !== \'ALL\'\n    ? facilityOccupancy?.occupiedUnits || 0\n    : occupancyData?.byFacility?.reduce((sum: number, facility: any) => sum + (facility.occupiedUnits || 0), 0) || 0'
);

// Fix option values in emergency modal
staff = staff.replace(
  '<option key={f.id} value={f.id}>{f.facilityName || f.name} ({f.facilityCode || f.code})</option>',
  '<option key={f.id} value={f.id}>{(f as any).facilityName || f.name} ({(f as any).facilityCode || (f as any).code || \'BOXORA\'})</option>'
);

fs.writeFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', staff, 'utf8');
console.log('StaffDashboard fixed.');

// ==========================================
// 2. CustomerDashboard.tsx
// ==========================================
let cust = fs.readFileSync('FE/boxora-web/src/pages/customer/CustomerDashboard.tsx', 'utf8');

// Update fetchMyRenewals at line 172 and add missing states
cust = cust.replace(
  `  const fetchMyRenewals = async () => {
    try {
      const res = await contractService.getRenewals()
      return res
    } catch {
      return []
    }
  }`,
  `  const [reopenModalTicket, setReopenModalTicket] = useState<SupportTicketRecord | null>(null)
  const [reopenReasonText, setReopenReasonText] = useState('')
  const [isProcessingTicketAction, setIsProcessingTicketAction] = useState(false)
  const [contractHistoryModal, setContractHistoryModal] = useState<any | null>(null)
  const [selectedRenewalForDocModal, setSelectedRenewalForDocModal] = useState<any | null>(null)

  const handleReopenCustomerTicket = async () => {
    if (!reopenModalTicket || !reopenReasonText.trim()) return
    setIsProcessingTicketAction(true)
    try {
      await supportTicketService.reopenTicket(reopenModalTicket.id, reopenReasonText.trim())
      setReopenModalTicket(null)
      setReopenReasonText('')
      await fetchCustomerTickets()
    } catch (err: any) {
      console.error('Failed to reopen ticket:', err)
    } finally {
      setIsProcessingTicketAction(false)
    }
  }

  const fetchMyRenewals = async () => {
    try {
      setLoadingRenewals(true)
      const res = await contractService.getRenewals()
      if (Array.isArray(res)) {
        setMyRenewals(res)
      }
      return res
    } catch {
      return []
    } finally {
      setLoadingRenewals(false)
    }
  }`
);

// Remove duplicate fetchMyRenewals around line 658
cust = cust.replace(
  `  const fetchMyRenewals = async () => {
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
  }`,
  ''
);

// Fix contractHistoryModal.renewals.map parameter types
cust = cust.replace(
  '{contractHistoryModal.renewals.map((r, idx) => (',
  '{contractHistoryModal.renewals.map((r: any, idx: number) => ('
);

fs.writeFileSync('FE/boxora-web/src/pages/customer/CustomerDashboard.tsx', cust, 'utf8');
console.log('CustomerDashboard fixed.');

