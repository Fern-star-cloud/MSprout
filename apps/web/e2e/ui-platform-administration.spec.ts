import { expect, test, type Page, type Route } from '@playwright/test'
import { addProfile, bootstrap, expectNoSeriousAccessibilityIssues, json, mockCsrf, outboxCount } from './support'

test.use({ serviceWorkers: 'block' })
const id = '00000000-0000-4000-8000-000000000060'
const session = { handle: 'sage.dev', online_only: true }
const application = { id, church_name: 'Synthetic application', city: 'Synthetic city', status: 'pending', address: null, timezone: 'Asia/Manila', church_id: null, category: null, reason: null, submitted_at: '2026-10-11T00:00:00Z', decided_at: null }
const health = { status: 'degraded', checked_at: '2026-10-11T00:00:00Z', api: { status: 'ok' }, database: { status: 'ok', size_bytes: 2048, growth_bytes_24h: null }, queue: { status: 'degraded', pending_count: 2, oldest_age_seconds: 70, failed_24h: 1 }, scheduler: { status: 'degraded', last_run_at: null }, birthdays: { status: 'ok', last_dispatch_at: null, failed_24h: 0 }, synchronization: { status: 'ok', events_24h: 0, rejected_24h: 0, open_conflicts: 0, error_rate: 0 } }
const event = { id: '00000000-0000-4000-8000-000000000070', category: 'platform', action: 'application.approved', result: 'success', occurred_at: '2026-10-11T00:00:00Z', correlation_id: '00000000-0000-4000-8000-000000000080', actor_id: 'PRIVATE_SENTINEL', target_id: 'PRIVATE_SENTINEL', metadata: { secret: 'PRIVATE_SENTINEL' } }

test.beforeEach(async ({ context }) => {
  await mockCsrf(context)
  await context.route('**/api/**', route => json(route, {}, 503))
  await context.route('**/platform/**', route => json(route, {}, 503))
  await context.route('**/platform/me', route => json(route, session))
  await context.route('**/platform/csrf-token', route => json(route, { csrf_token: 'synthetic-platform-only' }))
  await context.route('**/platform/applications?**', route => {
    const status = new URL(route.request().url()).searchParams.get('status')
    return json(route, { data: [{ ...application, status }], page: 1, has_more: false })
  })
  await context.route(`**/platform/applications/${id}`, route => json(route, application))
  await context.route('**/platform/system-health', route => json(route, health))
  await context.route('**/health/live', route => json(route, { status: 'ok' }))
  await context.route('**/health/ready', () => { throw new Error('Readiness must not be requested with a Platform session') })
  await context.route('**/platform/audit-events?**', route => {
    const url = new URL(route.request().url())
    return json(route, { scope: 'platform', data: [event], page: Number(url.searchParams.get('page')), per_page: Number(url.searchParams.get('per_page')), has_more: url.searchParams.get('page') === '1' })
  })
})
async function open(page: Page) {
  await page.goto('/account/platform-applications')
  await page.getByRole('button', { name: 'Review Synthetic application' }).click()
  await expect(page.getByText('Asia/Manila')).toBeVisible()
}
async function visibleFocus(page: Page) {
  expect(await page.evaluate(() => {
    const element = document.activeElement as HTMLElement
    const rect = element.getBoundingClientRect()
    const nav = document.querySelector('.platform-phone-navigation')?.getBoundingClientRect()
    return rect.top >= 0 && rect.bottom <= (nav?.height ? nav.top : innerHeight)
  })).toBe(true)
}

