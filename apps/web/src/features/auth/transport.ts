import { ApiError } from '../../api/client'

export function safeAuthMessage(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : 0
  switch (status) {
    case 401: return 'Please sign in again to continue.'
    case 403: return 'This action is unavailable. Check your verification and account access.'
    case 409: return 'An active application or a different decision already exists. Refresh to view the current status.'
    case 410: return 'This setup link has expired or has already been used.'
    case 419: return 'Your session expired. Please try again.'
    case 422: return 'Check the information you entered and try again.'
    case 429: return 'Too many attempts. Please wait a minute and try again.'
    default: return 'Connect to the internet and try again. If the problem continues, try later.'
  }
}

async function readResponse(response: Response): Promise<unknown> {
  const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    const errors = typeof payload === 'object' && payload !== null && 'field_errors' in payload ? payload.field_errors : undefined
    // Only field names affect form feedback; never reflect arbitrary server text.
    const fields = errors && typeof errors === 'object'
      ? Object.fromEntries(Object.keys(errors).map((key) => [key, ['Check this field.']])) : undefined
    throw new ApiError('auth_failed', safeAuthMessage({ status: response.status }), '', response.status, fields)
  }
  return payload
}

export async function authRequest<T = Record<string, unknown>>(
  path: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' = 'GET', body?: Record<string, unknown>, churchId?: string,
): Promise<T> {
  if (globalThis.navigator?.onLine === false) throw new Error('Connect to the internet and try again.')
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('Invalid authentication path')
  const headers: Record<string, string> = {
    Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Correlation-Id': crypto.randomUUID(),
  }
  const options = { credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' } as const
  if (churchId) {
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(churchId)) throw new Error('Invalid workspace')
    headers['X-Church-Id'] = churchId
  }
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
  return await readResponse(await fetch(path, { ...options, method, headers, body: body ? JSON.stringify(body) : undefined })) as T
}

export function signedInvitation(fragment: string, kind: 'platform' | 'church'): string | null {
  try {
    const url = new URL(decodeURIComponent(fragment), location.origin)
    const pattern = kind === 'platform' ? /^\/platform\/setup\/[a-f\d-]{36}$/i : /^\/email\/verify\/\d+\/[a-f\d]+$/i
    if (url.origin !== location.origin || !pattern.test(url.pathname) || !url.searchParams.has('signature') || !url.searchParams.has('expires')) return null
    return url.pathname + url.search
  } catch { return null }
}
