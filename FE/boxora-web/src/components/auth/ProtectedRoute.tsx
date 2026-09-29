import React from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, ROLE_PRESETS } from '../../context/AuthContext'
import { RoleType } from '../../types'

interface ProtectedRouteProps {
  allowedRoles?: RoleType[]
  children: React.ReactElement
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, role, isAuthenticated, isLoading, switchRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-600 rounded-full animate-spin"></div>
        <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider uppercase">
          Xác thực phiên làm việc Boxora...
        </span>
      </div>
    )
  }

  // If not logged in, redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  // If allowedRoles is specified and current role is not permitted, render 403 Forbidden screen
  if (allowedRoles && allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
    const matchingPreset = ROLE_PRESETS.find(p => p.role === role)
    const suggestedTarget = allowedRoles[0]
    const suggestedPreset = ROLE_PRESETS.find(p => p.role === suggestedTarget)

    const handleQuickSwitch = async (targetRole: RoleType) => {
      await switchRole(targetRole)
    }

    return (
      <div className="min-h-[75vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-left">
          
          {/* Top Banner */}
          <div className="bg-slate-900 text-white p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">lock_person</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500 text-white uppercase tracking-wider">
                  HTTP 403 FORBIDDEN
                </span>
                <span className="font-mono text-xs text-slate-400">RBAC Restriction</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                Phân hệ yêu cầu đặc quyền chuyên biệt
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Bạn không có quyền truy cập trực tiếp vào khu vực này với phiên đăng nhập hiện tại.
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            
            {/* Current Identity Details */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">Tài khoản hiện tại:</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-slate-200 text-slate-800">
                  {role}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                  {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{user.fullName || user.username}</span>
                  <span className="font-mono text-xs text-slate-500">{user.email}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-200">
                Vai trò của bạn: <strong>{matchingPreset?.label || role}</strong>
              </p>
            </div>

            {/* Allowed Roles */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Vai trò được phép truy cập phân hệ này:
              </span>
              <div className="flex flex-wrap gap-2">
                {allowedRoles.map(allowed => {
                  const preset = ROLE_PRESETS.find(p => p.role === allowed)
                  return (
                    <span
                      key={allowed}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-orange-50 border border-orange-200 text-orange-700 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">verified_user</span>
                      {preset?.label || allowed} ({allowed})
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Demo Quick Switcher */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>Bộ chuyển vai trò nhanh (Dành cho Giảng viên / Đánh giá Hệ thống):</span>
              </div>
              <p className="text-xs text-amber-700">
                Nhấp trực tiếp vào vai trò bên dưới để hệ thống tự động đổi tài khoản và mở khóa phân hệ:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allowedRoles.map(targetRole => {
                  const p = ROLE_PRESETS.find(item => item.role === targetRole)
                  if (!p) return null
                  return (
                    <button
                      key={targetRole}
                      type="button"
                      onClick={() => handleQuickSwitch(targetRole)}
                      className="p-2.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-left transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-amber-900">
                          {p.label}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {p.email}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-amber-600 text-[18px]">
                        login
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (matchingPreset?.portalPath) {
                    navigate(matchingPreset.portalPath)
                  } else {
                    navigate('/portal/customer')
                  }
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Về Portal của tôi ({role})
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">switch_account</span>
                Đổi tài khoản khác
              </button>
            </div>

          </div>

        </div>
      </div>
    )
  }

  return children
}
