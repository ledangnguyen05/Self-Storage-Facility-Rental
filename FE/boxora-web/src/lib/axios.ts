import axios, { AxiosResponse } from 'axios'
import { broadcastDataSync } from '../hooks/useRealtimeSync'
import { incrementForegroundRequest, decrementForegroundRequest } from '../utils/tabLoadingTracker'

let runtimeHealthyBaseUrl: string | null = null
let activeFailoverPromise: Promise<string | null> | null = null
let manifestServerInstanceId: string | null = null

const normalizeBaseUrl = (url: string | null | undefined): string => {
  return (url || '').trim().replace(/\/+$/, '')
}

// Per-browser session/auth/UI keys that must NOT be overwritten across different users/computers
const LOCAL_SESSION_ONLY_KEYS = new Set([
  'boxora_access_token',
  'boxora_refresh_token',
  'boxora_user',
  'boxora_user_permissions',
  'boxora_api_url',
  'boxora_env_api_url',
  'boxora_last_sync_event',
  'boxora_booking_draft',
  'boxora_selected_facility_id',
  'boxora_admin_selected_facility_id',
  'boxora_discounts_last_sync',
  'boxora_facility_unittypes_last_sync',
  'boxora_theme',
  'boxora_lang',
  'boxora_language',
  'boxora_web_settings',
  'boxora_ai_chat_history',
  'boxora_read_notification_ids',
  'boxora_bound_server_instance_id',
])

const isSharedBusinessKey = (key: string | null | undefined): boolean => {
  if (!key) return false
  if (LOCAL_SESSION_ONLY_KEYS.has(key)) return false
  return key.startsWith('boxora_')
}

// Sync build-time VITE_API_BASE_URL when a fresh deployment updates the bundle
if (typeof window !== 'undefined') {
  try {
    const envUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
    const params = new URLSearchParams(window.location.search)
    const queryApi = normalizeBaseUrl(params.get('api'))
    if (queryApi) {
      sessionStorage.setItem('boxora_api_url', queryApi)
      localStorage.setItem('boxora_api_url', queryApi)
    } else if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      const prevEnvUrl = sessionStorage.getItem('boxora_env_api_url')
      if (prevEnvUrl !== envUrl) {
        sessionStorage.setItem('boxora_env_api_url', envUrl)
        sessionStorage.setItem('boxora_api_url', envUrl)
        localStorage.setItem('boxora_api_url', envUrl)
      }
    }
  } catch {
    // Ignore storage access errors in restricted webviews
  }
}

export const getApiBaseUrl = (): string => {
  const envUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        return envUrl
      }
      return 'http://localhost:8080'
    }

    // Priority 1: Runtime-verified healthy endpoint (tunnel or verified host loopback)
    if (runtimeHealthyBaseUrl) {
      return runtimeHealthyBaseUrl
    }

    // Priority 2: ?api= query param (set by start_demo_online.bat)
    const params = new URLSearchParams(window.location.search)
    const queryApi = normalizeBaseUrl(params.get('api'))
    if (queryApi) {
      try {
        sessionStorage.setItem('boxora_api_url', queryApi)
        if (localStorage.getItem('boxora_api_url') !== queryApi) {
          localStorage.setItem('boxora_api_url', queryApi)
        }
      } catch {}
      return queryApi
    }

    // Priority 3: VITE_API_BASE_URL from build-time env (always fresher than old localStorage when opening without ?api=)
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl
    }

    // Priority 4: Session tunnel URL in current tab
    try {
      const sessionApi = normalizeBaseUrl(sessionStorage.getItem('boxora_api_url'))
      if (sessionApi) {
        return sessionApi
      }
    } catch {}

    // Priority 5: localStorage fallback
    try {
      const saved = normalizeBaseUrl(localStorage.getItem('boxora_api_url'))
      if (saved) return saved
    } catch {}
  }
  return envUrl || 'http://localhost:8080'
}

