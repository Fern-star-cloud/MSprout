export type RouteId = 'profiles' | 'home' | 'attendance' | 'sync' | 'prepare' | 'people' | 'more' | 'account' | 'conflicts' | 'reports' | 'birthdays' | 'ministries' | 'students' | 'teachers' | 'imports' | 'audit' | 'login' | 'verify-email' | 'forgot-password' | 'reset-password' | 'mfa' | 'teacher-invitation' | 'application' | 'platform-login' | 'platform-setup' | 'platform-applications' | 'platform-audit' | 'platform-system-health'
export interface PresentationRoute { id: RouteId; path: string; kind: 'church' | 'device' | 'public' | 'platform'; ownerOnly?: boolean }

const church = ['home', 'people', 'conflicts', 'reports', 'birthdays', 'ministries', 'students', 'teachers', 'imports', 'audit'] as const
const device = ['attendance', 'sync', 'prepare', 'more'] as const
const publicPages = ['login', 'verify-email', 'forgot-password', 'reset-password', 'mfa', 'teacher-invitation', 'application'] as const
const platform = ['platform-login', 'platform-setup', 'platform-applications', 'platform-audit', 'platform-system-health'] as const
export const presentationRoutes: PresentationRoute[] = [
  { id: 'profiles', path: '/profiles', kind: 'public' },
  { id: 'account', path: '/account', kind: 'public' },
  ...church.map(id => ({ id, path: `/account/${id}`, kind: 'church' as const, ownerOnly: id === 'people' || id === 'teachers' })),
  ...device.map(id => ({ id, path: `/account/${id}`, kind: 'device' as const })),
  ...publicPages.map(id => ({ id, path: `/account/${id}`, kind: 'public' as const })),
  ...platform.map(id => ({ id, path: `/account/${id}`, kind: 'platform' as const })),
]
const aliases = new Map<string, PresentationRoute>()
for (const route of presentationRoutes) {
  aliases.set(route.path, route)
  if (route.path.startsWith('/account/')) aliases.set(`/${route.id}`, route)
}
aliases.set('/', presentationRoutes[0])
aliases.set('/account/profiles', presentationRoutes[0])
aliases.set('/account/account', presentationRoutes[1])
for (const path of ['/dashboard', '/account/dashboard']) aliases.set(path, aliases.get('/account/home')!)

// Match the entire pathname. Fragments and search parameters belong to the existing screens.
export function resolveRoute(pathname: string): PresentationRoute | null {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return aliases.get(path) ?? null
}
