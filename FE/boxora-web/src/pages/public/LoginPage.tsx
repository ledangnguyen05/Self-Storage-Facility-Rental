import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { login, isLoading } = useAuth()

  const [email, setEmail] = useState('admin@gmail.com')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      const storedUser = localStorage.getItem('boxora_user')
      let userRole = 'CUSTOMER'
      if (storedUser) {
        try {
          userRole = JSON.parse(storedUser)?.role?.name || 'CUSTOMER'
        } catch {}
      }

      if (redirect === 'reserve') {
        navigate('/portal/customer')
      } else if (userRole === 'ADMIN') {
        navigate('/portal/admin')
      } else if (userRole === 'STAFF') {
        navigate('/portal/staff')
      } else if (userRole === 'FACILITY_MANAGER') {
        navigate('/portal/facility-manager')
      } else if (userRole === 'BUSINESS_MANAGER') {
        navigate('/portal/business-manager')
      } else {
        navigate('/portal/customer')
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.message || 'Invalid credentials or server connection error.')
    }
  }

  // Quick Preset Selector for Fast Evaluation
  const setPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail)
    setPassword(presetPass)
    setError(null)
  }

  return (
    <div className="bg-[var(--surface-canvas)] min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--surface-pure)] border border-[var(--border-subtle)] text-[var(--color-brand)] mb-4 shadow-sm">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">
            Sign in to Boxora
          </h2>
          <p className="mt-2 text-sm text-[var(--color-secondary)]">
            Access your storage units, check-in codes, and facility controls
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-8 bg-[var(--surface-pure)] border border-[var(--border-subtle)] shadow-sm">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@gmail.com"
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-[var(--border-subtle)] text-[var(--color-brand)]" defaultChecked />
                <span className="text-[var(--color-secondary)]">Remember session</span>
              </label>
              <a href="#forgot" className="text-[var(--color-brand)] hover:underline font-medium">Forgot password?</a>
            </div>

            <Button
              type="submit"
              className="w-full mt-4"
              size="lg"
              isLoading={isLoading}
            >
              Sign In to Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Quick Switch Preset Buttons */}
          <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
            <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-muted)] mb-3 text-center">
              Quick Switch Role (MongoDB Seeded Accounts)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPreset('admin@gmail.com', 'admin')}
                className="p-2 text-left rounded border border-[var(--border-subtle)] hover:bg-[var(--surface-canvas)] transition-colors"
              >
                <div className="font-bold text-[var(--color-primary)]">Admin</div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">admin@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => setPreset('customer@gmail.com', 'customer')}
                className="p-2 text-left rounded border border-[var(--border-subtle)] hover:bg-[var(--surface-canvas)] transition-colors"
              >
                <div className="font-bold text-[var(--color-primary)]">Customer</div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">customer@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => setPreset('staff@gmail.com', 'staff')}
                className="p-2 text-left rounded border border-[var(--border-subtle)] hover:bg-[var(--surface-canvas)] transition-colors"
              >
                <div className="font-bold text-[var(--color-primary)]">Staff</div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">staff@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => setPreset('facility@gmail.com', 'facility')}
                className="p-2 text-left rounded border border-[var(--border-subtle)] hover:bg-[var(--surface-canvas)] transition-colors"
              >
                <div className="font-bold text-[var(--color-primary)]">Facility Mgr</div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">facility@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => setPreset('business@gmail.com', 'business')}
                className="col-span-2 p-2 text-left rounded border border-[var(--border-subtle)] hover:bg-[var(--surface-canvas)] transition-colors"
              >
                <div className="font-bold text-[var(--color-primary)]">Business Operations Manager</div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">business@gmail.com</div>
              </button>
            </div>
          </div>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-[var(--color-secondary)]">
          Don't have an account yet?{' '}
          <Link to="/register" className="font-medium text-[var(--color-brand)] hover:underline">
            Register new customer account
          </Link>
        </p>

      </div>
    </div>
  )
}