interface ManifestConfig {
  apiBaseUrl: string | null
  serverInstanceId: string | null
}

const fetchManifestConfig = async (): Promise<ManifestConfig> => {
  if (typeof window === 'undefined') return { apiBaseUrl: null, serverInstanceId: null }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch(`/api-config.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return { apiBaseUrl: null, serverInstanceId: null }
    const data = await res.json()
    const apiBaseUrl = normalizeBaseUrl(data?.apiBaseUrl) || null
    const serverInstanceId = (data?.serverInstanceId || '').trim() || null
    if (serverInstanceId) {
      manifestServerInstanceId = serverInstanceId
    }
    return { apiBaseUrl, serverInstanceId }
  } catch {
    return { apiBaseUrl: null, serverInstanceId: null }
  } finally {
    clearTimeout(timer)
  }
}

const probeEndpointHealth = async (
  baseUrl: string,
  timeoutMs = 2500,
  expectedInstanceId?: string | null
): Promise<boolean> => {
  const clean = normalizeBaseUrl(baseUrl)
  if (!clean) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // If we need to verify that localhost:8080 is actually the demo host PC (and NOT another teammate's local DB)
    if (expectedInstanceId) {
      const stateRes = await fetch(`${clean}/api/v1/shared-state`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!stateRes.ok) return false
      const stateData = await stateRes.json()
      return stateData?.serverInstanceId === expectedInstanceId
    }

    const response = await fetch(`${clean}/api/v1/facilities`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) return false
    const contentType = response.headers.get('content-type') || ''
    return contentType.includes('application/json')
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

const discoverHealthyApiUrl = async (failedUrl?: string): Promise<string | null> => {
  if (typeof window === 'undefined') return null
  if (activeFailoverPromise) return activeFailoverPromise

  activeFailoverPromise = (async () => {
    try {
      const manifest = await fetchManifestConfig()
      const envUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
      const params = new URLSearchParams(window.location.search)
      const queryApi = normalizeBaseUrl(params.get('api'))
      let sessionApi = ''
      let savedApi = ''
      try {
        sessionApi = normalizeBaseUrl(sessionStorage.getItem('boxora_api_url'))
        savedApi = normalizeBaseUrl(localStorage.getItem('boxora_api_url'))
      } catch {}

      // 1. If this machine IS the demo host machine (verified via serverInstanceId), localhost:8080 is 100% identical DB & Wi-Fi immune
      if (manifest.serverInstanceId) {
        if (await probeEndpointHealth('http://localhost:8080', 1200, manifest.serverInstanceId)) {
          runtimeHealthyBaseUrl = 'http://localhost:8080'
          return runtimeHealthyBaseUrl
        }
      }

      // 2. Otherwise (or on any other computer!), ALWAYS connect to the shared Cloudflare Tunnel of the host machine
      const tunnelCandidates = Array.from(
        new Set(
          [manifest.apiBaseUrl, queryApi, envUrl, sessionApi, savedApi].filter(
            (u) => u && !u.includes('localhost') && !u.includes('127.0.0.1')
          ) as string[]
        )
      )

      const orderedTunnels = [
        ...tunnelCandidates.filter((c) => c !== normalizeBaseUrl(failedUrl)),
        ...tunnelCandidates.filter((c) => c === normalizeBaseUrl(failedUrl)),
      ]

      for (const candidate of orderedTunnels) {
        if (await probeEndpointHealth(candidate, 4000)) {
          runtimeHealthyBaseUrl = candidate
          try {
            sessionStorage.setItem('boxora_api_url', candidate)
            localStorage.setItem('boxora_api_url', candidate)
          } catch {}
          return candidate
        }
      }

      // 3. Final fallback: if all remote tunnels are blocked by firewall and localhost:8080 is available
      if (await probeEndpointHealth('http://localhost:8080', 1500)) {
        runtimeHealthyBaseUrl = 'http://localhost:8080'
        return runtimeHealthyBaseUrl
      }

      return null
    } finally {
      activeFailoverPromise = null
    }
  })()

  return activeFailoverPromise
}

// ============================================================================
// REAL-TIME POSTGRESQL SHARED STATE SYNCHRONIZER (CROSS-MACHINE DB CONSISTENCY)
// Ensures all computers see the exact same data from the Host PC's PostgreSQL DB
// ============================================================================
let isApplyingRemoteState = false
let isSyncingSharedState = false
let initialSharedStateSynced = false
let rawLocalStorageSetItem: ((key: string, value: string) => void) | null = null
let rawLocalStorageRemoveItem: ((key: string) => void) | null = null
let pendingUpserts: Record<string, string> = {}
let pendingRemovals = new Set<string>()
let flushTimer: number | null = null
let lastKnownServerUpdatedAt = 0
let lastLocalFlushCompletedAt = 0
let lastFailoverProbeAt = 0

const notifyAllComponentsOfRemoteChange = () => {
  if (typeof window === 'undefined') return
  broadcastDataSync('/api/v1/shared-state', 'sync')
  window.dispatchEvent(new Event('storage'))
}

const flushPendingSharedState = async () => {
  if (typeof window === 'undefined' || !initialSharedStateSynced) return
  const upsertsToSend = { ...pendingUpserts }
  const removalsToSend = Array.from(pendingRemovals)
  pendingUpserts = {}
  pendingRemovals.clear()

  if (Object.keys(upsertsToSend).length === 0 && removalsToSend.length === 0) {
    return
  }

  try {
    const baseUrl = getApiBaseUrl()
    const res = await fetch(`${baseUrl}/api/v1/shared-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        upsert: upsertsToSend,
        remove: removalsToSend,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (typeof data?.updatedAt === 'number' && data.updatedAt > lastKnownServerUpdatedAt) {
        lastKnownServerUpdatedAt = data.updatedAt
      }
      lastLocalFlushCompletedAt = Date.now()
    }
  } catch {
    // Re-queue if network failed transiently
    for (const [k, v] of Object.entries(upsertsToSend)) {
      if (!(k in pendingUpserts) && !pendingRemovals.has(k)) {
        pendingUpserts[k] = v
      }
    }
  }
}

