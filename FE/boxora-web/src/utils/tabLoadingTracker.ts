import { useEffect, useState } from 'react'

type Listener = (isLoading: boolean) => void

let isGateLoading = true
let activeForegroundRequests = 0
let minLoadingUntil = Date.now() + 450
let maxLoadingUntil = Date.now() + 3000
let checkTimer: ReturnType<typeof setTimeout> | null = null
let silentWindowUntil = 0

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

  // Safety cap so a slow/stalled request never blocks the UI forever
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
    const remainingMax = Math.min(200, Math.max(30, maxLoadingUntil - now))
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
export function markSilentSyncWindow(durationMs = 250) {
  const until = Date.now() + durationMs
  if (until > silentWindowUntil) {
    silentWindowUntil = until
  }
}

export function isSilentSyncActive(): boolean {
  return Date.now() < silentWindowUntil
}

/**
 * Trigger the foreground loading indicator immediately (e.g. on F5, route change, or tab switch).
 * Guarantees the loading spinner runs first for at least `minDurationMs` AND until in-flight
 * foreground GET requests settle.
 */
export function triggerTabDataLoading(minDurationMs = 360) {
  const now = Date.now()
  minLoadingUntil = Math.max(minLoadingUntil, now + minDurationMs)
  maxLoadingUntil = now + 2800
  if (!isGateLoading) {
    isGateLoading = true
    notifyListeners()
  }
  evaluateLoadingState()
}

export function incrementForegroundRequest() {
  if (isSilentSyncActive()) return false
  activeForegroundRequests += 1
  if (isGateLoading) {
    evaluateLoadingState()
  }
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
    evaluateLoadingState()
    return subscribeTabDataLoading(setIsLoading)
  }, [])

  return {
    isTabLoading: isLoading,
    triggerTabDataLoading,
  }
}

// Kick off initial F5 loading gate evaluation on module load
evaluateLoadingState()

