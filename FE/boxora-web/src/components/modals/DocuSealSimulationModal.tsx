import React, { useState, useRef } from 'react'
import { RentalContract } from '../../types'
import { contractService } from '../../services/contractService'
import { useAuth } from '../../context/AuthContext'

interface DocuSealSimulationModalProps {
  contract: RentalContract
  onClose: () => void
  onSignedSuccess: (updated: RentalContract) => void
}

function formatDate(val?: string) {
  if (!val) return 'N/A'
  try {
    const d = new Date(val)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return val
  }
}

function formatVnd(val?: number) {
  if (!val) return '0'
  return val.toLocaleString('vi-VN')
}

export function DocuSealSimulationModal({
  contract,
  onClose,
  onSignedSuccess,
}: DocuSealSimulationModalProps) {
  const { user } = useAuth()
  const customerDisplayName = contract.customerName || user?.fullName || 'Khách hàng'
  const customerDisplayPhone = contract.customerPhone || user?.phone || 'Theo hồ sơ'
  const [agreed, setAgreed] = useState(false)
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw'>('draw')
  const [signerName, setSignerName] = useState(customerDisplayName)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    setHasDrawn(true)
    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.lineWidth = 2.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0284c7'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleConfirmSign = async () => {
    if (!agreed) {
      setError('Vui lòng đánh dấu xác nhận đồng ý với điều khoản hợp đồng.')
      return
    }
    if (signatureMode === 'draw' && !hasDrawn) {
      setError('Vui lòng ký tay vào ô chữ ký bên dưới.')
      return
    }

    setIsSigning(true)
    setError(null)
    try {
      let signatureData: string | undefined = undefined

      if (signatureMode === 'draw' && canvasRef.current && hasDrawn) {
        // Lấy chính xác nét vẽ chữ ký tay thực tế của khách hàng từ canvas
        signatureData = canvasRef.current.toDataURL('image/png')
      } else if (signatureMode === 'type') {
        // Tạo chữ ký nét vẽ tay vector chân thực thay vì chữ in font thẳng
        const nameToUse = (signerName || customerDisplayName || 'nguyen').toLowerCase()
        const svgContent = nameToUse.includes('nguyen')
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 26 55 C 30 38 36 20 44 15 C 50 11 55 18 58 32 C 63 50 69 58 75 38 C 79 26 85 22 91 30 C 97 38 101 52 108 48 C 114 44 118 32 123 30 C 129 28 131 42 135 48 C 139 54 144 48 148 38 C 152 26 156 22 160 34 C 164 46 170 76 158 84 C 146 91 140 78 148 64 C 158 48 168 40 178 38 C 186 36 191 44 196 46 C 203 48 210 36 217 34 C 224 32 228 42 234 40 C 240 38 244 32 248 34" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="218" cy="23" r="2.2" fill="%231e3a8a"/><path d="M 34 68 C 74 65 132 67 198 59 C 220 56 236 55 248 57" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 28 58 C 32 40 36 22 45 16 C 52 12 58 20 62 38 C 66 54 72 56 78 36 C 82 24 88 20 94 36 C 98 52 104 56 110 38 C 114 26 120 28 126 44 C 132 60 138 60 144 42 C 148 30 154 28 158 38 C 162 48 166 74 172 16 C 174 12 178 14 180 24 C 182 38 188 56 196 48 C 204 40 210 34 218 36" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="127" cy="20" r="2.2" fill="%231e3a8a"/><path d="M 32 70 C 72 68 135 69 205 60 C 226 57 242 56 250 58" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/></svg>`
        signatureData = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`
      }

      if (signatureData) {
        try {
          localStorage.setItem('boxora_sig_' + contract.id, signatureData)
        } catch {
          // ignore quota error
        }
      }

      const updated = await contractService.mockSignContract(contract.id, signatureData)
      if (signatureData && !updated.signatureData) {
        updated.signatureData = signatureData
      }
      onSignedSuccess(updated)
    } catch (err: unknown) {
      let msg = 'Ký hợp đồng thất bại. Vui lòng thử lại.'
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response
        if (res?.data?.message) msg = res.data.message
      }
      setError(msg)
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 md:p-6 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-3xl my-auto space-y-4 rounded-2xl border border-slate-700 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header ký hợp đồng điện tử trực tuyến */}
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
                  Xác Thực Chữ Ký Điện Tử
                </span>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
                  Ký Hợp Đồng Trực Tuyến
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Ký Hợp Đồng Thuê Kho Tự Quản: {contract.contractCode}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Thân hợp đồng */}
        <div className="px-6 py-3 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Khung văn bản hợp đồng điện tử */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs text-slate-700 font-sans leading-relaxed">
            <div className="text-center pb-2 border-b border-slate-200 space-y-1">
              <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </h3>
              <p className="font-semibold text-slate-500 text-[11px]">Độc lập - Tự do - Hạnh phúc</p>
              <h4 className="pt-1 font-extrabold text-sm text-cyan-900 uppercase">
                HỢP ĐỒNG THUÊ NGĂN KHO TỰ QUẢN BOXORA
              </h4>
              <p className="text-[10px] text-slate-500 font-mono">Mã số: {contract.contractCode}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-1">
                <span className="font-bold text-[11px] text-cyan-800 uppercase block">BÊN CHO THUÊ (BÊN A)</span>
                <p><strong>Đơn vị:</strong> Hệ thống Kho Tự Quản Boxora</p>
                <p><strong>Cơ sở:</strong> {contract.facilityName || 'Hệ thống Boxora Mega Storage'}</p>
                <p><strong>Hotline:</strong> 1900 6868 - contact@boxora.vn</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-1">
                <span className="font-bold text-[11px] text-cyan-800 uppercase block">BÊN THUÊ (BÊN B)</span>
                <p><strong>Họ và tên:</strong> {customerDisplayName}</p>
                <p><strong>Email:</strong> {contract.customerEmail || user?.email || 'Chưa cập nhật'}</p>
                <p><strong>Số điện thoại:</strong> {customerDisplayPhone}</p>
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-1.5">
              <span className="font-bold text-[11px] text-slate-800 uppercase block">CHI TIẾT THUÊ KHO & TÀI CHÍNH</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-500 block">Ngăn kho:</span>
                  <strong className="text-cyan-800 font-mono">{contract.unitCode}</strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-500 block">Thời hạn thuê:</span>
                  <strong>{formatDate(contract.startDate)} - {formatDate(contract.endDate)}</strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-500 block">Giá thuê tháng:</span>
                  <strong className="text-emerald-700">{formatVnd(contract.monthlyFee)} đ</strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-500 block">Tiền đặt cọc:</span>
                  <strong className="text-cyan-700">{formatVnd(contract.depositHeld)} đ</strong>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-100/60 p-3 border border-slate-200 text-[11px] space-y-1">
              <strong className="text-slate-900 block font-semibold">Cam kết & Điều khoản chung:</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li>Bên B cam đoan không chứa hàng cấm, vũ khí, chất cháy nổ hoặc động vật sống.</li>
                <li>Hệ thống cấp mã PIN bảo mật cá nhân qua email ngay sau khi chữ ký điện tử được hoàn tất.</li>
                <li>Thời gian thanh toán định kỳ hàng tháng tuân thủ theo chính sách tự quản Boxora.</li>
              </ul>
            </div>
          </div>

          {/* Khu vực tạo chữ ký điện tử DocuSeal */}
          <div className="rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-cyan-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-cyan-700">draw</span>
                  Chữ ký điện tử của Bên Thuê (E-Signature)
                </h4>
                <p className="text-[11px] text-slate-500">Được chứng thực điện tử theo quy chuẩn an toàn Boxora e-Signature</p>
              </div>

              {/* Toggle chế độ ký */}
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSignatureMode('type')}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    signatureMode === 'type' ? 'bg-cyan-700 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ký theo tên
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('draw')}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    signatureMode === 'draw' ? 'bg-cyan-700 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vẽ chữ ký
                </button>
              </div>
            </div>

            {signatureMode === 'type' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Nhập họ và tên của bạn để tạo chữ ký"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                />
                <div className="flex h-20 items-center justify-center rounded-lg border border-cyan-200 bg-white shadow-inner">
                  <span className="font-serif italic text-2xl text-cyan-900 font-bold tracking-wider select-none">
                    {signerName || 'Chữ ký điện tử'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl border-2 border-cyan-300 bg-white shadow-inner overflow-hidden">
                  <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 select-none pointer-events-none">
                    <span className="material-symbols-outlined text-xs text-cyan-600">edit</span>
                    <span>Khung ký điện tử trực tiếp bằng chuột</span>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={130}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-32 bg-white cursor-crosshair touch-none"
                  />
                  {!hasDrawn && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 gap-1">
                      <span className="material-symbols-outlined text-2xl text-cyan-500/60 animate-bounce">draw</span>
                      <span className="font-medium text-slate-500">Vẽ chữ ký của bạn vào đây</span>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-6 right-6 border-b border-dashed border-slate-200 pointer-events-none"></div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {hasDrawn ? '✓ Đã ghi nhận nét ký của bạn' : 'Chưa vẽ chữ ký'}
                  </span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span> Xóa vẽ lại
                  </button>
                </div>
              </div>
            )}

            {/* Checkbox cam kết */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
              />
              <span className="text-xs text-slate-700">
                Tôi xác nhận rằng tôi đã đọc, hiểu và đồng ý toàn bộ điều khoản của Hợp đồng thuê kho tự quản Boxora. Chữ ký điện tử này có giá trị pháp lý đầy đủ. Thời hạn thuê và hiệu lực hợp đồng sẽ chính thức kích hoạt vào ngày tôi đến cơ sở hoàn tất check-in và nhận mã PIN.
              </span>
            </label>
          </div>
        </div>

        {/* Footer hành động */}
        <div className="bg-slate-50 px-6 py-3.5 flex items-center justify-between border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigning}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Hủy / Ký sau
          </button>

          <button
            type="button"
            onClick={handleConfirmSign}
            disabled={isSigning || !agreed}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-md transition-all ${
              isSigning || !agreed
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-700 text-white hover:bg-cyan-800 shadow-cyan-900/20 hover:shadow-lg'
            }`}
          >
            {isSigning ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang xác thực chữ ký điện tử...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>Hoàn Tất Ký Số & Kích Hoạt Kho</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
