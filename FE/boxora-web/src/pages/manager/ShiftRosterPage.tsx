import React, { useState, useEffect, useMemo } from 'react'
import { userService } from '../../services/userService'
import { facilityService } from '../../services/facilityService'
import { useAuth } from '../../context/AuthContext'
import { User, Facility } from '../../types'
import { ShiftAssignmentModal } from './modals/ShiftAssignmentModal'

export const ShiftRosterPage: React.FC = () => {
  const { user } = useAuth()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  const [showShiftModal, setShowShiftModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load facilities
  useEffect(() => {
    const loadFacilities = async () => {
      try {
        const res = await facilityService.getFacilities()
        const facs = res?.content || []
        setFacilities(facs)
        const userFacId = user?.facilityId
        if (userFacId && facs.some(f => f.id === userFacId)) {
          setSelectedFacilityId(userFacId)
        } else if (facs.length > 0) {
          setSelectedFacilityId(facs[0].id)
        }
      } catch (err) {
        console.warn('Failed to load facilities:', err)
      }
    }
    loadFacilities()
  }, [user])

  // Load staff list
  const fetchStaff = async () => {
    setIsLoading(true)
    try {
      const res = await userService.getAllUsers({
        role: 'STAFF',
        facilityId: selectedFacilityId || undefined,
        size: 100
      })
      setStaffList(res.data || [])
    } catch (err) {
      console.warn('Failed to load staff list:', err)
      setStaffList([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [selectedFacilityId])

  const currentFacilityName = useMemo(() => {
    return facilities.find(f => f.id === selectedFacilityId)?.name || 'Cơ sở Boxora'
  }, [facilities, selectedFacilityId])

  // KPIs
  const onlineCount = useMemo(() => staffList.filter(s => s.isActive !== false).length, [staffList])
  const offlineCount = useMemo(() => staffList.filter(s => s.isActive === false).length, [staffList])

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter(staff => {
      const matchSearch =
        staff.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.phone?.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchSearch) return false

      if (filterStatus === 'ONLINE') return staff.isActive !== false
      if (filterStatus === 'OFFLINE') return staff.isActive === false

      return true
    })
  }, [staffList, searchTerm, filterStatus])

  // Pagination
  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage) || 1
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredStaff.slice(start, start + itemsPerPage)
  }, [filteredStaff, currentPage, itemsPerPage])

  return (
    <div className="flex flex-col gap-6 w-full text-left">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">schedule</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Xử Lý Trực Ca &amp; Phân Công Nhân Sự
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {currentFacilityName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Điều phối ca trực quầy đón tiếp, bàn giao kiểm tra kho, tuần tra bảo mật SmartLock và ghi nhận nhật ký ca
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {facilities.length > 1 && (
            <select
              value={selectedFacilityId}
              onChange={e => setSelectedFacilityId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
            >
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={fetchStaff}
            disabled={isLoading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShiftModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Phân công ca trực mới</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng nhân sự cơ sở</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {staffList.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Nhân viên được điều phối tại chi nhánh
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Đang trực ca</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tracking-tight">
              {onlineCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Sẵn sàng đón khách và hỗ trợ tại quầy
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ngoại tuyến</span>
            <div className="p-1.5 rounded-lg bg-slate-50 text-slate-600">
              <span className="material-symbols-outlined text-[18px]">timer_off</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-700 tracking-tight">
              {offlineCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Chưa vào ca hoặc đang nghỉ ngơi
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ca trực hôm nay</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-[18px]">calendar_view_day</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-700 tracking-tight">
              3 ca trực
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Trực ban bảo đảm an ninh 24/7
            </div>
          </div>
        </div>
      </div>

      {/* Main Staff Roster Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
        
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {(['ALL', 'ONLINE', 'OFFLINE'] as const).map(st => {
              const label = st === 'ALL' ? 'Tất cả' : st === 'ONLINE' ? 'Đang trực' : 'Ngoại tuyến'
              const count = st === 'ALL' ? staffList.length : st === 'ONLINE' ? onlineCount : offlineCount
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => { setFilterStatus(st); setCurrentPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStatus === st
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              placeholder="Tìm theo tên, email, SĐT..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Nhân sự trực ca</th>
                <th className="py-3 px-4">Thông tin liên hệ</th>
                <th className="py-3 px-4">Vai trò cơ sở</th>
                <th className="py-3 px-4 text-center">Trạng thái ca</th>
                <th className="py-3 px-4 text-right">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl animate-spin mb-1">progress_activity</span>
                    <p>Đang tải danh sách nhân sự trực ca...</p>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Không tìm thấy nhân viên nào phù hợp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                paginatedStaff.map(staff => {
                  const isOnline = staff.isActive !== false
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                              {(staff.fullName || staff.username || 'NV').slice(0, 2).toUpperCase()}
                            </div>
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">{staff.fullName || staff.username}</div>
                            <div className="text-[10px] text-slate-400">ID: {staff.id?.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 text-xs">{staff.email}</div>
                        <div className="text-slate-500 text-[11px]">{staff.phone || 'Chưa có SĐT'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {staff.roleName || 'Nhân viên vận hành quầy'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-medium text-[11px] border ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {isOnline ? 'Đang trực' : 'Ngoại tuyến'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setShowShiftModal(true)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Đổi ca
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredStaff.length > itemsPerPage && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Hiển thị {paginatedStaff.length} trên {filteredStaff.length} nhân sự
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer font-semibold"
              >
                Trang trước
              </button>
              <span className="font-mono font-bold text-slate-900">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer font-semibold"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Shift Assignment Modal */}
      {showShiftModal && (
        <ShiftAssignmentModal
          isOpen={showShiftModal}
          onClose={() => setShowShiftModal(false)}
          facilityId={selectedFacilityId}
          onSaveShift={(summary) => {
            showToast(`Phân công ca trực thành công: ${summary}`)
            setShowShiftModal(false)
            fetchStaff()
          }}
        />
      )}

    </div>
  )
}
