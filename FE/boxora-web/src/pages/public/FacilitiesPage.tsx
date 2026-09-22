import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MapPin, Phone, CheckCircle2, Search, ArrowRight, ShieldCheck, Filter } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { MOCK_FACILITIES, MOCK_STORAGE_UNITS, MOCK_UNIT_TYPES } from '../../services/mockData'

export const FacilitiesPage: React.FC = () => {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(MOCK_FACILITIES[0].id)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const selectedFacility = MOCK_FACILITIES.find(f => f.id === selectedFacilityId) || MOCK_FACILITIES[0]
  
  const facilityUnits = MOCK_STORAGE_UNITS.filter(u => {
    const matchFac = u.facilityId === selectedFacilityId
    const matchStatus = statusFilter === 'ALL' || u.status === statusFilter
    return matchFac && matchStatus
  })

  return (
    <div className="bg-[var(--surface-canvas)] min-h-screen py-12 text-[var(--color-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-pure)] border border-[var(--border-subtle)] text-xs font-mono uppercase tracking-widest text-[var(--color-secondary)] mb-3">
            <Building2 className="w-3.5 h-3.5 text-[var(--color-brand)]" />
            Network Topology &bull; 3 Locations
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">Storage Facilities &amp; Unit Availability</h1>
          <p className="text-[var(--color-secondary)] leading-relaxed">
            Inspect real-time locker and storage suite inventory across each facility. View floor maps, specifications, and instant rental slots.
          </p>
        </div>

        {/* Facility Cards Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {MOCK_FACILITIES.map(facility => {
            const isSelected = facility.id === selectedFacilityId
            return (
              <div
                key={facility.id}
                onClick={() => setSelectedFacilityId(facility.id)}
                className={`cursor-pointer rounded-xl border p-5 transition-all ${
                  isSelected 
                    ? 'border-[var(--color-brand)] bg-[var(--surface-pure)] shadow-md ring-2 ring-[var(--color-brand)]/20' 
                    : 'border-[var(--border-subtle)] bg-[var(--surface-pure)] hover:border-[var(--color-secondary)]'
                }`}
              >
                <div className="h-40 rounded-lg overflow-hidden mb-4 relative">
                  <img 
                    src={facility.imageUrl} 
                    alt={facility.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="success">{facility.availableUnits} Available</Badge>
                  </div>
                </div>

                <h3 className="font-bold text-base mb-1">{facility.name}</h3>
                <p className="text-xs text-[var(--color-secondary)] flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                  {facility.address}
                </p>
                <p className="text-xs text-[var(--color-muted)] font-mono flex items-center gap-1.5 mb-4">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {facility.contactPhone}
                </p>

                <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-xs">
                  <span className="text-[var(--color-secondary)]">Total Capacity:</span>
                  <span className="font-mono font-semibold">{facility.totalUnits} Units</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected Facility Unit Inventory Grid */}
        <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-xl font-bold">{selectedFacility.name} &bull; Unit Matrix</h2>
              <p className="text-xs text-[var(--color-secondary)] mt-1">Real-time status of storage units on premises.</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] font-medium focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available Only</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </div>

          {/* Units Table/Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {facilityUnits.map(unit => (
              <div 
                key={unit.id}
                className="p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-lg text-[var(--color-primary)]">{unit.unitCode}</span>
                    <Badge variant={
                      unit.status === 'AVAILABLE' ? 'success' :
                      unit.status === 'OCCUPIED' ? 'warning' : 'neutral'
                    }>
                      {unit.status}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-[var(--color-secondary)] mb-1">{unit.unitTypeName}</p>
                  <p className="text-[11px] font-mono text-[var(--color-muted)] mb-3">{unit.floorLevel}</p>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-3 flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-[var(--color-primary)]">
                    {unit.pricePerMonth.toLocaleString()} ₫<span className="text-[10px] font-normal text-[var(--color-muted)]">/mo</span>
                  </span>
                  {unit.status === 'AVAILABLE' ? (
                    <Link to="/?reserve=true">
                      <Button size="sm" variant="primary">Reserve</Button>
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[var(--color-muted)] font-mono">Unavailable</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {facilityUnits.length === 0 && (
            <div className="py-12 text-center text-[var(--color-muted)] text-sm">
              No units match the selected status filter in this facility.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
