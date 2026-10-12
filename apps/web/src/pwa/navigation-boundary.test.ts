import { afterEach, expect, it, vi } from 'vitest'

vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))
vi.mock('workbox-precaching', () => ({ cleanupOutdatedCaches: vi.fn(), createHandlerBoundToURL: vi.fn(() => async () => new Response()), precacheAndRoute: vi.fn() }))
vi.mock('workbox-routing', async original => {
  const actual = await original() as typeof import('workbox-routing')
  return { ...actual, registerRoute: vi.fn() }
})
vi.mock('workbox-strategies', () => ({ NetworkOnly: class {} }))
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it('uses real Workbox navigation matching to exclude protected roots, queries and children while retaining frontend routes', async () => {
  vi.stubGlobal('self', { __WB_MANIFEST: [], __WB_DISABLE_DEV_LOGS: true, addEventListener: vi.fn() })
  await import('./service-worker')
  const { NavigationRoute, registerRoute } = await import('workbox-routing')
  const route = vi.mocked(registerRoute).mock.calls.map(call => call[0]).find(value => value instanceof NavigationRoute) as InstanceType<typeof NavigationRoute>
  expect(route).toBeDefined()
  const match = (path: string) => route.match({ event: new Event('fetch') as ExtendableEvent, request: { mode: 'navigate' } as Request, url: new URL(path, 'https://synthetic.invalid'), sameOrigin: true })
  for (const prefix of ['api', 'platform', 'auth', 'sanctum', 'health']) {
    for (const suffix of ['', '?probe=1', '/__qa-probe?probe=1']) expect(match(`/${prefix}${suffix}`), prefix + suffix).toBe(false)
    for (const path of [`/%${prefix.charCodeAt(0).toString(16)}${prefix.slice(1)}?probe=1`, `/${prefix}%2f__qa-probe`, `/%2f${prefix}`, `/safe/%252e%252e/${prefix}`, `/safe/../${prefix}`, `/safe/%2e%2e/${prefix}`, `/${prefix}%252f__qa-probe`, `/safe/%5c..%5c${prefix}`, `/%0a/${prefix}`]) expect(match(path), path).toBe(false)
  }
  for (const path of ['/', '/profiles', '/profiles?return=/api', '/%70rofiles', '/account/platform-login', '/platform-login', '/apiary', '/authentic', '/account/attendance?church=synthetic']) expect(match(path), path).toBe(true)
  for (const path of ['/%broken', '/%25252525252561pi']) expect(match(path), path).toBe(false)
  expect(route.match({ event: new Event('fetch') as ExtendableEvent, request: { mode: 'navigate' } as Request, url: new URL('https://external.invalid/profiles'), sameOrigin: false })).toBe(false)
})