const scheduleSharedStateFlush = () => {
  if (typeof window === 'undefined' || !initialSharedStateSynced) return
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer)
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flushPendingSharedState()
  }, 150)
}

export const syncSharedStateWithBackend = async (isInitialBoot = false, forceNotify = false): Promise<void> => {
  if (typeof window === 'undefined' || !rawLocalStorageSetItem || !rawLocalStorageRemoveItem) return
  if (isSyncingSharedState && !isInitialBoot) return
  isSyncingSharedState = true
  try {
    const baseUrl = getApiBaseUrl()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    let res: Response
    try {
      res = await fetch(`${baseUrl}/api/v1/shared-state`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) return
    const data = await res.json()
    const serverInstanceId: string | undefined = data?.serverInstanceId
    const serverUpdatedAt: number = Number(data?.updatedAt || 0)
    const serverEntries: Record<string, string> = data?.entries || {}

    const isHostBrowser =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      runtimeHealthyBaseUrl === 'http://localhost:8080'

    const prevBoundInstance = window.localStorage.getItem('boxora_bound_server_instance_id')
    const instanceChanged = Boolean(serverInstanceId && prevBoundInstance !== serverInstanceId)

    // Case 1: The Host PC's PostgreSQL shared_client_state table has no business entries yet.
    // Seed PostgreSQL with the existing shared business keys from the browser.
    if (Object.keys(serverEntries).length === 0 && serverUpdatedAt === 0) {
      const initialSeed: Record<string, string> = {}
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && isSharedBusinessKey(k)) {
          const v = window.localStorage.getItem(k)
          if (v !== null) initialSeed[k] = v
        }
      }
      if (serverInstanceId) {
        rawLocalStorageSetItem('boxora_bound_server_instance_id', serverInstanceId)
      }
      initialSharedStateSynced = true
      if (Object.keys(initialSeed).length > 0) {
        const seedRes = await fetch(`${baseUrl}/api/v1/shared-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ upsert: initialSeed }),
        })
        if (seedRes.ok) {
          const seedData = await seedRes.json()
          lastKnownServerUpdatedAt = Number(seedData?.updatedAt || 0)
        }
      }
      return
    }

    const serverRevisionAdvanced = serverUpdatedAt > 0 && serverUpdatedAt !== lastKnownServerUpdatedAt

    // Skip if nothing changed on server since last sync
    if (!isInitialBoot && !instanceChanged && !serverRevisionAdvanced && serverUpdatedAt > 0) {
      return
    }

    isApplyingRemoteState = true
    let hasChanges = false
    try {
      if (serverInstanceId && instanceChanged) {
        rawLocalStorageSetItem('boxora_bound_server_instance_id', serverInstanceId)
      }

      // If this was the initial boot before initialSharedStateSynced, discard any mount-time defaults
      // for keys that already exist in PostgreSQL so a newly opened browser never overwrites DB state
      if (!initialSharedStateSynced) {
        for (const k of Object.keys(serverEntries)) {
          delete pendingUpserts[k]
          pendingRemovals.delete(k)
        }
      }

      // 1. Reconcile local keys that do not exist in serverEntries
      const currentLocalKeys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && isSharedBusinessKey(k)) {
          currentLocalKeys.push(k)
        }
      }
      for (const localKey of currentLocalKeys) {
        if (!(localKey in serverEntries) && !(localKey in pendingUpserts)) {
          if (isInitialBoot && isHostBrowser && instanceChanged) {
            // Preserve Host PC's pre-existing local keys on first bind and merge them to PostgreSQL
            const existingHostVal = window.localStorage.getItem(localKey)
            if (existingHostVal !== null) {
              pendingUpserts[localKey] = existingHostVal
            }
          } else {
            rawLocalStorageRemoveItem(localKey)
            hasChanges = true
          }
        }
      }

      // 2. Apply all authoritative entries from the Host PC's PostgreSQL DB
      for (const [k, serverVal] of Object.entries(serverEntries)) {
        if (!isSharedBusinessKey(k) || k in pendingUpserts || pendingRemovals.has(k)) continue
        const currentVal = window.localStorage.getItem(k)
        if (currentVal !== serverVal) {
          rawLocalStorageSetItem(k, serverVal)
          hasChanges = true
        }
      }

      lastKnownServerUpdatedAt = serverUpdatedAt
    } finally {
      isApplyingRemoteState = false
      initialSharedStateSynced = true
    }

    if (Object.keys(pendingUpserts).length > 0 || pendingRemovals.size > 0) {
      scheduleSharedStateFlush()
    }

    const isEchoOfOwnFlush = !hasChanges && Date.now() - lastLocalFlushCompletedAt < 1200
    if ((hasChanges || (serverRevisionAdvanced && !isEchoOfOwnFlush) || (forceNotify && hasChanges)) && !isInitialBoot) {
      notifyAllComponentsOfRemoteChange()
    } else if (isInitialBoot && hasChanges) {
      notifyAllComponentsOfRemoteChange()
    }
  } catch {
    initialSharedStateSynced = true
  } finally {
    isSyncingSharedState = false
  }
}

let activeEventSource: EventSource | null = null
let activeEventSourceUrl = ''
let sseReconnectTimer: number | null = null

const connectRealtimeSseStream = () => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return
  const baseUrl = getApiBaseUrl()
  const streamUrl = `${baseUrl}/api/v1/shared-state/stream`

  if (activeEventSource && activeEventSourceUrl === streamUrl && activeEventSource.readyState !== EventSource.CLOSED) {
    return
  }

  if (activeEventSource) {
    try {
      activeEventSource.close()
    } catch {}
    activeEventSource = null
  }

  try {
    const es = new EventSource(streamUrl)
    activeEventSource = es
    activeEventSourceUrl = streamUrl

    es.addEventListener('sync', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        if (typeof payload?.updatedAt === 'number' && payload.updatedAt === lastKnownServerUpdatedAt) {
          return
        }
      } catch {}
      void syncSharedStateWithBackend(false, false)
    })

    es.addEventListener('connected', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        if (typeof payload?.updatedAt === 'number' && payload.updatedAt > lastKnownServerUpdatedAt) {
          void syncSharedStateWithBackend(false, false)
        }
      } catch {}
    })

    es.onerror = () => {
      try {
        es.close()
      } catch {}
      if (activeEventSource === es) {
        activeEventSource = null
      }
      if (sseReconnectTimer !== null) {
        window.clearTimeout(sseReconnectTimer)
      }
      sseReconnectTimer = window.setTimeout(() => {
        sseReconnectTimer = null
        connectRealtimeSseStream()
      }, 5000)
    }
  } catch {
    // Fallback polling handles synchronization if SSE is blocked
  }
}

if (typeof window !== 'undefined' && window.localStorage) {
  rawLocalStorageSetItem = window.localStorage.setItem.bind(window.localStorage)
  rawLocalStorageRemoveItem = window.localStorage.removeItem.bind(window.localStorage)

  window.localStorage.setItem = function (key: string, value: string) {
    const nextVal = String(value)
    const prevVal = window.localStorage.getItem(key)
    rawLocalStorageSetItem!(key, nextVal)
    if (!isApplyingRemoteState && isSharedBusinessKey(key) && prevVal !== nextVal) {
      pendingRemovals.delete(key)
      pendingUpserts[key] = nextVal
      scheduleSharedStateFlush()
    }
  }

  window.localStorage.removeItem = function (key: string) {
    const existed = window.localStorage.getItem(key) !== null
    rawLocalStorageRemoveItem!(key)
    if (!isApplyingRemoteState && isSharedBusinessKey(key) && existed) {
      delete pendingUpserts[key]
      pendingRemovals.add(key)
      scheduleSharedStateFlush()
    }
  }

  // Boot sequence: discover exact Host PC Backend endpoint, pull shared PostgreSQL state, and open SSE stream
  void (async () => {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      await discoverHealthyApiUrl()
    }
    await syncSharedStateWithBackend(true)
    connectRealtimeSseStream()
  })()

  // Quiet background cross-machine fallback sync (SSE handles instant <50ms updates)
  window.setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    void syncSharedStateWithBackend(false)
    connectRealtimeSseStream()
  }, 60000)

  window.addEventListener('focus', () => {
    void syncSharedStateWithBackend(false)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncSharedStateWithBackend(false)
    }
  })
}

// ============================================================================
// IN-FLIGHT REQUEST COALESCING, LIGHTWEIGHT CACHING & DIAGNOSTIC LOGGING
// ============================================================================
const isDevLogging = Boolean(import.meta.env?.DEV) || (typeof window !== 'undefined' && Boolean((window as any).BOXORA_API_DEBUG))

const inFlightGetRequests = new Map<string, Promise<any>>()
const recentGetCache = new Map<string, { data: any; status: number; statusText: string; headers: any; timestamp: number }>()
const GET_CACHE_TTL_MS = 15000 // 15-second short-lived cache for GET requests

export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    recentGetCache.clear()
    return
  }
  for (const key of recentGetCache.keys()) {
    if (key.includes(pattern)) {
      recentGetCache.delete(key)
    }
  }
}

const sanitizeUrlForLog = (url: string, params?: any): string => {
  let cleanUrl = url || ''
  if (params && typeof params === 'object') {
    const safeParams: Record<string, any> = {}
    for (const [k, v] of Object.entries(params)) {
      if (/token|password|secret|auth|credit|cvv/i.test(k)) {
        safeParams[k] = '***'
      } else {
        safeParams[k] = v
      }
    }
    const query = new URLSearchParams(safeParams as any).toString()
    if (query) cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + query
  }
  return cleanUrl
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

const originalApiRequest = api.request.bind(api)

api.request = (function <T = any, R = AxiosResponse<T>, D = any>(
  configOrUrl: any,
  maybeConfig?: any
): Promise<R> {
  const config = typeof configOrUrl === 'string'
    ? { ...(maybeConfig || {}), url: configOrUrl }
    : { ...(configOrUrl || {}) }

  const method = (config.method || 'get').toLowerCase()

  if (method !== 'get') {
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      invalidateApiCache()
    }
    const startTime = performance.now()
    const cleanUrl = sanitizeUrlForLog(config.url || '', config.params)
    if (isDevLogging) {
      console.debug(`%c[API REQ] ${method.toUpperCase()} ${cleanUrl}`, 'color: #3b82f6; font-weight: bold;', {
        startTime: new Date().toLocaleTimeString(),
      })
    }
    return (originalApiRequest(config) as unknown as Promise<R>)
      .then((res: any) => {
        const duration = Math.round(performance.now() - startTime)
        if (isDevLogging) {
          console.debug(`%c[API RES] ${method.toUpperCase()} ${cleanUrl} - ${res.status} (${duration}ms)`, 'color: #10b981; font-weight: bold;')
        }
        return res
      })
      .catch((err: any) => {
        const duration = Math.round(performance.now() - startTime)
        if (isDevLogging) {
          console.debug(`%c[API ERR] ${method.toUpperCase()} ${cleanUrl} - ${err.response?.status || 'FAILED'} (${duration}ms)`, 'color: #ef4444; font-weight: bold;')
        }
        throw err
      })
  }

  // Check if bypass requested
  if ((config as any).skipCache || (config as any).skipDedup) {
    return originalApiRequest(config) as unknown as Promise<R>
  }

  const cleanUrl = sanitizeUrlForLog(config.url || '', config.params)
  const cacheKey = cleanUrl

  // 1. Check TTL cache
  const cached = recentGetCache.get(cacheKey)
  const now = Date.now()
  if (cached && now - cached.timestamp < GET_CACHE_TTL_MS) {
    if (isDevLogging) {
      console.debug(`%c[API CACHE] GET ${cacheKey} (served from 15s cache)`, 'color: #8b5cf6; font-weight: bold;')
    }
    return Promise.resolve({
      data: cached.data,
      status: cached.status,
      statusText: cached.statusText,
      headers: cached.headers,
      config,
    } as unknown as R)
  }

  // 2. Check in-flight deduplication
  if (inFlightGetRequests.has(cacheKey)) {
    if (isDevLogging) {
      console.debug(`%c[API DEDUP] Coalesced concurrent GET: ${cacheKey}`, 'color: #f59e0b; font-weight: bold;')
    }
    return inFlightGetRequests.get(cacheKey)! as unknown as Promise<R>
  }

  // 3. Initiate request
  const startTime = performance.now()
  if (isDevLogging) {
    console.debug(`%c[API REQ] GET ${cacheKey}`, 'color: #3b82f6; font-weight: bold;', {
      startTime: new Date().toLocaleTimeString(),
    })
  }

  const promise = (originalApiRequest(config) as unknown as Promise<R>)
    .then((response: any) => {
      const duration = Math.round(performance.now() - startTime)
      if (isDevLogging) {
        console.debug(`%c[API RES] GET ${cacheKey} - ${response.status} (${duration}ms)`, 'color: #10b981; font-weight: bold;')
      }
      recentGetCache.set(cacheKey, {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        timestamp: Date.now(),
      })
      return response
    })
    .catch((error: any) => {
      const duration = Math.round(performance.now() - startTime)
      if (isDevLogging) {
        console.debug(`%c[API ERR] GET ${cacheKey} - ${error.response?.status || 'FAILED'} (${duration}ms)`, 'color: #ef4444; font-weight: bold;')
      }
      throw error
    })
    .finally(() => {
      inFlightGetRequests.delete(cacheKey)
    })

  inFlightGetRequests.set(cacheKey, promise)
  return promise
}) as any

// Request Interceptor: Attach JWT Token and sync dynamic baseURL
api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl()
    const token = localStorage.getItem('boxora_access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const method = (config.method || 'get').toLowerCase()
    if (method === 'get') {
      ;(config as any)._trackedForegroundLoad = incrementForegroundRequest()
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: Handle 401 & Token Refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => {
    if ((response.config as any)?._trackedForegroundLoad) {
      ;(response.config as any)._trackedForegroundLoad = false
      decrementForegroundRequest(true)
    }
    const method = (response.config?.method || '').toLowerCase()
    const url = response.config?.url || ''
    const isAuthOnly =
      url.includes('/api/v1/auth/refresh-token') ||
      url.includes('/api/v1/auth/login') ||
      url.includes('/api/v1/auth/captcha') ||
      url.includes('/api/v1/shared-state')
    const isVNPayVerify = url.includes('/vnpay-verify') || url.includes('/vnpay-return')
    if ((!isAuthOnly && ['post', 'put', 'patch', 'delete'].includes(method)) || isVNPayVerify) {
      invalidateApiCache()
      broadcastDataSync(url, method)
      pendingUpserts['boxora_last_cluster_mutation'] = JSON.stringify({
        url,
        method,
        ts: Date.now(),
      })
      scheduleSharedStateFlush()
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config
    if (originalRequest?._trackedForegroundLoad) {
      originalRequest._trackedForegroundLoad = false
      decrementForegroundRequest(true)
    }

    const status = error.response?.status
    const isNetworkOrTunnelError =
      !error.response || status === 502 || status === 503 || status === 504 || status === 530

    if (
      isNetworkOrTunnelError &&
      originalRequest &&
      !originalRequest._apiFailoverRetried &&
      Date.now() - lastFailoverProbeAt > 10000
    ) {
      lastFailoverProbeAt = Date.now()
      originalRequest._apiFailoverRetried = true
      const recoveredBaseUrl = await discoverHealthyApiUrl(originalRequest.baseURL)
      if (recoveredBaseUrl) {
        originalRequest.baseURL = recoveredBaseUrl
        return api(originalRequest)
      }
    }

    // CRITICAL: NEVER treat 403 Forbidden as an auth/session expiration!
    // 403 means user is authenticated but not authorized for this specific operation.
    // Purging tokens on 403 breaks valid active sessions.
    const isUnauthorized = status === 401

    if (
      isUnauthorized &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/v1/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers = originalRequest.headers || {}
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(api(originalRequest))
            },
            reject: (err) => reject(err),
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('boxora_refresh_token')
      try {
        const res = await axios.post(
          `${getApiBaseUrl()}/api/v1/auth/refresh-token`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true }
        )
        const newAccessToken = res.data?.data?.accessToken
        const newRefreshToken = res.data?.data?.refreshToken
        if (newAccessToken) {
          localStorage.setItem('boxora_access_token', newAccessToken)
          if (newRefreshToken) {
            localStorage.setItem('boxora_refresh_token', newRefreshToken)
          }
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          processQueue(null, newAccessToken)
          return api(originalRequest)
        }
      } catch (refreshErr: any) {
        processQueue(refreshErr, null)
        const refreshStatus = refreshErr?.response?.status
        if (refreshStatus === 401 || refreshStatus === 400) {
          localStorage.removeItem('boxora_access_token')
          localStorage.removeItem('boxora_refresh_token')
          localStorage.removeItem('boxora_user')
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('boxora_auth_expired'))
          }
        }
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
