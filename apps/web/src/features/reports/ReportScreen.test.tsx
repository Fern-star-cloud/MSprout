// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authDownload, authRequest } from '../auth/transport'
import { ReportScreen } from './ReportScreen'

vi.mock('../auth/transport', () => ({
  authRequest: vi.fn(), authDownload: vi.fn(), safeAuthMessage: () => 'Unable to load reports.',
}))

const church = '11111111-1111-4111-8111-111111111111'
const ministry = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.mocked(authRequest).mockImplementation(async (path) => {
    if (path === '/api/ministries') return { data: [{ id: ministry, name: 'Primary', status: 'active', version: 1 }] } as never
    return { data: {
      role: 'owner', can_export: true,
      filters: { date_from: '2026-09-01', date_to: '2026-09-30', ministry_id: null },
      summary: { present_count: 8, absent_count: 2, finalized_record_count: 10, attendance_rate: 0.8, pending_count: 1, conflict_count: 2, correction_count: 1 },
      sessions: [{
        id: '33333333-3333-4333-8333-333333333333', ministry_id: ministry, ministry_name: 'Primary',
        attendance_date: '2026-09-20', status: 'revised', finalized_at: '2026-09-20T08:00:00.000Z',
        present_count: 8, absent_count: 2, attendance_rate: 0.8, correction_count: 1,
      }],
    } } as never
  })
  vi.mocked(authDownload).mockResolvedValue(new Blob(['csv'], { type: 'text/csv' }))
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() })
})

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })

it('loads online totals, keeps local pending work separate, and downloads the filtered safe CSV', async () => {
  const user = userEvent.setup()
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  render(<ReportScreen initialChurchId={church} initialFrom="2026-09-01" initialTo="2026-09-30" pendingLocalCount={async () => 3} />)

  expect((await screen.findAllByText('80%')).length).toBeGreaterThan(0)
  expect(screen.getByText('3 local events')).toBeTruthy()
  expect(screen.getByRole('link', { name: '2 conflicts' }).getAttribute('href')).toContain('/account/conflicts')
  expect(screen.getAllByRole('link', { name: '1 correction' }).some((link) => link.getAttribute('href')?.includes('/account/reports'))).toBe(true)
  await user.selectOptions(screen.getByLabelText('Ministry'), ministry)
  await user.click(screen.getByRole('button', { name: 'Apply filters' }))

  await waitFor(() => expect(authRequest).toHaveBeenCalledWith(
    `/api/attendance-reports?date_from=2026-09-01&date_to=2026-09-30&ministry_id=${ministry}`,
    'GET', undefined, church,
  ))
  await user.click(screen.getByRole('button', { name: 'Download CSV' }))
  await waitFor(() => expect(authDownload).toHaveBeenCalledWith(
    `/api/attendance-reports/export?date_from=2026-09-01&date_to=2026-09-30&ministry_id=${ministry}`,
    church,
  ))
  expect(click).toHaveBeenCalled()
  click.mockRestore()
})

it('does not offer CSV export to a Teacher', async () => {
  vi.mocked(authRequest).mockImplementation(async (path) => path === '/api/ministries'
    ? { data: [{ id: ministry, name: 'Primary', status: 'active', version: 1 }] } as never
    : { data: {
      role: 'teacher', can_export: false,
      filters: { date_from: '2026-09-01', date_to: '2026-09-30', ministry_id: null },
      summary: { present_count: 1, absent_count: 0, finalized_record_count: 1, attendance_rate: 1, pending_count: 0, conflict_count: 0, correction_count: 0 },
      sessions: [],
    } } as never)
  render(<ReportScreen initialChurchId={church} initialFrom="2026-09-01" initialTo="2026-09-30" pendingLocalCount={async () => 0} />)

  expect(await screen.findByText('Assigned recent sessions')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
})
