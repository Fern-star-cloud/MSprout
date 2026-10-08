// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { authDownload, authRequest, authUpload, safeAuthMessage, signedInvitation } from './transport'

afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=; Max-Age=0' })

it('classifies an existing login session without treating submitted credentials as accepted', async () => {
  document.cookie = 'XSRF-TOKEN=csrf-value'
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json({ code: 'already_authenticated', message: 'private account detail' }, { status: 409 }))
  vi.stubGlobal('fetch', fetcher)
  const error = await authRequest('/login', 'POST', { email: 'different@example.test', password: crypto.randomUUID() }).catch(error => error)
  expect(error).toMatchObject({ code: 'already_authenticated', status: 409 })
  expect(safeAuthMessage(error)).toBe('A session is already signed in. Choose Continue signed-in session to check it, or sign out before using another account.')
  expect(fetcher.mock.calls[1][1]).toMatchObject({ redirect: 'error', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('does not assert offline status for an unclassified online fetch failure', () => {
  expect(safeAuthMessage(new TypeError('Failed to fetch private details'))).toBe('The request could not be completed. Check your connection and try again. If it continues, try later.')
})

it.each([401, 419, 403])('invalidates church workspace on protected request HTTP %s', async status => {
  const invalidated = vi.fn()
  window.addEventListener('church-workspace-invalidated', invalidated)
  try {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status })))
    const church = crypto.randomUUID()
    await expect(authRequest('/api/students', 'GET', undefined, church)).rejects.toMatchObject({ status })
    expect(invalidated).toHaveBeenCalledTimes(1)
    expect((invalidated.mock.calls[0][0] as CustomEvent).detail).toEqual({ status, churchId: church })
  } finally { window.removeEventListener('church-workspace-invalidated', invalidated) }
})

it('clears church workspace after logout and leaves it untouched by platform logout or denials', async () => {
  const invalidated = vi.fn()
  window.addEventListener('church-workspace-invalidated', invalidated)
  try {
    document.cookie = 'XSRF-TOKEN=csrf-value'
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async path => path === '/platform/csrf-token'
      ? Response.json({ csrf_token: 'platform-only' }) : new Response(null, { status: 204 })))
    await authRequest('/platform/logout', 'POST')
    expect(invalidated).not.toHaveBeenCalled()
    await authRequest('/logout', 'POST')
    expect(invalidated).toHaveBeenCalledTimes(1)
    expect((invalidated.mock.calls[0][0] as CustomEvent).detail.status).toBe(401)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 403 })))
    await expect(authRequest('/platform/me')).rejects.toMatchObject({ status: 403 })
    expect(invalidated).toHaveBeenCalledTimes(1)
  } finally { window.removeEventListener('church-workspace-invalidated', invalidated) }
})

it('initializes church CSRF and sends the decoded token with same-origin credentials', async () => {
  const fetcher = vi.fn().mockImplementationOnce(async () => {
    document.cookie = 'XSRF-TOKEN=csrf%3Dvalue'
    return new Response(null, { status: 204 })
  }).mockResolvedValueOnce(Response.json({ two_factor: true }))
  vi.stubGlobal('fetch', fetcher)
  await expect(authRequest('/login', 'POST', { email: 'teacher@example.test', password: crypto.randomUUID() })).resolves.toEqual({ two_factor: true })
  expect(fetcher.mock.calls[0][0]).toBe('/sanctum/csrf-cookie')
  expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', headers: { 'X-XSRF-TOKEN': 'csrf=value' } })
})

it('uses the isolated platform CSRF token rather than the church token', async () => {
  document.cookie = 'XSRF-TOKEN=church-only'
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ csrf_token: 'platform-only' })).mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetcher)
  await authRequest('/platform/logout', 'POST')
  expect(fetcher.mock.calls[0][0]).toBe('/platform/csrf-token')
  expect(fetcher.mock.calls[1][1].headers['X-CSRF-TOKEN']).toBe('platform-only')
  expect(fetcher.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBeUndefined()
})

