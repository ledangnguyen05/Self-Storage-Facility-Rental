import React, { useEffect, useState } from 'react'
import { ArrowUp, Headset, Mail, MapPin, MessageCircle, Phone, RotateCcw } from 'lucide-react'
import { SITE_CONFIG } from '../../constants/siteConfig'
import { buildDirectionsUrl } from '../../data/storageUnitsData'
import { useAsyncData } from '../../hooks/useAsyncData'
import { toNumber } from '../../lib/format'
import { facilityService } from '../../services/facilityService'
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, IconButton } from '../ui'

const SCROLL_TOP_THRESHOLD = 400

const openExternal = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Contact menu (hotline, Zalo, email, then the real branches with a directions link each) and a scroll-to-top
 * button. It sits directly above the chat button (BoxoraChatWidget, bottom-right
 * `bottom-4 sm:bottom-6`) so the two never overlap.
 */
export const FloatingContactWidget: React.FC = () => {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [menuOpened, setMenuOpened] = useState(false)
  const { hotline, headquarters, social, supportEmail, supportEmailHref } = SITE_CONFIG

  // Branches come from the public facility list and are only requested the first time the menu opens.
  const branches = useAsyncData(signal => facilityService.getPublicFacilities({ signal }), [], { enabled: menuOpened })

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > SCROLL_TOP_THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  const branchItems = (() => {
    if (branches.error) {
      return (
        <>
          <DropdownMenuItem icon={RotateCcw} description="Bấm để tải lại danh sách chi nhánh" keepOpen onSelect={() => void branches.reload()}>
            Không tải được chi nhánh
          </DropdownMenuItem>
          <DropdownMenuItem icon={MapPin} description={headquarters.name} onSelect={() => openExternal(headquarters.mapUrl)}>
            Chỉ đường tới trụ sở
          </DropdownMenuItem>
        </>
      )
    }
    if (branches.isLoading || !branches.data) {
      return <DropdownMenuItem disabled>Đang tải chi nhánh…</DropdownMenuItem>
    }
    if (branches.data.length === 0) {
      return <DropdownMenuItem disabled>Chưa có chi nhánh đang mở</DropdownMenuItem>
    }
    return branches.data.map(facility => {
      const lat = toNumber(facility.latitude)
      const lng = toNumber(facility.longitude)
      const address = [facility.address, facility.city].filter(Boolean).join(', ')
      const target = lat != null && lng != null ? { lat, lng } : address
      return (
        <DropdownMenuItem
          key={facility.id}
          icon={MapPin}
          description={address || undefined}
          disabled={!target}
          onSelect={() => target && openExternal(buildDirectionsUrl(target))}
        >
          {facility.name} · Chỉ đường
        </DropdownMenuItem>
      )
    })
  })()

  return (
    <div className="fixed bottom-18 right-5 z-40 flex flex-col items-center gap-2 sm:bottom-20 sm:right-7 print:hidden">
      {showScrollTop ? (
        <IconButton
          icon={ArrowUp}
          variant="secondary"
          size="lg"
          aria-label="Cuộn lên đầu trang"
          tooltip
          tooltipSide="left"
          className="rounded-full shadow-md"
          onClick={scrollToTop}
        />
      ) : null}

      <DropdownMenu
        side="top"
        align="end"
        aria-label="Liên hệ Boxora"
        className="w-80 max-h-[70vh] overflow-y-auto"
        onOpenChange={open => {
          if (open) setMenuOpened(true)
        }}
        trigger={
          <IconButton
            icon={Headset}
            variant="secondary"
            size="lg"
            aria-label="Liên hệ Boxora"
            className="rounded-full shadow-md"
          />
        }
      >
        <DropdownMenuLabel>Liên hệ Boxora</DropdownMenuLabel>
        <DropdownMenuItem
          icon={Phone}
          description={`${hotline.display} · ${hotline.hours}`}
          onSelect={() => window.location.assign(hotline.href)}
        >
          Gọi hotline
        </DropdownMenuItem>
        {social.zalo ? (
          <DropdownMenuItem icon={MessageCircle} description="Tư vấn qua Zalo" onSelect={() => openExternal(social.zalo)}>
            Nhắn tin Zalo
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem icon={Mail} description={supportEmail} onSelect={() => window.location.assign(supportEmailHref)}>
          Gửi email
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Chi nhánh</DropdownMenuLabel>
        {branchItems}
      </DropdownMenu>
    </div>
  )
}

export default FloatingContactWidget
