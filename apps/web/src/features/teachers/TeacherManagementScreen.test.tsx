// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TeacherManagementScreen } from './TeacherManagementScreen'
import { TeacherInvitationScreen } from './TeacherInvitationScreen'
import { authRequest } from '../auth/transport'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn(), safeAuthMessage: () => 'Unable to complete this action.' }))
const request = vi.mocked(authRequest)
const church = '12345678-1234-4234-8234-123456789012'
const teacher = { id: 'teacher-id', display_name: 'Test teacher', status: 'active', ministry_ids: ['ministry-id'], can_manage: true }

beforeEach(() => {
  history.replaceState(null, '', '/account/teachers?church=' + church)
  request.mockImplementation(async (path) => {
    if (path === '/api/me') return { memberships: [{ role: 'owner', status: 'active', church_id: church }], active_session: { mfa_confirmed: true } }
    if (path.startsWith('/api/teachers')) return { data: [teacher], has_more: false, can_invite: true }
    if (path.startsWith('/api/teacher-invitations')) return { data: [{ id: 'invite-id', email: 'invited@example.test', status: 'pending', role: 'teacher' }], has_more: false }
    return { data: [{ id: 'ministry-id', name: 'Sunday ministry' }] }
  })
})
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); history.replaceState(null, '', '/') })

it('lists Teachers and invitations and submits ministry assignments', async () => {
  const user = userEvent.setup()
  render(<TeacherManagementScreen />)
  await screen.findByText('Test teacher')
  expect(screen.getByText(/invited@example.test/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Edit assignments' }))
  await user.click(screen.getByLabelText('Sunday ministry'))
  await user.click(screen.getByRole('button', { name: 'Save assignments' }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/teachers/teacher-id/assignments', 'PUT', { ministry_ids: [] }, church))
})

it('requires an explicit revocation confirmation and supports cancel', async () => {
  const user = userEvent.setup()
  render(<TeacherManagementScreen />)
  await screen.findByText('Test teacher')
  await user.click(screen.getByRole('button', { name: 'Revoke Teacher' }))
  expect(request.mock.calls.some((call) => call[1] === 'DELETE')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Revoke Teacher' }))
  await user.click(screen.getByRole('button', { name: 'Confirm revocation' }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/teachers/teacher-id', 'DELETE', undefined, church))
})

it('confirms ownership with password and a fresh MFA code and clears controls after success', async () => {
  const user = userEvent.setup()
  render(<TeacherManagementScreen />)
  await screen.findByText('Test teacher')
  await user.click(screen.getByRole('button', { name: 'Transfer ownership' }))
  await user.type(screen.getByLabelText('Current password'), 'test-password')
  await user.type(screen.getByLabelText('Fresh authenticator code'), '123456')
  await user.click(screen.getByLabelText(/I understand/))
  await user.click(screen.getByRole('button', { name: 'Confirm transfer' }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/ownership-transfer', 'POST', { target_membership_id: teacher.id, password: 'test-password', code: '123456' }, church))
  expect(await screen.findByText(/Ownership transferred\. Sign in again\./)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Invite Teacher' })).toBeNull()
})

it('hides all management actions from Teachers and denied sessions', async () => {
  request.mockResolvedValue({ memberships: [{ role: 'teacher', status: 'active', church_id: church }] })
  render(<TeacherManagementScreen />)
  await screen.findByText(/Owner access is required/)
  expect(screen.queryByRole('button', { name: 'Invite Teacher' })).toBeNull()
  expect(request).toHaveBeenCalledTimes(1)
})

it('submits a fixed Teacher invitation with selected ministries', async () => {
  const user = userEvent.setup()
  render(<TeacherManagementScreen />)
  await screen.findByText('Test teacher')
  await user.type(screen.getByLabelText('Invitation email'), 'person@example.test')
  await user.click(screen.getByLabelText('Sunday ministry'))
  await user.click(screen.getByRole('button', { name: 'Invite Teacher' }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/teacher-invitations', 'POST', { email: 'person@example.test', ministry_ids: ['ministry-id'] }, church))
})

it('keeps signed proof in memory and submits acceptance in the body only', async () => {
  const user = userEvent.setup()
  const proof = { church_id: church, invitation_id: church, token: 'a'.repeat(64), signature: 'b'.repeat(64), expires: 2000000000 }
  history.replaceState(null, '', '/account/teacher-invitation#' + encodeURIComponent(JSON.stringify(proof)))
  render(<TeacherInvitationScreen fragment={location.hash.slice(1)} />)
  expect(location.hash).toBe('')
  await user.type(screen.getByLabelText('Invited email'), 'person@example.test')
  await user.click(screen.getByRole('button', { name: 'Accept invitation' }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/teacher-invitations/accept', 'POST', { ...proof, email: 'person@example.test' }))
  expect(await screen.findByText(/Invitation accepted/)).toBeTruthy()
})

it('hides actions after an authorization failure and never displays server details', async () => {
  const user = userEvent.setup()
  render(<TeacherManagementScreen />)
  await screen.findByText('Test teacher')
  request.mockRejectedValue(new Error('sensitive failure'))
  await user.click(screen.getByRole('button', { name: 'Revoke invitation' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('sensitive failure')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Invite Teacher' })).toBeNull()
})

it('offers no management actions while offline', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  render(<TeacherManagementScreen />)
  expect(screen.getByText(/Connect to the internet/)).toBeTruthy()
  expect(request).not.toHaveBeenCalled()
})

it('respects per Teacher action policy and invitation status', async () => {
  request.mockImplementation(async path => {
    if (path === '/api/me') return { memberships: [{ church_id: church, role: 'owner', status: 'active' }], active_session: { mfa_confirmed: true } }
    if (path.startsWith('/api/teachers')) return { data: [{ ...teacher, status: 'revoked', can_manage: false }], has_more: false, can_invite: false }
    if (path.startsWith('/api/teacher-invitations')) return { data: [{ id: 'expired', email: 'expired@example.test', status: 'expired' }], has_more: false }
    return { data: [] }
  })
  render(<TeacherManagementScreen />)
  await screen.findByText('Test teacher')
  for (const name of ['Revoke Teacher', 'Transfer ownership', 'Edit assignments', 'Invite Teacher', 'Revoke invitation']) expect(screen.queryByRole('button', { name })).toBeNull()
})

it('rejects malformed invitation fragments without a request', () => {
  render(<TeacherInvitationScreen fragment="invalid" />)
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(request).not.toHaveBeenCalled()
})
