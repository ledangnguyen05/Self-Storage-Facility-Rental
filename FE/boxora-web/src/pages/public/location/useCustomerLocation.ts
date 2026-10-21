import { useCallback, useEffect, useRef, useState } from 'react'
import { geocodeAddressWithNominatim, getNominatimErrorMessage } from '../../../services/nominatimGeocodingService'

export interface CustomerLocation {
  lat: number
  lng: number
  displayName: string
}

export interface LocationNotice {
  tone: 'success' | 'info' | 'warning'
  message: string
}

/** Vietnamese explanation for each `GeolocationPositionError` code, with what the visitor can do next. */
export function describeGeolocationError(error: GeolocationPositionError | undefined): string {
  switch (error?.code) {
    case 1:
      return 'Trình duyệt đang chặn quyền truy cập vị trí. Hãy cho phép vị trí cho trang này (biểu tượng ổ khóa cạnh thanh địa chỉ) rồi thử lại, hoặc nhập địa chỉ của bạn.'
    case 2:
      return 'Thiết bị chưa xác định được vị trí. Hãy bật dịch vụ định vị hoặc nhập địa chỉ của bạn.'
    case 3:
      return 'Lấy vị trí quá thời gian. Vui lòng thử lại hoặc nhập địa chỉ của bạn.'
    default:
      return 'Không lấy được vị trí. Vui lòng thử lại hoặc nhập địa chỉ của bạn.'
  }
}

/**
 * The visitor's position for distance sorting: browser GPS ("Vị trí của tôi") or an address looked up on Nominatim.
 * Both only run on an explicit click or Enter, never on page load.
 */
export function useCustomerLocation(onLocated?: () => void) {
  const [location, setLocation] = useState<CustomerLocation | null>(null)
  const [address, setAddressState] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [notice, setNotice] = useState<LocationNotice | null>(null)

  const mountedRef = useRef(true)
  const onLocatedRef = useRef(onLocated)
  useEffect(() => {
    onLocatedRef.current = onLocated
  })
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setAddress = useCallback((value: string) => {
    setAddressState(value)
    // Editing the text invalidates the previously resolved position.
    setLocation(null)
    setNotice(null)
  }, [])

  const locateWithGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNotice({ tone: 'warning', message: 'Trình duyệt của bạn không hỗ trợ định vị. Hãy nhập địa chỉ để tìm cơ sở gần bạn.' })
      return
    }
    setIsLocating(true)
    setNotice(null)
    navigator.geolocation.getCurrentPosition(
      position => {
        if (!mountedRef.current) return
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, displayName: 'Vị trí hiện tại của bạn' })
        setAddressState('')
        setIsLocating(false)
        setNotice({ tone: 'success', message: 'Đã xác định vị trí của bạn.' })
        onLocatedRef.current?.()
      },
      error => {
        if (!mountedRef.current) return
        setIsLocating(false)
        setNotice({ tone: 'warning', message: describeGeolocationError(error) })
      },
      { timeout: 10_000, enableHighAccuracy: true, maximumAge: 60_000 },
    )
  }, [])

  const searchAddress = useCallback(async () => {
    const query = address.trim()
    if (!query) {
      setNotice({ tone: 'info', message: 'Nhập địa chỉ hoặc khu vực để tìm cơ sở gần bạn.' })
      return
    }
    setIsSearching(true)
    setNotice(null)
    try {
      const result = await geocodeAddressWithNominatim(query)
      if (!mountedRef.current) return
      setLocation(result)
      setAddressState(result.displayName)
      setNotice({ tone: 'success', message: `Đã xác định vị trí: ${result.displayName}` })
      onLocatedRef.current?.()
    } catch (error) {
      if (!mountedRef.current) return
      setLocation(null)
      setNotice({ tone: 'warning', message: getNominatimErrorMessage(error) })
    } finally {
      if (mountedRef.current) setIsSearching(false)
    }
  }, [address])

  const clear = useCallback(() => {
    setLocation(null)
    setAddressState('')
    setNotice(null)
  }, [])

  return { location, address, setAddress, isLocating, isSearching, notice, locateWithGps, searchAddress, clear }
}

export type CustomerLocationState = ReturnType<typeof useCustomerLocation>
