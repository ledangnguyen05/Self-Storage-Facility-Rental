import React, { useState } from 'react'

interface IoTTelemetryModalProps {
  isOpen: boolean
  onClose: () => void
  facilityName: string
  totalUnits: number
}

interface DeviceNode {
  id: string
  name: string
  type: 'GATEWAY' | 'SMARTLOCK' | 'CLIMATE'
  location: string
  status: 'ONLINE' | 'STANDBY' | 'WARNING'
  battery?: string
  rssi: string
  latency: string
  lastSync: string
}

const MOCK_NODES: DeviceNode[] = [
  {
    id: 'GW-M01',
    name: 'LoRaWAN Gateway Root Master',
    type: 'GATEWAY',
    location: 'Trạm Kỹ Thuật Tầng 1 (Zone A)',
    status: 'ONLINE',
    rssi: '-42 dBm (Mạnh)',
    latency: '8 ms',
    lastSync: '10 giây trước'
  },
  {
    id: 'GW-R02',
    name: 'LoRaWAN Repeater Extender',
    type: 'GATEWAY',
    location: 'Hành lang Tầng 2 (Zone C Climate)',
    status: 'ONLINE',
    rssi: '-54 dBm (Tốt)',
    latency: '14 ms',
    lastSync: '18 giây trước'
  },
  {
    id: 'SL-CL-A',
    name: 'Cụm SmartLock Khóa Cơ Điện Zone A (16 kho)',
    type: 'SMARTLOCK',
    location: 'Phân khu A (Aisle North)',
    status: 'ONLINE',
    battery: '98%',
    rssi: '-48 dBm (Mạnh)',
    latency: '12 ms',
    lastSync: '25 giây trước'
  },
  {
    id: 'SL-CL-B',
    name: 'Cụm SmartLock Tải Nặng Zone B (16 kho)',
    type: 'SMARTLOCK',
    location: 'Phân khu B (Aisle South)',
    status: 'ONLINE',
    battery: '94%',
    rssi: '-56 dBm (Tốt)',
    latency: '15 ms',
    lastSync: '30 giây trước'
  },
  {
    id: 'SENS-CL-01',
    name: 'Cảm biến Nhiệt Ẩm Vi khí hậu #01',
    type: 'CLIMATE',
    location: 'Phân khu C - Kho Rượu Vang',
    status: 'ONLINE',
    battery: '99%',
    rssi: '-46 dBm (Mạnh)',
    latency: '11 ms',
    lastSync: '5 giây trước'
  },
  {
    id: 'SENS-CL-02',
    name: 'Cảm biến Nhiệt Ẩm Vi khí hậu #02',
    type: 'CLIMATE',
    location: 'Phân khu C - Kho Vi Điện Tử',
    status: 'ONLINE',
    battery: '97%',
    rssi: '-51 dBm (Tốt)',
    latency: '13 ms',
    lastSync: '8 giây trước'
  }
]

