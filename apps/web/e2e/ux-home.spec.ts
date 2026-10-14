import { expect, test, type BrowserContext } from '@playwright/test'
import { churchId, ministryId, json, expectNoSeriousAccessibilityIssues } from './support'

test.use({ serviceWorkers: 'block' })
async function home(context: BrowserContext, role: 'owner' | 'teacher') {
  await context.route('**/auth/session', route => json(route, { id: 11, email_verified: true, workspaces: [{ church_id: churchId, name: 'Sample Community Church', role }] }))
  await context.route('**/api/me', route => json(route, { id: 11, memberships: [{ church_id: churchId, status: 'active', role }], assignments: { ministry_ids: [ministryId] }, active_session: { mfa_confirmed: true } }))
  await context.route('**/api/ministries**', route => json(route, { data: [{ id: ministryId, name: 'Sunday Explorers Ministry', status: 'active' }] }))
}

for (const role of ['owner', 'teacher'] as const) {
  test(`${role} Home matches the light composition at five widths with readable accessible controls`, async ({ page, context }) => {
    await home(context, role)
    const writes: string[] = []
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname) })
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/account/home')
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
      if (role === 'teacher') await expect(page.getByRole('region', { name: 'Sunday Explorers Ministry' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const regions = page.getByRole('main').getByRole('region')
      await expect(regions).toHaveCount(role === 'owner' ? 3 : 1)
      if (role === 'owner' && width >= 768) {
        const boxes = await regions.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { top: r.top, height: r.height } }))
        expect(new Set(boxes.map(box => box.top)).size).toBe(1)
        expect(Math.max(...boxes.map(box => box.height)) - Math.min(...boxes.map(box => box.height))).toBeLessThan(1)
        expect(Math.max(...boxes.map(box => box.height))).toBeLessThan(330)
      }
      // UX-F2 uses the canonical light canvas; cards remain white and the sidebar stays light.
      expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(241, 246, 252)')
      if (width >= 1024) expect(await page.locator('.wide-layout').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient')
      for (const region of await regions.all()) {
        expect(await region.evaluate(el => getComputedStyle(el).borderRadius)).toBe('12px')
        expect(await region.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
        expect(await region.getByRole('heading').evaluate(el => getComputedStyle(el).fontSize)).toBe('18px')
      }
      const buttons = page.getByRole('main').locator('.home-button')
      for (const button of await buttons.all()) {
        const rect = await button.boundingBox()
        expect(rect?.height).toBeGreaterThanOrEqual(44)
        if (!await button.evaluate(el => el.classList.contains('home-button-secondary'))) {
          expect(rect?.height).toBeGreaterThanOrEqual(48)
          expect(await button.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('rgb(7, 104, 237)')
        } else expect(await button.evaluate(el => getComputedStyle(el).color)).toBe('rgb(21, 101, 216)')
        expect(await button.evaluate(el => getComputedStyle(el).borderRadius)).toBe('12px')
        if (role === 'teacher') expect(rect?.width).toBeGreaterThan(width < 768 ? width - 75 : 550)
        await button.focus()
        expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')
      }
      if (width < 768) {
        const brand = await page.locator('.compact-brand .brand-link').boundingBox()
        expect(brand?.width).toBeGreaterThanOrEqual(44)
        expect(brand?.height).toBeGreaterThanOrEqual(44)
        const bar = page.getByRole('navigation', { name: 'Phone navigation' })
        expect(await bar.getByRole('link').allTextContents()).toEqual(role === 'owner' ? ['Home', 'Attendance', 'Review', 'People', 'More'] : ['Home', 'Attendance', 'Sync', 'More'])
        expect(await bar.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
        for (const caption of await bar.locator('a > span').all()) expect(await caption.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14)
        expect(await bar.getByRole('link', { name: 'Home', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
        await buttons.last().scrollIntoViewIfNeeded()
        expect((await buttons.last().boundingBox())!.y + (await buttons.last().boundingBox())!.height).toBeLessThanOrEqual((await bar.boundingBox())!.y)
      }
      await expectNoSeriousAccessibilityIssues(page)
      await page.getByRole('heading', { name: 'Home', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: test.info().outputPath(`${role}-${width}.png`), fullPage: true })
    }
    expect(writes).toEqual([])
    expect(await page.getByRole('main').textContent()).not.toMatch(/\d+ changes|profile unlocked|synchronization complete/i)
  })
}

test('approved shared navigation persists on People and does not create a session on attendance navigation', async ({ page, context }) => {
  await home(context, 'owner')
  await context.route('**/api/students**', route => json(route, { data: [] }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/account/home')
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'People', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
  await expect(page.locator('.home-shell')).toHaveCount(0)
  expect(await page.locator('.wide-layout').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient')
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.locator('.home-shell')).toBeVisible()
  await page.getByRole('link', { name: 'Take attendance', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Take attendance', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Unlock an existing device profile' })).toBeVisible()
})

test('Owner Home People disclosure retains routes, keyboard control and the official existing asset', async ({ page, context }) => {
  await home(context, 'owner')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/account/home')
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true })
  const toggle = nav.getByRole('button', { name: 'Show People destinations' })
  await expect(nav.getByRole('link', { name: 'Reports & history', exact: true })).toHaveAttribute('href', '/account/reports')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(nav.getByRole('link', { name: 'Import', exact: true })).toBeHidden()
  await toggle.focus(); await page.keyboard.press('Enter')
  for (const name of ['Students', 'Ministries', 'Teachers', 'Import']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  await page.keyboard.press('Space'); await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.wide-layout img.brand-symbol')).toHaveAttribute('src', '/brand/msprout-symbol.svg')
  await expectNoSeriousAccessibilityIssues(page)
})

test('Home tablet drawer uses light surfaces and keyboard containment with narrow enlarged text', async ({ page, context }) => {
  await home(context, 'teacher')
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto('/account/home')
  await expect(page.getByRole('region', { name: 'Sunday Explorers Ministry' })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Navigation', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient')
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true) }
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({ path: test.info().outputPath('teacher-tablet-drawer.png'), fullPage: true })
  await page.keyboard.press('Escape'); await expect(menu).toBeFocused()
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addStyleTag({ content: ':root { font-size: 200%; }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({ path: test.info().outputPath('teacher-320-text-200.png'), fullPage: true })
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await expectNoSeriousAccessibilityIssues(page)
})
