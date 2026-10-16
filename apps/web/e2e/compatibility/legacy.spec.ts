import { test, expect, chromium, webkit, type Page, type BrowserContext } from '@playwright/test'
import { mkdtempSync, writeFileSync, readFileSync, realpathSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'
import { startCompatibilityServer, loadBuild } from '../../../../scripts/compatibility/server.mjs'
import { deviceRecords } from '../support'

// Public synthetic local-only PIN, never a human profile credential.
const pin = '184629'
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')

async function decryptIntent(page: Page) {
  const records = await deviceRecords(page)
  return page.evaluate(async ({ records, pin }) => {
    const profile = records.profiles[0]
    const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: decode(profile.salt as string), iterations: profile.iterations as number, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const decrypt = async (key: CryptoKey, envelope: { iv: string; ciphertext: string; schemaVersion: number }, purpose: string) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: new TextEncoder().encode(`MinistrySprout:${profile.id}:${envelope.schemaVersion}:${purpose}`), tagLength: 128 }, key, decode(envelope.ciphertext))
    const wrapped = profile.wrappedDataKey as { iv: string; ciphertext: string; schemaVersion: number }
    const raw = await decrypt(key, wrapped, 'wrapped-data-key')
    const dataKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt'])
    new Uint8Array(raw).fill(0)
    const result: Record<string, unknown[]> = {}
    for (const [table, purpose] of [['attendanceDrafts', 'attendance-draft'], ['outboxEvents', 'outbox-event']]) {
      result[table] = await Promise.all(records[table].map(async row => JSON.parse(new TextDecoder().decode(await decrypt(dataKey, row.encrypted as typeof wrapped, `${purpose}:${row.id}`)))))
    }
    return result
  }, { records, pin })
}

