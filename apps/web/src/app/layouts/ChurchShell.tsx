import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ConnectivityStatus } from '../../components/ConnectivityStatus'
import { Button, Dialog, StatusBadge } from '../../components/ui/Foundations'
import { PwaUpdateNotice } from '../../pwa/PwaUpdateNotice'
import { ChurchNavigationContext } from '../workspace-context'
import { navigationFor, type NavigationItem } from '../navigation'
import type { PresentationRoute } from '../routes'
import { Brand } from '../../components/ui/Brand'
import { ChurchName } from '../../components/ui/CompactText'
import { HomeIcon } from '../../components/ui/HomeIcon'

export function ChurchShell({ route, routeKey, children }: { route: PresentationRoute; routeKey: string; children: ReactNode }) {
  const { workspace, selector } = useContext(ChurchNavigationContext)
  const nav = navigationFor(workspace?.role ?? null)
  const isHome = route.id === 'home'
  const [drawerRoute, setDrawerRoute] = useState<string | null>(null)
  const peopleActive = nav.people.some(child => child.id === route.id)
  const [peopleDisclosure, setPeopleDisclosure] = useState<{ routeKey: string; expanded: boolean } | null>(null)
  const peopleExpanded = peopleDisclosure?.routeKey === routeKey ? peopleDisclosure.expanded : peopleActive
  const groupId = useId()
  const menu = useRef<HTMLButtonElement>(null), close = useRef<HTMLButtonElement>(null)
  const churchHint = new URLSearchParams(location.search).get('church')
  const href = (path: string) => workspace && churchHint === workspace.church_id ? `${path}?church=${encodeURIComponent(workspace.church_id)}` : path
  useEffect(() => {
    const resize = () => {
      if (innerWidth < 768 || innerWidth >= 1024) {
        setDrawerRoute(null)
        if (drawerRoute === routeKey) requestAnimationFrame(() => document.getElementById('main-content')?.focus())
      }
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [drawerRoute, routeKey])
  const links = (items: NavigationItem[], surface: 'wide' | 'tablet' | 'phone', grouped = false) => items.map(item => {
    const activeGroup = item.id === 'people' && peopleActive || item.id === 'more' && nav.more.some(child => child.id === route.id) && !nav.phone.some(child => child.id === route.id)
    const link = <a key={item.id} href={href(item.href)} className={item.group ? 'navigation-child' : undefined} aria-current={route.id === item.id ? 'page' : activeGroup ? 'location' : undefined} data-active-group={activeGroup || undefined}>
      <HomeIcon id={item.id} /><span>{surface === 'phone' && item.id === 'attendance' ? <>Attend<wbr />ance</> : item.label}</span>
    </a>
    if (grouped && item.id === 'people') return <div className="people-navigation-group" key={item.id}>
      <div className="home-people-navigation" data-active-group={peopleActive || undefined}>{link}<button type="button" aria-label="Show People destinations" aria-controls={`${groupId}-${surface}`} aria-expanded={peopleExpanded} onClick={() => setPeopleDisclosure({ routeKey, expanded: !peopleExpanded })}><span aria-hidden="true">{peopleExpanded ? '⌃' : '⌄'}</span></button></div>
      <div id={`${groupId}-${surface}`} className="people-destinations" hidden={!peopleExpanded}>{links(nav.people, surface)}</div>
    </div>
    return link
  })
  const brand = <a className="brand-link" href={href('/account/home')} aria-label="MSprout home"><Brand /></a>
  const identity = <div className="workspace-identity">{workspace ? <><div className="workspace-name"><HomeIcon id="verified" /><ChurchName value={workspace.name} /></div><StatusBadge tone={workspace.role === 'owner' ? 'success' : 'info'}>{workspace.role === 'owner' ? 'Owner' : 'Teacher'}</StatusBadge></> : <span>Device workspace<span className="sr-only"> · Online church access verified separately</span></span>}</div>
  return <div className={`church-shell application-layout${isHome ? ' home-shell' : ''}`} data-navigation-role={workspace?.role ?? 'device'}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="wide-layout">{brand}<nav className="wide-navigation" aria-label="Main navigation">{links(nav.main, 'wide', true)}</nav></aside>
    <div className="church-workspace">
      <header className="workspace-header">
        <div className="compact-brand"><Button ref={menu} variant="secondary" className="tablet-menu" onClick={() => setDrawerRoute(routeKey)} aria-haspopup="dialog" aria-expanded={drawerRoute === routeKey}><HomeIcon id="more" /><span className="sr-only">Menu</span></Button>{brand}</div>
        {identity}{selector}<div className="workspace-tools"><ConnectivityStatus /><a className="protected-sync-link" href={href('/account/sync')} aria-current={route.id === 'sync' ? 'page' : undefined}><HomeIcon id="sync" /><span>Sync &amp; device</span></a></div>
      </header>
      <div className="application-content">
        <PwaUpdateNotice />
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
    <nav className={`phone-navigation phone-count-${nav.phone.length}`} aria-label="Phone navigation">{links(nav.phone, 'phone')}</nav>
    <Dialog open={drawerRoute === routeKey} title="Navigation" onClose={() => setDrawerRoute(null)} initialFocus={close} returnFocus={menu}>
      <div className="tablet-drawer" onClick={event => { if (event.target instanceof Element && event.target.closest('a') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) setDrawerRoute(null) }}><div className="drawer-brand"><Button ref={close} variant="secondary" className="drawer-close" onClick={() => setDrawerRoute(null)}><HomeIcon id="more" /><span className="sr-only">Close navigation</span></Button>{brand}</div>
        <nav aria-label="Tablet navigation">{links(nav.main, 'tablet', true)}</nav>
      </div>
    </Dialog>
  </div>
}
