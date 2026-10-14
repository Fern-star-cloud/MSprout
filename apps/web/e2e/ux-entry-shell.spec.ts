import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { bootstrap, churchId, ministryId, json, mockCsrf, expectNoSeriousAccessibilityIssues } from './support'

// Only isolated contexts and intercepted API fixtures; no real accounts or data.
test.use({ serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC' })
async function workspace(context: BrowserContext, role: 'owner' | 'teacher', state = 'ready') {
  let deviceId = ''
  await mockCsrf(context)
  await context.route('**/api/**', route => json(route, { data: [] }))
  await context.route('**/auth/session', route => json(route, { id: 11, email_verified: true, mfa_confirmed: true, workspaces: [{ church_id: churchId, name: 'Synthetic church serving families across the community and neighbouring districts', role }] }))
  await context.route('**/api/me', route => json(route, { id: 11, email_verified: true, active_session: { mfa_confirmed: true }, memberships: [{ church_id: churchId, role, status: 'active' }], assignments: { ministry_ids: [ministryId] } }))
  await context.route('**/api/ministries**', route => state === 'error' ? json(route, {}, 503) : json(route, { data: state === 'empty' ? [] : [{ id: ministryId, name: 'Sunday Explorers Ministry welcoming children from every neighbourhood and community', status: 'active', version: 1 }] }))
  await context.route('**/api/offline/bootstrap**', route => {
    deviceId = new URL(route.request().url()).searchParams.get('device_id')!
    return json(route, bootstrap('11', [], deviceId))
  })
  await context.route('**/api/sync/pull**', route => json(route, { changes: [], page: { next_cursor: '0', has_more: false }, lease: bootstrap('11', [], deviceId).lease }))
  await context.route('**/logout', route => route.fulfill({ status: 204 }))
}

async function layout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  for (const control of await page.locator('button:visible, .home-button:visible, .phone-navigation a:visible, .device-entry-rail a:visible').all()) {
    const box = await control.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
}

for (const role of ['owner', 'teacher'] as const) {
  test(`entry shell visual matrix ${role}`, async ({ page, context }, info) => {
    await workspace(context, role)
    await page.clock.setFixedTime(new Date('2026-10-14T00:00:00Z'))
    await page.goto('/account/home?church=' + churchId)
    await expect(page.locator('.home-card').first()).toBeVisible()
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await layout(page)
      await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true })
      if (width === 768) {
        await page.getByRole('button', { name: 'Menu', exact: true }).click()
        await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
        await page.screenshot({ path: info.outputPath('drawer-768.png'), fullPage: true })
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused()
      }
      if (width === 390) await expectNoSeriousAccessibilityIssues(page)
    }
    await page.getByRole('navigation', { name: 'Phone navigation' }).getByRole('link', { name: 'More', exact: true }).click()
    await expect(page.getByRole('navigation', { name: 'More destinations' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('more-320.png'), fullPage: true })
    await layout(page)
  })
}

