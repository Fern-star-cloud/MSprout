import { expect, test } from '@playwright/test'
import { churchId, expectNoSeriousAccessibilityIssues, json, ministryId, otherChurchId, ownerAccount, mockOwner } from './support'

test.use({ serviceWorkers: 'block' })

test('cross-tenant requests fail closed without disclosing another church', async ({ page, context }) => {
  const privateName = 'Tenant A Private Student'
  await mockOwner(context)
  const meHandler = async (route: Parameters<typeof json>[0]) => {
    const requestedChurch = route.request().headers()['x-church-id']
    if (requestedChurch !== churchId) return json(route, { code: 'forbidden', message: 'Tenant details must not be reflected.' }, 403)
    return json(route, ownerAccount)
  }
  const studentsHandler = async (route: Parameters<typeof json>[0]) => {
    const requestedChurch = route.request().headers()['x-church-id']
    if (requestedChurch !== churchId) return json(route, { code: 'not_found', message: 'Tenant details must not be reflected.' }, 404)
    return json(route, { data: [{
      id: '00000000-0000-4000-8000-000000000031', first_name: 'Tenant A', middle_name: null, last_name: 'Private Student',
      preferred_name: null, suffix: null, display_name: privateName, date_of_birth: '2018-09-30', gender: 'unspecified',
      external_reference: null, ministry_ids: [ministryId], status: 'active', version: 1,
    }] })
  }
  await context.route('**/api/me', meHandler)
  await context.route('**/api/students**', studentsHandler)
  await context.route('**/api/ministries**', route => json(route, { data: [{ id: ministryId, name: 'Primary', status: 'active', version: 1 }] }))

  await page.goto(`/account/students?church=${churchId}`)
  await expect(page.getByText(privateName)).toBeVisible()
  await page.goto(`/account/students?church=${otherChurchId}`)
  await expect(page.getByRole('alert')).toHaveText('This church workspace is unavailable for your account.')
  await expect(page.getByText(privateName)).toHaveCount(0)
  await expect(page.getByText(/Tenant details/)).toHaveCount(0)
  await expectNoSeriousAccessibilityIssues(page)
})
