import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConnectivityStatus } from '../../components/ConnectivityStatus'
import { Button, Dialog, StatusBadge } from '../../components/ui/Foundations'
import type { PlatformSession } from '../../features/platform-auth/platform-session'
import type { PresentationRoute } from '../routes'

const destinations = [
  { id: 'platform-applications', label: 'Applications', href: '/account/platform-applications' },
  { id: 'platform-system-health', label: 'System Health', href: '/account/platform-system-health' },
  { id: 'platform-audit', label: 'Platform Audit', href: '/account/platform-audit' },
  { id: 'platform-login', label: 'Account', href: '/account/platform-login' },
] as const

export function PlatformPublicShell({ children }: { children: ReactNode }) {
  return <div className="platform-public public-layout"><a className="skip-link" href="#main-content">Skip to content</a>
    <header className="brand"><h1>MinistrySprout</h1><p>Platform administration · Online only</p></header>
    <main id="main-content" tabIndex={-1}>{children}</main><footer><ConnectivityStatus /></footer>
  </div>
}

export function PlatformShell({ session, route, logout, children }: { session: PlatformSession; route: PresentationRoute; logout: () => Promise<void>; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  const menu = useRef<HTMLButtonElement>(null), close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const resize = () => { if (innerWidth < 768 || innerWidth >= 1024) setDrawer(false) }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const links = destinations.map(item => <a key={item.id} href={item.href} aria-current={route.id === item.id ? 'page' : undefined}>{item.label}</a>)
  const brand = <a className="brand-link" href="/account/platform-applications" aria-label="MinistrySprout platform applications"><strong>MinistrySprout</strong></a>
  return <div className="platform-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="platform-sidebar">{brand}<nav aria-label="Platform navigation">{links}</nav><p>Platform Administrator</p></aside>
    <div className="platform-workspace"><header className="platform-header">
      <div className="platform-brand"><Button ref={menu} variant="secondary" className="platform-menu" onClick={() => setDrawer(true)} aria-haspopup="dialog" aria-expanded={drawer}>Menu</Button>{brand}</div>
      <div className="platform-identity"><span>{session.handle}</span><StatusBadge tone="info">Platform Administrator</StatusBadge></div>
      <div className="platform-tools"><ConnectivityStatus /><a href="/account/platform-login">Account</a><Button variant="secondary" onClick={() => void logout()}>Sign out of platform</Button></div>
    </header><div className="platform-content"><main id="main-content" tabIndex={-1}>{children}</main></div></div>
    <nav className="platform-phone-navigation" aria-label="Platform phone navigation">{links}</nav>
    <Dialog open={drawer} title="Platform navigation" onClose={() => setDrawer(false)} initialFocus={close} returnFocus={menu}>
      <div className="platform-drawer"><Button ref={close} variant="secondary" onClick={() => setDrawer(false)}>Close navigation</Button>
        <nav aria-label="Platform tablet navigation" onClick={event => { if (event.target instanceof Element && event.target.closest('a') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) setDrawer(false) }}>{links}</nav>
      </div>
    </Dialog>
  </div>
}
