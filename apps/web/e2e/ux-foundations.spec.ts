import { expect, test, type BrowserContext } from '@playwright/test'
import { churchId, ministryId, json, expectNoSeriousAccessibilityIssues } from './support'

// Isolated, synthetic browser contexts only. Every API request is intercepted;
// these presentation fixtures never contact or mutate a running API/database.
test.use({ serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC' })
type Identity = 'anonymous' | 'owner' | 'teacher' | 'platform'
async function fixture(context: BrowserContext, identity: Identity) {
  // Use the existing onboarding fixture contract; never run a real challenge.
  // This does not qualify third-party widget sizing or verification security.
  await context.addInitScript(() => { window.turnstile = { render: (element, options) => { element.textContent = 'Synthetic verification fixture'; options.callback('synthetic-proof'); return 'synthetic-widget' }, remove: () => undefined } })
  await context.route('https://challenges.cloudflare.com/**', route => route.abort('blockedbyclient'))
  await context.route('**/api/**', route => json(route, { data: [] }))
  await context.route('**/auth/session', route => json(route, identity === 'anonymous' ? { code: 'unauthenticated' } : { id: 11, email_verified: true, mfa_confirmed: true, workspaces: [{ church_id: churchId, name: 'Synthetic foundation church', role: identity === 'teacher' ? 'teacher' : 'owner' }] }, identity === 'anonymous' ? 401 : 200))
  await context.route('**/api/me', route => json(route, { id: 11, email_verified: true, active_session: { mfa_confirmed: true }, memberships: [{ church_id: churchId, role: identity === 'teacher' ? 'teacher' : 'owner', status: 'active' }], assignments: { ministry_ids: [ministryId] } }))
  await context.route('**/api/ministries**', route => json(route, { data: [{ id: ministryId, name: 'Synthetic assigned ministry', status: 'active', version: 1 }] }))
  await context.route('**/api/church-applications/current', route => json(route, { application: null }))
  await context.route('**/api/attendance-reports?**', route => {
    const q = new URL(route.request().url()).searchParams
    return json(route, { data: { role: identity, can_export: identity === 'owner', filters: { date_from: q.get('date_from'), date_to: q.get('date_to'), ministry_id: q.get('ministry_id') }, summary: { present_count: 0, absent_count: 0, finalized_record_count: 0, attendance_rate: 0, pending_count: 0, conflict_count: 0, correction_count: 0 }, sessions: [] } })
  })
  await context.route('**/api/birthdays/today', route => json(route, { data: { role: identity, local_date: '2026-10-14', timezone: 'UTC', count: 0, birthdays: [] } }))
  await context.route('**/api/audit-events?**', route => json(route, { scope: identity === 'teacher' ? 'own' : 'church', page: 1, per_page: 25, has_more: false, data: [] }))
  await context.route('**/api/push-subscriptions/config', route => json(route, { configured: false }))
  await context.route('**/platform/**', route => json(route, {}, 401))
  if (identity === 'platform') {
    await context.route('**/platform/me', route => json(route, { handle: 'sage.dev', online_only: true }))
    await context.route('**/platform/applications?**', route => json(route, { data: [], page: 1, per_page: 25, has_more: false }))
    await context.route('**/platform/audit-events?**', route => json(route, { data: [], page: 1, per_page: 25, has_more: false, scope: 'platform' }))
    await context.route('**/platform/system-health', route => json(route, { status: 'healthy', checked_at: '2026-10-14T00:00:00Z', api: { status: 'ok' }, database: { status: 'ok', size_bytes: 2048, growth_bytes_24h: 0 }, queue: { status: 'ok', pending_count: 0, failed_24h: 0, oldest_age_seconds: 0 }, scheduler: { status: 'ok', last_run_at: null }, birthdays: { status: 'ok', failed_24h: 0, last_dispatch_at: null }, synchronization: { status: 'ok', events_24h: 0, rejected_24h: 0, open_conflicts: 0, error_rate: 0 } }))
    await context.route('**/health/live', route => json(route, { status: 'ok' }))
    await context.route('**/health/ready', route => json(route, { status: 'ok' }))
  }
}

const surfaces: { identity: Identity; path: string; selector: string }[] = [
  { identity: 'anonymous', path: '/account/login', selector: '.auth-card' },
  { identity: 'anonymous', path: '/account/forgot-password', selector: '.auth-card' },
  { identity: 'anonymous', path: '/account/platform-login', selector: '.auth-card' },
  { identity: 'anonymous', path: '/profiles', selector: '.device-profiles' },
  { identity: 'owner', path: '/account/application', selector: '#application-heading' },
  { identity: 'owner', path: '/account/home', selector: '.church-home' },
  { identity: 'teacher', path: '/account/home', selector: '.home-ministry-card' },
  { identity: 'owner', path: '/account/prepare', selector: '.preparation-steps' },
  { identity: 'owner', path: '/account/sync', selector: '.sync-screen' },
  { identity: 'owner', path: '/account/attendance', selector: '.attendance-empty' },
  { identity: 'owner', path: '/account/ministries', selector: '.people-page' },
  { identity: 'owner', path: '/account/students', selector: '.people-page' },
  { identity: 'owner', path: '/account/teachers', selector: '.people-page' },
  { identity: 'owner', path: '/account/imports', selector: '.import-steps' },
  { identity: 'owner', path: '/account/conflicts', selector: '#review-heading' },
  { identity: 'owner', path: '/account/reports', selector: '.report-screen' },
  { identity: 'owner', path: '/account/birthdays', selector: '.birthday-screen' },
  { identity: 'owner', path: '/account/audit', selector: '.activity-screen' },
  { identity: 'platform', path: '/account/platform-applications', selector: '#review-heading' },
  { identity: 'platform', path: '/account/platform-system-health', selector: '#system-health-heading' },
  { identity: 'platform', path: '/account/platform-audit', selector: '#audit-heading' },
]

for (const surface of surfaces) {
  test(`foundation consumer ${surface.identity} ${surface.path}`, async ({ page, context }, info) => {
    await fixture(context, surface.identity)
    await page.clock.setFixedTime(new Date('2026-10-14T00:00:00Z'))
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(surface.path + '?church=' + churchId)
    await expect(page.locator(surface.selector).first()).toBeVisible()
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await page.screenshot({ path: info.outputPath(`consumer-${width}.png`), fullPage: true, animations: 'disabled' })
      const layout = await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth + 1, offenders: [...document.querySelectorAll('body *')].filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.right > innerWidth + 1 }).map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right })).slice(0, 12) }))
      expect(layout.fits, JSON.stringify({ width, offenders: layout.offenders })).toBe(true)
      for (const button of await page.locator('button.ui-button:visible').all()) {
        const box = await button.boundingBox()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      if (width === 390) await expectNoSeriousAccessibilityIssues(page)
    }
    expect(errors).toEqual([])
  })
}
