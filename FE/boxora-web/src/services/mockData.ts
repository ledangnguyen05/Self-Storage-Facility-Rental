import { Facility, UnitType, Booking, SupportTicket, HandoverRecord } from '../types'

export const MOCK_FACILITIES: Facility[] = [
  {
    id: 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c',
    name: 'Boxora District 1',
    code: 'HCM-D1',
    address: '123 Nguyen Hue, Ben Nghe Ward',
    city: 'Ho Chi Minh City',
    contactPhone: '0901234567',
    totalUnits: 9,
    availableUnits: 5,
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1000'
  },
  {
    id: '45e03ded-5da1-43d5-bea7-96c645d5f96c',
    name: 'Boxora District 7',
    code: 'HCM-D7',
    address: '456 Nguyen Huu Tho, Tan Hung Ward',
    city: 'Ho Chi Minh City',
    contactPhone: '0902345678',
    totalUnits: 9,
    availableUnits: 4,
    imageUrl: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=1000'
  },
  {
    id: 'fd8f948e-fdff-4a81-ad0f-fc45639b545d',
    name: 'Boxora Thu Duc',
    code: 'HCM-TD',
    address: '789 Vo Van Ngan, Linh Chieu Ward',
    city: 'Ho Chi Minh City',
    contactPhone: '0903456789',
    totalUnits: 9,
    availableUnits: 5,
    imageUrl: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&q=80&w=1000'
  },
  {
    id: 'a1111111-2222-3333-4444-555555555555',
    name: 'Boxora Tan Binh Mega Hub',
    code: 'HCM-TB',
    address: '102 Truong Son, Ward 2, Tan Binh District',
    city: 'Ho Chi Minh City',
    contactPhone: '0904567890',
    totalUnits: 9,
    availableUnits: 4,
    imageUrl: 'https://images.unsplash.com/photo-1590247813693-5541d1c609fd?auto=format&fit=crop&q=80&w=1000'
  }
]

export const MOCK_UNIT_TYPES: UnitType[] = [
  {
    id: 'ut-locker',
    typeName: 'Personal Locker (Mini Box)',
    dimensions: '1.0m × 1.0m × 1.2m',
    areaSqm: 1.0,
    basePricePerMonth: 450000,
    depositAmount: 450000,
    description: 'Perfect for backpacks, luggage, small electronics, legal documents and valuable personal archives.',
    suitableFor: '1-3 suitcases, 4 document boxes'
  },
  {
    id: 'ut-compact',
    typeName: 'Compact Studio Unit',
    dimensions: '1.5m × 2.0m × 2.6m',
    areaSqm: 3.0,
    basePricePerMonth: 1250000,
    depositAmount: 1250000,
    description: 'Ideal for students, seasonal equipment, hobby gear, camping tents, or small apartment overflow.',
    suitableFor: 'Studio apartment contents, seasonal wardrobes, 12 boxes'
  },
  {
    id: 'ut-standard',
    typeName: 'Standard 1-Bedroom Storage',
    dimensions: '2.0m × 3.0m × 2.8m',
    areaSqm: 6.0,
    basePricePerMonth: 2400000,
    depositAmount: 2400000,
    description: 'Generous storage room suitable for mattresses, sofas, home appliances, and moving transition.',
    suitableFor: 'Full 1-bedroom home, furniture, washer, 25+ boxes'
  },
  {
    id: 'ut-business',
    typeName: 'Commercial & E-Commerce Suite',
    dimensions: '3.0m × 4.0m × 3.0m',
    areaSqm: 12.0,
    basePricePerMonth: 4800000,
    depositAmount: 4800000,
    description: 'Equipped with heavy-duty shelving, climate-controlled insulation, dedicated electrical outlets and pallet access.',
    suitableFor: 'E-commerce inventory, office archives, retail merchandise'
  }
]

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'bk-8821',
    bookingCode: 'BX-2026-8821',
    customerId: 'cust-1',
    customerName: 'Le Dang Nguyen',
    customerEmail: 'customer@gmail.com',
    customerPhone: '0373214567',
    storageUnitId: 'u-101',
    unitCode: 'A-101',
    facilityName: 'Boxora Central Landmark — District 1',
    startDate: '2026-09-01',
    endDate: '2026-12-01',
    rentalMonths: 3,
    totalRentalFee: 3750000,
    depositPaid: 1250000,
    status: 'ACTIVE',
    accessCode: 'BX-88219',
    accessPin: '4920',
    qrAccessToken: 'QR_BOXORA_A101_88219',
    handoverTime: '2026-09-01 09:30'
  },
  {
    id: 'bk-8822',
    bookingCode: 'BX-2026-8822',
    customerId: 'cust-2',
    customerName: 'Tran Thi Mai',
    customerEmail: 'mai.tran@gmail.com',
    customerPhone: '0908123456',
    storageUnitId: 'u-106',
    unitCode: 'C-301',
    facilityName: 'Boxora Central Landmark — District 1',
    startDate: '2026-08-15',
    endDate: '2026-09-15',
    rentalMonths: 1,
    totalRentalFee: 4800000,
    depositPaid: 4800000,
    status: 'OVERDUE',
    accessCode: 'BX-99312',
    accessPin: '8114',
    qrAccessToken: 'QR_BOXORA_C301_99312',
    handoverTime: '2026-08-15 14:00'
  }
]

