import React, { useState } from 'react'
import { 
  KeyRound, 
  QrCode, 
  Lock, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Plus, 
  FileText,
  CreditCard,
  RefreshCw,
  Send,
  Building
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { MOCK_BOOKINGS, MOCK_TICKETS } from '../../services/mockData'
import { useAuth } from '../../context/AuthContext'
import { Booking, SupportTicket } from '../../types'

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS)
  const [tickets, setTickets] = useState<SupportTicket[]>(MOCK_TICKETS)
  
  // Modals state
  const [selectedBookingForQR, setSelectedBookingForQR] = useState<Booking | null>(null)
  const [renewBooking, setRenewBooking] = useState<Booking | null>(null)
  const [renewMonths, setRenewMonths] = useState(3)
  const [isRenewSuccess, setIsRenewSuccess] = useState(false)

  // Support ticket state (Flow 7)
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [ticketCategory, setTicketCategory] = useState<'UNIT' | 'LOCK' | 'ACCESS_CODE' | 'PAYMENT' | 'STORED_ITEMS' | 'OTHER'>('LOCK')
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState(false)

  const handleRenewConfirm = () => {
    if (!renewBooking) return
    setIsRenewSuccess(true)
    setTimeout(() => {
      setBookings(prev => prev.map(b => {
        if (b.id === renewBooking.id) {
          return {
            ...b,
            rentalMonths: b.rentalMonths + renewMonths,
            endDate: '2027-04-01'
          }
        }
        return b
      }))
      setIsRenewSuccess(false)
      setRenewBooking(null)
    }, 1500)
  }

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault()
    const newTicket: SupportTicket = {
      id: `tk-${Date.now()}`,
      ticketCode: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'cust-1',
      customerName: user?.fullName || 'Storage Customer',
      category: ticketCategory,
      title: ticketTitle,
      description: ticketDescription,
      status: 'OPEN',
      priority: 'HIGH',
      createdAt: new Date().toISOString().split('T')[0]
    }
    setTickets([newTicket, ...tickets])
    setTicketSuccess(true)
    setTimeout(() => {
      setTicketSuccess(false)
      setIsTicketModalOpen(false)
      setTicketTitle('')
      setTicketDescription('')
    }, 1500)
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-[var(--surface-pure)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[var(--color-brand)] text-xs font-mono font-medium mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-pulse"></span>
            CUSTOMER ACCESS PORTAL
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">
            Welcome back, {user?.fullName || 'Storage Customer'}
          </h1>
          <p className="text-xs text-[var(--color-secondary)] mt-1">
            Access your registered units, generate instant QR entry tokens, renew contracts, or request staff assistance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setIsTicketModalOpen(true)}>
            <HelpCircle className="w-4 h-4 mr-2" />
            Support Request
          </Button>
          <Button onClick={() => window.location.href = '/?reserve=true'}>
            <Plus className="w-4 h-4 mr-2" />
            Reserve New Unit
          </Button>
        </div>
      </div>

      {/* Active Storage Units Section (Flow 3) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-primary)]">Rented Storage Units</h2>
            <p className="text-xs text-[var(--color-secondary)]">Manage doors, access passcodes, and duration</p>
          </div>
          <Badge variant="neutral">{bookings.length} Active Contracts</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bookings.map((booking) => (
            <Card key={booking.id} className="p-6 bg-[var(--surface-pure)] border border-[var(--border-subtle)] shadow-sm hover:border-[var(--color-brand)] transition-colors">
              <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-[var(--color-muted)] font-semibold">{booking.bookingCode}</span>
                    <Badge variant={booking.status === 'ACTIVE' ? 'success' : 'warning'}>
                      {booking.status}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-extrabold text-[var(--color-primary)] font-mono">Unit {booking.unitCode}</h3>
                  <p className="text-xs text-[var(--color-secondary)] flex items-center gap-1 mt-1">
                    <Building className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                    {booking.facilityName}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[var(--color-muted)]">Monthly Rate</span>
                  <p className="font-mono font-bold text-sm text-[var(--color-primary)]">
                    {(booking.totalRentalFee / booking.rentalMonths).toLocaleString()} ₫
                  </p>
                </div>
              </div>

              {/* Digital Passcode Box */}
              <div className="my-5 p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                    Unit Access Passcode
                  </span>
                  <span className="font-mono font-bold text-base tracking-widest text-[var(--color-primary)] bg-[var(--surface-pure)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
                    {booking.accessCode}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    Digital Keypad PIN
                  </span>
                  <span className="font-mono font-bold text-base tracking-widest text-[var(--color-brand)] bg-[var(--surface-pure)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
                    {booking.accessPin}
                  </span>
                </div>
              </div>

              {/* Lease Dates */}
              <div className="grid grid-cols-2 gap-3 text-xs text-[var(--color-secondary)] pb-5 mb-5 border-b border-[var(--border-subtle)]">
                <div>
                  <span className="text-[var(--color-muted)] block text-[11px]">Lease Start:</span>
                  <span className="font-mono font-medium">{booking.startDate}</span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)] block text-[11px]">Lease End:</span>
                  <span className="font-mono font-medium text-amber-700">{booking.endDate}</span>
                </div>
              </div>

              {/* Actions: QR Access & Renewal (Flow 6) */}
              <div className="flex items-center gap-3">
                <Button 
                  variant="primary" 
                  className="flex-1"
                  onClick={() => setSelectedBookingForQR(booking)}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Show QR Pass
                </Button>
                <Button 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => setRenewBooking(booking)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Renew Contract
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Support Tickets Section (Flow 7) */}
      <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-primary)]">My Support Requests &amp; Issues</h2>
            <p className="text-xs text-[var(--color-secondary)]">Report locks, smart codes, payments, or unit maintenance issues</p>
          </div>
          <Button size="sm" onClick={() => setIsTicketModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Ticket
          </Button>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--color-muted)]">{ticket.ticketCode}</span>
                  <Badge variant={ticket.status === 'RESOLVED' ? 'success' : 'warning'}>
                    {ticket.status}
                  </Badge>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-canvas)] text-[var(--color-secondary)] border border-[var(--border-subtle)]">
                    {ticket.category}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-primary)]">{ticket.title}</h4>
                <p className="text-xs text-[var(--color-secondary)]">{ticket.description}</p>
                {ticket.resolutionNote && (
                  <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2 rounded mt-2 border border-emerald-200">
                    Staff Response: {ticket.resolutionNote}
                  </p>
                )}
              </div>

              <div className="text-right sm:self-center shrink-0">
                <span className="text-xs font-mono text-[var(--color-muted)]">{ticket.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Access Modal */}
      <Modal
        isOpen={!!selectedBookingForQR}
        onClose={() => setSelectedBookingForQR(null)}
        title={`Entry Pass &bull; Unit ${selectedBookingForQR?.unitCode}`}
        description="Scan this encrypted QR code at facility turnstiles or show to front desk security."
      >
        <div className="py-6 text-center space-y-4">
          <div className="inline-block p-4 bg-white rounded-2xl border-2 border-dashed border-[var(--border-subtle)] shadow-inner">
            {/* SVG Simulated QR code */}
            <div className="w-48 h-48 bg-zinc-900 rounded-lg flex flex-col items-center justify-center p-4 text-white">
              <QrCode className="w-32 h-32 text-white stroke-[1.2]" />
              <span className="text-[10px] font-mono tracking-widest mt-1 text-zinc-400">
                {selectedBookingForQR?.qrAccessToken}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-mono font-bold text-lg">{selectedBookingForQR?.accessCode}</p>
            <p className="text-xs text-[var(--color-muted)]">Valid for automated entry 24/7</p>
          </div>

          <div className="p-3 bg-[var(--surface-canvas)] rounded-lg text-xs text-[var(--color-secondary)]">
            Facility: <strong>{selectedBookingForQR?.facilityName}</strong>
          </div>
        </div>
      </Modal>

      {/* Contract Renewal Modal (Flow 6) */}
      <Modal
        isOpen={!!renewBooking}
        onClose={() => setRenewBooking(null)}
        title={`Renew Storage Contract &bull; Unit ${renewBooking?.unitCode}`}
        description="Extend your storage lease seamlessly. Pricing reflects automatic loyalty discounts."
      >
        {isRenewSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Lease Successfully Extended!</h3>
            <p className="text-xs text-[var(--color-secondary)]">Your unit end date has been updated to April 2027.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                Extension Duration
              </label>
              <select
                value={renewMonths}
                onChange={(e) => setRenewMonths(parseInt(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-sm font-medium focus:outline-none"
              >
                <option value={1}>1 Month (+1,250,000 ₫)</option>
                <option value={3}>3 Months (+3,750,000 ₫ - 5% OFF)</option>
                <option value={6}>6 Months (+7,500,000 ₫ - 10% OFF)</option>
                <option value={12}>12 Months (+15,000,000 ₫ - 15% OFF)</option>
              </select>
            </div>

            <div className="p-3 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--color-secondary)]">Current Lease End:</span>
                <span className="font-mono">{renewBooking?.endDate}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[var(--color-primary)] border-t border-[var(--border-subtle)] pt-2">
                <span>Total Extension Fee:</span>
                <span className="font-mono text-[var(--color-brand)]">{(renewMonths * 1250000).toLocaleString()} ₫</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="ghost" onClick={() => setRenewBooking(null)}>Cancel</Button>
              <Button onClick={handleRenewConfirm}>Confirm &amp; Pay Extension</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Support Ticket Modal (Flow 7) */}
      <Modal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        title="Submit Support Request"
        description="Facility staff and maintenance on duty will inspect or respond promptly."
      >
        {ticketSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Support Request Dispatched!</h3>
            <p className="text-xs text-[var(--color-secondary)]">A facility technician has received your ticket.</p>
          </div>
        ) : (
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                Category
              </label>
              <select
                value={ticketCategory}
                onChange={(e: any) => setTicketCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-sm font-medium focus:outline-none"
              >
                <option value="LOCK">Lock / Cylinder Hardware</option>
                <option value="ACCESS_CODE">Access Code / QR Token Failure</option>
                <option value="UNIT">Unit Damage / Climate Inquiry</option>
                <option value="PAYMENT">Invoice / Fee Clarification</option>
                <option value="STORED_ITEMS">Overdue / Retrieval Inquiry</option>
                <option value="OTHER">General Assistance</option>
              </select>
            </div>

            <Input
              label="Subject Summary"
              placeholder="e.g. Digital keypad battery low on Unit A-101"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                Detailed Description
              </label>
              <textarea
                rows={3}
                className="w-full px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                placeholder="Explain the issue in detail..."
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsTicketModalOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Request</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
