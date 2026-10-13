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
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw'>('type')
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
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
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
      const updated = await contractService.mockSignContract(contract.id)
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
        
        {/* Header mô phỏng DocuSeal */}
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
                  DocuSeal e-Sign Verification
                </span>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
                  Mô Phỏng Ký Số Trực Tuyến
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
                <p className="text-[11px] text-slate-500">Được chứng thực điện tử theo chuẩn DocuSeal e-Signature</p>
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
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={560}
                    height={100}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-24 rounded-lg border border-cyan-200 bg-white shadow-inner cursor-crosshair touch-none"
                  />
                  {!hasDrawn && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 italic">
                      Dùng chuột hoặc ngón tay để vẽ chữ ký của bạn tại đây...
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
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
                Tôi xác nhận rằng tôi đã đọc, hiểu và đồng ý toàn bộ điều khoản của Hợp đồng thuê kho tự quản Boxora. Chữ ký điện tử này có giá trị pháp lý đầy đủ.
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
                <span>Đang xác thực chữ ký DocuSeal...</span>
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