export const MOCK_TICKETS: SupportTicket[] = [
  {
    id: 'tc-1',
    ticketCode: 'TK-0918-01',
    userId: 'cust-1',
    customerName: 'Le Dang Nguyen',
    bookingId: 'bk-8821',
    category: 'ACCESS_CODE',
    title: 'Smart Lock keypad backlight flickering',
    description: 'When typing my PIN 4920 on keypad unit A-101, the digits 2 and 0 do not illuminate clearly at night.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdAt: '2026-09-18 10:15'
  },
  {
    id: 'tc-2',
    ticketCode: 'TK-0917-04',
    userId: 'cust-2',
    customerName: 'Tran Thi Mai',
    bookingId: 'bk-8822',
    category: 'PAYMENT',
    title: 'Request renewal invoice for corporate deduction',
    description: 'Please issue official VAT invoice for contract BX-2026-8822 to my company registration tax code.',
    status: 'RESOLVED',
    priority: 'LOW',
    resolutionNote: 'VAT invoice e-mailed to mai.tran@gmail.com with serial BX-VAT-2026-09.',
    createdAt: '2026-09-17 14:30'
  }
]

export const MOCK_HANDOVERS: HandoverRecord[] = [
  {
    id: 'ho-1',
    bookingCode: 'BX-2026-8821',
    customerName: 'Le Dang Nguyen',
    unitCode: 'A-101',
    staffName: 'Pham Van Staff',
    recordType: 'CHECK_IN',
    status: 'PENDING_CHECKIN',
    accessCode: 'BX-88219',
    handoverDate: '2026-09-18 10:00',
    unitCondition: 'Clean, dehumidifier operating at 55% RH, smart keypad battery 100%, no scratches.',
    notes: 'Scheduled for 10:00 AM check-in arrival',
    recordedAt: '2026-09-01 09:30'
  },
  {
    id: 'ho-2',
    bookingCode: 'BX-2026-9104',
    customerName: 'Hoang Kim Oanh',
    unitCode: 'A-103',
    staffName: 'Pham Van Staff',
    recordType: 'CHECK_IN',
    status: 'HANDED_OVER',
    accessCode: 'BX-91044',
    handoverDate: '2026-09-15 14:20',
    unitCondition: 'Inspected with customer. High-spec locking latch confirmed.',
    notes: 'Identity verified with CCCD',
    recordedAt: '2026-09-15 14:25'
  }
]