test('entry shell visual matrix public form and safe feedback', async ({ page, context }, info) => {
  await mockCsrf(context)
  await context.route('**/login', route => route.request().method() === 'POST' ? json(route, { code: 'validation_failed', field_errors: { email: ['Not rendered raw'] } }, 422) : route.fallback())
  await page.goto('/account/login')
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await layout(page)
    await page.screenshot({ path: info.outputPath(`login-${width}.png`), fullPage: true })
  }
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-only-phrase')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await page.screenshot({ path: info.outputPath('login-error-320.png'), fullPage: true })
  await page.getByRole('link', { name: 'Email: Check this field.' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await expectNoSeriousAccessibilityIssues(page)
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await layout(page)
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await layout(page)
})

test('entry shell visual matrix encrypted picker and PIN', async ({ page, context }, info) => {
  await workspace(context, 'teacher')
  await page.clock.setFixedTime(new Date('2026-10-14T00:00:00Z'))
  await page.goto('/account/prepare')
  await page.getByRole('button', { name: 'Continue to local PIN' }).click()
  await page.getByLabel('Choose a 6–12 digit local PIN').fill('000123')
  await page.getByLabel('Confirm local PIN').fill('000123')
  await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
  await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Lock profile', exact: true }).click()
  await page.goto('/profiles')
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('button', { name: 'Use profile 1' })).toBeVisible()
    await layout(page)
    await page.screenshot({ path: info.outputPath(`profiles-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Use profile 1' }).click()
    await expect(page.getByLabel('Local PIN')).toHaveAttribute('type', 'password')
    await expect(page.getByLabel('Local PIN')).toHaveAttribute('inputmode', 'numeric')
    await layout(page)
    await page.screenshot({ path: info.outputPath(`pin-${width}.png`), fullPage: true })
    if (width === 390) await expectNoSeriousAccessibilityIssues(page)
    await page.getByRole('button', { name: '‹ Profiles' }).click()
  }
  await context.setOffline(true)
  await expect(page.locator('.device-entry-connection')).toContainText('Offline')
  await page.screenshot({ path: info.outputPath('profiles-offline-320.png'), fullPage: true })
})

for (const state of ['empty', 'error']) test(`Teacher ${state} remains distinct and recoverable`, async ({ page, context }, info) => {
  await workspace(context, 'teacher', state)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/account/home')
  await expect(page.getByText(state === 'empty' ? 'No assigned ministries available' : /Assigned ministries are unavailable/)).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'My ministries' })).toBeVisible()
  await layout(page)
  await page.screenshot({ path: info.outputPath(`teacher-${state}-320.png`), fullPage: true })
  await expectNoSeriousAccessibilityIssues(page)
})

test('church navigation retains context without duplicate authorization requests or a new loading flash', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await workspace(context, 'owner')
  const requests: string[] = []
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path === '/auth/session' || path === '/api/me') requests.push(path) })
  await page.goto('/account/home?church=' + churchId)
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.assign(window, { uxLoadingFlashes: 0 })
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.textContent?.includes('Loading church workspace…')) Object.assign(window, { uxLoadingFlashes: Number(Reflect.get(window, 'uxLoadingFlashes')) + 1 })
    }).observe(document.getElementById('main-content')!, { childList: true, subtree: true })
  })
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'People', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'People destinations' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp('people\\?church=' + churchId))
  // Existing route validation remains mandatory: one session + membership request per destination.
  await expect.poll(() => requests).toEqual(['/auth/session', '/api/me', '/auth/session', '/api/me'])
  expect(await page.evaluate(() => Reflect.get(window, 'uxLoadingFlashes'))).toBe(0)
})

test('entry uses measured foundation tokens and truthful busy feedback', async ({ page, context }, info) => {
  await mockCsrf(context)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await context.route('**/login', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await pending
    await json(route, {}, 429)
  })
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/account/login')
  const primary = page.getByRole('button', { name: 'Sign in', exact: true })
  const secondary = page.getByRole('button', { name: 'Continue signed-in session' })
  await expect(primary).toHaveClass(/ui-button-primary/)
  await expect(secondary).toHaveClass(/ui-button-secondary/)
  const measurements = await page.evaluate(() => {
    const style = (selector: string) => { const element = document.querySelector(selector)!; const s = getComputedStyle(element), r = element.getBoundingClientRect(); return { font: s.fontFamily, size: s.fontSize, color: s.color, background: s.backgroundColor, gradient: s.backgroundImage, radius: s.borderRadius, width: r.width, height: r.height } }
    return { heading: style('#auth-heading'), primary: style('.church-auth .ui-button-primary'), secondary: style('.church-auth .ui-button-secondary'), label: style('.church-auth label'), field: style('.church-auth input'), card: style('.church-auth') }
  })
  expect(measurements.heading.size).toBe('24px')
  expect(measurements.heading.color).toBe('rgb(16, 44, 70)')
  expect(measurements.primary.gradient).toContain('rgb(7, 104, 237)')
  expect(measurements.primary.radius).toBe('12px')
  expect(measurements.label.size).toBe('14px')
  expect(measurements.field.size).toBe('16px')
  expect(measurements.field.height).toBeGreaterThanOrEqual(48)
  expect(measurements.field.radius).toBe('8px')
  await info.attach('computed-foundations', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-only-phrase')
  try {
    await primary.click()
    await expect(page.getByRole('button', { name: 'Please wait…' })).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('button', { name: 'Please wait…' })).toBeDisabled()
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('login-busy-390.png'), fullPage: true })
  } finally { release() }
  await expect(page.getByRole('alert')).toContainText('Too many attempts')
})
