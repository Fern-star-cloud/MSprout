import { expect, test } from '@playwright/test'
import { churchId, expectNoSeriousAccessibilityIssues, json, ministryId, mockCsrf, mockOwner } from './support'

test.use({ serviceWorkers: 'block' })

test('verified application, platform approval, Owner MFA, roster setup, and Teacher assignment remain coherent', async ({ page, context }) => {
  test.setTimeout(60_000)
  await mockCsrf(context)
  await context.route('**/platform/csrf-token', route => json(route, { csrf_token: 'pilot-platform-token' }))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'turnstile', { value: {
      render: (_element: HTMLElement, options: { callback(token: string): void }) => { options.callback('pilot-captcha'); return 'pilot-widget' },
      remove: () => undefined,
    } })
  })

  let application: Record<string, unknown> | null = null
  await context.route('**/auth/session', route => json(route, { id: 1, workspaces: [], email: 'owner@example.test', email_verified: true, mfa_confirmed: false }))
  await context.route('**/api/church-applications/current', route => json(route, { application }))
  await context.route('**/api/church-applications', async route => {
    application = {
      id: '00000000-0000-4000-8000-000000000060', church_id: null, church_name: 'Pilot Church', city: 'Pilot City',
      address: null, timezone: 'Asia/Manila', status: 'pending', reason: null,
      created_at: '2026-09-30T00:00:00Z', decided_at: null,
    }
    await json(route, application)
  })

  await page.goto('/account/verify-email')
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  await page.goto('/account/application')
  await page.getByLabel('Church name').fill('Pilot Church')
  await page.getByLabel('City').fill('Pilot City')
  await page.getByRole('button', { name: 'Submit application' }).click()
  await expect(page.getByRole('heading', { name: 'Pending review' })).toBeVisible()

  await context.route('**/platform/applications?**', route => json(route, { data: [application], page: 1, has_more: false }))
  await context.route('**/platform/applications/**', async route => {
    if (route.request().url().endsWith('/approve')) {
      application = { ...application, church_id: churchId, status: 'approved', decided_at: '2026-09-30T00:05:00Z' }
    }
    await json(route, application)
  })
  await page.goto('/account/platform-applications')
  await page.getByRole('button', { name: 'Review Pilot Church' }).click()
  await page.getByRole('button', { name: 'Approve application' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Approved' })).toHaveText('Approved')

  await context.route('**/user/confirm-password', route => json(route, {}))
  await context.route('**/user/two-factor-authentication', route => json(route, {}))
  await context.route('**/user/two-factor-secret-key', route => json(route, { secretKey: 'PILOTMFAKEY' }))
  await context.route('**/user/confirmed-two-factor-authentication', route => json(route, {}))
  await context.route('**/user/two-factor-recovery-codes', route => json(route, ['pilot-recovery-1', 'pilot-recovery-2']))
  await page.goto('/account/mfa')
  await page.getByLabel('Current password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Set up authenticator' }).click()
  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Confirm authenticator' }).click()
  await expect(page.getByText('pilot-recovery-1')).toBeVisible()

  let ministries = [{ id: ministryId, name: 'Primary', status: 'active', version: 1 }]
  let students: Record<string, unknown>[] = []
  await mockOwner(context)
  await context.route('**/api/ministries**', async route => {
    if (route.request().method() === 'POST') ministries = [...ministries, { id: '00000000-0000-4000-8000-000000000021', name: 'Preschool', status: 'active', version: 1 }]
    await json(route, route.request().method() === 'POST' ? ministries.at(-1) : { data: ministries })
  })
  await page.goto(`/account/ministries?church=${churchId}`)
  await page.getByLabel('New ministry').fill('Preschool')
  await page.getByRole('button', { name: 'Add ministry' }).click()
  await expect(page.getByText('Preschool')).toBeVisible()

  await context.route('**/api/students**', async route => {
    if (route.request().method() === 'POST') students = [{
      id: '00000000-0000-4000-8000-000000000031', first_name: 'Pilot', middle_name: null, last_name: 'Student',
      preferred_name: null, suffix: null, display_name: 'Pilot Student', date_of_birth: '2018-09-30', gender: 'unspecified',
      external_reference: null, ministry_ids: [ministryId], status: 'active', version: 1,
    }]
    await json(route, route.request().method() === 'POST' ? students[0] : { data: students })
  })
  await page.goto(`/account/students?church=${churchId}`)
  await page.getByLabel('First name').fill('Pilot')
  await page.getByLabel('Last name').fill('Student')
  await page.getByRole('group', { name: 'Enroll in ministries' }).getByLabel('Primary').check()
  await page.getByRole('button', { name: 'Add student' }).click()
  await expect(page.getByText('Pilot Student', { exact: true })).toBeVisible()

  let invited = false
  await context.route('**/api/teachers?**', route => json(route, { data: [], page: 1, has_more: false, can_invite: true }))
  await context.route('**/api/teacher-invitations?**', route => json(route, { data: invited ? [{ id: '00000000-0000-4000-8000-000000000070', email: 'teacher@example.test', status: 'pending', expires_at: '2099-10-07T00:00:00Z' }] : [], page: 1, has_more: false }))
  await context.route('**/api/assigned-ministries', route => json(route, { data: ministries.map(({ id, name }) => ({ id, name })) }))
  await context.route('**/api/teacher-invitations', async route => { invited = true; await json(route, {}) })
  await page.goto(`/account/teachers?church=${churchId}`)
  await page.getByLabel('Invitation email').fill('teacher@example.test')
  await page.getByRole('group', { name: 'Ministries' }).getByLabel('Primary').check()
  await page.getByRole('button', { name: 'Invite Teacher' }).click()
  await expect(page.getByText(/teacher@example\.test · pending/)).toBeVisible()
  await expectNoSeriousAccessibilityIssues(page)
})
