import React, { useState } from 'react'

interface DoorAccessHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  unit: {
    id: string
    tenant: string
    smartlock: string
    battery: string
  }
}

interface AccessLog {
  id: string
  timestamp: string
  actor: string
  actorRole: 'TENANT' | 'STAFF' | 'UNKNOWN'
  method: 'APP_BLE' | 'PIN_KEYPAD' | 'RFID_MASTER' | 'REMOTE_OVERRIDE'
  status: 'SUCCESS' | 'FAILED'
  device: string
}

const MOCK_LOGS: AccessLog[] = [
  {
    id: 'LOG-01',
    timestamp: 'Hôm nay 08:30:12',
    actor: 'Khách hàng chính chủ',
    actorRole: 'TENANT',
    method: 'APP_BLE',
    status: 'SUCCESS',
    device: 'Boxora iOS App (iPhone 15 Pro)'
  },
  {
    id: 'LOG-02',
    timestamp: 'Hôm qua 17:15:40',
    actor: 'Khách hàng chính chủ',
    actorRole: 'TENANT',
    method: 'PIN_KEYPAD',
    status: 'SUCCESS',
    device: 'Bàn phím SmartLock Keypad'
  },
  {
    id: 'LOG-03',
    timestamp: '06/10/2026 14:02:18',
    actor: 'Người dùng nhập mã',
    actorRole: 'UNKNOWN',
    method: 'PIN_KEYPAD',
    status: 'FAILED',
    device: 'Bàn phím (Sai mã PIN lần 1)'
  },
  {
    id: 'LOG-04',
    timestamp: '06/10/2026 14:03:02',
    actor: 'Khách hàng chính chủ',
    actorRole: 'TENANT',
    method: 'PIN_KEYPAD',
    status: 'SUCCESS',
    device: 'Bàn phím SmartLock Keypad'
  },
  {
    id: 'LOG-05',
    timestamp: '03/10/2026 10:20:55',
    actor: 'Lê Hoàng Nam (Kỹ thuật)',
    actorRole: 'STAFF',
    method: 'RFID_MASTER',
    status: 'SUCCESS',
    device: 'Thẻ RFID Quản trị Master #04'
  },
  {
    id: 'LOG-06',
    timestamp: '28/09/2026 19:44:10',
    actor: 'Khách hàng chính chủ',
    actorRole: 'TENANT',
    method: 'APP_BLE',
    status: 'SUCCESS',
    device: 'Boxora Android App (Samsung S24)'
  }
]

export const DoorAccessHistoryModal: React.FC<DoorAccessHistoryModalProps> = ({
  isOpen,
  onClose,
  unit
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'7D' | '30D' | 'ALL'>('30D')

  if (!isOpen) return null

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
                <h2 className="text-lg font-bold text-slate-900">Nhật Ký Truy Cập Kho #{unit.id}</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                  {unit.smartlock}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chủ kho: <strong className="text-slate-800">{unit.tenant}</strong> &bull; Trạng thái pin SmartLock: {unit.battery}
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
            <span className="text-[11px] uppercase font-bold text-slate-500">Tổng lượt mở cửa</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-slate-900">14</span>
              <span className="text-xs text-slate-600 font-medium">lượt/tháng</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Cảnh báo sai mã</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-amber-700">01</span>
              <span className="text-xs text-slate-600 font-medium">lần</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Xâm nhập bất thường</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-emerald-700">00</span>
              <span className="text-xs text-slate-600 font-medium">An toàn tuyệt đối</span>
            </div>
          </div>
        </div>

        {/* Period Filter Buttons */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
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
            Tự động đồng bộ với SmartLock Gateway
          </span>
        </div>

        {/* Access Log Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3">Thời Gian</th>
                <th className="p-3">Đối Tượng Mở Cửa</th>
                <th className="p-3">Phương Thức</th>
                <th className="p-3">Thiết Bị / Nhật Ký</th>
                <th className="p-3 text-right">Kết Quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_LOGS.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-all">
                  <td className="p-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="p-3 font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        log.actorRole === 'TENANT' ? 'bg-blue-600' :
                        log.actorRole === 'STAFF' ? 'bg-indigo-600' : 'bg-amber-500'
                      }`}></span>
                      {log.actor}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      <span className="material-symbols-outlined text-[15px] text-slate-500">
                        {log.method === 'APP_BLE' ? 'bluetooth' :
                         log.method === 'PIN_KEYPAD' ? 'pin' :
                         log.method === 'RFID_MASTER' ? 'contactless' : 'vpn_key'}
                      </span>
                      {log.method === 'APP_BLE' ? 'App Mobile BLE' :
                       log.method === 'PIN_KEYPAD' ? 'Mã PIN Bàn Phím' :
                       log.method === 'RFID_MASTER' ? 'Thẻ Master RFID' : 'Cưỡng chế từ xa'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 font-mono text-[11px]">
                    {log.device}
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
                        Sai mã
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
