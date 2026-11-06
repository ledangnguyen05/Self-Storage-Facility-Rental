import { useEffect, useState } from 'react'

type Listener = (isLoading: boolean) => void

let isGateLoading = false
let activeForegroundRequests = 0
let minLoadingUntil = 0
let maxLoadingUntil = 0
let checkTimer: ReturnType<typeof setTimeout> | null = null
let silentWindowUntil = 0
let activeSilentSyncCount = 0

const listeners = new Set<Listener>()

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(isGateLoading)
    } catch {
      // ignore listener errors
    }
  })
}

function evaluateLoadingState() {
  if (checkTimer) {
    clearTimeout(checkTimer)
    checkTimer = null
  }

  const now = Date.now()

  // Safety cap so a slow/stalled tunnel request never blocks or blanks the UI
  if (now >= maxLoadingUntil) {
    activeForegroundRequests = 0
    if (isGateLoading) {
      isGateLoading = false
      notifyListeners()
    }
    return
  }

  const remainingMin = minLoadingUntil - now
  if (remainingMin > 0) {
    checkTimer = setTimeout(evaluateLoadingState, remainingMin + 15)
    return
  }

  if (activeForegroundRequests > 0) {
    const remainingMax = Math.min(120, Math.max(25, maxLoadingUntil - now))
    checkTimer = setTimeout(evaluateLoadingState, remainingMax)
    return
  }

  if (isGateLoading) {
    isGateLoading = false
    notifyListeners()
  }
}

/**
 * Mark an execution scope as a background silent sync so axios requests
 * fired inside it do not trigger or prolong the foreground tab loading gate.
 */
export function markSilentSyncWindow(durationMs = 800) {
  const until = Date.now() + durationMs
  if (until > silentWindowUntil) {
    silentWindowUntil = until
  }
}

export function beginSilentSync() {
  activeSilentSyncCount += 1
  markSilentSyncWindow(2500)
}

export function endSilentSync(lingerMs = 600) {
  activeSilentSyncCount = Math.max(0, activeSilentSyncCount - 1)
  markSilentSyncWindow(lingerMs)
}

export function isSilentSyncActive(): boolean {
  return activeSilentSyncCount > 0 || Date.now() < silentWindowUntil
}

/**
 * Trigger a subtle loading transition on explicit route change.
 * Never blocks or unmounts existing DOM content during background syncs.
 */
export function triggerTabDataLoading(minDurationMs = 150) {
  if (isSilentSyncActive()) return
  const now = Date.now()
  const cappedMin = Math.min(minDurationMs, 180)
  minLoadingUntil = Math.max(minLoadingUntil, now + cappedMin)
  maxLoadingUntil = now + 350
  if (!isGateLoading) {
    isGateLoading = true
    notifyListeners()
  }
  evaluateLoadingState()
}

export function incrementForegroundRequest() {
  if (isSilentSyncActive() || !isGateLoading) return false
  activeForegroundRequests += 1
  evaluateLoadingState()
  return true
}

export function decrementForegroundRequest(wasTracked: boolean) {
  if (!wasTracked) return
  activeForegroundRequests = Math.max(0, activeForegroundRequests - 1)
  if (isGateLoading) {
    evaluateLoadingState()
  }
}

export function subscribeTabDataLoading(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getIsTabDataLoading(): boolean {
  return isGateLoading
}

export function useTabDataLoading() {
  const [isLoading, setIsLoading] = useState<boolean>(() => getIsTabDataLoading())

  useEffect(() => {
    setIsLoading(getIsTabDataLoading())
    return subscribeTabDataLoading(setIsLoading)
  }, [])

  return {
    isTabLoading: isLoading,
    triggerTabDataLoading,
  }
}