export const IoTTelemetryModal: React.FC<IoTTelemetryModalProps> = ({
  isOpen,
  onClose,
  facilityName,
  totalUnits
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'GATEWAY' | 'SMARTLOCK' | 'CLIMATE'>('ALL')
  const [isPinging, setIsPinging] = useState(false)
  const [lastPingTime, setLastPingTime] = useState('Vừa kiểm tra')

  if (!isOpen) return null

  const handleRunPing = () => {
    setIsPinging(true)
    setTimeout(() => {
      setIsPinging(false)
      setLastPingTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1200)
  }

  const filteredNodes = MOCK_NODES.filter(node => filterType === 'ALL' || node.type === filterType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-100 text-cyan-900">
              <span className="material-symbols-outlined text-[26px]">sensors</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Giám Sát Mạng Lưới IoT &amp; Trạm Vi Khí Hậu</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Mesh Ổn định
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {facilityName} &bull; Kết nối {totalUnits} phòng kho tự quản &bull; LoRaWAN EU868 Band
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

        {/* Development State Warning Banner */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
          <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0">engineering</span>
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span>TÍNH NĂNG ĐANG PHÁT TRIỂN &bull; CHƯA KẾT NỐI PHẦN CỨNG THỰC TẾ</span>
              <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 font-mono text-[10px] rounded font-bold uppercase">Mô phỏng</span>
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Trạm hiện chưa lắp đặt gateway LoRaWAN và cụm cảm biến IoT vi khí hậu thực tế tại hiện trường. Dữ liệu ping, RSSI và ngưỡng nhiệt ẩm dưới đây là dữ liệu telemetry giả lập phục vụ kiểm thử giao diện điều hành.
            </p>
          </div>
        </div>

        {/* Realtime KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Độ trễ trung bình</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-slate-900">14</span>
              <span className="text-xs text-slate-600 font-semibold">ms</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">check_circle</span> Phản hồi thời gian thực
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Trạm kết nối trực tuyến</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-emerald-700">32/32</span>
              <span className="text-xs text-slate-600 font-semibold">nút</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">wifi</span> 100% Khả dụng
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Pin SmartLock TB</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold font-mono text-blue-700">96.4</span>
              <span className="text-xs text-slate-600 font-semibold">%</span>
            </div>
            <span className="text-[10px] text-blue-700 font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">battery_charging_full</span> Không có cảnh báo pin yếu
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-500">Vi khí hậu Zone C</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold font-mono text-cyan-700">20.4°C</span>
              <span className="text-xs text-slate-600 font-mono">52% RH</span>
            </div>
            <span className="text-[10px] text-cyan-800 font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">thermostat</span> Chuẩn bảo quản đồ da &amp; rượu
            </span>
          </div>
        </div>

        {/* Nodes Table Filter & Run Ping Button */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            {(['ALL', 'GATEWAY', 'SMARTLOCK', 'CLIMATE'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  filterType === type 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type === 'ALL' ? 'Tất cả nút' :
                 type === 'GATEWAY' ? 'Gateway trạm gốc' :
                 type === 'SMARTLOCK' ? 'Cụm SmartLock' : 'Cảm biến Vi khí hậu'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Ping lần cuối: {lastPingTime}</span>
            <button
              type="button"
              onClick={handleRunPing}
              disabled={isPinging}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isPinging ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isPinging ? 'Đang ping trạm...' : 'Chạy Ping Mạng Lưới'}</span>
            </button>
          </div>
        </div>

        {/* Device Nodes Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3">Mã &amp; Tên Trạm Thiết Bị</th>
                <th className="p-3">Vị Trí Cụm</th>
                <th className="p-3">Cường Độ Tín Hiệu (RSSI)</th>
                <th className="p-3">Độ Trễ</th>
                <th className="p-3">Pin</th>
                <th className="p-3 text-right">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredNodes.map(node => (
                <tr key={node.id} className="hover:bg-slate-50/80 transition-all">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-800">
                        {node.id}
                      </span>
                      <span className="font-semibold text-slate-900">{node.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-600">{node.location}</td>
                  <td className="p-3 font-mono text-slate-700">{node.rssi}</td>
                  <td className="p-3 font-mono font-semibold text-emerald-700">{node.latency}</td>
                  <td className="p-3 font-mono text-slate-800">
                    {node.battery ? (
                      <span className="flex items-center gap-1 font-semibold text-emerald-700">
                        <span className="material-symbols-outlined text-[15px]">battery_full</span>
                        {node.battery}
                      </span>
                    ) : (
                      <span className="text-slate-600">Nguồn AC 220V</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-semibold text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Trực tuyến
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Hệ thống IoT được kiểm định an ninh mạng chuẩn TLS 1.3 &amp; AES-128
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
          >
            Đóng bảng giám sát
          </button>
        </div>
      </div>
    </div>
  )
}
