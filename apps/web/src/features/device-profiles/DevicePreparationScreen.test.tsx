// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { ProfilePinError } from '../../offline/profile-store'
import { StrictMode } from 'react'
import { authRequest } from '../auth/transport'
import { DevicePreparationScreen } from './DevicePreparationScreen'
import type { LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn(), safeAuthMessage: () => 'Sign in again and check your church access.' }))
const church = '00000000-0000-4000-8000-000000000010', ministry = '00000000-0000-4000-8000-000000000020'
const partial = { id: 'partial', actorId: '11', churchId: church, deviceId: 'device', leaseExpiresAt: null, leaseSignature: null, requiresReauthentication: true } as ProfileRecord
const bootstrap: OfflineBootstrap = { actor: { id: '11' }, ministries: [{ id: ministry, name: 'Assigned', version: 1 }], roster: [], server_cursor: '0', lease: { actor_id: '11', church_id: church, device_id: 'device', expires_at: '2099-01-01T00:00:00Z', membership_id: 'membership', issued_at: '2026-01-01T00:00:00Z', signature: 'a'.repeat(64) } }
function setup(profiles: ProfileRecord[] = []) {
  vi.mocked(authRequest).mockImplementation(async path => {
    if (path === '/auth/session') return { id: 11, email_verified: true, mfa_confirmed: true, workspaces: [{ church_id: church, name: 'Synthetic church', role: 'teacher' }] } as never
    if (path === '/api/me') return { id: 11, email_verified: true, memberships: [{ church_id: church, role: 'teacher', status: 'active' }], assignments: { ministry_ids: [ministry] }, active_session: { mfa_confirmed: false } } as never
    if (path === '/api/ministries') return { data: [{ id: ministry, name: 'Assigned', status: 'active', version: 1 }] } as never
    return bootstrap as never
  })
  let unlocked = false
  const store = {
    listProfiles: vi.fn(async () => profiles), createProfile: vi.fn(async (input: Parameters<LocalProfileStore['createProfile']>[0]) => { void input; profiles.push(partial); return partial }),
    unlockProfile: vi.fn(async () => { unlocked = true }), saveBootstrap: vi.fn(async () => {}),
    isLeaseValid: vi.fn(async () => true), isUnlocked: vi.fn(() => unlocked),
    lockProfile: vi.fn(() => { unlocked = false }), onLock: vi.fn((listener: Parameters<LocalProfileStore['onLock']>[0]) => { void listener; return () => {} }),
  }
  return store
}
afterEach(() => { cleanup(); vi.resetAllMocks() })
async function pinStage() { await screen.findByText('Assigned'); fireEvent.click(screen.getByRole('button', { name: 'Continue to local PIN' })) }
function enter(pin = '000123', confirmation = pin) {
  fireEvent.change(screen.getByLabelText('Choose a 6–12 digit local PIN'), { target: { value: pin } })
  fireEvent.change(screen.getByLabelText('Confirm local PIN'), { target: { value: confirmation } })
  fireEvent.submit(screen.getByRole('button', { name: 'Prepare encrypted profile' }).closest('form')!)
}
it('preserves leading zeros and shows Ready only after durable persistence, without entering attendance', async () => {
  const store = setup(), attendance = vi.fn()
  let finish!: () => void
  store.saveBootstrap.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<DevicePreparationScreen store={store} onAttendance={attendance} />)
  await pinStage()
  const form = screen.getByRole('button', { name: 'Prepare encrypted profile' }).closest('form')!
  enter(); fireEvent.submit(form)
  await waitFor(() => expect(store.saveBootstrap).toHaveBeenCalledOnce())
  expect(store.createProfile.mock.calls[0][0]).toMatchObject({ actorId: '11', churchId: church, pin: '000123' })
  expect(screen.queryByRole('heading', { name: 'Ready for offline attendance' })).toBeNull()
  expect(store.createProfile).toHaveBeenCalledOnce()
  await act(async () => finish())
  await screen.findByRole('heading', { name: 'Ready for offline attendance' })
  expect(attendance).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open Attendance' }))
  expect(attendance).toHaveBeenCalledOnce()
})
it.each([['12345','12345'],['1234567890123','1234567890123'],['abc123','abc123'],['000123','000124']])('rejects invalid or mismatching PINs %s/%s before creating anything', async (pin, confirmation) => {
  const store = setup(); render(<DevicePreparationScreen store={store} />); await pinStage(); enter(pin, confirmation)
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(store.createProfile).not.toHaveBeenCalled()
})
it('continues an interrupted profile with its existing PIN and device binding', async () => {
  const store = setup([partial, { ...partial, id: 'foreign', actorId: '22' }]); render(<DevicePreparationScreen store={store} />)
  await screen.findByRole('radio', { name: 'Continue Profile 1' }); fireEvent.click(screen.getByRole('radio', { name: 'Continue Profile 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue to local PIN' }))
  fireEvent.change(screen.getByLabelText('Existing local PIN'), { target: { value: '000123' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Continue encrypted preparation' }).closest('form')!)
  await screen.findByRole('heading', { name: 'Ready for offline attendance' })
  expect(store.createProfile).not.toHaveBeenCalled(); expect(store.unlockProfile).toHaveBeenCalledWith('partial', '000123')
  expect(store.saveBootstrap).toHaveBeenCalledWith('partial', bootstrap, { preserveCursor: true, preparationOnly: true })
  expect(screen.queryByRole('radio', { name: /Profile 2/ })).toBeNull()
})
it('keeps a partially created profile after durable-write failure and never recreates it on retry', async () => {
  const store = setup(); store.saveBootstrap.mockRejectedValueOnce(new Error('storage'))
  render(<DevicePreparationScreen store={store} />); await pinStage(); enter()
  await screen.findByText(/Keep this profile and its existing PIN/)
  expect(screen.queryByRole('heading', { name: 'Ready for offline attendance' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Verify access again' })); await pinStage()
  fireEvent.change(screen.getByLabelText('Existing local PIN'), { target: { value: '000123' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Continue encrypted preparation' }).closest('form')!)
  await screen.findByRole('heading', { name: 'Ready for offline attendance' })
  expect(store.createProfile).toHaveBeenCalledOnce()
})
it.each(['lock','authorization','offline'])('suppresses a late bootstrap after %s changes', async cause => {
  const store = setup(); let finish!: (value: unknown) => void
  const original = vi.mocked(authRequest).getMockImplementation()!
  vi.mocked(authRequest).mockImplementation((...args) => args[0].startsWith('/api/offline/bootstrap') ? new Promise(resolve => { finish = resolve }) : original(...args))
  render(<DevicePreparationScreen store={store} />); await pinStage(); enter(); await waitFor(() => expect(finish).toBeDefined())
  await act(async () => {
    if (cause === 'lock') { store.isUnlocked.mockReturnValue(false); store.onLock.mock.calls[0][0]('partial', 'manual') }
    else window.dispatchEvent(cause === 'offline' ? new Event('offline') : new CustomEvent('church-workspace-invalidated', { detail: { status: 401 } }))
    finish(bootstrap)
  })
  expect(store.saveBootstrap).not.toHaveBeenCalled(); expect(screen.queryByText('Assigned')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Ready for offline attendance' })).toBeNull()
})

it.each([401, 403, 419])('creates nothing for an expired or unauthorized session (%s)', async status => {
  const store = setup(); vi.mocked(authRequest).mockRejectedValue(new ApiError('denied', '', '', status))
  render(<DevicePreparationScreen store={store} />)
  await screen.findByRole('alert')
  expect(screen.queryByLabelText('Choose a 6–12 digit local PIN')).toBeNull()
  expect(store.createProfile).not.toHaveBeenCalled()
})
it('blocks no-assignment preparation and rejects an unauthorized query workspace', async () => {
  const store = setup(), original = vi.mocked(authRequest).getMockImplementation()!
  vi.mocked(authRequest).mockImplementation(async (...args) => args[0] === '/api/ministries' ? { data: [] } as never : original(...args))
  render(<DevicePreparationScreen store={store} />)
  await screen.findByText(/No authorized active ministries/)
  expect(screen.getByRole('button', { name: 'Continue to local PIN' }).hasAttribute('disabled')).toBe(true)
  expect(store.createProfile).not.toHaveBeenCalled()
})
it('waits for explicit selection when multiple verified churches exist', async () => {
  const store = setup(), original = vi.mocked(authRequest).getMockImplementation()!
  vi.mocked(authRequest).mockImplementation(async (...args) => args[0] === '/auth/session' ? { id: 11, email_verified: true, mfa_confirmed: false, workspaces: [{ church_id: church, name: 'Synthetic church', role: 'teacher' }, { church_id: '00000000-0000-4000-8000-000000000099', name: 'Other church', role: 'teacher' }] } as never : original(...args))
  render(<DevicePreparationScreen store={store} />)
  await screen.findByLabelText('Verified church workspace')
  expect(authRequest).not.toHaveBeenCalledWith('/api/me', 'GET', undefined, church)
  fireEvent.change(screen.getByLabelText('Verified church workspace'), { target: { value: church } })
  await screen.findByText('Assigned')
  expect(store.createProfile).not.toHaveBeenCalled()
})
it('checks scope again before applying bootstrap and refuses a changed actor', async () => {
  const store = setup(), original = vi.mocked(authRequest).getMockImplementation()!
  let bootstrapped = false
  vi.mocked(authRequest).mockImplementation(async (...args) => {
    if (args[0].startsWith('/api/offline/bootstrap')) bootstrapped = true
    if (args[0] === '/auth/session' && bootstrapped) return { id: 22, email_verified: true, mfa_confirmed: false, workspaces: [{ church_id: church, name: 'Synthetic church', role: 'teacher' }] } as never
    return original(...args)
  })
  render(<DevicePreparationScreen store={store} />); await pinStage(); enter()
  await screen.findByText(/Keep this profile and its existing PIN/)
  expect(store.saveBootstrap).not.toHaveBeenCalled(); expect(store.lockProfile).toHaveBeenCalledWith('partial')
})
it('announces an enforced incorrect-PIN delay without fetching a roster', async () => {
  const store = setup([partial]); store.unlockProfile.mockRejectedValueOnce(new ProfilePinError('incorrect', new Date(Date.now() + 60_000).toISOString()))
  render(<DevicePreparationScreen store={store} />)
  fireEvent.click(await screen.findByRole('radio', { name: 'Continue Profile 1' })); await pinStage()
  fireEvent.change(screen.getByLabelText('Existing local PIN'), { target: { value: '000124' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Continue encrypted preparation' }).closest('form')!)
  await screen.findByRole('alert')
  expect(screen.getByRole('alert').textContent).toMatch(/PIN was not accepted/)
  expect(screen.getByText(/Try again in \d+ seconds/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Verify access again' })); await pinStage()
  expect(screen.getByText(/Try again in \d+ seconds/)).toBeTruthy()
  expect(screen.getByLabelText('Existing local PIN').getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('button', { name: 'Continue encrypted preparation' }).hasAttribute('disabled')).toBe(true)
  expect(vi.mocked(authRequest).mock.calls.some(([path]) => path.startsWith('/api/offline/bootstrap'))).toBe(false)
})
it('never displays Ready for an unverifiable lease and hides readiness immediately on lock', async () => {
  const store = setup(); store.isLeaseValid.mockResolvedValueOnce(false)
  render(<DevicePreparationScreen store={store} />); await pinStage(); enter()
  await screen.findByText(/Keep this profile and its existing PIN/)
  expect(screen.queryByRole('heading', { name: 'Ready for offline attendance' })).toBeNull()
})
it('preserves a creation that finishes after unmount without unlocking or bootstrapping it', async () => {
  const store = setup(); let finish!: (profile: ProfileRecord) => void
  store.createProfile.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(<DevicePreparationScreen store={store} />); await pinStage(); enter()
  await waitFor(() => expect(finish).toBeDefined()); view.unmount(); await act(async () => finish(partial))
  expect(store.unlockProfile).not.toHaveBeenCalled(); expect(store.saveBootstrap).not.toHaveBeenCalled()
})
it('does not repeat an uncertain creation when storage reconciliation fails', async () => {
  const store = setup(); store.createProfile.mockRejectedValueOnce(new Error('write uncertain'))
  render(<DevicePreparationScreen store={store} />); await pinStage()
  store.listProfiles.mockRejectedValueOnce(new Error('unreadable')); enter()
  await screen.findByText(/Keep this profile and its existing PIN/)
  fireEvent.click(screen.getByRole('button', { name: 'Verify access again' })); await pinStage(); enter()
  await screen.findByText(/previous creation could not be reconciled/)
  expect(store.createProfile).toHaveBeenCalledOnce()
})

it('finishes verified access after StrictMode remount without requiring a manual retry', async () => {
  const store = setup()
  render(<StrictMode><DevicePreparationScreen store={store} /></StrictMode>)
  await screen.findByText('Assigned')
  expect(screen.getByRole('button', { name: 'Continue to local PIN' })).toBeTruthy()
})
