import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { startSnapshotBrowserServer } from '../../../../scripts/compatibility/snapshots/browser-server.mjs'
import { deviceRecords, expectNoSeriousAccessibilityIssues } from '../support'

for (const width of [390, 1440]) test('qualified snapshot HTTP preserves real encrypted pending work at ' + width, async ({ page, context, browserName }, info) => {
  const server = await startSnapshotBrowserServer(resolve(process.env.COMPAT_SNAPSHOTS_ASSETS!), process.env.COMPAT_SNAPSHOTS_API!)
  await context.route('**/*', route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort('blockedbyclient'))
  const errors: string[] = []
  const interruptionErrors: string[] = []
  let interrupting = false
  page.on('pageerror', error => {
    const detail = error.name + ': ' + error.message.replaceAll(server.fixture.password, '[disposable-secret]').replaceAll(server.fixture.email, '[synthetic-identity]')
    // Native WebKit reports this exact deliberately cut worker fetch globally.
    // Assert it separately, only inside the verified interruption; never ignore
    // arbitrary load errors, errors outside this phase, or additional failures.
    if (browserName === 'webkit' && interrupting && detail === 'FetchEvent.respondWith received an error: Load failed'
      && JSON.stringify(server.interruption()) === JSON.stringify({ interrupted: true, status: 200 })) interruptionErrors.push(detail)
    else errors.push(detail)
  })
  try {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(server.origin + '/account/login')
    await page.getByLabel('Email', { exact: true }).fill(server.fixture.email)
    await page.getByLabel('Password', { exact: true }).fill(server.fixture.password)
    const [login] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/login' && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Sign in', exact: true }).click(),
    ])
    expect(login.ok()).toBe(true)
    // Do not race unauthenticated API polling (and its guest Set-Cookie) with
    // login's session rotation. Observe the real completed browser transition.
    await expect(page.getByRole('link', { name: 'Continue to church Home', exact: true })).toBeVisible()
    await expect.poll(async () => (await page.request.get(server.origin + '/auth/session')).status()).toBe(200)
    await page.goto(server.origin + '/account/prepare?church=' + server.fixture.church)
    await page.getByRole('button', { name: 'Continue to local PIN' }).click()
    await page.getByLabel('Choose a 6–12 digit local PIN').fill('184629')
    await page.getByLabel('Confirm local PIN', { exact: true }).fill('184629')
    await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
    await expect(page.getByRole('button', { name: 'Open Attendance' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Open Attendance' }).click()
    await page.getByRole('button', { name: 'Start attendance' }).click()
    await page.getByRole('button', { name: 'Mark Synthetic Browser present' }).click()
    await expect(page.getByRole('button', { name: 'Mark Synthetic Browser present' })).toBeEnabled()
    const before = await deviceRecords(page)
    expect(before.outboxEvents.length).toBeGreaterThan(0)
    expect(JSON.stringify(before)).not.toContain('Synthetic Browser')
    const device = before.profiles[0].deviceId as string
    const localSession = before.attendanceDrafts[0].id as string
    expect(device).toMatch(/^[0-9a-f-]{36}$/i)
    expect(localSession).toMatch(/^[0-9a-f-]{36}$/i)
    expect(await server.activate()).toEqual({ active: true })
    const resource = '/api/offline/bootstrap/recovery'
    const send = async (method: string, path: string, body?: unknown, csrf = true, extra: Record<string, string> = {}) => page.evaluate(async input => {
      const headers: Record<string, string> = { Accept: 'application/json', 'X-Church-Id': input.church, ...input.extra }
      if (input.body !== undefined) headers['Content-Type'] = 'application/json'
      if (input.csrf) {
        const token = document.cookie.split('; ').find(part => part.startsWith('XSRF-TOKEN='))?.slice(11)
        if (token) headers['X-XSRF-TOKEN'] = decodeURIComponent(token)
      }
      // Match the established application transport; the document deliberately
      // has no-referrer, while Sanctum needs the same-origin request assurance.
      const response = await fetch(input.path, { method: input.method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'origin', headers, body: input.body === undefined ? undefined : JSON.stringify(input.body) })
      return { status: response.status, cache: response.headers.get('Cache-Control'), data: await response.json() }
    }, { method, path, body, csrf, church: server.fixture.church, extra })
    // Fixed-ASCII v1 map keys use PHP's existing push canonicalization. Unicode
    // values must also match PHP's escaped UTF-16 JSON; plain JSON.stringify
    // hashing would give a different digest for non-ASCII display names.
    const digest = (value: unknown, canonical = true) => page.evaluate(async ({ value, canonical }) => {
      const order = (v: unknown): unknown => Array.isArray(v) ? v.map(order) : v !== null && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, val]) => [k, order(val)])) : v
      const bytes = canonical ? JSON.stringify(order(value)).replace(/[\u0080-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) : value as string
      const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bytes))
      return [...new Uint8Array(hashed)].map(b => b.toString(16).padStart(2, '0')).join('')
    }, { value, canonical })
    const intent = { action: 'begin', schema: 'attendance-recovery-v1', device_id: device, request_id: crypto.randomUUID(), local_generation_id: crypto.randomUUID() }
    expect((await send('POST', resource, intent, false)).status).toBe(419)
    const begin = await send('POST', resource, intent)
    expect(begin.status).toBe(200)
    expect(begin.data.client_recovered).toBe(false)
    expect((await send('POST', resource, intent)).data).toEqual(begin.data)
    const bind = { schema: intent.schema, device_id: device, recovery_id: begin.data.recovery_id, generation: begin.data.generation }
    const upload = await send('POST', resource, { ...bind, action: 'manifest', ordinal: 0, previous_digest: null, items: [{ type: 'reference', session_id: localSession }] })
    expect(upload.status).toBe(200)
    expect(upload.data.events_settled).toBe(false)
    const seal = { ...bind, action: 'seal', input_page_count: 1, input_item_count: 1, input_manifest_digest: await digest(upload.data.page_digest, false) }
    const ready = await send('POST', resource, seal)
    expect(ready.status).toBe(200)
    expect(ready.data.state).toBe('ready')
    expect(await digest(ready.data.page_digests.join(''), false)).toBe(ready.data.manifest_digest)
    const query = new URLSearchParams({ device_id: device, recovery_id: bind.recovery_id, generation: bind.generation, page: '0' })
    const url = resource + '?' + query
    const initialRead = await send('GET', url)
    expect(initialRead.status, JSON.stringify(server.observation())).toBe(200)
    expect(server.observation()).toMatchObject({ status: 200, refererMatches: true })
    // The real worker owns API fetches. Drop an actual broker response instead
    // of relying on Page.route to intercept a service-worker network request.
    interrupting = true
    server.interruptRead()
    await expect(send('GET', url)).rejects.toThrow()
    expect(server.interruption()).toEqual({ interrupted: true, status: 200 })
    const first = await send('GET', url)
    expect(first.status).toBe(200)
    interrupting = false
    expect(first.cache).toBe('no-store, private')
    expect(first.data.client_recovered).toBe(false)
    expect(first.data.page.generation).toBe(bind.generation)
    expect(await digest(first.data.page)).toBe(first.data.page_digest)
    expect((await send('GET', url)).data).toEqual(first.data)
    expect((await send('POST', resource, seal)).data).toEqual(ready.data)
    expect((await send('POST', resource, { ...bind, action: 'confirm' })).status).toBe(422)
    expect((await send('GET', '/api/sync/pull', undefined, true, { 'X-Device-Id': device })).data.code).toBe('full_bootstrap_required')
    expect(await deviceRecords(page)).toEqual(before)
    await expectNoSeriousAccessibilityIssues(page)
    await page.screenshot({ path: info.outputPath('snapshot-prepared-local-work-preserved.png'), fullPage: true })
    expect(await server.shortLifetime()).toEqual({ bounded: true })
    const shortIntent = { ...intent, request_id: crypto.randomUUID(), local_generation_id: crypto.randomUUID() }
    const short = await send('POST', resource, shortIntent)
    expect(short.status).toBe(200)
    expect((await send('GET', url)).status).toBe(409)
    expect(await server.expire(short.data.recovery_id)).toEqual({ expired: true })
    const expiredQuery = new URLSearchParams({ device_id: device, recovery_id: short.data.recovery_id, generation: short.data.generation, page: '0' })
    expect((await send('GET', resource + '?' + expiredQuery)).status).toBe(409)
    expect((await send('POST', resource, shortIntent)).status).toBe(409)
    expect(await server.revoke()).toEqual({ revoked: true })
    expect([401, 403]).toContain((await send('GET', url)).status)
    expect(await deviceRecords(page)).toEqual(before)
    expect(interruptionErrors).toEqual(browserName === 'webkit' ? ['FetchEvent.respondWith received an error: Load failed'] : [])
    expect(errors).toEqual([])
  } finally { await server.close() }
})
