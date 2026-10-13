import { expect, test } from '@playwright/test'
import { churchId, ministryId, json, expectNoSeriousAccessibilityIssues } from './support'

test.use({ serviceWorkers: 'block' })
for (const [kind, name] of [['normal', 'Sunday Explorers Ministry'], ['50-character', 'W'.repeat(50)], ['extreme', 'M'.repeat(120)]] as const) {
  test(`Teacher compact ministry ${kind}: bounded name and mobile full-value access`, async ({ page, context }) => {
    const writes: string[] = []
    await context.route('**/auth/session', route => json(route, { id: 11, email_verified: true, workspaces: [{ church_id: churchId, name: 'Sample Community Church', role: 'teacher' }] }))
    await context.route('**/api/**', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) { writes.push(route.request().url()); return route.abort() }
      const path = new URL(route.request().url()).pathname
      return json(route, path === '/api/me' ? { id: 11, memberships: [{ church_id: churchId, role: 'teacher', status: 'active' }], assignments: { ministry_ids: [ministryId] }, active_session: { mfa_confirmed: true } } : path === '/api/ministries' ? { data: [{ id: ministryId, name, status: 'active', version: 1 }] } : { data: [] })
    })
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/account/home?church=${churchId}`)
      const card = page.getByRole('region', { name, exact: true })
      await expect(card).toBeVisible()
      const heading = card.getByRole('heading', { name, exact: true })
      const geometry = await heading.evaluate(el => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }))
      expect(geometry.height).toBeLessThanOrEqual(geometry.line * 2 + 1)
      expect((await card.boundingBox())!.height).toBeLessThan(300)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const reveal = card.getByRole('button', { name: 'Show full ministry name', exact: true })
      const clipped = await heading.locator('.compact-name-text').evaluate(el => el.scrollHeight > el.clientHeight + 1)
      if (!clipped) await expect(reveal).toHaveCount(0)
      else {
        await expect(reveal).toBeVisible()
        const target = await reveal.boundingBox()
        expect(target!.width).toBeGreaterThanOrEqual(44); expect(target!.height).toBeGreaterThanOrEqual(44)
        await reveal.click()
        const dialog = page.getByRole('dialog', { name: 'Full ministry name', exact: true })
        await expect(dialog).toBeVisible(); await expect(dialog.getByText(name, { exact: true })).toBeVisible()
        await expectNoSeriousAccessibilityIssues(page)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.keyboard.press('Escape'); await expect(reveal).toBeFocused()
        await reveal.focus(); await page.keyboard.press('Enter'); await expect(dialog).toBeVisible()
        await dialog.getByRole('button', { name: 'Close full name', exact: true }).click(); await expect(reveal).toBeFocused()
      }
      if (width < 768 && kind !== 'normal') expect(clipped).toBe(true)
      for (const label of ['Take attendance', 'Recent sessions']) expect((await card.getByRole('link', { name: label, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await expectNoSeriousAccessibilityIssues(page)
      await page.goto(`/account/ministries?church=${churchId}`)
      const view = page.getByRole('button', { name: `View ${name}`, exact: true })
      await expect(view).toBeVisible()
      expect((await view.boundingBox())!.height).toBeLessThan(90)
      await view.click(); await expect(page.getByRole('region', { name: 'Ministry detail' }).getByRole('heading', { name, exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    if (kind === '50-character') {
      await page.setViewportSize({ width: 390, height: 900 })
      await page.goto(`/account/home?church=${churchId}`)
      await page.getByRole('button', { name: 'Show full ministry name', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Full ministry name', exact: true })
      await expect(dialog).toBeVisible()
      await page.setViewportSize({ width: 1440, height: 900 })
      await dialog.getByRole('button', { name: 'Close full name', exact: true }).click()
      await expect(page.getByRole('heading', { name, exact: true })).toBeFocused()
    }
    if (kind === 'extreme') {
      await page.setViewportSize({ width: 320, height: 900 })
      await page.goto(`/account/home?church=${churchId}`)
      await page.addStyleTag({ content: ':root { font-size: 200%; }' })
      const reveal = page.getByRole('button', { name: 'Show full ministry name', exact: true })
      await reveal.click()
      const dialog = page.getByRole('dialog', { name: 'Full ministry name', exact: true })
      await expect(dialog.getByText(name, { exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expectNoSeriousAccessibilityIssues(page)
      await page.keyboard.press('Escape'); await expect(reveal).toBeFocused()
    }
    expect(writes).toEqual([])
  })
}
