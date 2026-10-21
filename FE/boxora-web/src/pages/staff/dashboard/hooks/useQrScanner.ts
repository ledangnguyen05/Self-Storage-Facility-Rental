import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState, type CameraDevice } from 'html5-qrcode'

export type QrScannerStatus = 'idle' | 'starting' | 'scanning' | 'error'

interface UseQrScannerOptions {
  /** Id of the element html5-qrcode renders the camera into. Must be mounted while `enabled`. */
  elementId: string
  /** Camera runs only while true; turning it off stops the stream. */
  enabled: boolean
  onDecode: (text: string) => void
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

const BACK_CAMERA = /back|rear|environment|sau/i

function pickDefaultCamera(cameras: CameraDevice[]): CameraDevice | undefined {
  return cameras.find((camera) => BACK_CAMERA.test(camera.label)) ?? cameras[0]
}

function describeCameraError(err: unknown): string {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '')
  if (/NotAllowed|Permission/i.test(text)) return 'Trình duyệt chưa được cấp quyền dùng camera.'
  if (/NotFound|Requested device not found|no camera/i.test(text)) return 'Không tìm thấy camera trên thiết bị này.'
  if (/NotReadable|in use|Could not start video/i.test(text)) return 'Camera đang được ứng dụng khác sử dụng.'
  if (/secure|https/i.test(text)) return 'Camera chỉ hoạt động trên kết nối bảo mật (HTTPS).'
  return 'Không thể khởi động camera.'
}

/**
 * html5-qrcode with a sequenced lifecycle. Every start / stop / file scan runs
 * one after another on a queue, and each start belongs to a "session": closing
 * the dialog (or switching camera) while the camera is still starting stops it
 * as soon as start resolves, so the camera is never left on.
 */
export function useQrScanner({ elementId, enabled, onDecode }: UseQrScannerOptions) {
  const [status, setStatus] = useState<QrScannerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [cameraId, setCameraIdState] = useState('')

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const sessionRef = useRef(0)
  const mountedRef = useRef(true)
  const cameraIdRef = useRef('')
  const audioRef = useRef<AudioContext | null>(null)
  const onDecodeRef = useRef(onDecode)
  useLayoutEffect(() => {
    onDecodeRef.current = onDecode
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const audio = audioRef.current
      audioRef.current = null
      if (audio && audio.state !== 'closed') void audio.close().catch(() => undefined)
    }
  }, [])

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task, task)
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }, [])

  /** Runs inside the queue only. */
  const stopNow = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      const state = scanner.getState()
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop()
      }
    } catch {
      // Already stopped.
    }
    try {
      scanner.clear()
    } catch {
      // The container may already be gone.
    }
  }, [])

  const beep = useCallback(() => {
    try {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
      if (!Ctor) return
      const context = audioRef.current ?? new Ctor()
      audioRef.current = context
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, context.currentTime)
      gain.gain.setValueAtTime(0.15, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
      oscillator.start()
      oscillator.stop(context.currentTime + 0.18)
    } catch {
      // Audio is optional.
    }
  }, [])

  const start = useCallback(
    (preferredCameraId?: string) => {
      const session = ++sessionRef.current
      return enqueue(async () => {
        if (session !== sessionRef.current) return
        if (mountedRef.current) {
          setStatus('starting')
          setError(null)
        }
        await stopNow()
        try {
          let deviceId = preferredCameraId || cameraIdRef.current
          if (!deviceId) {
            const list = await Html5Qrcode.getCameras()
            if (session !== sessionRef.current) return
            if (mountedRef.current) setCameras(list)
            deviceId = pickDefaultCamera(list)?.id ?? ''
          }
          cameraIdRef.current = deviceId
          if (mountedRef.current) setCameraIdState(deviceId)

          const scanner = new Html5Qrcode(elementId, false)
          scannerRef.current = scanner
          let handled = false
          await scanner.start(
            deviceId || { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
              if (handled || session !== sessionRef.current) return
              handled = true
              sessionRef.current += 1
              beep()
              if (mountedRef.current) setStatus('idle')
              void enqueue(stopNow)
              onDecodeRef.current(decodedText)
            },
            undefined,
          )
          if (session !== sessionRef.current) {
            // Closed, restarted or decoded while the camera was starting.
            await stopNow()
            return
          }
          if (mountedRef.current) setStatus('scanning')
        } catch (err) {
          await stopNow()
          if (session !== sessionRef.current || !mountedRef.current) return
          setStatus('error')
          setError(describeCameraError(err))
        }
      })
    },
    [beep, elementId, enqueue, stopNow],
  )

  const stop = useCallback(() => {
    sessionRef.current += 1
    if (mountedRef.current) setStatus('idle')
    return enqueue(stopNow)
  }, [enqueue, stopNow])

  /** Switches camera: the running stream is stopped before the new one starts. */
  const selectCamera = useCallback(
    (id: string) => {
      cameraIdRef.current = id
      setCameraIdState(id)
      void start(id)
    },
    [start],
  )

  /** Decodes a QR image. The live camera is stopped first (html5-qrcode cannot do both). */
  const scanFile = useCallback(
    (file: File) => {
      sessionRef.current += 1
      setStatus('idle')
      return enqueue(async () => {
        await stopNow()
        const scanner = new Html5Qrcode(elementId, false)
        try {
          return await scanner.scanFile(file, false)
        } finally {
          try {
            scanner.clear()
          } catch {
            // Nothing rendered.
          }
        }
      })
    },
    [elementId, enqueue, stopNow],
  )

  useEffect(() => {
    if (!enabled) return undefined
    void start()
    return () => {
      void stop()
    }
  }, [enabled, start, stop])

  return { status, error, cameras, cameraId, selectCamera, restart: start, scanFile }
}
