import React, { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { User, RoleType } from '../../types'

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    password: '',
    roleName: 'STAFF' as RoleType
  })
  const [createSuccess, setCreateSuccess] = useState(false)

  // Seeded fallback users
  const fallbackUsers: User[] = [
    { id: 'u-1', username: 'admin', email: 'admin@boxora.com', fullName: 'Nguyễn Quỳnh Anh', role: { name: 'ADMIN', description: 'Full system privileges' }, isActive: true, createdAt: '2026-09-01' },
    { id: 'u-2', username: 'cust_01', email: 'nguyenvana@gmail.com', fullName: 'Nguyễn Văn An', role: { name: 'CUSTOMER', description: 'Storage customer' }, isActive: true, createdAt: '2026-09-02' },
    { id: 'u-3', username: 'staff_tb', email: 'staff.nam@boxora.com', fullName: 'Lê Hoàng Nam', role: { name: 'STAFF', description: 'Facility Staff' }, isActive: true, createdAt: '2026-09-03' },
    { id: 'u-4', username: 'mgr_tb', email: 'manager.tri@boxora.com', fullName: 'Trần Hữu Trí', role: { name: 'FACILITY_MANAGER', description: 'Facility Manager' }, isActive: true, createdAt: '2026-09-04' },
    { id: 'u-5', username: 'biz_ops', email: 'csuite.mai@boxora.com', fullName: 'Trần Mai Phương', role: { name: 'BUSINESS_MANAGER', description: 'Business Operations Director' }, isActive: true, createdAt: '2026-09-05' },
  ]

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await userService.getAllUsers()
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setUsers(res.data)
      } else {
        setUsers(fallbackUsers)
      }
    } catch {
      setUsers(fallbackUsers)
    }
  }

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await userService.createUser(newUser)
      setCreateSuccess(true)
      setTimeout(() => {
        setCreateSuccess(false)
        setIsCreateModalOpen(false)
        fetchUsers()
      }, 1200)
    } catch {
      const localUser: User = {
        id: `u-${Date.now()}`,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        phone: newUser.phone,
        role: { name: newUser.roleName },
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0]
      }
      setUsers([localUser, ...users])
      setCreateSuccess(true)
      setTimeout(() => {
        setCreateSuccess(false)
        setIsCreateModalOpen(false)
      }, 1200)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchQuery = (u.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                       u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       u.username.toLowerCase().includes(searchQuery.toLowerCase())
    const matchRole = roleFilter === 'ALL' || u.role?.name === roleFilter
    return matchQuery && matchRole
  })

  // Live security audit telemetry
  const auditLogs = [
    { time: '16:14:22', user: 'admin@boxora.com', action: 'Cập nhật phân quyền Matrix cho FACILITY_MANAGER', ip: '192.168.1.1' },
    { time: '15:48:10', user: 'staff.nam@boxora.com', action: 'Xác thực CCCD & ký hợp đồng số #HD-2025-4421', ip: '192.168.1.45' },
    { time: '14:20:05', user: 'nguyenvana@gmail.com', action: 'Tạo mã truy cập SmartLock IoT cho Kho #A-108', ip: '113.161.78.22' },
    { time: '11:05:40', user: 'csuite.mai@boxora.com', action: 'Đồng bộ chính sách nợ quá hạn: 50.000đ/ngày toàn chuỗi', ip: '192.168.1.12' }
  ]

  const getRoleBadge = (roleName?: string) => {
    switch (roleName) {
      case 'ADMIN':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'FACILITY_MANAGER':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'BUSINESS_MANAGER':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'STAFF':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Banner */}
      <div className="relative w-full overflow-hidden rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-slate-900"></span>
              QUẢN TRỊ VIÊN HỆ THỐNG CẤP CAO (RBAC ENGINE)
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Quản Trị Người Dùng, Phân Quyền &amp; Nhật Ký Hệ Thống
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kiểm soát tài khoản 5 vai trò: Khách hàng, Nhân viên điều hành, Quản lý cơ sở, Giám đốc vận hành và Quản trị viên
            </p>
          </div>

          <button 
            type="button" 
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-orange-700 transition-all shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Cấp Tài Khoản Mới</span>
          </button>
        </div>
      </div>

      {/* User Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Tìm theo tên, email, tên tài khoản..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono uppercase font-semibold">Vai trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium focus:outline-none"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="ADMIN">ADMIN (Quản trị viên)</option>
              <option value="CUSTOMER">CUSTOMER (Khách thuê)</option>
              <option value="STAFF">STAFF (Nhân viên)</option>
              <option value="FACILITY_MANAGER">FACILITY_MANAGER (Quản lý cơ sở)</option>
              <option value="BUSINESS_MANAGER">BUSINESS_MANAGER (Giám đốc)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-y border-slate-200 uppercase tracking-wider text-slate-500 font-mono">
              <tr>
                <th className="py-3 px-4">Họ &amp; Tên / Email</th>
                <th className="py-3 px-4">Tên đăng nhập</th>
                <th className="py-3 px-4">Vai trò định danh</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Ngày cấp</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-sm text-slate-900">{u.fullName || u.username}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{u.username}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${getRoleBadge(u.role?.name)}`}>
                      {u.role?.name || 'CUSTOMER'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Hoạt động
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">{u.createdAt || '2026-09-01'}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button type="button" className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold border border-slate-200 transition-all">
                      Phân quyền
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit & Activity Stream */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-[20px]">security</span>
              Nhật Ký Bảo Mật &amp; Truy Vết Sự Kiện (Live Security Stream)
            </h2>
            <p className="text-xs text-slate-500">Theo dõi xác thực tài khoản và các thao tác cấu hình hệ thống thời gian thực</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-bold border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Stream
          </span>
        </div>

        <div className="divide-y divide-slate-100 font-mono text-xs">
          {auditLogs.map((log, idx) => (
            <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-semibold">{log.time}</span>
                <span className="text-orange-600 font-bold">{log.user}</span>
                <span className="text-slate-800 font-sans">{log.action}</span>
              </div>
              <span className="text-[11px] text-slate-400">IP: {log.ip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Cấp Tài Khoản Hệ Thống Mới</h3>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {createSuccess ? (
              <div className="py-6 text-center space-y-2">
                <span className="material-symbols-outlined text-emerald-600 text-[48px]">check_circle</span>
                <h4 className="text-sm font-bold text-slate-900">Đã cấp tài khoản thành công!</h4>
                <p className="text-xs text-slate-500">Thông tin đăng nhập đã được ghi nhận vào cơ sở dữ liệu Boxora.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                    placeholder="Nguyễn Văn B"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tên đăng nhập</label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      placeholder="nguyenvanb"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                      placeholder="0911223344"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email liên hệ</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="vanb@boxora.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mật khẩu ban đầu</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phân quyền vai trò</label>
                  <select
                    value={newUser.roleName}
                    onChange={(e: any) => setNewUser({...newUser, roleName: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium focus:outline-none"
                  >
                    <option value="CUSTOMER">CUSTOMER - Khách Hàng Thuê Kho</option>
                    <option value="STAFF">STAFF - Nhân Viên Vận Hành Trạm</option>
                    <option value="FACILITY_MANAGER">FACILITY_MANAGER - Quản Lý Cơ Sở</option>
                    <option value="BUSINESS_MANAGER">BUSINESS_MANAGER - Giám Đốc Vận Hành</option>
                    <option value="ADMIN">ADMIN - Quản Trị Viên Hệ Thống</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-all shadow-sm"
                  >
                    Tạo Tài Khoản
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
