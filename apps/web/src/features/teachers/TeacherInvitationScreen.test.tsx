// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { TeacherInvitationScreen } from './TeacherInvitationScreen'

vi.mock('../auth/transport', async importOriginal => {
  const original = await importOriginal() as typeof import('../auth/transport')
  return { ...original, authRequest: vi.fn() }
})

afterEach(() => { cleanup(); vi.resetAllMocks(); history.replaceState(null, '', '/') })

it.each([
  [403, 'Use the invited account to accept this invitation.'],
  [410, 'This setup link has expired or has already been used.'],
  [422, 'Check the information you entered and try again.'],
])('maps registration HTTP %s safely and retains the proof across rerenders', async (status, message) => {
  const proof = { church_id: '12345678-1234-4234-8234-123456789012', invitation_id: '87654321-4321-4321-8321-210987654321', token: 'a'.repeat(64), signature: 'b'.repeat(64), expires: 2000000000 }
  const fragment = encodeURIComponent(JSON.stringify(proof))
  history.replaceState(null, '', '/account/teacher-invitation#' + fragment)
  vi.mocked(authRequest).mockRejectedValue({ status, message: 'untrusted response text' })
  const user = userEvent.setup()
  const { rerender } = render(<TeacherInvitationScreen fragment={fragment} />)
  rerender(<TeacherInvitationScreen fragment={fragment} />)
  expect(location.hash).toBe('')
  await user.type(screen.getByLabelText('Invited email'), 'invited@example.test')
  await user.click(screen.getByRole('checkbox', { name: 'Create my invited account' }))
  await user.type(screen.getByLabelText('Display name'), 'Invited Teacher')
  const password = 'Q'.repeat(12) + 'a1!'
  await user.type(screen.getByLabelText('New password'), password)
  await user.click(screen.getByRole('button', { name: 'Accept invitation' }))
  expect((await screen.findByRole('alert')).textContent).toContain(message)
  expect(screen.queryByText('untrusted response text')).toBeNull()
  expect(authRequest).toHaveBeenCalledExactlyOnceWith('/api/teacher-invitations/accept', 'POST', { ...proof, email: 'invited@example.test', name: 'Invited Teacher', password })
})
