const fs = require('fs');

let content = fs.readFileSync('FE/boxora-web/src/pages/manager/ManagerDashboard.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Lines 22-31
content = content.replace(/<{7} Updated upstream\n={7}\n([\s\S]*?)<{7} HEAD\n>{7} Stashed changes\n={7}\n>{7} [a-f0-9]+/g, '$1');

// 2. Lines 102-151
content = content.replace(/<{7} Updated upstream\n  const \[confirmModal, setConfirmModal\] = useState<\{[\s\S]*?<{7} HEAD\n  const \[activeHandoverBookingId, setActiveHandoverBookingId\] = useState<string>\(''\)\n={7}\n([\s\S]*?)>{7} [a-f0-9]+\n\n  \/\/ Tickets queue pagination([\s\S]*?)>{7} Stashed changes/g, 
`  // Management Summaries Data
  const [upcomingHandovers, setUpcomingHandovers] = useState<Booking[]>([])
  const [activeRentals, setActiveRentals] = useState<Booking[]>([])
  const [showAllRentals, setShowAllRentals] = useState(false)
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([])

  // Check-in Filter & Claim States
  const [checkinTimeframe, setCheckinTimeframe] = useState<'current' | 'today' | 'past' | 'future' | 'all'>('all')
  const [checkinFromDate, setCheckinFromDate] = useState<string>('')
  const [checkinToDate, setCheckinToDate] = useState<string>('')
  const [claimingBookingId, setClaimingBookingId] = useState<string | null>(null)
  const [activeBookingId, setActiveBookingId] = useState<string>(
    searchParams.get('bookingId') || searchParams.get('checkinBookingId') || ''
  )

  useEffect(() => {
    const bId = searchParams.get('bookingId') || searchParams.get('checkinBookingId')
    if (bId) {
      setActiveBookingId(bId)
    }
  }, [searchParams])

  // Tickets queue pagination$2
  const [receptionAlertData, setReceptionAlertData] = useState<any>(null)`);

// 3. Lines 375-573
content = content.replace(/<{7} Updated upstream\n={7}\n([\s\S]*?)>{7} Stashed changes\n  const handleInspect/g, '$1\n  const handleInspect');

// 4. Any remaining conflict markers
// If there are simple Updated upstream ... ======= ... >>>>>>> Stashed changes
content = content.replace(/<{7} Updated upstream\n([\s\S]*?)={7}\n([\s\S]*?)>{7} Stashed changes/g, '$2');
// If there are HEAD ... ======= ... >>>>>>>
content = content.replace(/<{7} HEAD\n([\s\S]*?)={7}\n([\s\S]*?)>{7} [a-f0-9]+/g, '$2');

fs.writeFileSync('FE/boxora-web/src/pages/manager/ManagerDashboard.tsx', content, 'utf8');
console.log('ManagerDashboard.tsx resolution step finished');

