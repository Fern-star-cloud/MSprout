// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { authDownload, authRequest, authUpload, safeAuthMessage, signedInvitation } from './transport'

afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=; Max-Age=0' })

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
