import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConnectivityStatus } from '../../components/ConnectivityStatus'
import { Button, Dialog, StatusBadge } from '../../components/ui/Foundations'
import { pwaUpdateController, usePwaUpdate } from '../../pwa/update-controller'
import { ChurchNavigationContext } from '../workspace-context'
import { navigationFor, type NavigationItem } from '../navigation'
import type { PresentationRoute } from '../routes'

function Icon({ id }: { id: NavigationItem['id'] }) {
  const paths: Partial<Record<NavigationItem['id'], string>> = {
    home: 'M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4Z', attendance: 'M6 4h12v17H6Zm3 5 2 2 4-4m-6 9 2 2 4-4',
    sync: 'M7 7a7 7 0 0 1 12 3m0-5v5h-5M17 17a7 7 0 0 1-12-3m0 5v-5h5',
    people: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a5 5 0 0 1 10 0v3m3-16a3 3 0 0 1 0 6m0 3a5 5 0 0 1 5 5v2',
    more: 'M4 6h16M4 12h16M4 18h16', conflicts: 'M6 4h12v17H6Zm6 4v6m0 3h.01',
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d={paths[id] ?? 'M5 4h14v17H5Zm3 5h8m-8 4h8m-8 4h5'} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

export function ChurchShell({ route, routeKey, children }: { route: PresentationRoute; routeKey: string; children: ReactNode }) {
  const { workspace, selector } = useContext(ChurchNavigationContext)
  const nav = navigationFor(workspace?.role ?? null)
  const [drawerRoute, setDrawerRoute] = useState<string | null>(null)
  const menu = useRef<HTMLButtonElement>(null), close = useRef<HTMLButtonElement>(null)
  const update = usePwaUpdate()
  const churchHint = new URLSearchParams(location.search).get('church')
  const href = (path: string) => workspace && churchHint === workspace.church_id ? `${path}?church=${encodeURIComponent(workspace.church_id)}` : path
  useEffect(() => {
    const resize = () => { if (innerWidth < 768 || innerWidth >= 1024) setDrawerRoute(null) }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const links = (items: NavigationItem[], icons = false) => items.map(item => <a key={item.id} href={href(item.href)} className={item.group ? 'navigation-child' : undefined} aria-current={route.id === item.id ? 'page' : icons && item.id === 'people' && nav.people.some(child => child.id === route.id) ? 'location' : undefined} data-active-group={item.id === 'people' && nav.people.some(child => child.id === route.id) || undefined}>
    {icons && <Icon id={item.id} />}<span>{item.label}</span>
  </a>)
  const brand = <a className="brand-link" href={href('/account/home')} aria-label="MinistrySprout home"><span className="brand-mark" aria-hidden="true">M</span><strong>MinistrySprout</strong></a>
  const identity = <div className="workspace-identity">{workspace ? <><span>{workspace.name}</span><StatusBadge tone="info">{workspace.role === 'owner' ? 'Owner' : 'Teacher'}</StatusBadge></> : <span>Device workspace · Online church access verified separately</span>}</div>
  return <div className="church-shell application-layout">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="wide-layout">{brand}<nav className="wide-navigation" aria-label="Main navigation">{links(nav.main)}</nav><ConnectivityStatus /></aside>
    <div className="church-workspace">
      <header className="workspace-header">
        <div className="compact-brand"><Button ref={menu} variant="secondary" className="tablet-menu" onClick={() => setDrawerRoute(routeKey)} aria-haspopup="dialog" aria-expanded={drawerRoute === routeKey}>Menu</Button>{brand}</div>
        {identity}{selector}<div className="workspace-tools"><ConnectivityStatus /><a className="protected-sync-link" href={href('/account/sync')}>Sync &amp; device</a></div>
      </header>
      <div className="application-content">
        {update.updateAvailable && <section className="update-notice" role="status" aria-live="polite"><div><strong>Update available</strong><span>{update.updateBlocked ? 'Finish or safely save local work before updating.' : 'A new version of MinistrySprout is ready.'}</span></div><button type="button" onClick={() => void pwaUpdateController.applyUpdate()}>Update when safe</button></section>}
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
    <nav className={`phone-navigation phone-count-${nav.phone.length}`} aria-label="Phone navigation">{links(nav.phone, true)}</nav>
    <Dialog open={drawerRoute === routeKey} title="Navigation" onClose={() => setDrawerRoute(null)} initialFocus={close} returnFocus={menu}>
      <div className="tablet-drawer"><Button ref={close} variant="secondary" onClick={() => setDrawerRoute(null)}>Close navigation</Button>
        <nav aria-label="Tablet navigation" onClick={event => { if (event.target instanceof Element && event.target.closest('a') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) setDrawerRoute(null) }}>{links(nav.main)}</nav>
      </div>
    </Dialog>
  </div>
}
