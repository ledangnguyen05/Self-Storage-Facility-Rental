import React, { useState } from 'react'
import { 
  UserCheck, 
  Key, 
  CheckCircle2, 
  Clock, 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowRightLeft,
  FileCheck,
  CheckCircle,
  XCircle,
  Building
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { MOCK_HANDOVERS, MOCK_TICKETS, MOCK_BOOKINGS } from '../../services/mockData'
import { HandoverRecord, SupportTicket } from '../../types'

export const StaffDashboard: React.FC = () => {
  const [handovers, setHandovers] = useState<HandoverRecord[]>(MOCK_HANDOVERS)
  const [tickets, setTickets] = useState<SupportTicket[]>(MOCK_TICKETS)
  
  // Handover inspection modal
  const [activeHandover, setActiveHandover] = useState<HandoverRecord | null>(null)
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [keyHanded, setKeyHanded] = useState(true)
  const [unitCondition, setUnitCondition] = useState('Pristine clean, seals intact, LED lighting checked')
  const [isSuccess, setIsSuccess] = useState(false)

  // Ticket resolution modal
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null)
  const [resolutionText, setResolutionText] = useState('')

  const handleCompleteHandover = () => {
    if (!activeHandover) return
    setIsSuccess(true)
    setTimeout(() => {
      setHandovers(prev => prev.map(h => {
        if (h.id === activeHandover.id) {
          return {
            ...h,
            status: 'HANDED_OVER',
            handoverDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
            unitCondition: unitCondition,
            notes: inspectionNotes || 'Check-in confirmed by staff on duty'
          }
        }
        return h
      }))
      setIsSuccess(false)
      setActiveHandover(null)
    }, 1200)
  }

  const handleResolveTicket = () => {
    if (!activeTicket) return
    setTickets(prev => prev.map(t => {
      if (t.id === activeTicket.id) {
        return {
          ...t,
          status: 'RESOLVED',
          resolutionNote: resolutionText || 'Resolved on site by facility staff'
        }
      }
      return t
    }))
    setActiveTicket(null)
    setResolutionText('')
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-[var(--surface-pure)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[var(--color-brand)] text-xs font-mono font-medium mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]"></span>
            FACILITY STAFF DESK &bull; DISTRICT 1
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">
            Daily Operations &amp; Check-In Queue
          </h1>
          <p className="text-xs text-[var(--color-secondary)] mt-1">
            Flow 2: Support customer check-in, physically hand over cylinders/smart codes, inspect unit returns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral">Station: Central Landmark D1</Badge>
        </div>
      </div>

      {/* Check-in & Handover Queue (Flow 2) */}
      <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold">Check-in &amp; Handover Manifest</h2>
            <p className="text-xs text-[var(--color-secondary)]">Customers scheduled for arrival or unit handover today</p>
          </div>
          <Badge variant="warning">
            {handovers.filter(h => h.status === 'PENDING_CHECKIN').length} Pending Arrival
          </Badge>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {handovers.map((h) => (
            <div key={h.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--color-muted)]">{h.bookingCode}</span>
                  <Badge variant={h.status === 'HANDED_OVER' ? 'success' : 'warning'}>
                    {h.status === 'HANDED_OVER' ? 'Handover Completed' : 'Awaiting Arrival'}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-[var(--color-brand)] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    Unit {h.unitCode}
                  </span>
                </div>
                <div className="font-semibold text-sm text-[var(--color-primary)]">
                  {h.customerName}
                </div>
                <div className="text-xs text-[var(--color-secondary)]">
                  Access Code: <span className="font-mono font-medium">{h.accessCode}</span> &bull; Condition: {h.unitCondition}
                </div>
                {h.notes && (
                  <p className="text-[11px] text-[var(--color-muted)] italic">Log: {h.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {h.status === 'PENDING_CHECKIN' ? (
                  <Button 
                    size="sm" 
                    variant="primary"
                    onClick={() => {
                      setActiveHandover(h)
                      setInspectionNotes('')
                    }}
                  >
                    <Key className="w-3.5 h-3.5 mr-1.5" />
                    Process Check-in &amp; Handover
                  </Button>
                ) : (
                  <Badge variant="outline">Verified &bull; {h.handoverDate}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* On-Site Problem Handling & Support Requests */}
      <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold">On-Site Issues &amp; Maintenance Requests</h2>
            <p className="text-xs text-[var(--color-secondary)]">Lost keys, damaged units, keypad PIN resets, or access requests</p>
          </div>
          <Badge variant="neutral">{tickets.length} Registered Issues</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tickets.map(ticket => (
            <Card key={ticket.id} className="p-5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-0.5">
                  <span className="font-mono text-xs text-[var(--color-muted)] font-semibold">{ticket.ticketCode}</span>
                  <h4 className="font-bold text-sm text-[var(--color-primary)]">{ticket.title}</h4>
                </div>
                <Badge variant={ticket.status === 'RESOLVED' ? 'success' : 'warning'}>
                  {ticket.status}
                </Badge>
              </div>

              <p className="text-xs text-[var(--color-secondary)] mb-3 leading-relaxed">
                {ticket.description}
              </p>

              <div className="text-[11px] text-[var(--color-muted)] border-t border-[var(--border-subtle)] pt-2.5 flex items-center justify-between">
                <span>Customer: <strong>{ticket.customerName}</strong></span>
                {ticket.status !== 'RESOLVED' ? (
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => {
                      setActiveTicket(ticket)
                      setResolutionText('')
                    }}
                  >
                    Resolve On-Site
                  </Button>
                ) : (
                  <span className="text-emerald-700 font-medium">Done</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Handover Process Modal */}
      <Modal
        isOpen={!!activeHandover}
        onClose={() => setActiveHandover(null)}
        title={`Complete Unit Handover &bull; ${activeHandover?.unitCode}`}
        description="Verify customer identity, physically provide the lock cylinder / smart card, and inspect initial condition."
      >
        {isSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Handover Confirmed &amp; Unit Activated!</h3>
            <p className="text-xs text-[var(--color-secondary)]">The status of Unit {activeHandover?.unitCode} is now marked OCCUPIED.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-secondary)]">Customer:</span>
                <span className="font-bold">{activeHandover?.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-secondary)]">Assigned Unit:</span>
                <span className="font-mono font-bold text-[var(--color-brand)]">{activeHandover?.unitCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-secondary)]">System Access Code:</span>
                <span className="font-mono">{activeHandover?.accessCode}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                Physical Unit Condition Inspection
              </label>
              <input
                type="text"
                value={unitCondition}
                onChange={(e) => setUnitCondition(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-xs font-medium focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input 
                type="checkbox" 
                id="keyCheck" 
                checked={keyHanded} 
                onChange={(e) => setKeyHanded(e.target.checked)}
                className="rounded border-[var(--border-subtle)] text-[var(--color-brand)]"
              />
              <label htmlFor="keyCheck" className="text-xs font-medium text-[var(--color-primary)] cursor-pointer">
                Smart access card or brass lock cylinder physically handed to customer
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
                Staff Notes / Comments
              </label>
              <textarea
                rows={2}
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                placeholder="e.g. Identity verified via CCCD, customer inspected lighting inside unit."
                className="w-full px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="ghost" onClick={() => setActiveHandover(null)}>Cancel</Button>
              <Button onClick={handleCompleteHandover} disabled={!keyHanded}>
                Confirm Handover &bull; Hand Keys
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Resolve Ticket Modal */}
      <Modal
        isOpen={!!activeTicket}
        onClose={() => setActiveTicket(null)}
        title={`Resolve Issue &bull; ${activeTicket?.ticketCode}`}
        description="Enter the action taken on site (battery replaced, code reset, door adjusted)."
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-[var(--surface-canvas)] text-xs space-y-1 border border-[var(--border-subtle)]">
            <p className="font-bold">{activeTicket?.title}</p>
            <p className="text-[var(--color-secondary)]">{activeTicket?.description}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
              Staff Resolution Action
            </label>
            <textarea
              rows={3}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="e.g. Replaced 4x AA batteries in digital keypad lock. Tested PIN successfully."
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-xs focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setActiveTicket(null)}>Cancel</Button>
            <Button onClick={handleResolveTicket}>Mark as Resolved</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
