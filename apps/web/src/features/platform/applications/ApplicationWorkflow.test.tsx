// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authRequest } from '../../auth/transport'
import { ApplicationReviewScreen } from './ApplicationReviewScreen'
import { completeDecision } from './application-decisions'
import type { Application } from './application-projection'

vi.mock('../../auth/transport', async (original) => ({ ...await original() as typeof import('../../auth/transport'), authRequest: vi.fn() }))
const id = '00000000-0000-4000-8000-000000000060'
const application: Application = { id, church_name: 'Synthetic application', city: 'Synthetic city', address: null, timezone: 'Asia/Manila', church_id: null, category: null, reason: null, status: 'pending', submitted_at: '2026-10-11T00:00:00Z', decided_at: null }
let state = application
let post: () => Promise<unknown>
beforeEach(() => {
  state = { ...application }
  completeDecision(id)
  post = async () => { state = { ...state, status: 'approved' }; return state }
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  vi.mocked(authRequest).mockImplementation(async (path, method) => {
    if (path === '/platform/me') return { handle: 'sage.dev', online_only: true }
    if (method === 'POST') return post()
    if (path.includes('?')) return { data: [state], page: 1, has_more: false }
    return state
  })
})
afterEach(() => { cleanup(); vi.mocked(authRequest).mockReset() })
async function open() {
  const user = userEvent.setup()
  render(<ApplicationReviewScreen />)
  await user.click(await screen.findByRole('button', { name: 'Review Synthetic application' }))
  await screen.findByText('Asia/Manila')
  return user
}
const posts = () => vi.mocked(authRequest).mock.calls.filter(call => call[1] === 'POST')

