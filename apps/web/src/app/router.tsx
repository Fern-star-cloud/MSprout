import { useEffect, useState, type MouseEvent } from 'react'
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
import { pwaUpdateController, usePwaUpdate } from '../pwa/update-controller'
import { PhoneLayout } from './layouts/PhoneLayout'
import { WideLayout } from './layouts/WideLayout'
import { ChurchWorkspaceBoundary } from './ChurchWorkspaceBoundary'

export interface NavigationItem {
  label: string
  href: string
  icon: 'home' | 'attendance' | 'birthday' | 'ministries' | 'students' | 'teachers' | 'import'
}

const navigationItems: NavigationItem[] = [
  { label: 'Home', href: '/account/dashboard', icon: 'home' },
  { label: 'Attendance', href: '/account/attendance', icon: 'attendance' },
  { label: 'Review', href: '/account/conflicts', icon: 'attendance' },
  { label: 'Reports', href: '/account/reports', icon: 'attendance' },
  { label: 'Birthdays', href: '/account/birthdays', icon: 'birthday' },
  { label: 'Ministries', href: '/account/ministries', icon: 'ministries' },
  { label: 'Students', href: '/account/students', icon: 'students' },
  { label: 'Teachers', href: '/account/teachers', icon: 'teachers' },
  { label: 'Import', href: '/account/imports', icon: 'import' },
]

const shellPages = new Set(['dashboard', 'attendance', 'conflicts', 'reports', 'birthdays', 'ministries', 'students', 'teachers', 'imports', 'audit'])
const workspacePages = new Set(['conflicts', 'reports', 'birthdays', 'ministries', 'students', 'imports'])
const authPages: AuthPage[] = ['login', 'verify-email', 'forgot-password', 'reset-password', 'mfa']

function Dashboard() {
  const churchId = new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? ''
  return <><section className="dashboard-card"><p className="eyebrow">Church workspace</p><h1>Welcome to MinistrySprout</h1><p>Choose a ministry task from the navigation.</p></section>{churchId && <BirthdayScreen initialChurchId={churchId} />}</>
}

function UpdateNotice() {
  const update = usePwaUpdate()
  if (!update.updateAvailable) return null
  return (
    <section className="update-notice" role="status" aria-live="polite">
      <div><strong>Update available</strong><span>{update.updateBlocked ? 'Finish or safely save local work before updating.' : 'A new version of Sprout is ready.'}</span></div>
      <button type="button" onClick={() => void pwaUpdateController.applyUpdate()}>Update when safe</button>
    </section>
  )
}

function screenFor(page: string, fragment: string, navigate: (path: string) => void) {
  if (page === 'profiles') return <DeviceProfilesScreen onUnlocked={() => navigate('/account/attendance')} />
  if (page === 'dashboard') return <Dashboard />
  if (page === 'attendance') return <AttendanceScreen />
  if (page === 'conflicts') return <ConflictReviewScreen />
  if (page === 'reports') return <ReportScreen />
  if (page === 'birthdays') return <BirthdayScreen />
  if (page === 'audit') return <AuditScreen />
  if (page === 'teachers') return <TeacherManagementScreen />
  if (page === 'ministries') return <MinistriesScreen />
  if (page === 'students') return <StudentsScreen />
  if (page === 'imports') return <ImportScreen />
  if (page === 'teacher-invitation') return <TeacherInvitationScreen fragment={fragment} />
  if (page === 'application') return <ApplicationScreen />
  if (page === 'platform-applications') return <ApplicationReviewScreen />
  if (page === 'platform-audit') return <AuditScreen platform />
  if (page === 'platform-system-health') return <SystemHealthScreen />
  if (page === 'platform-login' || page === 'platform-setup') return <PlatformAuthScreen setup={page === 'platform-setup'} fragment={fragment} />
  return <AuthScreen initialPage={authPages.includes(page as AuthPage) ? page as AuthPage : 'login'} fragment={fragment} />
}

export function AppRouter() {
  const [entry, setEntry] = useState(() => ({
    path: globalThis.location?.pathname ?? '/',
    search: globalThis.location?.search ?? '',
    fragment: globalThis.location?.hash.slice(1) ?? '',
  }))
  useEffect(() => {
    const update = () => setEntry({ path: globalThis.location.pathname, search: globalThis.location.search, fragment: globalThis.location.hash.slice(1) })
    globalThis.addEventListener('popstate', update)
    return () => globalThis.removeEventListener('popstate', update)
  }, [])
  const navigate = (path: string) => {
    const url = new URL(path, globalThis.location.href)
    globalThis.history.pushState(null, '', url.pathname + url.search + url.hash)
    setEntry({ path: url.pathname, search: url.search, fragment: url.hash.slice(1) })
  }
  const page = entry.path.split('/').filter(Boolean).pop() ?? 'profiles'
  const screen = screenFor(page, entry.fragment, navigate)
  const churchHint = new URLSearchParams(entry.search).get('church')
  const items = churchHint ? navigationItems.map(item => ({ ...item, href: `${item.href}?church=${encodeURIComponent(churchHint)}` })) : navigationItems

  function navigateWorkspace(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !workspacePages.has(page)) return
    const link = event.target instanceof Element ? event.target.closest('a') : null
    if (!link || !link.closest('nav') || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
    const url = new URL(link.href)
    // Keep native navigation outside the six shared church modules.
    if (url.origin !== location.origin || !navigationItems.some(item => workspacePages.has(item.href.split('/').pop()!) && item.href === url.pathname)) return
    event.preventDefault()
    if (url.pathname !== entry.path || url.search !== entry.search || url.hash.slice(1) !== entry.fragment) navigate(url.href)
  }

  if (!shellPages.has(page)) {
    return (
      <div className="public-layout">
        <header className="brand"><h1>MinistrySprout</h1><p>Children&apos;s ministry, ready anywhere.</p></header>
        <main id="main-content">{screen}</main>
        <footer><ConnectivityStatus /><a href="/account/platform-login">Platform administration</a></footer>
      </div>
    )
  }

  return (
    <div className="application-layout" onClick={navigateWorkspace}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <PhoneLayout items={items} activePath={entry.path} />
      <WideLayout items={items} activePath={entry.path} />
      <div className="application-content">
        <div className="phone-status"><ConnectivityStatus /></div>
        <UpdateNotice />
        <main id="main-content" tabIndex={-1}>{workspacePages.has(page)
          ? <ChurchWorkspaceBoundary key={churchHint ?? ''} routeKey={entry.path + entry.search} allowOffline={page === 'birthdays'}>{screen}</ChurchWorkspaceBoundary>
          : screen}</main>
      </div>
    </div>
  )
}
