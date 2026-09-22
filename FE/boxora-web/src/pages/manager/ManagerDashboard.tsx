import React, { useState } from 'react'
import { 
  Building2, 
  Users, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  TrendingUp, 
  ShieldAlert, 
  Clock,
  ArrowUpRight,
  Filter,
  UserCheck
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { MOCK_STORAGE_UNITS, MOCK_BOOKINGS, MOCK_FACILITIES } from '../../services/mockData'
import { StorageUnit, Booking } from '../../types'

export const ManagerDashboard: React.FC = () => {
  const [units, setUnits] = useState<StorageUnit[]>(MOCK_STORAGE_UNITS)
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS)

  // Modals state
  const [isNewUnitModalOpen, setIsNewUnitModalOpen] = useState(false)
  const [newUnitCode, setNewUnitCode] = useState('')
  const [newFloor, setNewFloor] = useState('Floor 1')
  const [newPrice, setNewPrice] = useState(1250000)

  // Unit status toggle
  const toggleUnitMaintenance = (unitId: string) => {
    setUnits(prev => prev.map(u => {
      if (u.id === unitId) {
        const nextStatus = u.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE'
        return { ...u, status: nextStatus }
      }
      return u
    }))
  }

  // Handle unit creation
  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault()
    const newUnit: StorageUnit = {
      id: `u-${Date.now()}`,
      unitCode: newUnitCode.toUpperCase(),
      floorLevel: newFloor,
      status: 'AVAILABLE',
      facilityId: 'fac-1',
      facilityName: 'Boxora Central Landmark — District 1',
      unitTypeId: 'ut-compact',
      unitTypeName: 'Compact Studio Unit',
      pricePerMonth: newPrice
    }
    setUnits([newUnit, ...units])
    setIsNewUnitModalOpen(false)
    setNewUnitCode('')
  }

  // Overdue contracts count
  const overdueCount = bookings.filter(b => b.status === 'OVERDUE').length
  const totalOccupied = units.filter(u => u.status === 'OCCUPIED').length
  const occupancyRate = Math.round((totalOccupied / units.length) * 100)

  return (
    <div className="space-y-8">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-[var(--surface-pure)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--color-secondary)] mb-1">
            <span>Facility Occupancy</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-[var(--color-primary)]">
            {occupancyRate}%
          </div>
          <p className="text-[11px] text-[var(--color-muted)] mt-1">{totalOccupied} of {units.length} units occupied</p>
        </Card>

        <Card className="p-5 bg-[var(--surface-pure)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--color-secondary)] mb-1">
            <span>Available For Rent</span>
            <Layers className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-[var(--color-primary)]">
            {units.filter(u => u.status === 'AVAILABLE').length}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Ready for instantaneous booking</p>
        </Card>

        <Card className="p-5 bg-[var(--surface-pure)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--color-secondary)] mb-1">
            <span>Overdue Warnings</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-red-600">
            {overdueCount}
          </div>
          <p className="text-[11px] text-[var(--color-muted)] mt-1">Locks secured / notice dispatched</p>
        </Card>

        <Card className="p-5 bg-[var(--surface-pure)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--color-secondary)] mb-1">
            <span>Staff On Shift</span>
            <UserCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-[var(--color-primary)]">
            4 / 4
          </div>
          <p className="text-[11px] text-[var(--color-muted)] mt-1">Front desk &amp; security active</p>
        </Card>
      </div>

      {/* Unit Inventory Management (Flow 5) */}
      <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold">Facility Unit Inventory &amp; Status Controls</h2>
            <p className="text-xs text-[var(--color-secondary)]">Manage unit status, switch maintenance locks, or add new storage rooms</p>
          </div>
          <Button onClick={() => setIsNewUnitModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Storage Unit
          </Button>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-canvas)] border-y border-[var(--border-subtle)] uppercase tracking-wider text-[var(--color-muted)] font-mono">
              <tr>
                <th className="py-3 px-4">Unit Code</th>
                <th className="py-3 px-4">Location Floor</th>
                <th className="py-3 px-4">Unit Type</th>
                <th className="py-3 px-4">Rental Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-medium">
              {units.map((unit) => (
                <tr key={unit.id} className="hover:bg-[var(--surface-canvas)] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-sm text-[var(--color-primary)]">
                    {unit.unitCode}
                  </td>
                  <td className="py-3 px-4 text-[var(--color-secondary)]">{unit.floorLevel}</td>
                  <td className="py-3 px-4 text-[var(--color-primary)]">{unit.unitTypeName}</td>
                  <td className="py-3 px-4 font-mono text-[var(--color-primary)]">
                    {unit.pricePerMonth.toLocaleString()} ₫/mo
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={
                      unit.status === 'AVAILABLE' ? 'success' :
                      unit.status === 'OCCUPIED' ? 'neutral' : 'warning'
                    }>
                      {unit.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => toggleUnitMaintenance(unit.id)}
                    >
                      {unit.status === 'MAINTENANCE' ? 'Clear Maintenance' : 'Set Maintenance'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue Handling & Contracts Table (Flow 6) */}
      <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
          <div>
            <h2 className="text-lg font-bold">Rental Contracts &amp; Overdue Oversight</h2>
            <p className="text-xs text-[var(--color-secondary)]">Flow 6: Monitor overdue payments, enforce digital lockouts, or extend grace periods</p>
          </div>
          <Badge variant="neutral">{bookings.length} Total Contracts</Badge>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {bookings.map(b => (
            <div key={b.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-[var(--color-muted)]">{b.bookingCode}</span>
                  <Badge variant={b.status === 'ACTIVE' ? 'success' : 'danger'}>
                    {b.status}
                  </Badge>
                  <span className="font-mono font-bold text-xs text-[var(--color-brand)]">Unit {b.unitCode}</span>
                </div>
                <p className="text-sm font-bold text-[var(--color-primary)]">{b.customerName} &bull; <span className="text-xs font-normal text-[var(--color-secondary)]">{b.customerPhone}</span></p>
                <p className="text-xs text-[var(--color-muted)]">
                  Lease: {b.startDate} &rarr; {b.endDate} &bull; Paid: {b.depositPaid.toLocaleString()} ₫ deposit
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary">
                  Notify Customer
                </Button>
                <Button size="sm" variant="ghost">
                  Contract Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Unit Modal */}
      <Modal
        isOpen={isNewUnitModalOpen}
        onClose={() => setIsNewUnitModalOpen(false)}
        title="Add Storage Unit to Facility"
        description="Register a newly partitioned storage room or locker."
      >
        <form onSubmit={handleCreateUnit} className="space-y-4">
          <Input
            label="Unit Code (e.g. A-105, B-204)"
            value={newUnitCode}
            onChange={(e) => setNewUnitCode(e.target.value)}
            placeholder="A-105"
            required
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-1">
              Floor Location
            </label>
            <select
              value={newFloor}
              onChange={(e) => setNewFloor(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-pure)] text-xs font-medium focus:outline-none"
            >
              <option value="Ground Floor">Ground Floor (Heavy Loading Dock)</option>
              <option value="Floor 1">Floor 1 (Standard Access)</option>
              <option value="Floor 2">Floor 2 (Locker Suite)</option>
              <option value="Floor 3">Floor 3 (Climate Control High Spec)</option>
            </select>
          </div>

          <Input
            label="Base Monthly Rate (VND)"
            type="number"
            value={newPrice.toString()}
            onChange={(e) => setNewPrice(parseInt(e.target.value) || 0)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsNewUnitModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Storage Unit</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
