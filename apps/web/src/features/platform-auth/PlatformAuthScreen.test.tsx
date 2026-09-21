// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlatformAuthScreen } from './PlatformAuthScreen'
import { authRequest } from '../auth/transport'

vi.mock('../auth/transport', async (original) => ({ ...await original<typeof import('../auth/transport')>(), authRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('requires the platform challenge before displaying the platform session', async () => {
  vi.mocked(authRequest).mockImplementation(async (path) => path === '/platform/me' ? { handle: 'sage.dev', online_only: true } : { two_factor: true })
  render(<PlatformAuthScreen />)
  fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'sage.dev' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: crypto.randomUUID() } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to platform' }))
  expect(await screen.findByLabelText('Authenticator code')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify platform sign-in' }))
  expect(await screen.findByText('Signed in as sage.dev')).toBeTruthy()
})

it('requires recovery acknowledgement before completing signed setup', async () => {
  const invitation = '/platform/setup/11111111-1111-4111-8111-111111111111?expires=123&signature=abc'
  vi.mocked(authRequest).mockImplementation(async (path, method) => {
    if (path === invitation && method === 'POST') return { secret: 'test-setup-key', qr_code: '', recovery_codes: ['test-recovery-code'] }
    if (path === '/platform/me') return { handle: 'sage.dev', online_only: true }
    return {}
  })
  render(<PlatformAuthScreen setup fragment={encodeURIComponent(location.origin + invitation)} />)
  const password = crypto.randomUUID()
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Begin secure setup' }))
  expect(await screen.findByText('test-setup-key')).toBeTruthy()
  expect(screen.getByText('test-recovery-code')).toBeTruthy()
  expect((screen.getByLabelText('I saved my recovery codes') as HTMLInputElement).required).toBe(true)
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } })
  fireEvent.click(screen.getByLabelText('I saved my recovery codes'))
  fireEvent.click(screen.getByRole('button', { name: 'Activate platform account' }))
  expect(await screen.findByText('Signed in as sage.dev')).toBeTruthy()
  expect(authRequest).toHaveBeenCalledWith(invitation.split('?')[0] + '/confirm', 'POST', { code: '123456', recovery_codes_acknowledged: true })
  expect(screen.queryByText('test-setup-key')).toBeNull()
})

it('rejects an external setup link without sending any request', () => {
  render(<PlatformAuthScreen setup fragment={encodeURIComponent('https://attacker.test/platform/setup/11111111-1111-4111-8111-111111111111?expires=1&signature=a')} />)
  expect(screen.getByRole('alert').textContent).toContain('valid setup link')
  expect(authRequest).not.toHaveBeenCalled()
})
