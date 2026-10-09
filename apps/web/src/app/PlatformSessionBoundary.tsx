import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, ErrorSummary, LoadingState, StatusBanner } from '../components/ui/Foundations'
import { authRequest, safeAuthMessage } from '../features/auth/transport'
import { readPlatformSession, type PlatformSession } from '../features/platform-auth/platform-session'
import { PlatformPublicShell, PlatformShell } from './layouts/PlatformShell'
import type { PresentationRoute } from './routes'

type Phase = 'checking' | 'ready' | 'anonymous' | 'denied' | 'error' | 'offline' | 'signing-out' | 'signed-out'
type Checked = { key: string; phase: Phase; session?: PlatformSession; message?: string; epoch?: number }

export function PlatformSessionBoundary({ route, routeKey, children, anonymous }: { route: PresentationRoute; routeKey: string; children: ReactNode; anonymous?: ReactNode }) {
  const [online, setOnline] = useState(globalThis.navigator?.onLine !== false)
  const connectivityState = useRef(online)
  const [checked, setChecked] = useState<Checked>({ key: routeKey, phase: 'checking' })
  const generation = useRef(0), mutation = useRef(0), mounted = useRef(false)
  const verified = useRef(false), previouslyVerified = useRef(false), signingOut = useRef(false)
  const cancelChecks = useCallback(() => { generation.current++; mutation.current++ }, [])
  const verify = useCallback(async () => {
    if (signingOut.current) return
    const run = ++generation.current
    verified.current = false
    setChecked({ key: routeKey, phase: 'checking' })
    try {
      const session = await readPlatformSession()
      if (!mounted.current || run !== generation.current) return
      verified.current = true; previouslyVerified.current = true
      setChecked({ key: routeKey, phase: 'ready', session, epoch: run })
    } catch (error) {
      if (!mounted.current || run !== generation.current) return
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
      setChecked({ key: routeKey, phase: status === 401 || status === 419 ? 'anonymous' : status === 403 ? 'denied' : 'error',
        message: status === 401 || status === 419 ? previouslyVerified.current || status === 419 ? 'Your platform session expired. Sign in again to continue.' : 'No verified platform session. Sign in to continue.'
          : status === 403 ? 'Platform access is unavailable. A verified Platform Administrator session with MFA is required.' : safeAuthMessage(error) })
    }
  }, [routeKey])
  useEffect(() => {
    mounted.current = true
    let active = true
    if (online) void Promise.resolve().then(() => { if (active) return verify() })
    return () => { active = false; mounted.current = false; cancelChecks() }
  }, [online, verify, cancelChecks])
  useEffect(() => {
    if (checked.key === routeKey && checked.phase === 'ready') document.getElementById('main-content')?.focus()
  }, [checked.key, checked.phase, routeKey])
  useEffect(() => {
    const clear = () => { generation.current++; verified.current = false }
    const connectivity = (event: Event) => {
      const connected = event.type === 'online'
      if (connected === connectivityState.current) return
      connectivityState.current = connected
      clear(); setOnline(connected)
      setChecked({ key: routeKey, phase: connected ? 'checking' : 'offline' })
    }
    const invalidate = (event: Event) => {
      clear()
      const detail = (event as CustomEvent<{status?:number;reason?:string}>).detail
      if (detail?.reason === 'logout-started') { setChecked({ key: routeKey, phase: 'signing-out' }); return }
      if (detail?.reason === 'logout-uncertain') { setChecked({ key: routeKey, phase: 'error', message: 'Sign-out could not be confirmed. Check your platform session before continuing.' }); return }
      const phase = detail?.reason === 'logout' ? 'signed-out' : detail?.status === 403 ? 'denied' : 'anonymous'
      setChecked({ key: routeKey, phase, message: phase === 'signed-out' ? undefined : phase === 'denied' ? 'Platform access is unavailable. Check your administrator assurance.' : previouslyVerified.current || detail?.status === 419 ? 'Your platform session expired. Sign in again to continue.' : 'No verified platform session. Sign in to continue.' })
    }
    const refresh = () => { if (verified.current && navigator.onLine) void verify() }
    window.addEventListener('platform-session-invalidated', invalidate)
    window.addEventListener('offline', connectivity); window.addEventListener('online', connectivity); window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('platform-session-invalidated', invalidate); window.removeEventListener('offline', connectivity); window.removeEventListener('online', connectivity); window.removeEventListener('focus', refresh) }
  }, [routeKey, verify])
  const logout = async () => {
    if (signingOut.current) return
    signingOut.current = true; const operation = ++mutation.current
    generation.current++; verified.current = false
    setChecked({ key: routeKey, phase: 'signing-out' })
    try {
      await authRequest('/platform/logout', 'POST')
      if (mounted.current && operation === mutation.current) setChecked({ key: routeKey, phase: 'signed-out' })
    } catch {
      if (mounted.current && operation === mutation.current) setChecked({ key: routeKey, phase: 'error', message: 'Sign-out could not be confirmed. Check your platform session before continuing.' })
    } finally { signingOut.current = false }
  }
  const state: Checked = !online ? { key: routeKey, phase: 'offline' } : checked.key === routeKey ? checked : { key: routeKey, phase: 'checking' }
  if (state.phase === 'ready' && state.session) return <PlatformShell key={routeKey + ':' + state.epoch} route={route} session={state.session} logout={logout}>
    {route.id === 'platform-login' ? <section className="dashboard-card"><h1>Platform Account</h1><p role="status">Signed in as {state.session.handle}</p><p>Your platform session and MFA assurance were verified. Platform access remains separate from church accounts and student records.</p><a className="action-link" href="/account/platform-applications">Open Applications</a><p>Use Sign out of platform in the header to end this platform session.</p></section> : children}
  </PlatformShell>
  return <PlatformPublicShell><section className="dashboard-card" aria-label="Platform session">
    {(state.phase === 'checking' || state.phase === 'signing-out') && <LoadingState label={state.phase === 'signing-out' ? 'Signing out of platform…' : 'Checking platform session and MFA…'} />}
    {state.phase === 'offline' && <StatusBanner tone="neutral" live>Connect to the internet to use platform administration. Protected platform information is unavailable offline.</StatusBanner>}
    {state.message && <ErrorSummary message={state.message} />}
    {state.phase === 'signed-out' && <StatusBanner live>You are signed out of platform.</StatusBanner>}
    {online && !['checking','signing-out'].includes(state.phase) && <><Button variant="secondary" onClick={() => void verify()}>Check platform session</Button>{route.id !== 'platform-login' && <p><a href="/account/platform-login">Platform sign in</a></p>}</>}
  </section>{online && (state.phase === 'anonymous' || state.phase === 'signed-out') && anonymous}</PlatformPublicShell>
}
