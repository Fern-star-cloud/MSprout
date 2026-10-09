import { ApiError } from '../../api/client'

export function safeAuthMessage(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : 0
  if (error instanceof ApiError && status === 409 && error.code === 'already_authenticated') {
    return 'A session is already signed in. Choose Continue signed-in session to check it, or sign out before using another account.'
  }
  if (typeof status === 'number' && status >= 500 && status < 600) {
    return 'The service is temporarily unavailable. Please try again later.'
  }
  switch (status) {
    case 401: return 'Please sign in again to continue.'
    case 403: return 'This action is unavailable. Check your verification and account access.'
    case 409: return 'An active application or a different decision already exists. Refresh to view the current status.'
    case 410: return 'This setup link has expired or has already been used.'
    case 419: return 'Your session expired. Please try again.'
    case 422: return 'Check the information you entered and try again.'
    case 429: return 'Too many attempts. Please wait a minute and try again.'
    default: return globalThis.navigator?.onLine === false
      ? 'Connect to the internet and try again. If the problem continues, try later.'
      : 'The request could not be completed. Check your connection and try again. If it continues, try later.'
  }
}

async function readResponse(response: Response): Promise<unknown> {
  const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    const errors = typeof payload === 'object' && payload !== null && 'field_errors' in payload ? payload.field_errors : undefined
    // Only field names affect form feedback; never reflect arbitrary server text.
    const fields = errors && typeof errors === 'object'
      ? Object.fromEntries(Object.keys(errors).map((key) => [key, ['Check this field.']])) : undefined
    const code = response.status === 409 && typeof payload === 'object' && payload !== null
      && 'code' in payload && payload.code === 'already_authenticated' ? 'already_authenticated' : 'auth_failed'
    const error = new ApiError(code, '', '', response.status, fields)
    error.message = safeAuthMessage(error)
    throw error
  }
  return payload
}

function invalidateWorkspace(status: number, churchId?: string): void {
  globalThis.dispatchEvent?.(new CustomEvent('church-workspace-invalidated', { detail: { status, churchId } }))
}

function invalidatePlatform(status: number, reason?: string): void {
  globalThis.dispatchEvent?.(new CustomEvent('platform-session-invalidated', { detail: { status, ...(reason ? { reason } : {}) } }))
}

function invalidateDeniedRequest(error: unknown, churchId?: string): void {
  if (error instanceof ApiError && ([401, 419].includes(error.status) || (error.status === 403 && churchId))) {
    invalidateWorkspace(error.status, churchId)
  }
}

export async function authRequest<T = Record<string, unknown>>(
  path: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' = 'GET', body?: Record<string, unknown>, churchId?: string,
): Promise<T> {
  if (globalThis.navigator?.onLine === false) throw new Error('Connect to the internet and try again.')
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('Invalid authentication path')
  const platformLogout = path === '/platform/logout' && method === 'POST'
  if (platformLogout) invalidatePlatform(0, 'logout-started')
  const headers: Record<string, string> = {
    Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Correlation-Id': crypto.randomUUID(),
  }
  const options = { credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'origin' } as const
  if (churchId) {
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(churchId)) throw new Error('Invalid workspace')
    headers['X-Church-Id'] = churchId
  }
  try {
    if (method !== 'GET') {
      if (path.startsWith('/platform/')) {
        const csrf = await readResponse(await fetch('/platform/csrf-token', { ...options, headers })) as { csrf_token: string }
        headers['X-CSRF-TOKEN'] = csrf.csrf_token
      } else {
        await readResponse(await fetch('/sanctum/csrf-cookie', { ...options, headers }))
        const cookie = document.cookie.split('; ').find((value) => value.startsWith('XSRF-TOKEN='))
        if (!cookie) throw new Error('CSRF initialization failed')
        headers['X-XSRF-TOKEN'] = decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
      }
      headers['Content-Type'] = 'application/json'
    }
    const result = await readResponse(await fetch(path, { ...options, method, headers, body: body ? JSON.stringify(body) : undefined })) as T
    if (platformLogout) invalidatePlatform(401, 'logout')
    if (!path.startsWith('/platform/') && method !== 'GET') {
      if (path === '/logout' || path === '/api/ownership-transfer') invalidateWorkspace(401)
      else if (['/login', '/two-factor-challenge', '/user/confirmed-two-factor-authentication', '/user/profile-information', '/user/password'].includes(path)
        || /^\/api\/teachers\//.test(path)) invalidateWorkspace(0)
    }
    return result
  } catch (error) {
    if (path.startsWith('/platform/')) {
      if (platformLogout) invalidatePlatform(0, 'logout-uncertain')
      else if (error instanceof ApiError && [401,403,419].includes(error.status)) invalidatePlatform(error.status)
    } else invalidateDeniedRequest(error, churchId)
    throw error
  }
}

