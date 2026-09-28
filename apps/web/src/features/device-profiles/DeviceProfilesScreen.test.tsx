// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DeviceProfilesScreen } from './DeviceProfilesScreen'

afterEach(() => cleanup())

it('offers an accessible PIN unlock and online profile creation flow', async () => {
  const store = {
    listProfiles: vi.fn(async () => [{
      id: 'profile-a', actorId: '11', deviceId: 'device-a', churchId: 'church-a', createdAt: '2026-09-28T00:00:00Z',
      requiresReauthentication: false, failedAttempts: 0, retryAfter: null, leaseExpiresAt: null, leaseSignature: null,
      salt: 'salt', iterations: 600_000,
      wrappedDataKey: { algorithm: 'AES-256-GCM' as const, iv: 'iv', ciphertext: 'ciphertext', schemaVersion: 1 },
    }]),
    unlockProfile: vi.fn(), switchProfile: vi.fn(), createProfile: vi.fn(), saveBootstrap: vi.fn(), purgeProfile: vi.fn(),
  }
  render(<DeviceProfilesScreen store={store} />)

  expect(await screen.findByRole('heading', { name: 'Choose a device profile' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Use profile 1' })).toBeTruthy()
  expect(screen.getByLabelText('Local PIN').getAttribute('inputmode')).toBe('numeric')
  expect(screen.getByRole('button', { name: 'Add profile' })).toBeTruthy()
  expect(screen.getByText(/not your church password/i)).toBeTruthy()
})
