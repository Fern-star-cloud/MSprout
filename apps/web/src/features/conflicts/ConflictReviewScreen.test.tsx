// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { ConflictReviewScreen } from './ConflictReviewScreen'

vi.mock('../auth/transport', () => ({
  authRequest: vi.fn(),
  safeAuthMessage: () => 'Unable to load review items.',
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('shows Owner conflict evidence side by side and submits the bounded resolution reason', async () => {
  vi.mocked(authRequest)
    .mockResolvedValueOnce({ data: [{
      id: 'conflict-a', session_id: 'session-a', record_id: 'record-a', field: 'state', base_version: 3, status: 'open',
      existing: { value: { state: 'present' }, actor_id: '10', device_id: 'device-a', local_time: '2026-09-29T01:00:00Z', server_time: '2026-09-29T01:01:00Z', correlation_id: 'correlation-a' },
      incoming: { value: { state: 'absent' }, actor_id: '11', device_id: 'device-b', local_time: '2026-09-29T01:02:00Z', server_time: '2026-09-29T01:03:00Z', correlation_id: 'correlation-b' },
    }] })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ status: 'resolved', effective_state: 'absent' })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [] })
  const user = userEvent.setup()
  render(<ConflictReviewScreen initialChurchId="00000000-0000-4000-8000-000000000001" />)

  expect(await screen.findByText('Present')).toBeTruthy()
  expect(screen.getByText('Absent')).toBeTruthy()
  expect(screen.getByText('10')).toBeTruthy()
  expect(screen.getByText('device-b')).toBeTruthy()
  expect(screen.getByText('2026-09-29T01:02:00Z')).toBeTruthy()
  expect(screen.getByText('2026-09-29T01:03:00Z')).toBeTruthy()

  await user.type(screen.getByLabelText('Resolution reason'), 'Confirmed against the signed paper roster.')
  await user.click(screen.getByRole('button', { name: 'Use incoming value' }))

  await waitFor(() => expect(authRequest).toHaveBeenCalledWith(
    '/api/sync-conflicts/conflict-a/resolve',
    'POST',
    { choice: 'incoming', reason: 'Confirmed against the signed paper roster.' },
    '00000000-0000-4000-8000-000000000001',
  ))
  expect(await screen.findByText('No attendance conflicts need review.')).toBeTruthy()
})

it('shows Teachers only the Needs Owner Review status without evidence details', async () => {
  vi.mocked(authRequest).mockResolvedValueOnce({ needs_owner_review: true })
  render(<ConflictReviewScreen initialChurchId="00000000-0000-4000-8000-000000000001" />)

  expect(await screen.findByText('Needs Owner Review')).toBeTruthy()
  expect(screen.queryByText(/Device/)).toBeNull()
  expect(screen.queryByLabelText('Resolution reason')).toBeNull()
})

it('lets an Owner promote a pending guest without collecting guardian details', async () => {
  vi.mocked(authRequest)
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [{
      id: 'guest-a', session_id: 'session-a', display_name: 'Guest Child', gender: 'female',
      actor_id: 10, device_id: 'device-a', local_time: '2026-09-29T01:00:00Z', server_time: '2026-09-29T01:01:00Z',
    }] })
    .mockResolvedValueOnce({ data: [{ id: 'student-a', display_name: 'Known Student' }] })
    .mockResolvedValueOnce({ id: 'guest-a', status: 'promoted' })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [] })
  const user = userEvent.setup()
  render(<ConflictReviewScreen initialChurchId="00000000-0000-4000-8000-000000000001" />)

  expect(await screen.findByRole('heading', { name: 'Guest Child' })).toBeTruthy()
  expect(screen.queryByLabelText(/guardian/i)).toBeNull()
  const form = screen.getByRole('form', { name: 'Promote Guest Child' })
  await user.type(form.querySelector<HTMLInputElement>('input[name="first_name"]')!, 'Guest')
  await user.type(form.querySelector<HTMLInputElement>('input[name="last_name"]')!, 'Child')
  await user.click(screen.getByRole('button', { name: 'Promote guest' }))

  await waitFor(() => expect(authRequest).toHaveBeenCalledWith(
    '/api/attendance-guests/guest-a/promote',
    'POST',
    { first_name: 'Guest', last_name: 'Child', gender: 'female' },
    '00000000-0000-4000-8000-000000000001',
  ))
})
