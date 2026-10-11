// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApplicationReviewScreen } from './ApplicationReviewScreen'
import { authRequest } from '../../auth/transport'

vi.mock('../../auth/transport', async (original) => ({ ...await original() as typeof import('../../auth/transport'), authRequest: vi.fn() }))
const application = { id: '00000000-0000-4000-8000-000000000061', church_name: 'Grace Church', city: 'Davao City', timezone: 'Asia/Manila', address: null, status: 'pending', church_id: null, category: null, reason: null, submitted_at: '2026-10-11T00:00:00Z', decided_at: null }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  vi.mocked(authRequest).mockImplementation(async (path, method) => {
    if (path === '/platform/me') return { handle: 'sage.dev', online_only: true }
    if (method === 'POST') return { ...application, status: 'approved' }
    return path.includes('?') ? { data: [application], page: 1, has_more: false } : application
  })
})
afterEach(() => { cleanup(); vi.mocked(authRequest).mockReset() })
it('loads detail and submits an explicit review decision', async () => {
  render(<ApplicationReviewScreen />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Review Grace Church' }))
  expect(await screen.findByText('Asia/Manila')).toBeDefined()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
  expect(await screen.findByText('Approved')).toBeDefined()
  expect(authRequest).toHaveBeenLastCalledWith(`/platform/applications/${application.id}/approve`, 'POST')
  expect(screen.queryByRole('button', { name: 'Approve application' })).toBeNull()
})
it('requires a reason for rejection and reports request failures safely while preserving inputs', async () => {
  vi.mocked(authRequest).mockImplementation(async (path, method) => {
    if (path === '/platform/me') return { handle: 'sage.dev', online_only: true }
    if (method === 'POST') throw { status: 429 }
    return path.includes('?') ? { data: [application], page: 1, has_more: false } : application
  })
  render(<ApplicationReviewScreen />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Review Grace Church' }))
  const reason = await screen.findByLabelText('Reason for applicant')
  expect((reason as HTMLTextAreaElement).required).toBe(true)
  await user.type(reason, 'Please provide more information')
  await user.click(screen.getByRole('button', { name: 'Reject application' }))
  await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
  expect(await screen.findByRole('alert')).toBeDefined()
  expect(authRequest).toHaveBeenLastCalledWith(`/platform/applications/${application.id}/reject`, 'POST', { category: 'incomplete', reason: 'Please provide more information' })
  expect((reason as HTMLTextAreaElement).value).toBe('Please provide more information')
})
it('does not show review controls when platform authorization fails', async () => {
  vi.mocked(authRequest).mockRejectedValue({ status: 403 })
  render(<ApplicationReviewScreen />)
  expect(await screen.findByRole('alert')).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Approve application' })).toBeNull()
})