it('does not send authentication requests while offline', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(false)
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  await expect(authRequest('/platform/me')).rejects.toThrow('Connect to the internet')
  expect(fetcher).not.toHaveBeenCalled()
})

it('shows generic rate-limit messages and never reflects arbitrary server text', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'private account detail' }, { status: 429 })))
  try { await authRequest('/platform/me') } catch (error) {
    expect(safeAuthMessage(error)).toBe('Too many attempts. Please wait a minute and try again.')
  }
  expect(safeAuthMessage(new Error('private account detail'))).not.toContain('private account detail')
})

it.each([500, 502, 503, 504])('identifies HTTP %s as a service failure without reflecting server details', async (status) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'private account detail' }, { status })))
  await expect(authRequest('/auth/session')).rejects.toMatchObject({
    status,
    message: 'The service is temporarily unavailable. Please try again later.',
  })
  expect(safeAuthMessage({ status })).toBe('The service is temporarily unavailable. Please try again later.')
})

it('accepts only same-origin signed links for the expected endpoint', () => {
  const path = '/platform/setup/11111111-1111-4111-8111-111111111111?expires=123&signature=abc'
  expect(signedInvitation(encodeURIComponent(location.origin + path), 'platform')).toBe(path)
  expect(signedInvitation(encodeURIComponent('https://attacker.test' + path), 'platform')).toBeNull()
  expect(signedInvitation(encodeURIComponent(location.origin + '/logout'), 'platform')).toBeNull()
})

it('sends a validated church header with CSRF protected membership mutations', async () => {
  const church = crypto.randomUUID()
  document.cookie = 'XSRF-TOKEN=csrf-value'
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetcher)
  await authRequest('/api/teachers/' + crypto.randomUUID(), 'DELETE', undefined, church)
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'DELETE', cache: 'no-store', headers: { 'X-Church-Id': church, 'X-XSRF-TOKEN': 'csrf-value' } })
  await expect(authRequest('/api/teachers', 'GET', undefined, 'invalid')).rejects.toThrow('Invalid workspace')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('uploads an import as browser-bounded multipart data without forcing a content type', async () => {
  const church = crypto.randomUUID()
  document.cookie = 'XSRF-TOKEN=csrf-value'
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(Response.json({ id: crypto.randomUUID() }))
  vi.stubGlobal('fetch', fetcher)
  const file = new File(['first_name,last_name\nAri,Sprout'], 'students.csv', { type: 'text/csv' })
  await authUpload('/api/imports/students/preview', file, church)
  expect(fetcher.mock.calls[1][1].body).toBeInstanceOf(FormData)
  expect(fetcher.mock.calls[1][1].headers).toMatchObject({ 'X-Church-Id': church, 'X-XSRF-TOKEN': 'csrf-value' })
  expect(fetcher.mock.calls[1][1].headers['Content-Type']).toBeUndefined()
})

it('downloads only allowlisted same-origin attendance report filters', async () => {
  const church = crypto.randomUUID()
  const ministry = crypto.randomUUID()
  const fetcher = vi.fn().mockResolvedValue(new Response('csv', { status: 200, headers: { 'Content-Type': 'text/csv' } }))
  vi.stubGlobal('fetch', fetcher)
  const path = `/api/attendance-reports/export?date_from=2026-09-01&date_to=2026-09-30&ministry_id=${ministry}`

  const download = await authDownload(path, church)
  expect(download).toMatchObject({ size: 3, type: 'text/csv' })
  await expect(download.text()).resolves.toBe('csv')
  expect(fetcher).toHaveBeenCalledWith(path, expect.objectContaining({ cache: 'no-store', headers: expect.objectContaining({ 'X-Church-Id': church }) }))
  await expect(authDownload('/api/attendance-reports/export?date_from=2026-09-01&date_to=2026-09-30&child_name=private', church)).rejects.toThrow('Invalid download request')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
