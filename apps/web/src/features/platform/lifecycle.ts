import { useCallback, useEffect, useRef, useState } from 'react'

export function usePlatformLifecycle(clear: () => void) {
  const scope = useRef({ generation: 0, mounted: false, connected: navigator.onLine })
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const lifetime = scope.current
    lifetime.mounted = true
    const invalidate = () => { lifetime.generation++; clear() }
    const connection = (event: Event) => {
      const connected = event.type === 'online'
      if (lifetime.connected === connected) return
      lifetime.connected = connected; setOnline(connected); invalidate()
    }
    window.addEventListener('platform-session-invalidated', invalidate)
    window.addEventListener('offline', connection); window.addEventListener('online', connection)
    return () => {
      lifetime.mounted = false; lifetime.generation++
      window.removeEventListener('platform-session-invalidated', invalidate)
      window.removeEventListener('offline', connection); window.removeEventListener('online', connection)
    }
  }, [clear])
  const begin = useCallback(() => ++scope.current.generation, [])
  const current = useCallback((token: number) => scope.current.mounted && navigator.onLine && scope.current.generation === token, [])
  // Locally detected invalid identity/scope must invalidate the outer shell too.
  const invalidate = useCallback(() => window.dispatchEvent(new CustomEvent('platform-session-invalidated', { detail: { status: 403 } })), [])
  return { online, begin, current, invalidate }
}
export const accessDenied = (failure: unknown) => [401, 403, 419].includes((failure as { status?: number })?.status ?? 0)
export function revealFocus(element: HTMLElement | null) {
  if (!element?.isConnected) return
  element.focus()
  const rectangle = element.getBoundingClientRect()
  const navigation = document.querySelector('.platform-phone-navigation')?.getBoundingClientRect()
  const bottom = navigation && navigation.height > 0 ? navigation.top : window.innerHeight
  if (rectangle.top < 0 || rectangle.bottom > bottom) element.scrollIntoView?.({ block: 'start' })
}