it('verifies the isolated platform session before loading protected applications', async () => {
  vi.mocked(authRequest).mockResolvedValue({ handle: 'church-user', online_only: true })
  render(<ApplicationReviewScreen />)
  await screen.findByRole('alert')
  expect(authRequest).toHaveBeenCalledTimes(1)
  expect(authRequest).toHaveBeenCalledWith('/platform/me')
})
it('requires confirmation, focuses cancellation and restores the actual trigger without a mutation', async () => {
  const user = await open()
  const trigger = screen.getByRole('button', { name: 'Approve application' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Confirm approval' })
  expect(within(dialog).getByText('Synthetic application')).toBeDefined()
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(posts()).toHaveLength(0)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(document.activeElement).toBe(trigger)
  expect(posts()).toHaveLength(0)
})
it('rechecks the selected application and displays an already resolved outcome without posting', async () => {
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  state = { ...state, status: 'rejected', reason: 'Incomplete information' }
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
  await screen.findByText('Rejected')
  expect(posts()).toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Approve application' })).toBeNull()
})
it('prevents duplicate confirmations and accepts only the authoritative empty-body approval result', async () => {
  let complete!: (value: unknown) => void
  post = () => new Promise(resolve => { complete = resolve })
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  await user.dblClick(screen.getByRole('button', { name: 'Confirm approval' }))
  await waitFor(() => expect(posts()).toHaveLength(1))
  expect(posts()[0]).toEqual([`/platform/applications/${id}/approve`, 'POST'])
  expect(screen.queryByText('Approved')).toBeNull()
  await act(async () => complete({ ...state, status: 'approved' }))
  await screen.findByText('Approved')
})
it('blocks another decision after an unknown outcome until an authoritative disposition is found', async () => {
  post = async () => { throw new TypeError('Synthetic network failure') }
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
  const check = await screen.findByRole('button', { name: 'Check decision status' })
  expect((screen.getByRole('button', { name: 'Approve application' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(check)
  expect(posts()).toHaveLength(1)
  state = { ...state, status: 'approved' }
  await user.click(screen.getByRole('button', { name: 'Check decision status' }))
  await screen.findByText('Approved')
  expect(posts()).toHaveLength(1)
})
it('suppresses a late detail response and all protected values after session invalidation', async () => {
  let complete!: (value: unknown) => void
  vi.mocked(authRequest).mockImplementation(async (path) => {
    if (path === '/platform/me') return { handle: 'sage.dev', online_only: true }
    if (path.includes('?')) return { data: [application], page: 1, has_more: false }
    return new Promise(resolve => { complete = resolve })
  })
  render(<ApplicationReviewScreen />)
  await userEvent.click(await screen.findByRole('button', { name: 'Review Synthetic application' }))
  act(() => window.dispatchEvent(new CustomEvent('platform-session-invalidated', { detail: { status: 401 } })))
  await act(async () => complete(application))
  expect(screen.queryByText('Synthetic application')).toBeNull()
  expect(screen.queryByText('Asia/Manila')).toBeNull()
})

it('requires a fresh confirmation when server application fields change', async () => {
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  state = { ...state, city: 'Updated synthetic city' }
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
  await screen.findByText(/Application details changed/)
  expect(posts()).toHaveLength(0)
  expect(screen.getByText('Updated synthetic city')).toBeDefined()
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('preserves a rejection reason following server validation and confirms only the supported contract', async () => {
  post = async () => { throw { status: 422, field_errors: { reason: ['Private server message'] } } }
  const user = await open()
  const reason = screen.getByLabelText('Reason for applicant') as HTMLTextAreaElement
  await user.click(screen.getByRole('button', { name: 'Reject application' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.type(reason, '  Synthetic explanation  ')
  await user.selectOptions(screen.getByLabelText('Decision category'), 'other')
  await user.click(screen.getByRole('button', { name: 'Reject application' }))
  await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
  await screen.findByRole('alert')
  expect(posts()[0]).toEqual([`/platform/applications/${id}/reject`, 'POST', { category: 'other', reason: 'Synthetic explanation' }])
  expect(reason.value).toBe('  Synthetic explanation  ')
  expect(document.body.textContent).not.toContain('Private server message')
  expect((screen.getByRole('button', { name: 'Reject application' }) as HTMLButtonElement).disabled).toBe(false)
})
it('reconciles a conflict response to the immutable server decision', async () => {
  post = async () => { state = { ...state, status: 'rejected', reason: 'Synthetic prior decision' }; throw { status: 409 } }
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
  await screen.findByText('Rejected')
  expect(posts()).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Reject application' })).toBeNull()
})
it('keeps an uncertain decision blocked across screen remounts', async () => {
  post = async () => { throw new TypeError('Synthetic failure') }
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
  await screen.findByRole('button', { name: 'Check decision status' })
  cleanup()
  await open()
  expect((screen.getByRole('button', { name: 'Approve application' }) as HTMLButtonElement).disabled).toBe(true)
  expect(posts()).toHaveLength(1)
})
it('does not send a decision after assurance changes during preflight', async () => {
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Approve application' }))
  vi.mocked(authRequest).mockImplementation(async () => { throw { status: 403 } })
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
  await screen.findByRole('alert')
  expect(posts()).toHaveLength(0)
  expect(screen.queryByText('Synthetic application')).toBeNull()
})
it('rejects malformed queue projections without leaking extra applicant fields', async () => {
  vi.mocked(authRequest).mockImplementation(async path => path === '/platform/me' ? { handle: 'sage.dev', online_only: true } : { data: [{ ...application, id: 'invalid', email: 'PRIVATE_SENTINEL' }], page: 1, has_more: false })
  render(<ApplicationReviewScreen />)
  await screen.findByRole('alert')
  expect(document.body.textContent).not.toContain('PRIVATE_SENTINEL')
  expect(screen.queryByRole('button', { name: /Review Synthetic/ })).toBeNull()
})
it('does not retain old queue pagination or records when the requested page fails', async () => {
  vi.mocked(authRequest).mockImplementation(async path => {
    if (path === '/platform/me') return { handle: 'sage.dev', online_only: true }
    if (path.endsWith('page=2')) throw { status: 503 }
    return { data: [application], page: 1, has_more: true }
  })
  render(<ApplicationReviewScreen />)
  await screen.findByRole('button', { name: 'Review Synthetic application' })
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Synthetic application')).toBeNull()
  expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true)
})
