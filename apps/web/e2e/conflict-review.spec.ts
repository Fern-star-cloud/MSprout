import { expect, test } from '@playwright/test'
import { churchId, expectNoSeriousAccessibilityIssues, json, ministryId, mockCsrf } from './support'

test.use({ serviceWorkers: 'block' })

test('an Owner sees both immutable submissions, resolves the conflict, and reports the revision-effective count', async ({ page, context }) => {
  await mockCsrf(context)
  const conflictId = '00000000-0000-4000-8000-000000000080'
  let open = true
  await context.route('**/api/sync-conflicts**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { choice: string; reason: string }
      expect(body).toEqual({ choice: 'incoming', reason: 'Confirmed against the signed pilot roster.' })
      open = false
      await json(route, { status: 'resolved' })
      return
    }
    await json(route, { data: open ? [{
      id: conflictId, session_id: '00000000-0000-4000-8000-000000000081', record_id: '00000000-0000-4000-8000-000000000082',
      field: 'state', base_version: 2, status: 'open',
      existing: { value: { state: 'absent' }, actor_id: '11', device_id: 'device-a', local_time: '2026-09-28T08:00:00Z', server_time: '2026-09-28T08:01:00Z', correlation_id: '00000000-0000-4000-8000-000000000083' },
      incoming: { value: { state: 'present' }, actor_id: '22', device_id: 'device-b', local_time: '2026-09-28T08:02:00Z', server_time: '2026-09-28T08:03:00Z', correlation_id: '00000000-0000-4000-8000-000000000084' },
    }] : [] })
  })
  await context.route('**/api/attendance-guests', route => json(route, { data: [] }))
  await context.route('**/api/students', route => json(route, { data: [] }))

  await page.goto(`/account/conflicts?church=${churchId}`)
  await expect(page.getByRole('region', { name: 'Existing value attendance value' })).toContainText('Absent')
  await expect(page.getByRole('region', { name: 'Incoming value attendance value' })).toContainText('Present')
  await page.getByLabel('Resolution reason').fill('Confirmed against the signed pilot roster.')
  await page.getByRole('button', { name: 'Use incoming value' }).click()
  await expect(page.getByText('No attendance conflicts need review.')).toBeVisible()

  await context.route('**/api/ministries', route => json(route, { data: [{ id: ministryId, name: 'Primary' }] }))
  await context.route('**/api/attendance-reports?**', route => json(route, { data: {
    role: 'owner', can_export: true,
    filters: { date_from: '2026-09-01', date_to: '2026-09-30', ministry_id: null },
    summary: { present_count: 1, absent_count: 0, finalized_record_count: 1, attendance_rate: 1, pending_count: 0, conflict_count: 0, correction_count: 1 },
    sessions: [{ id: '00000000-0000-4000-8000-000000000081', ministry_id: ministryId, ministry_name: 'Primary', attendance_date: '2026-09-28', status: 'revised', finalized_at: '2026-09-28T08:05:00Z', present_count: 1, absent_count: 0, attendance_rate: 1, correction_count: 1 }],
  } }))
  await page.goto(`/account/reports?church=${churchId}`)
  await expect(page.getByText('Revised', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('link', { name: '1 correction' }).first()).toBeVisible()
  await expect(page.getByLabel('Attendance summary')).toContainText('100%')
  await expectNoSeriousAccessibilityIssues(page)
})
