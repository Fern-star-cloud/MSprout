import { useContext, useEffect, useRef, useState, type MouseEvent } from 'react'
import { ApplicationScreen } from '../features/applications/ApplicationScreen'
import { AuditScreen } from '../features/audit/AuditScreen'
import { AttendanceScreen } from '../features/attendance/AttendanceScreen'
import { BirthdayScreen } from '../features/birthdays/BirthdayScreen'
import { ConflictReviewScreen } from '../features/conflicts/ConflictReviewScreen'
import { AuthScreen, type AuthPage } from '../features/auth/AuthScreen'
import { ImportScreen } from '../features/imports/ImportScreen'
import { ReportScreen } from '../features/reports/ReportScreen'
import { DeviceProfilesScreen } from '../features/device-profiles/DeviceProfilesScreen'
import { MinistriesScreen } from '../features/ministries/MinistriesScreen'
import { PlatformAuthScreen } from '../features/platform-auth/PlatformAuthScreen'
import { ApplicationReviewScreen } from '../features/platform/applications/ApplicationReviewScreen'
import { SystemHealthScreen } from '../features/platform/system-health/SystemHealthScreen'
import { StudentsScreen } from '../features/students/StudentsScreen'
import { TeacherInvitationScreen } from '../features/teachers/TeacherInvitationScreen'
import { TeacherManagementScreen } from '../features/teachers/TeacherManagementScreen'
import { ConnectivityStatus } from '../components/ConnectivityStatus'
import { StatusBanner } from '../components/ui/Foundations'
import { ChurchShell } from './layouts/ChurchShell'
import { ChurchWorkspaceBoundary } from './ChurchWorkspaceBoundary'
import { ChurchNavigationContext } from './workspace-context'
import { HomeScreen } from './HomeScreen'
import { navigationFor } from './navigation'
import { resolveRoute, type PresentationRoute } from './routes'

function DestinationList({ people = false }: { people?: boolean }) {
  const { workspace } = useContext(ChurchNavigationContext)
  const nav = navigationFor(workspace?.role ?? null)
  const church = new URLSearchParams(location.search).get('church')
  return <section className="dashboard-card"><h1>{people ? 'People' : 'More'}</h1><p>{people ? 'Manage people and ministries with the existing church tools.' : 'Church and device destinations.'}</p>
    <nav className="destination-list" aria-label={people ? 'People destinations' : 'More destinations'}>{(people ? nav.people : nav.more).map(item => <a key={item.id} href={workspace && church === workspace.church_id ? `${item.href}?church=${encodeURIComponent(church)}` : item.href}>{item.label}</a>)}</nav>
  </section>
}

function ChurchPage({ route, navigate }: { route: PresentationRoute; navigate: (path: string) => void }) {
  const { workspace } = useContext(ChurchNavigationContext)
  if (route.ownerOnly && workspace?.role !== 'owner') return <StatusBanner tone="warning">This destination is available to the church Owner. Open My ministries or your assigned roster instead.</StatusBanner>
  switch (route.id) {
    case 'home': return <HomeScreen />
    case 'people': return <DestinationList people />
    case 'more': return <DestinationList />
    case 'attendance': return <AttendanceScreen />
    case 'sync': return <><h1>Sync &amp; device</h1><p>Use the existing synchronization recovery below. Viewing this destination does not start synchronization.</p><DeviceProfilesScreen onUnlocked={() => navigate('/account/attendance')} /></>
    case 'prepare': return <><h1>Prepare this device</h1><p>Use Add profile below to prepare an encrypted device profile with the existing authorized bootstrap.</p><DeviceProfilesScreen onUnlocked={() => navigate('/account/attendance')} /></>
    case 'conflicts': return <ConflictReviewScreen />
    case 'reports': return <ReportScreen />
    case 'birthdays': return <BirthdayScreen />
    case 'audit': return <AuditScreen />
    case 'teachers': return <TeacherManagementScreen />
    case 'ministries': return <MinistriesScreen />
    case 'students': return <StudentsScreen />
    case 'imports': return <ImportScreen />
    default: return null
  }
}

function PublicPage({ route, fragment, navigate }: { route: PresentationRoute; fragment: string; navigate: (path: string) => void }) {
  switch (route.id) {
    case 'profiles': return <DeviceProfilesScreen onUnlocked={() => navigate('/account/attendance')} />
    case 'account': return <><h1>Account</h1><p>Sign in or deliberately verify your existing session below.</p><AuthScreen initialPage="login" /></>
    case 'teacher-invitation': return <TeacherInvitationScreen fragment={fragment} />
    case 'application': return <ApplicationScreen />
    case 'platform-applications': return <ApplicationReviewScreen />
    case 'platform-audit': return <AuditScreen platform />
    case 'platform-system-health': return <SystemHealthScreen />
    case 'platform-login': case 'platform-setup': return <PlatformAuthScreen setup={route.id === 'platform-setup'} fragment={fragment} />
    default: return <AuthScreen key={route.id} initialPage={route.id as AuthPage} fragment={fragment} />
  }
}

export function AppRouter() {
  const [entry, setEntry] = useState(() => typeof window === 'undefined'
    ? { path: '/', search: '', fragment: '' }
    : { path: window.location.pathname, search: window.location.search, fragment: window.location.hash.slice(1) })
  const previousEntry = useRef(entry.path + entry.search)
  useEffect(() => {
    const update = () => setEntry({ path: location.pathname, search: location.search, fragment: location.hash.slice(1) })
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const routeKey = entry.path + entry.search
  useEffect(() => {
    if (previousEntry.current !== routeKey) document.getElementById('main-content')?.focus()
    previousEntry.current = routeKey
  }, [routeKey])
  const navigate = (path: string) => {
    const url = new URL(path, location.href)
    if (url.origin !== location.origin || !resolveRoute(url.pathname)) return
    history.pushState(null, '', url.pathname + url.search + url.hash)
    setEntry({ path: url.pathname, search: url.search, fragment: url.hash.slice(1) })
  }
  function followInternalLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.getAttribute('href')?.startsWith('#')) return
    const url = new URL(link.href)
    if (url.origin !== location.origin || !resolveRoute(url.pathname)) return
    event.preventDefault()
    if (url.pathname + url.search + url.hash !== location.pathname + location.search + location.hash) navigate(url.href)
  }
  const route = resolveRoute(entry.path)
  const churchShell = route && (route.kind === 'church' || route.kind === 'device')
  return <div onClick={followInternalLink}>{churchShell ? <ChurchWorkspaceBoundary routeKey={routeKey} independent={route.kind === 'device'} allowOffline={route.id === 'birthdays'} renderShell={content => <ChurchShell route={route} routeKey={routeKey}>{content}</ChurchShell>}><ChurchPage key={route.id} route={route} navigate={navigate} /></ChurchWorkspaceBoundary> : <div className="public-layout">
    <header className="brand"><h1>MinistrySprout</h1><p>Children&apos;s ministry, ready anywhere.</p></header>
    <main id="main-content" tabIndex={-1}>{route ? <PublicPage key={route.id} route={route} fragment={entry.fragment} navigate={navigate} /> : <section className="auth-card"><h2>Page not found</h2><p>Choose a supported MinistrySprout destination.</p><a href="/account/home">Open Home</a></section>}</main>
    <footer><ConnectivityStatus /><a href="/account">Account</a><a href="/profiles">Device profiles</a><a href="/account/attendance">Attendance</a><a href="/account/sync">Sync &amp; device</a><a href="/account/platform-login">Platform administration</a></footer>
  </div>}</div>
}
