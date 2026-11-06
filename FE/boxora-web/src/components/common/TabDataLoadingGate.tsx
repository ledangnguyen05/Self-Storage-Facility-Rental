import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { triggerTabDataLoading } from '../../utils/tabLoadingTracker'

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
}) => {
  const location = useLocation()
  const prevPathnameRef = useRef<string>(location.pathname)

  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname
      triggerTabDataLoading(150)
    }
  }, [location.pathname])

  return (
    <div className="relative w-full">
      {children}
    </div>
  )
}

export default TabDataLoadingGate
