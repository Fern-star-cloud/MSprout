import type { components } from '../../api/generated'
import { resolveRoute } from '../../app/routes'
import { authRequest } from './transport'

export type AccountSession = components['schemas']['AccountSession']
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i

export async function readAccountSession(): Promise<AccountSession> {
  const session = await authRequest<AccountSession>('/auth/session')
  if (!Number.isSafeInteger(session?.id) || session.id <= 0 || typeof session.email_verified !== 'boolean'
    || typeof session.mfa_confirmed !== 'boolean' || !Array.isArray(session.workspaces)
    || session.workspaces.some(item => !uuid.test(item.church_id) || typeof item.name !== 'string' || !['owner', 'teacher'].includes(item.role))) {
    throw new Error('Account state could not be verified')
  }
  return session
}

// Return destinations are presentation links, never authority or automatic redirects.
export function accountReturnDestination(value: string | null): string | null {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, location.origin)
    const route = resolveRoute(url.pathname)
    if (url.origin !== location.origin || url.hash || !route || !(route.kind === 'church' || route.kind === 'device' || route.id === 'application' || route.id === 'profiles')) return null
    if ([...url.searchParams.keys()].some(key => key !== 'church') || url.searchParams.getAll('church').length > 1) return null
    const church = url.searchParams.get('church')
    if (church && !uuid.test(church)) return null
    return route.path + (church ? `?church=${encodeURIComponent(church)}` : '')
  } catch { return null }
}

export function accountEntry(path: '/account/login' | '/account/mfa' | '/account/verify-email', destination: string): string {
  const safe = accountReturnDestination(destination)
  return path + (safe ? `?returnTo=${encodeURIComponent(safe)}` : '')
}

export function isUncertainSubmission(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : 0
  return typeof status !== 'number' || status < 400 || status >= 500 || status === 409
}
