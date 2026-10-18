import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { startAuthorityBrowserServer } from '../../../../scripts/compatibility/authority/browser-server.mjs'
import { deviceRecords, expectNoSeriousAccessibilityIssues } from '../support'

for (const width of [390, 1440]) test('real cookie authority and encrypted pending work at ' + width + 'px', async ({ page, context }, info) => {
  const server = await startAuthorityBrowserServer(resolve(process.env.COMPAT_C_ASSETS!), process.env.COMPAT_C_API!)
  const errors: string[] = []
  page.on('pageerror', () => errors.push('browser page error'))
  await context.route('**/*', route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort('blockedbyclient'))
  try {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(server.origin + '/account/login')
    await expectNoSeriousAccessibilityIssues(page)
    await page.getByLabel('Email', { exact: true }).fill(server.fixture.email)
    await page.getByLabel('Password', { exact: true }).fill(server.fixture.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect.poll(async () => (await page.request.get(server.origin + '/auth/session')).status()).toBe(200)
    await page.goto(server.origin + '/account/prepare?church=' + server.fixture.church)
    await page.getByRole('button', { name: 'Continue to local PIN' }).click()
    await page.getByLabel('Choose a 6–12 digit local PIN').fill('184629')
    await page.getByLabel('Confirm local PIN', { exact: true }).fill('184629')
    await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
    await expect(page.getByRole('button', { name: 'Open Attendance' })).toBeVisible({ timeout: 30_000 })
    await expectNoSeriousAccessibilityIssues(page)
    await page.getByRole('button', { name: 'Open Attendance' }).click()
    await page.getByRole('button', { name: 'Start attendance' }).click()
    await page.getByRole('button', { name: 'Mark Synthetic Browser present' }).click()
    await expect(page.getByRole('button', { name: 'Mark Synthetic Browser present' })).toBeEnabled()
    const pending = await deviceRecords(page)
    expect(pending.attendanceDrafts).toHaveLength(1)
    expect(pending.outboxEvents).toHaveLength(2)
    expect(JSON.stringify(pending)).not.toContain('Synthetic Browser')
    await page.screenshot({ path: info.outputPath('attendance.png'), fullPage: true })
    await expectNoSeriousAccessibilityIssues(page)
    // Real synchronization must return genuine persisted acknowledgments, never fixtures.
    await page.goto(server.origin + '/account/sync')
    await page.getByLabel('Existing local PIN', { exact: true }).fill('184629')
    await page.getByRole('button', { name: 'Unlock existing profile', exact: true }).click()
    await page.getByRole('button', { name: 'Continue synchronization', exact: true }).click()
    await expect.poll(async () => (await deviceRecords(page)).outboxEvents.length).toBe(0)
    // Create fresh pending local work, then remove server authority without touching it.
    await page.getByRole('link', { name: 'Attendance', exact: true }).click()
    await page.getByRole('button', { name: 'Resume attendance', exact: true }).click()
    await page.getByRole('button', { name: 'Mark Synthetic Browser absent' }).click()
    await expect(page.getByRole('button', { name: 'Mark Synthetic Browser absent' })).toBeEnabled()
    const before = await deviceRecords(page)
    expect(before.outboxEvents.length).toBeGreaterThan(0)
    expect(await server.revoke()).toEqual({ revoked: true })
    await page.goto(server.origin + '/account/sync')
    await expect(page.getByRole('button', { name: 'Continue synchronization', exact: true })).toBeDisabled()
    expect(await deviceRecords(page)).toEqual(before)
    await page.screenshot({ path: info.outputPath('revoked-preserved.png'), fullPage: true })
    await expectNoSeriousAccessibilityIssues(page)
    expect(errors).toEqual([])
  } finally { await server.close() }
})
