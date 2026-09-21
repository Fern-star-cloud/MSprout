// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApplicationScreen } from './ApplicationScreen'
import { authRequest } from '../auth/transport'

vi.mock('../auth/transport', async (original) => ({ ...await original<typeof import('../auth/transport')>(), authRequest: vi.fn() }))
vi.mock('./CaptchaChallenge', () => ({ CaptchaChallenge: ({ onToken }: { onToken: (token: string) => void }) => <button type="button" onClick={() => onToken('test-proof')}>Complete verification</button> }))
beforeEach(() => { vi.mocked(authRequest).mockReset() })
afterEach(cleanup)

it('requires email verification before showing the application form', async () => {
  vi.mocked(authRequest).mockResolvedValue({ email_verified: false, mfa_confirmed: false })
  render(<ApplicationScreen />)
  expect(await screen.findByRole('link', { name: 'Verify email' })).toBeDefined()
  expect(screen.queryByLabelText('Church name')).toBeNull()
})

it('submits bounded application data with a completed captcha and shows pending status', async () => {
  vi.mocked(authRequest).mockResolvedValueOnce({ email_verified: true, mfa_confirmed: false }).mockResolvedValueOnce({ application: null }).mockResolvedValueOnce({ id: 'application', status: 'pending', church_name: 'Grace Church' })
  render(<ApplicationScreen />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Church name'), 'Grace Church')
  await user.type(screen.getByLabelText('City'), 'Davao City')
  expect((screen.getByRole('button', { name: 'Submit application' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Complete verification' }))
  await user.click(screen.getByRole('button', { name: 'Submit application' }))
  expect(await screen.findByText('Pending review')).toBeDefined()
  expect(authRequest).toHaveBeenLastCalledWith('/api/church-applications', 'POST', expect.objectContaining({ church_name: 'Grace Church', captcha_token: 'test-proof', timezone: 'Asia/Manila' }))
})

it.each(['approved', 'rejected'])('shows %s next steps from the current application', async (status) => {
  vi.mocked(authRequest).mockResolvedValueOnce({ email_verified: true, mfa_confirmed: false }).mockResolvedValueOnce({ application: { id: 'application', status, church_name: 'Grace Church', reason: 'More information needed' } })
  render(<ApplicationScreen />)
  if (status === 'approved') expect(await screen.findByRole('link', { name: 'Set up MFA' })).toBeDefined()
  else expect(await screen.findByText('More information needed')).toBeDefined()
  expect(screen.queryByLabelText('Church name')).toBeNull()
})

it('offers retry and sign in after a failed initial load', async () => {
  vi.mocked(authRequest).mockRejectedValue({ status: 401 })
  render(<ApplicationScreen />)
  expect(await screen.findByRole('alert')).toBeDefined()
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeDefined()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toBeDefined())
})

it('links an approved workspace to Teacher management', async () => {
  const church = crypto.randomUUID()
  vi.mocked(authRequest).mockResolvedValueOnce({ email_verified: true, mfa_confirmed: true }).mockResolvedValueOnce({ application: { id: 'application', status: 'approved', church_name: 'Grace Church', church_id: church } })
  render(<ApplicationScreen />)
  expect((await screen.findByRole('link', { name: 'Manage Teachers' })).getAttribute('href')).toBe('/account/teachers?church=' + church)
})
