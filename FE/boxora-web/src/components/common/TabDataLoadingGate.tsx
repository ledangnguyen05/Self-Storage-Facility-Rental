import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { triggerTabDataLoading, useTabDataLoading } from '../../utils/tabLoadingTracker'

interface TabDataLoadingGateProps {
  children: React.ReactNode
  minHeightClass?: string
}

export const BoxoraMinimalLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLanguage()
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 ${className}`}>
      <div className="relative h-8 w-8">
        <div className="h-8 w-8 rounded-full border-[2.5px] border-slate-200 dark:border-slate-800" />
        <div className="absolute inset-0 h-8 w-8 rounded-full border-[2.5px] border-transparent border-t-slate-900 dark:border-t-white animate-spin" />
      </div>
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
        {t('Đang tải...', 'Loading...')}
      </span>
    </div>
  )
}

export const TabDataLoadingGate: React.FC<TabDataLoadingGateProps> = ({
  children,
  minHeightClass = 'min-h-[60vh]',
}) => {
  const location = useLocation()
  const { isTabLoading } = useTabDataLoading()
  const prevRouteKeyRef = useRef<string>(`${location.pathname}${location.search}`)

  useEffect(() => {
    triggerTabDataLoading(380)
  }, [])

  useEffect(() => {
    const currentKey = `${location.pathname}${location.search}`
    if (prevRouteKeyRef.current !== currentKey) {
      prevRouteKeyRef.current = currentKey
      triggerTabDataLoading(320)
    }
  }, [location.pathname, location.search])

  return (
    <div className="relative w-full">
      {isTabLoading && (
        <div className={`w-full ${minHeightClass} flex items-center justify-center py-16`}>
          <BoxoraMinimalLoader />
        </div>
      )}

      <div
        className={
          isTabLoading
            ? 'opacity-0 pointer-events-none select-none h-0 overflow-hidden'
            : 'opacity-100 transition-opacity duration-150'
        }
      >
        {children}
      </div>
    </div>
  )
}

export default TabDataLoadingGate
