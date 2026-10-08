// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { authRequest } from '../auth/transport'
import { DeviceProfilesScreen } from './DeviceProfilesScreen'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn() }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

it('offers an accessible PIN unlock and online profile creation flow', async () => {
  const store = {
    listProfiles: vi.fn(async () => [{
      id: 'profile-a', actorId: '11', deviceId: 'device-a', churchId: 'church-a', createdAt: '2026-09-28T00:00:00Z',
      requiresReauthentication: false, failedAttempts: 0, retryAfter: null, leaseExpiresAt: null, leaseSignature: null,
      salt: 'salt', iterations: 600_000,
      wrappedDataKey: { algorithm: 'AES-256-GCM' as const, iv: 'iv', ciphertext: 'ciphertext', schemaVersion: 1 },
    }]),
    unlockProfile: vi.fn(), switchProfile: vi.fn(), createProfile: vi.fn(), saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(),
  }
  render(<DeviceProfilesScreen store={store} />)

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
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(),
  }
  const unlocked = vi.fn()
  render(<DeviceProfilesScreen store={store} onUnlocked={unlocked} />)
  await screen.findByRole('button', { name: 'Refresh authorization after sign-in' })
  await user.type(screen.getByLabelText('Local PIN'), '184629')
  await user.click(screen.getByRole('button', { name: 'Refresh authorization after sign-in' }))

  await waitFor(() => expect(store.unlockProfile).toHaveBeenCalledWith(profile.id, '184629'))
  expect(authRequest).toHaveBeenCalledWith(`/api/offline/bootstrap?device_id=${profile.deviceId}`, 'GET', undefined, profile.churchId)
  expect(store.saveBootstrap).toHaveBeenCalledWith(profile.id, bootstrap)
  expect(unlocked).toHaveBeenCalledOnce()
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
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(),
  }
  render(<DeviceProfilesScreen store={store} />)
  await screen.findByRole('button', { name: 'Refresh authorization after sign-in' })
  await user.type(screen.getByLabelText('Local PIN'), '184629')
  await user.click(screen.getByRole('button', { name: 'Refresh authorization after sign-in' }))

  await waitFor(() => expect(store.invalidateAuthorization).toHaveBeenCalledWith(profile.id))
  expect(store.saveBootstrap).not.toHaveBeenCalled()
})
