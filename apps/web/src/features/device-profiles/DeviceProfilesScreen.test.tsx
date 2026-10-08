// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { authRequest } from '../auth/transport'
import { DeviceProfilesScreen } from './DeviceProfilesScreen'
import { syncClient, type SyncSummary } from '../../sync/sync-client'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn() }))
vi.mock('../../sync/sync-client', () => ({ syncClient: { syncProfile: vi.fn(async () => ({ conflicts: 0, rejected: 0 })) } }))

function recoveryStore() {
  const profile = {
    id: 'profile-a', actorId: '11', deviceId: 'device-a', churchId: 'church-a', createdAt: '2026-09-28T00:00:00Z',
    requiresReauthentication: false, syncNeedsPull: true, failedAttempts: 0, retryAfter: null, leaseExpiresAt: null, leaseSignature: null,
    salt: 'salt', iterations: 600_000,
    wrappedDataKey: { algorithm: 'AES-256-GCM' as const, iv: 'iv', ciphertext: 'ciphertext', schemaVersion: 1 },
  }
  return {
    listProfiles: vi.fn(async () => [profile]), unlockProfile: vi.fn(), switchProfile: vi.fn(), createProfile: vi.fn(),
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), onLock: vi.fn(() => () => {}), isUnlocked: () => true, lockProfile: vi.fn(),
  }
}

it('keeps incomplete downloads visible and prevents a second action until the pull finishes', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  vi.mocked(authRequest).mockResolvedValue({} as never)
  let finish!: () => void
  const synchronizer = { syncProfile: vi.fn(() => new Promise<SyncSummary>(resolve => { finish = () => {
    resolve({ pushed: 0, acknowledged: 0, conflicts: 0, rejected: 0, pulled: 0, nextCursor: '3' })
  } })) }
  const unlocked = vi.fn()
  render(<DeviceProfilesScreen store={store} synchronizer={synchronizer} pendingCount={async () => 0} onUnlocked={unlocked} />)
  await screen.findByText(/0 pending uploads.*Downloads incomplete/)
  await user.type(screen.getByLabelText('Local PIN'), '184629')
  const button = screen.getByRole('button', { name: 'Refresh authorization and sync' })
  await user.click(button)
  await waitFor(() => expect(synchronizer.syncProfile).toHaveBeenCalledOnce())
  expect((button as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText(/Synchronization complete\./)).toBeNull()
  await user.click(button)
  expect(synchronizer.syncProfile).toHaveBeenCalledOnce()
  finish()
  await screen.findByText(/Synchronization complete.*download pages/)
  expect(unlocked).not.toHaveBeenCalled()
})

it('refuses recovery when the PIN fails or bootstrap belongs to another actor', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  store.unlockProfile.mockRejectedValueOnce(new Error('incorrect PIN'))
  const synchronizer = { syncProfile: vi.fn() }
  render(<DeviceProfilesScreen store={store} synchronizer={synchronizer} pendingCount={async () => 0} />)
  const button = await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.type(screen.getByLabelText('Local PIN'), '184629')
  await user.click(button)
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  expect(authRequest).not.toHaveBeenCalled()
  vi.mocked(authRequest).mockResolvedValue({ actor: { id: 'other-teacher' } } as never)
  store.saveBootstrap.mockRejectedValueOnce(new Error('Server actor does not match this local profile.'))
  await user.click(button)
  await waitFor(() => expect(store.saveBootstrap).toHaveBeenCalledOnce())
  expect(synchronizer.syncProfile).not.toHaveBeenCalled()
  expect(store.switchProfile).not.toHaveBeenCalled()
})

it('reports a failed download separately from zero uploads and permits retry', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  vi.mocked(authRequest).mockResolvedValue({} as never)
  const synchronizer = { syncProfile: vi.fn().mockRejectedValueOnce(new TypeError('network interruption')).mockResolvedValue({ conflicts: 0, rejected: 0 }) }
  render(<DeviceProfilesScreen store={store} synchronizer={synchronizer} pendingCount={async () => 0} />)
  const button = await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.click(button)
  await screen.findByText(/Synchronization incomplete.*Uploaded changes may already be accepted/)
  expect(screen.queryByText(/Synchronization complete\./)).toBeNull()
  expect(screen.getByText(/0 pending uploads.*Downloads incomplete/)).toBeTruthy()
  await user.click(button)
  await screen.findByText(/Synchronization complete.*download pages/)
  expect(synchronizer.syncProfile).toHaveBeenCalledTimes(2)
})

