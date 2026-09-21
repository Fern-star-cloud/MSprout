// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ApplicationReviewScreen } from './ApplicationReviewScreen'
import { authRequest } from '../../auth/transport'

vi.mock('../../auth/transport', async (original) => ({ ...await original<typeof import('../../auth/transport')>(), authRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.mocked(authRequest).mockReset() })
const application = { id: 'a', church_name: 'Grace Church', city: 'Davao City', timezone: 'Asia/Manila', address: null, status: 'pending' }

it('loads detail and submits an explicit review decision', async () => {
  vi.mocked(authRequest).mockResolvedValueOnce({ data: [application], page: 1, has_more: false }).mockResolvedValueOnce(application).mockResolvedValueOnce({ ...application, status: 'approved' })
  render(<ApplicationReviewScreen />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Review Grace Church' }))
  expect(await screen.findByText('Asia/Manila')).toBeDefined()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  expect(await screen.findByText('Approved')).toBeDefined()
  expect(authRequest).toHaveBeenLastCalledWith('/platform/applications/a/approve', 'POST')
  expect(screen.queryByRole('button', { name: 'Approve application' })).toBeNull()
})

it('requires a reason for rejection and reports request failures safely', async () => {
  vi.mocked(authRequest).mockResolvedValueOnce({ data: [application], page: 1, has_more: false }).mockResolvedValueOnce(application).mockRejectedValueOnce({ status: 429 })
  render(<ApplicationReviewScreen />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Review Grace Church' }))
  const reason = await screen.findByLabelText('Reason for applicant')
  expect((reason as HTMLTextAreaElement).required).toBe(true)
  await user.type(reason, 'Please provide more information')
  await user.click(screen.getByRole('button', { name: 'Reject application' }))
  expect(await screen.findByRole('alert')).toBeDefined()
  expect(authRequest).toHaveBeenLastCalledWith('/platform/applications/a/reject', 'POST', { category: 'incomplete', reason: 'Please provide more information' })
})

it('does not show review controls when platform authorization fails', async () => {
  vi.mocked(authRequest).mockRejectedValue({ status: 403 })
  render(<ApplicationReviewScreen />)
  expect(await screen.findByRole('alert')).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Approve application' })).toBeNull()
})
