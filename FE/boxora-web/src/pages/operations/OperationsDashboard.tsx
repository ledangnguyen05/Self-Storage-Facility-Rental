import React, { useState } from 'react'
import { 
  BarChart3, 
  DollarSign, 
  FileSpreadsheet, 
  Settings2, 
  Building, 
  Check, 
  TrendingUp, 
  Percent, 
  Download,
  Shield,
  Layers
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { MOCK_FACILITIES } from '../../services/mockData'

export const OperationsDashboard: React.FC = () => {
  // Global business policy state (Flow 4)
  const [depositRule, setDepositRule] = useState('100% of 1st month (Refundable upon pristine exit)')
  const [overdueDailyFee, setOverdueDailyFee] = useState(50000)
  const [gracePeriodDays, setGracePeriodDays] = useState(3)
  const [discount3Months, setDiscount3Months] = useState(5)
  const [discount6Months, setDiscount6Months] = useState(10)
  const [discount12Months, setDiscount12Months] = useState(15)
  const [isSaved, setIsSaved] = useState(false)

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  // Multi-facility network revenue metrics
  const facilitiesSummary = [
    { name: 'Boxora Central Landmark (D1)', totalUnits: 120, occupied: 86, monthlyRevenue: 124500000, occupancyRate: 72 },
    { name: 'Boxora Tech Park (Thu Duc)', totalUnits: 250, occupied: 162, monthlyRevenue: 248000000, occupancyRate: 65 },
    { name: 'Boxora Riverside (Binh Thanh)', totalUnits: 180, occupied: 138, monthlyRevenue: 186200000, occupancyRate: 77 }
  ]

  const totalNetworkRevenue = facilitiesSummary.reduce((sum, f) => sum + f.monthlyRevenue, 0)
  const totalNetworkUnits = facilitiesSummary.reduce((sum, f) => sum + f.totalUnits, 0)
  const totalNetworkOccupied = facilitiesSummary.reduce((sum, f) => sum + f.occupied, 0)
  const averageOccupancy = Math.round((totalNetworkOccupied / totalNetworkUnits) * 100)

  return (
    <div className="space-y-8">
      {/* Network Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-6 bg-[var(--surface-pure)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--color-secondary)] mb-2">
            <span>Systemwide Monthly Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-[var(--color-primary)]">
            {totalNetworkRevenue.toLocaleString()} ₫
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% versus last quarter
          </p>
        </Card>

        <Card className="p-6 bg-[var(--surface-pure)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--color-secondary)] mb-2">
            <span>Network Average Occupancy</span>
            <Layers className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-[var(--color-primary)]">
            {averageOccupancy}%
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {totalNetworkOccupied} of {totalNetworkUnits} units leased
          </p>
        </Card>

        <Card className="p-6 bg-[var(--surface-pure)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs text-[var(--color-secondary)] mb-2">
            <span>Total Registered Facilities</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-[var(--color-primary)]">
            3 Facilities
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">Ho Chi Minh City Metropolitan Area</p>
        </Card>
      </div>

      {/* Facility Performance Table & Export */}
      <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold">Facility Operations &amp; Yield Benchmarks</h2>
            <p className="text-xs text-[var(--color-secondary)]">Live revenue and utilization tracking across all hubs</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => alert('Facility analytics report exported to CSV.')}>
            <Download className="w-4 h-4 mr-1.5" />
            Export System Report (CSV)
          </Button>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-canvas)] border-y border-[var(--border-subtle)] uppercase tracking-wider text-[var(--color-muted)] font-mono">
              <tr>
                <th className="py-3 px-4">Facility Name</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Occupancy Rate</th>
                <th className="py-3 px-4">Monthly Inflow</th>
                <th className="py-3 px-4 text-right">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-medium">
              {facilitiesSummary.map((f, idx) => (
                <tr key={idx} className="hover:bg-[var(--surface-canvas)] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-sm text-[var(--color-primary)]">{f.name}</td>
                  <td className="py-3.5 px-4 font-mono text-[var(--color-secondary)]">
                    {f.occupied} / {f.totalUnits} units
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-[var(--surface-canvas)] h-2 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                        <div 
                          className="bg-[var(--color-brand)] h-full rounded-full" 
                          style={{ width: `${f.occupancyRate}%` }}
                        ></div>
                      </div>
                      <span className="font-mono font-bold">{f.occupancyRate}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                    {f.monthlyRevenue.toLocaleString()} ₫
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Badge variant="success">Optimal Yield</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Rental Policies & Fee Configuration (Flow 4) */}
      <div className="bg-[var(--surface-pure)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <div className="pb-4 border-b border-[var(--border-subtle)] mb-6">
          <h2 className="text-lg font-bold">Business Rules &amp; Fee Policy Engine</h2>
          <p className="text-xs text-[var(--color-secondary)]">
            Configure systemwide deposit thresholds, overdue penalties, and tiered term discounts
          </p>
        </div>

        <form onSubmit={handleSavePolicy} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input
                label="Security Deposit Rule"
                value={depositRule}
                onChange={(e) => setDepositRule(e.target.value)}
                helperText="Applied at reservation across all unit tiers"
                required
              />
            </div>

            <div>
              <Input
                label="Overdue Daily Late Fee (VND / Day)"
                type="number"
                value={overdueDailyFee.toString()}
                onChange={(e) => setOverdueDailyFee(parseInt(e.target.value) || 0)}
                helperText="Auto-invoiced once grace period elapses"
                required
              />
            </div>

            <div>
              <Input
                label="Grace Period Before Lockout (Days)"
                type="number"
                value={gracePeriodDays.toString()}
                onChange={(e) => setGracePeriodDays(parseInt(e.target.value) || 0)}
                helperText="Days before customer access PIN is automatically frozen"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]">
                Tiered Term Discount Policies (%)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="3-Month"
                  type="number"
                  value={discount3Months.toString()}
                  onChange={(e) => setDiscount3Months(parseInt(e.target.value) || 0)}
                />
                <Input
                  label="6-Month"
                  type="number"
                  value={discount6Months.toString()}
                  onChange={(e) => setDiscount6Months(parseInt(e.target.value) || 0)}
                />
                <Input
                  label="12-Month"
                  type="number"
                  value={discount12Months.toString()}
                  onChange={(e) => setDiscount12Months(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
            {isSaved ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Global business policies updated successfully!
              </span>
            ) : <span></span>}

            <Button type="submit">
              Save Policy Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
