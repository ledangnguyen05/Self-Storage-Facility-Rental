import React, { useState, useEffect } from 'react'
import { activityLogService } from '../../../services/activityLogService'
import { ActivityLog } from '../../../types'

interface DoorAccessHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  unit: {
    id: string
    tenant: string
    smartlock: string
    battery?: string
  }
}

export const DoorAccessHistoryModal: React.FC<DoorAccessHistoryModalProps> = ({
  isOpen,
  onClose,
  unit
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'7D' | '30D' | 'ALL'>('30D')
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadLogs()
    }
  }, [isOpen, unit.id, filterPeriod])

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      const now = new Date()
      const toDate = now.toLocaleDateString('en-CA')
      const from = new Date(now)
      if (filterPeriod === '7D') from.setDate(from.getDate() - 7)
      if (filterPeriod === '30D') from.setDate(from.getDate() - 30)

      const res = await activityLogService.getAll({
        search: unit.id,
        fromDate: filterPeriod === 'ALL' ? undefined : from.toLocaleDateString('en-CA'),
        toDate,
        size: 30,
        sortBy: 'createdAt',
        sortDir: 'desc'
      })
      setLogs((res?.content || []).filter(log =>
        log.description?.toLowerCase().includes(unit.id.toLowerCase())
      ))
    } catch {
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const successCount = logs.filter(l => l.status === 'SUCCESS').length
  const failCount = logs.filter(l => l.status === 'FAILURE' || l.status === 'WARNING').length

  const formatLogTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
              <span className="material-symbols-outlined text-[26px]">history</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Operational audit records for unit #{unit.id}</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                  {unit.smartlock}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tenant: <strong className="text-slate-800">{unit.tenant}</strong> &bull; Physical lock access events are not available.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Audit records mentioning this unit</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-slate-900">{logs.length}</span>
              <span className="text-xs text-slate-600 font-medium">lượt log</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Successful log entries</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-emerald-700">{successCount}</span>
              <span className="text-xs text-slate-600 font-medium">lần</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Warning / failure log entries</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-amber-700">{failCount}</span>
              <span className="text-xs text-slate-600 font-medium">sự kiện</span>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center justify-between pb-1">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterPeriod('7D')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                filterPeriod === '7D' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('30D')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                filterPeriod === '30D' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                filterPeriod === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toàn bộ lịch sử
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Audit entries referencing this unit; this is not device telemetry.
          </span>
        </div>

        {/* Access Log Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Đang tải dữ liệu nhật ký từ máy chủ...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Chưa có nhật ký hoạt động nào được ghi nhận cho kho này.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3">Thời Gian</th>
                  <th className="p-3">Đối Tượng Thực Hiện</th>
                  <th className="p-3">Hành Động</th>
                  <th className="p-3">Chi Tiết / Nhật Ký</th>
                  <th className="p-3 text-right">Kết Quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-all">
                    <td className="p-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {formatLogTime(log.createdAt)}
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          log.status === 'SUCCESS' ? 'bg-blue-600' : 'bg-amber-500'
                        }`}></span>
                        {log.userFullName || log.username || 'Hệ thống'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <span className="material-symbols-outlined text-[15px] text-slate-500">
                          shield_person
                        </span>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-[11px] max-w-xs truncate">
                      {log.details || log.logType}
                    </td>
                    <td className="p-3 text-right">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                          <span className="material-symbols-outlined text-[12px]">check</span>
                          Thành công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 font-bold text-[10px]">
                          <span className="material-symbols-outlined text-[12px]">close</span>
                          {log.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Dữ liệu nhật ký được lưu trữ bất biến phục vụ tra cứu bảo hiểm &amp; pháp lý
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
