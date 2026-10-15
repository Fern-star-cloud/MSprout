import { expect, test, type Page } from '@playwright/test'
import { bootstrap, churchId, deviceRecords, expectNoSeriousAccessibilityIssues, json, ministryId, mockCsrf, outboxCount } from './support'

// Intercepted API, real encryption/IndexedDB and fresh isolated contexts only.
test.use({ serviceWorkers: 'block' })

async function capture(page: Page, state: string) {
  const measurements = []
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), state).toBe(true)
    measurements.push(await page.locator('.attendance-screen').evaluate((screen, width) => ({
      width, font: getComputedStyle(screen).fontFamily,
      heading: getComputedStyle(screen.querySelector('h1')!).fontSize,
      controls: [...screen.querySelectorAll('button, input, select')].filter(control => control.getClientRects().length).map(control => ({
        name: control.getAttribute('aria-label') || control.textContent?.trim(),
        font: getComputedStyle(control).fontSize, radius: getComputedStyle(control).borderRadius,
        height: control.getBoundingClientRect().height,
      })),
    }), width))
    await page.screenshot({ path: test.info().outputPath(`${state}-${width}.png`), fullPage: true })
  }
  await test.info().attach(`${state}-computed-styles`, { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
}

for (const role of ['owner', 'teacher'] as const) {
  test(`${role} authorized attendance, pending encrypted save, guest and finalization reflow safely`, async ({ page, context }) => {
    await mockCsrf(context)
    await context.route('**/api/**', route => json(route, {}, 503))
    await context.route('**/auth/session', route => json(route, { id: 11, email_verified: true, mfa_confirmed: role === 'owner', workspaces: [{ church_id: churchId, name: 'Synthetic Church', role }] }))
    await context.route('**/api/me', route => json(route, { id: 11, email_verified: true, memberships: [{ church_id: churchId, role, status: 'active' }], assignments: { ministry_ids: [ministryId] }, active_session: { mfa_confirmed: role === 'owner' } }))
    await context.route('**/api/ministries', route => json(route, { data: [{ id: ministryId, name: 'Primary', status: 'active', version: 1 }] }))
    await context.route('**/api/offline/bootstrap**', route => json(route, bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)))
    await page.goto('/account/prepare')
    await expect(page.locator('.preparation-active .ui-status-badge')).toHaveText(role === 'owner' ? 'Owner' : 'Teacher')
    await page.getByRole('button', { name: 'Continue to local PIN' }).click()
    await page.getByLabel('Choose a 6–12 digit local PIN').fill('184629')
    await page.getByLabel('Confirm local PIN').fill('184629')
    await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
    await expect(page.getByRole('button', { name: 'Open Attendance' })).toBeVisible({ timeout: 30_000 })
    const prepared = await deviceRecords(page)
    expect(prepared.profiles[0].churchId).toBe(churchId)
    expect(prepared.profiles[0].actorId).toBe('11')
    expect(prepared.attendanceDrafts).toHaveLength(0)
    expect(prepared.outboxEvents).toHaveLength(0)
    await page.getByRole('button', { name: 'Open Attendance' }).click()
    await expect(page.getByText('No draft for this date')).toBeVisible()
    await capture(page, `${role}-no-draft`)
    expect(await deviceRecords(page)).toEqual(prepared)
    await page.getByRole('button', { name: 'Start attendance' }).click()
    await expect(page.getByText('Pilot Student A')).toBeVisible()
    await expect.poll(() => outboxCount(page)).toBe(1)
    await context.setOffline(true)
    // Delay the real encryption operation in this disposable page, not a timer
    // or fake UI state. The original function resumes before any durable write.
    await page.evaluate(() => {
      const original = crypto.subtle.encrypt.bind(crypto.subtle)
      let release!: () => void
      const wait = new Promise<void>(resolve => { release = resolve })
      Object.assign(globalThis, { releaseWorkflowSave: release })
      crypto.subtle.encrypt = async (...args: Parameters<SubtleCrypto['encrypt']>) => {
        crypto.subtle.encrypt = original
        await wait
        return original(...args)
      }
    })
    await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Saving on this device…$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Finalize attendance' })).toBeDisabled()
    expect(await outboxCount(page)).toBe(1)
    await capture(page, `${role}-local-save-pending-offline`)
    await page.evaluate(() => (globalThis as unknown as { releaseWorkflowSave: () => void }).releaseWorkflowSave())
    await expect.poll(() => outboxCount(page)).toBe(2)
    await expect(page.getByRole('button', { name: 'Mark Pilot Student A present' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Mark Pilot Student B absent' }).click()
    await expect.poll(() => outboxCount(page)).toBe(3)
    await capture(page, `${role}-selected-offline`)
    await expectNoSeriousAccessibilityIssues(page)
    const saved = await deviceRecords(page)
    expect(JSON.stringify(saved)).not.toMatch(/Pilot Student|student_marked|attendance_date/)
    await page.getByLabel('Search roster').fill('No matching synthetic student')
    await expect(page.getByText('No entries match this filter.')).toBeVisible()
    await capture(page, `${role}-empty-filter`)
    await page.getByLabel('Search roster').fill('')
    await page.getByRole('button', { name: 'Add temporary guest' }).click()
    await expect(page.getByLabel('Display name')).toBeFocused()
    await capture(page, `${role}-guest-dialog`)
    await expectNoSeriousAccessibilityIssues(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Add temporary guest' })).toBeFocused()
    await page.getByRole('button', { name: 'Finalize attendance' }).click()
    await expect(page.getByRole('dialog', { name: 'Finalize this session?' })).toBeVisible()
    await capture(page, `${role}-finalize-dialog`)
    await expectNoSeriousAccessibilityIssues(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Finalize attendance' })).toBeFocused()
    expect(await deviceRecords(page)).toEqual(saved)
  })
}
