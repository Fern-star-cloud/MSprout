import { useEffect, useState } from 'react'

function ConnectionIcon({ online }: { online: boolean }) {
  return online ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path d="m4 4 16 16M5 12.5a10 10 0 0 1 5-2.6M14 9.8a10 10 0 0 1 5 2.7M9 16a5 5 0 0 1 3-1M15 16l-.2-.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

export function ConnectivityStatus() {
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine !== false)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return (
    <span className={`connectivity-status ${online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite">
      <ConnectionIcon online={online} />
      <span>{online ? 'Online' : 'Offline'}</span>
    </span>
  )
}
