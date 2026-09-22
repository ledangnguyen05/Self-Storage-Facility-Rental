import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  ShieldCheck, 
  KeyRound, 
  Clock, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Boxes, 
  SlidersHorizontal,
  MapPin,
  ChevronRight,
  Sparkles,
  LockKeyhole,
  Smartphone
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { MOCK_FACILITIES, MOCK_UNIT_TYPES } from '../../services/mockData'
import { useAuth } from '../../context/AuthContext'

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  // Reservation quick-modal
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false)
  const [selectedFacility, setSelectedFacility] = useState(MOCK_FACILITIES[0].id)
  const [selectedUnitType, setSelectedUnitType] = useState(MOCK_UNIT_TYPES[1].id)
  const [rentalMonths, setRentalMonths] = useState(3)
  const [startDate, setStartDate] = useState('2026-10-01')
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Size calculator state
  const [storageItems, setStorageItems] = useState({
    boxes: 10,
    luggage: 2,
    mattress: 1,
    appliance: 1,
    furniture: 2
  })

  // Calculate recommended unit
  const totalVolumeEstimate = 
    storageItems.boxes * 0.15 + 
    storageItems.luggage * 0.2 + 
    storageItems.mattress * 1.5 + 
    storageItems.appliance * 1.0 + 
    storageItems.furniture * 1.8

  const recommendedUnitType = 
    totalVolumeEstimate < 1.5 ? MOCK_UNIT_TYPES[0] :
    totalVolumeEstimate < 5.0 ? MOCK_UNIT_TYPES[1] :
    totalVolumeEstimate < 12.0 ? MOCK_UNIT_TYPES[2] : MOCK_UNIT_TYPES[3]

  const activeFacilityObj = MOCK_FACILITIES.find(f => f.id === selectedFacility) || MOCK_FACILITIES[0]
  const activeTypeObj = MOCK_UNIT_TYPES.find(t => t.id === selectedUnitType) || MOCK_UNIT_TYPES[1]
  const totalFee = activeTypeObj.basePricePerMonth * rentalMonths + activeTypeObj.depositAmount

  const handleBookingConfirm = () => {
    if (!isAuthenticated) {
      setIsReserveModalOpen(false)
      navigate('/login?redirect=reserve')
      return
    }
    setBookingSuccess(true)
    setTimeout(() => {
      setBookingSuccess(false)
      setIsReserveModalOpen(false)
      navigate('/portal/customer')
    }, 1800)
  }

  return (
    <div className="bg-[var(--surface-canvas)] min-h-screen text-[var(--color-primary)]">
      {/* Editorial Hero Section */}
      <section className="relative pt-12 pb-20 border-b border-[var(--border-subtle)] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left 7 cols: Headline & Value Prop */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-pure)] border border-[var(--border-subtle)] text-xs font-mono uppercase tracking-widest text-[var(--color-secondary)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Instant Digital Check-in &bull; Zero Physical Paperwork
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-sans tracking-tight font-extrabold text-[var(--color-primary)] leading-[1.12]">
                Architectural Self-Storage with Precision Control.
              </h1>

              <p className="text-lg sm:text-xl text-[var(--color-secondary)] font-normal max-w-2xl leading-relaxed">
                Clean, climate-monitored, military-grade private lockers and commercial suites across Vietnam. Reserve in 60 seconds, unlock with encrypted digital codes, manage all your storage assets in one unified platform.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button 
                  size="lg" 
                  onClick={() => setIsReserveModalOpen(true)}
                  className="shadow-sm"
                >
                  Reserve a Storage Unit
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link to="/facilities">
                  <Button variant="secondary" size="lg">
                    Explore 3 Facilities
                  </Button>
                </Link>
              </div>

              {/* Swiss Metric Strip */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-[var(--border-subtle)]">
                <div>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-primary)]">100%</p>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mt-0.5">Automated Access</p>
                </div>
                <div>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-primary)]">550+</p>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mt-0.5">Active Units</p>
                </div>
                <div>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-primary)]">24 / 7</p>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mt-0.5">CCTV &amp; Biometric Guard</p>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Architectural Preview Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-pure)] shadow-md p-2">
                <div className="relative h-72 sm:h-80 rounded-xl overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1200" 
                    alt="Boxora Facility Interior"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute top-3 left-3">
                    <Badge variant="success">Available Now</Badge>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <p className="text-xs font-mono uppercase tracking-wider text-white/75">Flagship Location</p>
                    <p className="text-lg font-bold">Boxora Central Landmark — District 1</p>
                    <p className="text-xs text-white/80 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> 142 Nguyen Thi Minh Khai, Ben Thanh Ward
                    </p>
                  </div>
                </div>

                {/* Quick Unit Snapshot */}
                <div className="p-4 space-y-3 bg-[var(--surface-pure)]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--color-secondary)]">Starting Monthly</span>
                    <span className="font-mono font-bold text-lg text-[var(--color-primary)]">450,000 ₫</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)] border-t border-[var(--border-subtle)] pt-2">
                    <span>Sizes from 1.0m² to 12.0m²</span>
                    <span className="text-emerald-600 font-medium">34 Units Available Today</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4 Core Pillars Section (Swiss Style Grid) */}
      <section className="py-20 border-b border-[var(--border-subtle)] bg-[var(--surface-pure)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand)] mb-2">Engineered For Reliability</h2>
            <p className="text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">
              Self-storage built around modern privacy and effortless access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[var(--color-brand)] flex items-center justify-center mb-4">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base mb-2">Digital Passcode Entry</h3>
              <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
                Unique PIN and QR tokens generated per booking. Unlock entrance turnstiles and individual units straight from your phone.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base mb-2">Climate &amp; Safety Guard</h3>
              <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
                Regulated 23-25°C temperature and 55% humidity to safeguard electronics, luxury leather, books, and high-value archives.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base mb-2">Flexible Terms</h3>
              <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
                Rent on month-to-month flexibility. Upgrade, downsize, or renew automatically without long-term lock-in traps.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base mb-2">Prime Urban Hubs</h3>
              <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
                Located near major arteries in District 1, Thu Duc High-Tech Zone, and Binh Thanh for prompt vehicle unloading.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Unit Types & Pricing Matrix */}
      <section className="py-20 border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand)] mb-2">Storage Specifications</h2>
              <p className="text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">
                Select the exact footprint you require.
              </p>
            </div>
            <p className="text-sm text-[var(--color-secondary)] mt-3 md:mt-0 max-w-md">
              All units include complimentary lock cylinder, 24/7 CCTV surveillance, and fire-suppression sprinklers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {MOCK_UNIT_TYPES.map((type) => (
              <Card key={type.id} className="flex flex-col justify-between p-6 bg-[var(--surface-pure)] border border-[var(--border-subtle)] hover:border-[var(--color-brand)] transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-[var(--color-muted)] uppercase tracking-wider">{type.dimensions}</span>
                    <Badge variant="outline">{type.areaSqm} m²</Badge>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--color-primary)] mb-2">{type.typeName}</h3>
                  <p className="text-xs text-[var(--color-secondary)] mb-4 leading-relaxed">{type.description}</p>
                  
                  <div className="bg-[var(--surface-canvas)] p-3 rounded-lg border border-[var(--border-subtle)] mb-6">
                    <p className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1">Recommended for:</p>
                    <p className="text-xs text-[var(--color-primary)] font-medium">{type.suitableFor}</p>
                  </div>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <div className="mb-4">
                    <span className="text-2xl font-bold font-mono text-[var(--color-primary)]">
                      {type.basePricePerMonth.toLocaleString()} ₫
                    </span>
                    <span className="text-xs text-[var(--color-muted)]"> / month</span>
                  </div>
                  <Button 
                    className="w-full" 
                    variant="secondary"
                    onClick={() => {
                      setSelectedUnitType(type.id)
                      setIsReserveModalOpen(true)
                    }}
                  >
                    Select &amp; Reserve
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Size Estimator */}
      <section className="py-20 border-b border-[var(--border-subtle)] bg-[var(--surface-pure)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand)] mb-2">Precision Planning</h2>
            <p className="text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">
              Calculate your volume in real time.
            </p>
            <p className="text-sm text-[var(--color-secondary)] mt-2">
              Adjust your item quantities below to see our architectural storage recommendation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sliders */}
            <div className="lg:col-span-7 bg-[var(--surface-canvas)] p-6 rounded-xl border border-[var(--border-subtle)] space-y-6">
              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>Standard Moving Boxes</span>
                  <span className="font-mono font-bold">{storageItems.boxes} boxes</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="40" 
                  value={storageItems.boxes} 
                  onChange={(e) => setStorageItems({...storageItems, boxes: parseInt(e.target.value)})}
                  className="w-full accent-[var(--color-brand)]"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>Luggage &amp; Travel Bags</span>
                  <span className="font-mono font-bold">{storageItems.luggage} items</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={storageItems.luggage} 
                  onChange={(e) => setStorageItems({...storageItems, luggage: parseInt(e.target.value)})}
                  className="w-full accent-[var(--color-brand)]"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>Bed Mattresses (Single/Queen)</span>
                  <span className="font-mono font-bold">{storageItems.mattress} items</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="4" 
                  value={storageItems.mattress} 
                  onChange={(e) => setStorageItems({...storageItems, mattress: parseInt(e.target.value)})}
                  className="w-full accent-[var(--color-brand)]"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>Major Appliances (Fridges, Washers)</span>
                  <span className="font-mono font-bold">{storageItems.appliance} items</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="6" 
                  value={storageItems.appliance} 
                  onChange={(e) => setStorageItems({...storageItems, appliance: parseInt(e.target.value)})}
                  className="w-full accent-[var(--color-brand)]"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>Furniture Units (Desks, Wardrobes, Sofas)</span>
                  <span className="font-mono font-bold">{storageItems.furniture} items</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="8" 
                  value={storageItems.furniture} 
                  onChange={(e) => setStorageItems({...storageItems, furniture: parseInt(e.target.value)})}
                  className="w-full accent-[var(--color-brand)]"
                />
              </div>
            </div>

            {/* Recommendation Result */}
            <div className="lg:col-span-5 bg-[var(--surface-pure)] border border-[var(--color-brand)] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--color-brand)] mb-3">
                <Sparkles className="w-4 h-4" />
                <span>Optimal Match Recommendation</span>
              </div>

              <h3 className="text-2xl font-extrabold text-[var(--color-primary)] mb-1">
                {recommendedUnitType.typeName}
              </h3>
              <p className="text-sm font-mono text-[var(--color-muted)] mb-4">
                {recommendedUnitType.dimensions} ({recommendedUnitType.areaSqm} m²)
              </p>

              <div className="space-y-3 border-y border-[var(--border-subtle)] py-4 my-4 text-xs text-[var(--color-secondary)]">
                <div className="flex justify-between">
                  <span>Estimated Item Footprint:</span>
                  <span className="font-mono font-bold text-[var(--color-primary)]">~{totalVolumeEstimate.toFixed(1)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span>Base Monthly Rate:</span>
                  <span className="font-mono font-bold text-[var(--color-primary)]">{recommendedUnitType.basePricePerMonth.toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span>Refundable Security Deposit:</span>
                  <span className="font-mono font-bold text-[var(--color-primary)]">{recommendedUnitType.depositAmount.toLocaleString()} ₫</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => {
                  setSelectedUnitType(recommendedUnitType.id)
                  setIsReserveModalOpen(true)
                }}
              >
                Book This Recommended Size
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Reservation Flow Modal (Flow 1) */}
      <Modal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title="Reserve Self-Storage Unit"
        description="Choose your facility, unit type, and start date to generate your reservation code."
      >
        {bookingSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold">Reservation Successful!</h3>
            <p className="text-sm text-[var(--color-secondary)] max-w-sm mx-auto">
              Your unit reservation is confirmed. Redirecting you to your Customer Portal to access your PIN and check-in pass...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                Select Facility
              </label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {MOCK_FACILITIES.map(fac => (
                  <option key={fac.id} value={fac.id}>{fac.name} ({fac.city})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                Select Unit Type
              </label>
              <select
                value={selectedUnitType}
                onChange={(e) => setSelectedUnitType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {MOCK_UNIT_TYPES.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.typeName} &bull; {type.areaSqm}m² &bull; {type.basePricePerMonth.toLocaleString()} ₫/mo
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                  Rental Period
                </label>
                <select
                  value={rentalMonths}
                  onChange={(e) => setRentalMonths(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                >
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months (Save 5%)</option>
                  <option value={6}>6 Months (Save 10%)</option>
                  <option value={12}>12 Months (Save 15%)</option>
                </select>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-[var(--surface-canvas)] p-3 rounded-lg border border-[var(--border-subtle)] text-xs space-y-2 mt-2">
              <div className="flex justify-between">
                <span className="text-[var(--color-secondary)]">Rental Fee ({rentalMonths} mos):</span>
                <span className="font-mono font-semibold">{(activeTypeObj.basePricePerMonth * rentalMonths).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-secondary)]">Security Deposit (Refundable):</span>
                <span className="font-mono font-semibold">{activeTypeObj.depositAmount.toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[var(--color-primary)] border-t border-[var(--border-subtle)] pt-2">
                <span>Total Due Now:</span>
                <span className="font-mono text-[var(--color-brand)]">{totalFee.toLocaleString()} ₫</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="ghost" onClick={() => setIsReserveModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBookingConfirm}>
                Confirm Reservation &bull; {totalFee.toLocaleString()} ₫
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
