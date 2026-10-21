import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { isRequestCanceled } from '../lib/apiError'

export interface UseAsyncDataOptions<T> {
  /** When false the fetcher is not called and any in-flight request is aborted. Default true. */
  enabled?: boolean
  /** Value of `data` until the first successful load (e.g. `[]`). */
  initialData?: T
  /** Keep the previous `data` on screen while new deps load. When false, data resets to initialData. Default true. */
  keepPreviousData?: boolean
}

export interface UseAsyncDataResult<T> {
  data: T | undefined
  /** Last error (cleared by the next successful load). Canceled requests never set it. */
  error: unknown
  /** True while loading and nothing has been loaded yet: show a skeleton. */
  isLoading: boolean
  /** True while re-fetching with previous data still on screen. */
  isRefreshing: boolean
  /** Re-runs the fetcher; resolves when it settles (never rejects). No-op while disabled. */
  reload: () => Promise<void>
  /** Local update after a mutation (optimistic edits, inserting a created row…). */
  setData: Dispatch<SetStateAction<T | undefined>>
}

/**
 * Loads async data with abort-on-change and stale-response protection.
 *
 *   const { data = [], error, isLoading, reload } = useAsyncData(
 *     (signal) => bookingService.getMyBookings(undefined, { signal }),
 *     [userId],
 *     { enabled: Boolean(userId) },
 *   )
 *
 * Pass `signal` through to axios so superseded requests are cancelled.
 * The fetcher may change every render; only `deps` trigger a new load.
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: UseAsyncDataOptions<T> = {}
): UseAsyncDataResult<T> {
  const { enabled = true, initialData, keepPreviousData = true } = options

  const [data, setDataState] = useState<T | undefined>(initialData)
  const [error, setError] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetcherRef = useRef(fetcher)
  const enabledRef = useRef(enabled)
  const keepPreviousRef = useRef(keepPreviousData)
  const initialDataRef = useRef(initialData)
  useLayoutEffect(() => {
    fetcherRef.current = fetcher
    enabledRef.current = enabled
    keepPreviousRef.current = keepPreviousData
  })

  const requestIdRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const hasLoadedRef = useRef(false)

  const run = useCallback(async (mode: 'load' | 'reload') => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = ++requestIdRef.current

    if (mode === 'load' && !keepPreviousRef.current) {
      hasLoadedRef.current = false
      setDataState(initialDataRef.current)
    }
    if (hasLoadedRef.current) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const result = await fetcherRef.current(controller.signal)
      if (requestId !== requestIdRef.current || controller.signal.aborted) return
      hasLoadedRef.current = true
      setDataState(result)
      setError(null)
    } catch (err) {
      if (requestId !== requestIdRef.current || controller.signal.aborted || isRequestCanceled(err)) return
      setError(err)
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort()
      requestIdRef.current += 1
      setIsLoading(false)
      setIsRefreshing(false)
      return undefined
    }
    void run('load')
    return () => {
      controllerRef.current?.abort()
    }
    // `deps` is the caller's dependency list, spread on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps])

  const reload = useCallback(async () => {
    if (!enabledRef.current) return
    await run('reload')
  }, [run])

  const setData = useCallback<Dispatch<SetStateAction<T | undefined>>>((value) => {
    hasLoadedRef.current = true
    setDataState(value)
  }, [])

  return { data, error, isLoading, isRefreshing, reload, setData }
}