test('confirmation cancellation, keyboard trap and exact approval remain accessible and server authoritative', async ({ page, context }) => {
  let held!: Route, posts = 0
  await context.route(`**/platform/applications/${id}/approve`, route => {
    posts++; expect(route.request().postData()).toBeNull()
    expect(route.request().headers()['x-csrf-token']).toBe('synthetic-platform-only')
    expect(route.request().headers()['x-xsrf-token']).toBeUndefined(); held = route
  })
  await open(page)
  await page.screenshot({ path: test.info().outputPath('application-detail.png'), fullPage: true })
  const trigger = page.getByRole('button', { name: 'Approve application' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Confirm approval' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Confirm approval' })).toBeFocused()
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({ path: test.info().outputPath('application-confirmation.png'), fullPage: true })
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused(); await visibleFocus(page); expect(posts).toBe(0)
  await trigger.click(); await dialog.getByRole('button', { name: 'Confirm approval' }).dblclick()
  await expect.poll(() => posts).toBe(1); await expect(dialog.getByRole('button', { name: 'Confirm approval' })).toBeDisabled()
  await expect(page.getByText('Approved', { exact: true })).toHaveCount(0)
  await json(held, { ...application, status: 'approved', church_id: '00000000-0000-4000-8000-000000000090', decided_at: '2026-10-11T00:01:00Z' })
  await expect(page.getByText('Approved', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Church applications', exact: true })).toBeFocused(); await visibleFocus(page)
  await expect(trigger).toHaveCount(0); await expectNoSeriousAccessibilityIssues(page)
})
test('rejection requires a reason and confirmation, preserving non-secret input after field errors', async ({ page, context }) => {
  let posts = 0
  await context.route(`**/platform/applications/${id}/reject`, route => {
    posts++; expect(route.request().postDataJSON()).toEqual({ category: 'other', reason: 'Synthetic explanation' })
    return json(route, { field_errors: { reason: ['PRIVATE_SENTINEL'] } }, 422)
  })
  await open(page)
  await page.getByRole('button', { name: 'Reject application' }).click(); expect(posts).toBe(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Reason for applicant').fill('   ')
  await page.getByRole('button', { name: 'Reject application' }).click()
  await expect(page.getByRole('alert')).toContainText('Enter a reason'); expect(posts).toBe(0)
  await page.getByLabel('Decision category').selectOption('other'); await page.getByLabel('Reason for applicant').fill('Synthetic explanation')
  await page.getByRole('button', { name: 'Reject application' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm rejection' }); await expect(dialog.getByText('Synthetic explanation')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click(); expect(posts).toBe(0)
  await expect(page.getByRole('button', { name: 'Reject application' })).toBeFocused()
  await visibleFocus(page)
  await page.getByRole('button', { name: 'Reject application' }).click(); await dialog.getByRole('button', { name: 'Confirm rejection' }).click()
  await expect(page.getByRole('alert')).toBeFocused(); await visibleFocus(page)
  await expect(page.getByLabel('Reason for applicant')).toHaveValue('Synthetic explanation'); expect(posts).toBe(1)
  expect(await page.locator('main').ariaSnapshot()).not.toContain('PRIVATE_SENTINEL'); await expectNoSeriousAccessibilityIssues(page)
})
test('a stale preflight prevents a mutation and displays the actual immutable decision', async ({ page, context }) => {
  await open(page)
  let posts = 0
  await context.route(`**/platform/applications/${id}/*`, route => { posts++; return json(route, {}, 500) })
  await context.route(`**/platform/applications/${id}`, route => json(route, { ...application, status: 'rejected', category: 'incomplete', reason: 'Synthetic prior reason', decided_at: '2026-10-11T00:01:00Z' }))
  await page.getByRole('button', { name: 'Approve application' }).click(); await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByText('Rejected', { exact: true })).toBeVisible(); expect(posts).toBe(0)
  await expect(page.getByText('Reason: Synthetic prior reason')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve application' })).toHaveCount(0); await expectNoSeriousAccessibilityIssues(page)
})
test('uncertain decisions reconcile through reads and remain blocked through an assurance remount', async ({ page, context }) => {
  let posts = 0, decided = false
  await context.route(`**/platform/applications/${id}/approve`, route => { posts++; return route.abort('failed') })
  await context.route(`**/platform/applications/${id}`, route => json(route, { ...application, status: decided ? 'approved' : 'pending' }))
  await open(page)
  await page.getByRole('button', { name: 'Approve application' }).click(); await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByRole('button', { name: 'Check decision status' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve application' })).toBeDisabled()
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.getByRole('button', { name: 'Review Synthetic application' }).click()
  await expect(page.getByRole('button', { name: 'Approve application' })).toBeDisabled()
  await page.getByRole('button', { name: 'Check decision status' }).click()
  await expect(page.getByRole('button', { name: 'Check decision status' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Approve application' })).toBeDisabled(); expect(posts).toBe(1)
  decided = true
  await page.getByRole('button', { name: 'Check decision status' }).click()
  await expect(page.getByText('Approved', { exact: true })).toBeVisible(); expect(posts).toBe(1)
  await expectNoSeriousAccessibilityIssues(page)
})
test('queue filters, empty states and responsive detail keep authorized fields readable', async ({ page, context }) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/account/platform-applications')
    await page.getByLabel('Application status').selectOption('approved'); await expect(page.getByRole('listitem').getByText('Approved', { exact: true })).toBeVisible()
    await page.getByLabel('Application status').selectOption('rejected'); await expect(page.getByRole('listitem').getByText('Rejected', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expectNoSeriousAccessibilityIssues(page)
  }
  await context.route('**/platform/applications?**', route => json(route, { data: [], page: 1, has_more: false }))
  await page.getByRole('button', { name: 'Refresh applications' }).click(); await expect(page.getByText('No applications in this category.')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('applications-responsive.png'), fullPage: true })
})
test('health separates degraded server metrics, liveness, readiness and unavailable requests', async ({ page, context }) => {
  await page.goto('/account/platform-system-health')
  await expect(page.getByText('Responding', { exact: true })).toBeVisible(); await expect(page.getByText('Degraded', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Readiness is unavailable/)).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('aggregate-health.png'), fullPage: true })
  await expectNoSeriousAccessibilityIssues(page)
  await context.route('**/platform/system-health', route => json(route, { message: 'PRIVATE_SENTINEL' }, 503))
  await context.route('**/health/live', route => route.abort('failed'))
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('does not prove the backend is unhealthy')
  await expect(page.getByText('Unknown — probe unavailable')).toBeVisible()
  await expect(page.getByText('Degraded', { exact: true })).toHaveCount(0)
  expect(await page.locator('main').ariaSnapshot()).not.toContain('PRIVATE_SENTINEL')
  await page.screenshot({ path: test.info().outputPath('health-unavailable.png'), fullPage: true })
  await expectNoSeriousAccessibilityIssues(page)
})
test('audit pages use only supported filters and sanitized chronological fields', async ({ page }) => {
  await page.goto('/account/platform-audit'); await expect(page.getByText('Application approved')).toBeVisible()
  expect(await page.locator('main').ariaSnapshot()).not.toContain('PRIVATE_SENTINEL')
  await page.screenshot({ path: test.info().outputPath('sanitized-audit.png'), fullPage: true })
  await page.getByLabel('Events per page').selectOption('50')
  await expect(page.getByText('Application approved')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.getByText('Page 2')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Platform audit', exact: true })).toBeFocused(); await visibleFocus(page)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled(); await expectNoSeriousAccessibilityIssues(page)
})
test('expired audit access hides all events and suppresses a late protected result', async ({ page, context }) => {
  let held!: Route
  await context.route('**/platform/audit-events?**', route => { held = route })
  await page.goto('/account/platform-audit'); await expect.poll(() => Boolean(held)).toBe(true)
  await context.route('**/platform/me', route => json(route, {}, 401))
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await expect(page.getByRole('alert')).toContainText('expired')
  await json(held, { scope: 'platform', page: 1, per_page: 25, data: [event], has_more: false })
  expect(await page.locator('main').ariaSnapshot()).not.toMatch(/Application approved|PRIVATE_SENTINEL|sage\.dev/)
  await expectNoSeriousAccessibilityIssues(page)
})
test('a locally detected identity change removes the verified shell before any decision', async ({ page, context }) => {
  let posts = 0
  await context.route(`**/platform/applications/${id}/approve`, route => { posts++; return json(route, {}, 500) })
  await open(page)
  await context.route('**/platform/me', route => json(route, { handle: 'church-user', online_only: true }))
  await page.getByRole('button', { name: 'Approve application' }).click()
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByRole('alert')).toContainText('Platform access is unavailable')
  await expect(page.getByRole('button', { name: 'Sign out of platform' })).toHaveCount(0)
  expect(await page.locator('main').ariaSnapshot()).not.toMatch(/Synthetic application|sage\.dev|Asia\/Manila/)
  expect(posts).toBe(0); await expectNoSeriousAccessibilityIssues(page)
})
test('a failed queue page removes its records and old pagination without a misleading empty result', async ({ page, context }) => {
  await context.route('**/platform/applications?**', route => {
    const page = Number(new URL(route.request().url()).searchParams.get('page'))
    return page === 1 ? json(route, { data: [application], page: 1, has_more: true }) : json(route, { message: 'PRIVATE_SENTINEL' }, 503)
  })
  await page.goto('/account/platform-applications')
  await expect(page.getByRole('button', { name: 'Review Synthetic application' })).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click(); await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await expect(page.getByText('No applications in this category.')).toHaveCount(0)
  expect(await page.locator('main').ariaSnapshot()).not.toMatch(/Synthetic application|PRIVATE_SENTINEL/)
  await expectNoSeriousAccessibilityIssues(page)
})
async function fingerprint(page: Page) { return page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('ministry-sprout-offline'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
  try {
    const tables = Array.from(db.objectStoreNames).sort(), transaction = db.transaction(tables)
    const records = await Promise.all(tables.map(table => new Promise(resolve => { const read = transaction.objectStore(table).getAll(); read.onsuccess = () => resolve({ table, rows: read.result }) })))
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(records)))
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
  } finally { db.close() }
}) }
test('Platform review, health and audit preserve every encrypted store with pending attendance exactly', async ({ page, context }) => {
  await context.route('**/api/offline/bootstrap**', route => json(route, bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)))
  await context.route('**/logout', route => route.fulfill({ status: 204 }))
  await addProfile(page); await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
  await expect(page.getByRole('button', { name: 'Mark Pilot Student A present' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Mark Pilot Student A present' })).toBeEnabled()
  await expect.poll(() => outboxCount(page)).toBeGreaterThan(0)
  const before = await fingerprint(page)
  await context.route(`**/platform/applications/${id}/approve`, route => json(route, { ...application, status: 'approved' }))
  await open(page); await page.getByRole('button', { name: 'Approve application' }).click(); await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByText('Approved', { exact: true })).toBeVisible(); expect(await fingerprint(page)).toBe(before)
  await page.goto('/account/platform-system-health'); await expect(page.getByText('Responding')).toBeVisible(); expect(await fingerprint(page)).toBe(before)
  await page.goto('/account/platform-audit'); await expect(page.getByText('Application approved')).toBeVisible(); expect(await fingerprint(page)).toBe(before)
})