async function unlock(page: Page, offlineContext?: BrowserContext) {
  await page.goto('/profiles')
  await page.getByRole('button', { name: 'Use profile 1', exact: true }).click()
  // Enter genuine browser-offline mode only after the cached page is loaded.
  // WebKit's offline emulation rejects worker-served document navigations.
  if (offlineContext) await offlineContext.setOffline(true)
  await page.getByLabel('Local PIN', { exact: true }).fill(pin)
  await page.getByRole('button', { name: 'Unlock Profile 1', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Take attendance' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume attendance' }).click()
  await expect(page.getByRole('button', { name: 'Mark B1 Student 1 present' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Mark B1 Student 2 absent' })).toHaveAttribute('aria-pressed', 'true')
}

test('frozen legacy preserves encrypted intent across locks, offline reopen, windows and lease denial', async ({ browserName }, info) => {
  const manifestPath = resolve(process.env.COMPAT_B1_MANIFEST!)
  const output = realpathSync(process.env.COMPAT_B1_OUTPUT!)
  const allowed = resolve(info.config.rootDir, '../../../../.git/msprout-compat-b1-20261016')
  const distance = relative(allowed, output)
  if (distance.startsWith('..') || isAbsolute(distance)) throw Error('Browser storage must stay in ignored B1 output')
  const { manifest, root } = loadBuild(manifestPath)
  const server = await startCompatibilityServer({ manifestPath })
  const userDataDir = mkdtempSync(resolve(output, `${browserName}-profile-`))
  const blocked: string[] = [], cases: string[] = []
  const launches: string[] = []
  let context: BrowserContext | undefined
  const launch = async () => {
    const engine = browserName === 'webkit' ? webkit : chromium
    context = await engine.launchPersistentContext(userDataDir, {
      headless: true, serviceWorkers: 'allow', baseURL: server.origin, viewport: { width: 1280, height: 900 },
      ...(browserName === 'webkit' ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : { channel: 'chrome' }),
    })
    launches.push(context.browser()?.version() ?? browserName)
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === server.origin) return route.continue()
      blocked.push(new URL(route.request().url()).origin); return route.abort('blockedbyclient')
    })
    await context.tracing.start({ screenshots: true, snapshots: true })
    const page = context.pages()[0] ?? await context.newPage()
    await page.goto(server.origin + '/profiles?church=00000000-0000-4000-8000-000000000010')
    return page
  }
  const close = async (name: string) => {
    if (!context) return
    await context.tracing.stop({ path: info.outputPath(`${name}.zip`) })
    await context.close(); context = undefined
  }
  try {
    let page = await launch()
    const index = await page.request.get(server.origin + '/index.html')
    expect(sha(await index.body())).toBe(manifest.assetHashes['index.html'])
    const application = Object.keys(manifest.assetHashes).find(path => /^assets\/.*\.js$/.test(path))!
    expect(sha(await (await page.request.get(server.origin + '/' + application)).body())).toBe(manifest.assetHashes[application])
    expect((await index.headers())['x-b1-source-sha']).toBe(manifest.sourceSha)
    expect(await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname))).toContain('/' + application)
    expect(sha(readFileSync(resolve(root, 'service-worker.js')))).toBe(manifest.assetHashes['service-worker.js'])
    await page.getByRole('link', { name: 'Prepare this device', exact: true }).click()
    await page.getByRole('button', { name: 'Continue to local PIN' }).click()
    await page.getByLabel('Choose a 6–12 digit local PIN').fill(pin)
    await page.getByLabel('Confirm local PIN', { exact: true }).fill(pin)
    await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
    await expect(page.getByRole('button', { name: 'Open Attendance' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Open Attendance' }).click()
    await page.getByRole('button', { name: 'Start attendance' }).click()
    for (const name of ['Mark B1 Student 1 present', 'Mark B1 Student 2 absent']) {
      await page.getByRole('button', { name }).click()
      await expect(page.getByRole('button', { name })).toBeEnabled()
    }
    const before = await deviceRecords(page), intent = await decryptIntent(page)
    // Supported online profile switching logs out and sets this operational flag.
    const retained = { ...before, profiles: before.profiles.map(row => ({ ...row, requiresReauthentication: true })) }
    expect(before.profiles).toHaveLength(1); expect(before.attendanceDrafts).toHaveLength(1); expect(before.outboxEvents).toHaveLength(3)
    expect(before.serverCursors).toMatchObject([{ cursor: '0' }])
    expect(intent.attendanceDrafts).toMatchObject([{ entries: [{ state: 'present' }, { state: 'absent' }], status: 'draft' }])
    expect(intent.outboxEvents).toHaveLength(3)
    expect(JSON.stringify(before)).not.toMatch(/B1 Student|attendance\.student_marked|student_ids/)
    cases.push('actual-pinned-assets', 'genuine-profile-creation', 'draft-and-three-pending-events', 'real-encryption-and-intent')
    writeFileSync(info.outputPath('encrypted-before.json'), JSON.stringify(before, null, 2))
    await page.screenshot({ path: info.outputPath('saved-legacy.png'), fullPage: true })
    await page.goto('/profiles')
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    server.requestWaitingProbe()
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
    await expect(page.getByRole('region', { name: 'Application update' })).toBeVisible()
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting?.state)).toBe('installed')
    await page.getByRole('button', { name: 'Update when safe' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Safe updating is not available' })).toBeVisible()
    expect(await deviceRecords(page)).toEqual(before)
    const second = await context!.newPage(); await second.goto(server.origin + '/profiles')
    expect(await deviceRecords(second)).toEqual(before)
    await second.close(); await page.bringToFront()
    cases.push('waiting-worker-refuses-unsafe-activation', 'second-tab-retains-same-encrypted-records')
    await close('first-session')
    page = await launch()
    expect(await deviceRecords(page)).toEqual(before)
    await unlock(page)
    expect(await decryptIntent(page)).toEqual(intent)
    expect(await deviceRecords(page)).toEqual(retained)
    cases.push('persistent-browser-relaunch', 'original-pin-and-profile-resume')
    server.setReachable(false)
    const offline = await page.reload()
    expect(offline?.fromServiceWorker()).toBe(true)
    expect(await deviceRecords(page)).toEqual(retained)
    await unlock(page, context!)
    expect(await decryptIntent(page)).toEqual(intent)
    await context!.setOffline(false)
    cases.push('unreachable-origin-cached-reload-and-browser-offline-resume')
    server.setReachable(true)
    await page.goto('/account/sync')
    server.setAuthorized(false)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Unlock existing profile', exact: true })).toBeDisabled()
    expect(await deviceRecords(page)).toEqual(retained)
    cases.push('authorization-denial-retains-encrypted-work')
    server.setAuthorized(true)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Unlock existing profile', exact: true })).toBeEnabled()
    await page.getByLabel('Existing local PIN', { exact: true }).fill(pin)
    await page.getByRole('button', { name: 'Unlock existing profile', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Continue synchronization', exact: true })).toBeEnabled()
    expect(await deviceRecords(page)).toEqual(retained)
    cases.push('fixture-account-restoration-and-original-pin-unlock-without-transfer')
    // A full navigation drops memory-only keys. Use the supported profile flow
    // again; do not inject an unlocked key into the new document.
    await unlock(page)
    const expires = String(before.profiles[0].leaseExpiresAt)
    await page.clock.setFixedTime(new Date(Date.parse(expires) + 1000))
    // A clock jump is not a timer firing. Exercise an actual authorization-
    // checked write, rather than claiming a pre-existing lease timer elapsed.
    await page.getByRole('button', { name: 'Mark B1 Student 2 present' }).click()
    await expect(page.getByRole('alert')).toContainText('This change was not saved.')
    await expect(page.getByRole('button', { name: 'Mark B1 Student 2 absent' })).toHaveAttribute('aria-pressed', 'true')
    expect(await deviceRecords(page)).toEqual(retained)
    cases.push('expired-lease-denies-marking-with-records-preserved')
    expect(server.requests.filter(row => row.path === '/api/sync/push' || row.path === '/api/sync/pull')).toEqual([])
    expect(blocked).toEqual([])
    writeFileSync(info.outputPath('evidence.json'), JSON.stringify({ sourceSha: manifest.sourceSha, assets: manifest.assetHashes, userDataDir, origin: server.origin, launches, cases, encryptedBeforeSha256: sha(JSON.stringify(before)), profileId: before.profiles[0].id, eventIds: before.outboxEvents.map(row => row.id), cursor: before.serverCursors, requests: server.requests, waitingProbe: 'same-application worker comment; no distinct-build transition claim', futureCapableReader: 'NOT AVAILABLE; NOT TESTED', realBackendAuthorization: 'NOT TESTED; synthetic fixture only' }, null, 2))
  } finally { await close('final-session'); await server.stop() }
})
