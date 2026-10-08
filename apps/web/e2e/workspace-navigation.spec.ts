import { expect, test } from '@playwright/test'
import { churchId, otherChurchId, json, expectNoSeriousAccessibilityIssues } from './support'

test.use({ serviceWorkers: 'block' })

for (const role of ['owner', 'teacher'] as const) {
  test(`${role} navigates all six modules and refreshes without entering workspace IDs`, async ({ page, context }) => {
    const requests: string[] = []
    let activations = 0
    let activationGate: Promise<void> | undefined
    await context.route('**/auth/session', async route => {
      activations++
      await activationGate
      return json(route, {
        id: 11, email_verified: true, mfa_confirmed: role === 'owner',
        workspaces: [{ church_id: churchId, name: 'Pilot Church', role }],
      })
    })
    await context.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/health') return json(route, { status: 'ok' })
      expect(route.request().headers()['x-church-id']).toBe(churchId)
      requests.push(path)
      if (path === '/api/me') return json(route, { id: 11, memberships: [{ church_id: churchId, role, status: 'active' }], active_session: { mfa_confirmed: role === 'owner' } })
      if (path === '/api/birthdays/today') return json(route, { data: { role, local_date: '2026-10-08', timezone: 'Asia/Manila', count: 0, birthdays: [] } })
      if (path === '/api/attendance-reports') return json(route, { data: {
        role, can_export: role === 'owner', summary: { present_count: 0, absent_count: 0, finalized_record_count: 0, attendance_rate: 0, pending_count: 0, conflict_count: 0, correction_count: 0 }, sessions: [],
      } })
      if (path === '/api/sync-conflicts' && role === 'teacher') return json(route, { needs_owner_review: true })
      return json(route, { data: [] })
    })
    await page.goto('/account/students')
    for (const [label, heading] of [['Review', 'Attendance review'], ['Reports', 'Attendance reports'], ['Birthdays', "Today's Birthdays"], ['Ministries', 'Ministries'], ['Students', 'Students'], ['Import', 'Import students']]) {
      const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true })
      const phone = page.getByRole('navigation', { name: 'Phone navigation', exact: true })
      await (await navigation.isVisible() ? navigation : phone).getByRole('link', { name: label, exact: true }).click()
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expect(page.getByLabel('Church workspace ID')).toHaveCount(0)
      if (label === 'Import') {
        if (role === 'owner') await expect(page.getByLabel('Student spreadsheet')).toBeVisible()
        else await expect(page.getByText('Student imports are available only to the church Owner with confirmed MFA.')).toBeVisible()
      }
      const content = page.getByRole('heading', { name: heading, exact: true })
      await content.evaluate(element => { element.setAttribute('data-activation-proof', 'retained') })
      const previousActivations = activations
      let release!: () => void
      activationGate = new Promise(resolve => { release = resolve })
      // Deterministic browser event simulation; live human timing remains separate evidence.
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
        document.dispatchEvent(new Event('visibilitychange'))
        window.dispatchEvent(new Event('focus'))
      })
      await expect.poll(() => activations).toBe(previousActivations + 1)
      await expect(content).toHaveAttribute('data-activation-proof', 'retained')
      await expect(page.getByText('Loading church workspace…')).toHaveCount(0)
      const scopedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/me')
      release(); activationGate = undefined
      await scopedResponse
      await expect(content).toHaveAttribute('data-activation-proof', 'retained')
      await page.evaluate(() => { Reflect.deleteProperty(document, 'visibilityState') })
    }
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Import students' })).toBeVisible()
    if (role === 'teacher') await expect(page.getByLabel('Student spreadsheet')).toHaveCount(0)
    expect(requests).toContain('/api/students')
    expect(requests).toContain('/api/attendance-reports')
    await expectNoSeriousAccessibilityIssues(page)
  })
}

test('unavailable membership and expired sessions never request child data', async ({ page, context }) => {
  let expired = false
  let childRequests = 0
  await context.route('**/api/**', route => { childRequests++; return json(route, {}, 403) })
  await context.route('**/auth/session', route => expired
    ? json(route, { message: 'private data' }, 401)
    : json(route, { id: 11, email_verified: true, workspaces: [{ church_id: churchId, name: 'Pilot Church', role: 'owner' }] }))
  await page.goto(`/account/students?church=${otherChurchId}`)
  await expect(page.getByRole('alert')).toHaveText('This church workspace is unavailable for your account.')
  expired = true
  await page.goto('/account/students')
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  expect(childRequests).toBe(0)
  await expect(page.getByText('private data')).toHaveCount(0)
})