export async function authUpload<T>(path: string, file: File, churchId: string): Promise<T> {
  if (globalThis.navigator?.onLine === false) throw new Error('Connect to the internet and try again.')
  if (!/^\/api\/imports\/students\/preview$/.test(path) || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(churchId)) throw new Error('Invalid import request')
  const headers: Record<string, string> = {
    Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Correlation-Id': crypto.randomUUID(), 'X-Church-Id': churchId,
  }
  const options = { credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'origin' } as const
  try {
    await readResponse(await fetch('/sanctum/csrf-cookie', { ...options, headers }))
    const cookie = document.cookie.split('; ').find((value) => value.startsWith('XSRF-TOKEN='))
    if (!cookie) throw new Error('CSRF initialization failed')
    headers['X-XSRF-TOKEN'] = decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
    const body = new FormData()
    body.set('file', file)

    return await readResponse(await fetch(path, { ...options, method: 'POST', headers, body })) as T
  } catch (error) {
    invalidateDeniedRequest(error, churchId)
    throw error
  }
}

export async function authDownload(path: string, churchId: string): Promise<Blob> {
  if (globalThis.navigator?.onLine === false) throw new Error('Connect to the internet and try again.')
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(churchId)) throw new Error('Invalid workspace')
  const parsed = new URL(path, globalThis.location?.origin ?? 'http://localhost')
  const reportExport = parsed.pathname === '/api/attendance-reports/export'
    && [...parsed.searchParams.keys()].every((key) => ['date_from', 'date_to', 'ministry_id'].includes(key))
    && /^\d{4}-\d{2}-\d{2}$/.test(parsed.searchParams.get('date_from') ?? '')
    && /^\d{4}-\d{2}-\d{2}$/.test(parsed.searchParams.get('date_to') ?? '')
    && (!parsed.searchParams.has('ministry_id') || /^[a-f\d-]{36}$/i.test(parsed.searchParams.get('ministry_id') ?? ''))
  if (parsed.origin !== (globalThis.location?.origin ?? 'http://localhost') || (path !== '/api/imports/template' && !reportExport)) throw new Error('Invalid download request')
  const response = await fetch(path, {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'origin',
    headers: { Accept: 'text/csv', 'X-Requested-With': 'XMLHttpRequest', 'X-Correlation-Id': crypto.randomUUID(), 'X-Church-Id': churchId },
  })
  if (!response.ok) {
    try { await readResponse(response) }
    catch (error) { invalidateDeniedRequest(error, churchId); throw error }
    throw new Error('Download failed')
  }

  return await response.blob()
}

export function signedInvitation(fragment: string, kind: 'platform' | 'church'): string | null {
  try {
    const url = new URL(decodeURIComponent(fragment), location.origin)
    const pattern = kind === 'platform' ? /^\/platform\/setup\/[a-f\d-]{36}$/i : /^\/email\/verify\/\d+\/[a-f\d]+$/i
    if (url.origin !== location.origin || !pattern.test(url.pathname) || !url.searchParams.has('signature') || !url.searchParams.has('expires')) return null
    return url.pathname + url.search
  } catch { return null }
}
