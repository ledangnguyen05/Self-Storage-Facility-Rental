import React from 'react'
import { Link } from 'react-router-dom'
import { Box, Shield, Clock, MapPin, Phone, Mail, Award } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 pt-16 pb-12 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-4 text-left">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Box size={18} />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                BOXORA<span className="text-blue-600 dark:text-blue-400">.</span>
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mb-6">
              Hạ tầng cho thuê kho tự quản thông minh thế hệ mới. Kiểm soát nhiệt ẩm 24/7, khóa điện tử IoT chống sao chép và quản lý hợp đồng số minh bạch.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <Shield size={14} /> An ninh CCTV 24/7
              </span>
              <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                <Clock size={14} /> Mở khóa PIN/QR tức thì
              </span>
              <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <Award size={14} /> Tiêu chuẩn PCCC TCVN
              </span>
            </div>
          </div>

          {/* Storage Solutions */}
          <div className="md:col-span-3 text-left">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4">
              Kích Thước & Loại Kho
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link to="/booking" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Locker Cá Nhân XS (1m³ - Vali & Tài liệu)
                </Link>
              </li>
              <li>
                <Link to="/booking" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Kho Mini S (3m³ - Đồ đạc phòng trọ)
                </Link>
              </li>
              <li>
                <Link to="/booking" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Kho Gia Đình M & L (6 - 15m³ - Nội thất nhà)
                </Link>
              </li>
              <li>
                <Link to="/booking" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Kho Doanh Nghiệp XL (20 - 45m³ - Hàng TMĐT)
                </Link>
              </li>
            </ul>
          </div>

          {/* Locations */}
          <div className="md:col-span-3 text-left">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4">
              Cơ Sở Trực Thuộc (TP.HCM)
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>Boxora Q.1 — 123 Nguyễn Huệ, P. Bến Nghé</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>Boxora Q.7 — 456 Nguyễn Hữu Thọ, P. Tân Phong</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>Boxora TP. Thủ Đức — 789 Võ Văn Ngân, P. Linh Chiểu</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>Boxora Tân Bình — 102 Trường Sơn, P. 2</span>
              </li>
            </ul>
          </div>

          {/* Support & Portals */}
          <div className="md:col-span-2 text-left">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4">
              Hỗ Trợ & Cổng Portal
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400 mb-4">
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Cổng Khách Hàng
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Cổng Nhân Viên (Staff)
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Cổng Quản Lý Cơ Sở
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Tiêu Chuẩn & Nội Quy
                </Link>
              </li>
            </ul>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400" />
                <span>Hotline: 1900 8888</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail size={13} className="text-slate-400" />
                <span>support@boxora.vn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-4">
          <div>© 2026 Nền Tảng Boxora Smart Storage (StorageOps Pro). Bản quyền đã được bảo lưu.</div>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Chính sách bảo mật
            </Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Điều khoản thuê kho
            </Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Quy chuẩn an toàn cháy nổ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
