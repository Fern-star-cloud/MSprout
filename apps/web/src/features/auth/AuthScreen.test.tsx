// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'
import { authRequest } from './transport'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../../api/client'

vi.mock('./transport', async (original) => ({ ...await original<typeof import('./transport')>(), authRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('submits a labelled login form and continues to the MFA challenge', async () => {
  vi.mocked(authRequest).mockResolvedValue({ two_factor: true })
  render(<AuthScreen initialPage="login" />)
  const password = screen.getByLabelText('Password') as HTMLInputElement
  expect(password.autocomplete).toBe('current-password')
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teacher@example.test' } })
  fireEvent.change(password, { target: { value: crypto.randomUUID() } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByLabelText('Authenticator code')).toBeTruthy()
  expect(screen.queryByLabelText('Password')).toBeNull()
})

it('shows a safe visible failure without logging or retaining the password', async () => {
  vi.mocked(authRequest).mockRejectedValue({ status: 429 })
  render(<AuthScreen initialPage="login" />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teacher@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: crypto.randomUUID() } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Too many attempts')
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
})

it('requests password recovery with a non-enumerating success message', async () => {
  vi.mocked(authRequest).mockResolvedValue({})
  render(<AuthScreen initialPage="forgot-password" />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teacher@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect((await screen.findByRole('status')).textContent).toContain('If an account matches')
})

it('enrolls MFA only after password confirmation and shows recovery codes after confirmation', async () => {
  vi.mocked(authRequest).mockImplementation(async (path) => {
    if (path === '/user/two-factor-secret-key') return { secretKey: 'test-enrollment-key' }
    if (path === '/user/two-factor-recovery-codes') return ['test-recovery-code']
    return {}
  })
  render(<AuthScreen initialPage="mfa" />)
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: crypto.randomUUID() } })
  fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }))
  expect(await screen.findByText('test-enrollment-key')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm authenticator' }))
  expect(await screen.findByText('test-recovery-code')).toBeTruthy()
  await waitFor(() => expect(authRequest).toHaveBeenCalledWith('/user/confirm-password', 'POST', expect.anything()))
})

it('uses the email reset token without putting it into form fields or storage', async () => {
  vi.mocked(authRequest).mockResolvedValue({})
  const token = crypto.randomUUID()
  render(<AuthScreen initialPage="reset-password" fragment={new URLSearchParams({ token, email: 'teacher@example.test' }).toString()} />)
  const password = crypto.randomUUID()
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy()
  expect(authRequest).toHaveBeenCalledWith('/reset-password', 'POST', expect.objectContaining({ token, email: 'teacher@example.test' }))
})

it('keeps a verification link available after signing in', async () => {
  const invitation = '/email/verify/12/abcdef?expires=123&signature=abc'
  vi.mocked(authRequest).mockResolvedValue({ email_verified: true, mfa_confirmed: false })
  render(<AuthScreen initialPage="verify-email" fragment={encodeURIComponent(location.origin + invitation)} />)
  expect(screen.getByRole('link', { name: 'Sign in to verify' }).getAttribute('href')).toContain('#')
})

it('checks an existing session after a reload without submitting credentials', async () => {
  vi.mocked(authRequest).mockResolvedValue({ email_verified: true, mfa_confirmed: false })
  render(<AuthScreen initialPage="login" />)
  await userEvent.click(screen.getByRole('button', { name: 'Continue signed-in session' }))
  expect(await screen.findByRole('heading', { name: 'Your account' })).toBeTruthy()
  expect(authRequest).toHaveBeenCalledWith('/auth/session')
})

it('verifies a signed email link only once before checking account state', async () => {
  const invitation = '/email/verify/12/abcdef?expires=123&signature=abc'
  vi.mocked(authRequest).mockResolvedValue({ email_verified: true, mfa_confirmed: false })
  render(<AuthScreen initialPage="verify-email" fragment={encodeURIComponent(location.origin + invitation)} />)
  await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
  expect(await screen.findByRole('heading', { name: 'Your account' })).toBeTruthy()
  expect(vi.mocked(authRequest).mock.calls.filter(([path]) => path === invitation)).toHaveLength(1)
})

it('supports keyboard submission and associates visible field errors', async () => {
  vi.mocked(authRequest).mockRejectedValue(new ApiError('validation_failed', 'invalid', '', 422, { email: ['Check this field.'] }))
  render(<AuthScreen initialPage="login" />)
  await userEvent.tab()
  expect(document.activeElement).toBe(screen.getByLabelText('Email'))
  await userEvent.type(screen.getByLabelText('Email'), 'teacher@example.test')
  await userEvent.tab()
  await userEvent.keyboard(crypto.randomUUID() + '{Enter}')
  expect(await screen.findByText('Check this field.')).toBeTruthy()
  expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toBe('email-error')
})