it('locks the profile if an authorization denial cannot purge its cache', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  vi.mocked(authRequest).mockRejectedValueOnce(new ApiError('forbidden', 'Unavailable.', '', 403))
  store.invalidateAuthorization.mockRejectedValueOnce(new Error('storage unavailable'))
  const synchronizer = { syncProfile: vi.fn() }
  render(<DeviceProfilesScreen store={store} synchronizer={synchronizer} pendingCount={async () => 0} />)
  const button = await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.click(button)
  await waitFor(() => expect(store.lockProfile).toHaveBeenCalledWith('profile-a'))
  expect(synchronizer.syncProfile).not.toHaveBeenCalled()
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

it('offers an accessible PIN unlock and online profile creation flow', async () => {
  const store = {
    listProfiles: vi.fn(async () => [{
      id: 'profile-a', actorId: '11', deviceId: 'device-a', churchId: 'church-a', createdAt: '2026-09-28T00:00:00Z',
      requiresReauthentication: false, failedAttempts: 0, retryAfter: null, leaseExpiresAt: null, leaseSignature: null,
      salt: 'salt', iterations: 600_000,
      wrappedDataKey: { algorithm: 'AES-256-GCM' as const, iv: 'iv', ciphertext: 'ciphertext', schemaVersion: 1 },
    }]),
    unlockProfile: vi.fn(), switchProfile: vi.fn(), createProfile: vi.fn(), saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), onLock: vi.fn(() => () => {}), isUnlocked: () => true, lockProfile: vi.fn(),
  }
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)

  expect(await screen.findByRole('heading', { name: 'Choose a device profile' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Use profile 1' })).toBeTruthy()
  expect(screen.getByLabelText('Local PIN').getAttribute('inputmode')).toBe('numeric')
  expect(screen.getByLabelText('Local PIN').getAttribute('type')).toBe('password')
  expect(screen.getByRole('button', { name: 'Add profile' })).toBeTruthy()
  expect(screen.getByText(/not your church password/i)).toBeTruthy()
})

it('refreshes the selected profile only after the signed-in actor passes bootstrap validation', async () => {
  const user = userEvent.setup()
  const profile = {
    id: 'profile-a', actorId: '11', deviceId: '00000000-0000-4000-8000-000000000050', churchId: '00000000-0000-4000-8000-000000000010', createdAt: '2026-09-28T00:00:00Z',
    requiresReauthentication: true, failedAttempts: 0, retryAfter: null, leaseExpiresAt: '2026-10-12T00:00:00Z', leaseSignature: 'a'.repeat(64),
    salt: 'salt', iterations: 600_000,
    wrappedDataKey: { algorithm: 'AES-256-GCM' as const, iv: 'iv', ciphertext: 'ciphertext', schemaVersion: 1 },
  }
  const bootstrap = { actor: { id: '11' }, ministries: [], roster: [], server_cursor: '2', lease: {
    actor_id: '11', church_id: profile.churchId, membership_id: '00000000-0000-4000-8000-000000000040',
    device_id: profile.deviceId, issued_at: '2026-09-30T00:00:00Z', expires_at: '2026-10-14T00:00:00Z', signature: 'b'.repeat(64),
  } }
  vi.mocked(authRequest).mockResolvedValue(bootstrap as never)
  const store = {
    listProfiles: vi.fn(async () => [profile]), unlockProfile: vi.fn(), switchProfile: vi.fn(), createProfile: vi.fn(),
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), onLock: vi.fn(() => () => {}), isUnlocked: () => true, lockProfile: vi.fn(),
  }
  const unlocked = vi.fn()
  render(<DeviceProfilesScreen store={store} onUnlocked={unlocked} pendingCount={async () => 0} />)
  await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.type(screen.getByLabelText('Local PIN'), '184629')
  await user.click(screen.getByRole('button', { name: 'Refresh authorization and sync' }))

  await waitFor(() => expect(store.unlockProfile).toHaveBeenCalledWith(profile.id, '184629'))
  expect(authRequest).toHaveBeenCalledWith(`/api/offline/bootstrap?device_id=${profile.deviceId}`, 'GET', undefined, profile.churchId)
  expect(store.saveBootstrap).toHaveBeenCalledWith(profile.id, bootstrap, { preserveCursor: true })
  expect(syncClient.syncProfile).toHaveBeenCalledWith(profile.id)
  expect(unlocked).not.toHaveBeenCalled()
  expect(store.switchProfile).not.toHaveBeenCalled()
  expect(store.createProfile).not.toHaveBeenCalled()
  expect(await screen.findByText(/Synchronization complete.*download pages/i)).toBeTruthy()
})

it('invalidates cached authorization after an authenticated bootstrap denial', async () => {
  const user = userEvent.setup()
  const profile = {
    id: 'profile-a', actorId: '11', deviceId: '00000000-0000-4000-8000-000000000050', churchId: '00000000-0000-4000-8000-000000000010', createdAt: '2026-09-28T00:00:00Z',
    requiresReauthentication: true, failedAttempts: 0, retryAfter: null, leaseExpiresAt: '2026-10-12T00:00:00Z', leaseSignature: 'a'.repeat(64),
    salt: 'salt', iterations: 600_000,
    wrappedDataKey: { algorithm: 'AES-256-GCM' as const, iv: 'iv', ciphertext: 'ciphertext', schemaVersion: 1 },
  }
  vi.mocked(authRequest).mockRejectedValue(new ApiError('forbidden', 'Unavailable.', '', 403))
  const store = {
    listProfiles: vi.fn(async () => [profile]), unlockProfile: vi.fn(), switchProfile: vi.fn(), createProfile: vi.fn(),
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), onLock: vi.fn(() => () => {}), isUnlocked: () => true, lockProfile: vi.fn(),
  }
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)
  await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.type(screen.getByLabelText('Local PIN'), '184629')
  await user.click(screen.getByRole('button', { name: 'Refresh authorization and sync' }))

  await waitFor(() => expect(store.invalidateAuthorization).toHaveBeenCalledWith(profile.id))
  expect(store.saveBootstrap).not.toHaveBeenCalled()
  expect(syncClient.syncProfile).not.toHaveBeenCalled()
})
