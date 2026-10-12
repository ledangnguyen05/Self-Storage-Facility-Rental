import React from 'react'
import { Link } from 'react-router-dom'
import { Box, Shield, Clock, MapPin } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#FFFFFF] border-t border-[#E5E5E1] py-16 mt-auto">
      <div className="max-w-[1280px] mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-4 text-left">
            <div className="flex items-center gap-2.5 text-[#111111] mb-4">
              <div className="w-7 h-7 rounded-[6px] bg-[#111111] text-[#FFFFFF] flex items-center justify-center font-bold text-[13px]">
                <Box size={16} />
              </div>
              <span className="font-display font-bold text-[17px] tracking-[-0.04em]">
                BOXORA<span className="text-[#2457FF]">.</span>
              </span>
            </div>
            <p className="text-[14px] text-[#555555] leading-relaxed max-w-[320px] mb-6">
              Next-generation self-storage infrastructure. Climate-controlled personal boxes, commercial warehouse suites, and 24/7 digital keypad access.
            </p>
            <div className="flex items-center gap-4 text-[12px] text-[#8A8A8A] font-mono">
              <span className="flex items-center gap-1.5"><Shield size={14} className="text-[#168A55]" /> ISO 27001 CCTV</span>
              <span className="flex items-center gap-1.5"><Clock size={14} /> 24/7 Digital Entry</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 text-left">
            <h4 className="text-[12px] font-semibold text-[#111111] uppercase tracking-wider mb-4 font-mono">
              Solutions & Sizing
            </h4>
            <ul className="space-y-2.5 text-[14px] text-[#555555]">
              <li><Link to="/facilities" className="hover:text-[#111111] transition-colors">Personal Mini Lockers (1m²)</Link></li>
              <li><Link to="/facilities" className="hover:text-[#111111] transition-colors">Studio Apartment Storage (3m²)</Link></li>
              <li><Link to="/facilities" className="hover:text-[#111111] transition-colors">Standard Household Rooms (6m²)</Link></li>
              <li><Link to="/facilities" className="hover:text-[#111111] transition-colors">E-Commerce Warehouse Suites (12m²)</Link></li>
            </ul>
          </div>

          {/* Facilities */}
          <div className="md:col-span-3 text-left">
            <h4 className="text-[12px] font-semibold text-[#111111] uppercase tracking-wider mb-4 font-mono">
              Locations (HCMC)
            </h4>
            <ul className="space-y-2.5 text-[14px] text-[#555555]">
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-[#8A8A8A] shrink-0 mt-1" />
                <span>District 1 — Central Landmark</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-[#8A8A8A] shrink-0 mt-1" />
                <span>Thu Duc — Saigon Hi-Tech Park</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-[#8A8A8A] shrink-0 mt-1" />
                <span>Binh Thanh — Riverside Facility</span>
              </li>
            </ul>
          </div>

          {/* Quick Access */}
          <div className="md:col-span-2 text-left">
            <h4 className="text-[12px] font-semibold text-[#111111] uppercase tracking-wider mb-4 font-mono">
              Portals
            </h4>
            <ul className="space-y-2.5 text-[14px] text-[#555555]">
              <li><Link to="/login" className="hover:text-[#111111] transition-colors">Customer Portal</Link></li>
              <li><Link to="/login" className="hover:text-[#111111] transition-colors">Staff Check-in App</Link></li>
              <li><Link to="/login" className="hover:text-[#111111] transition-colors">Facility Manager</Link></li>
              <li><Link to="/login" className="hover:text-[#111111] transition-colors">Admin Console</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#E5E5E1] flex flex-col sm:flex-row items-center justify-between text-[13px] text-[#8A8A8A]">
          <div>© 2026 Boxora Self-Storage Systems Inc. All rights reserved.</div>
          <div className="flex items-center gap-6 mt-4 sm:mt-0">
            <Link to="/terms" className="hover:text-[#111111] transition-colors">Chính sách bảo mật</Link>
            <Link to="/terms" className="hover:text-[#111111] transition-colors">Điều khoản dịch vụ</Link>
            <Link to="/terms" className="hover:text-[#111111] transition-colors">Quy chuẩn an toàn kho</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
