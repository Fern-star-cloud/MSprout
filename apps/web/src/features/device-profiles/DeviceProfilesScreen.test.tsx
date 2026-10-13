// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { authRequest } from '../auth/transport'
import { DeviceProfilesScreen } from './DeviceProfilesScreen'
import { syncClient, type SyncSummary } from '../../sync/sync-client'
import { ProfilePinError, type LocalProfileStore } from '../../offline/profile-store'

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
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), isLeaseValid: vi.fn(async () => true), assessRemoval: vi.fn(async () => ({ status: 'unknown' as const })), onLock: vi.fn((listener: Parameters<LocalProfileStore['onLock']>[0]) => { void listener; return () => {} }), isUnlocked: () => true, lockProfile: vi.fn(),
  }
}

it('announces browser connectivity once in picker and PIN views without implying server or sign-in availability', async () => {
  const connection = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  render(<DeviceProfilesScreen store={recoveryStore()} pendingCount={async () => 0} />)
  await screen.findByRole('button', { name: 'Use profile 1' })
  const statuses = () => screen.getAllByRole('status').filter(status => status.textContent?.startsWith('Browser connectivity:'))
  expect(statuses()).toHaveLength(1)
  expect(statuses()[0].textContent).toBe('Browser connectivity: Online. This does not confirm server availability or signed-in access.')
  expect(statuses()[0].getAttribute('aria-live')).toBe('polite')
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  expect(statuses()).toHaveLength(1)
  connection.mockReturnValue(false)
  fireEvent(window, new Event('offline'))
  expect(statuses()[0].textContent).toContain('Browser connectivity: Offline.')
  connection.mockReturnValue(true)
  fireEvent(window, new Event('online'))
  expect(statuses()[0].textContent).toContain('Browser connectivity: Online.')
})

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
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  const button = await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.click(button)
  await screen.findByText(/Synchronization incomplete.*Uploaded changes may already be accepted/)
  expect(screen.queryByText(/Synchronization complete\./)).toBeNull()
  expect(screen.getByText(/0 pending uploads.*Downloads incomplete/)).toBeTruthy()
  await user.click(button)
  await screen.findByText(/Synchronization complete.*download pages/)
  expect(synchronizer.syncProfile).toHaveBeenCalledTimes(2)
})

it('uses the current persisted reauthentication state when synchronization invalidates authorization', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  const original = (await store.listProfiles())[0]
  vi.mocked(authRequest).mockResolvedValue({} as never)
  const synchronizer = { syncProfile: vi.fn(async () => {
    store.listProfiles.mockResolvedValue([{ ...original, requiresReauthentication: true }])
    store.isLeaseValid.mockResolvedValue(false)
    throw new Error('Authenticate online as this profile before synchronizing.')
  }) }
  render(<DeviceProfilesScreen store={store} synchronizer={synchronizer} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await user.click(await screen.findByRole('button', { name: 'Refresh authorization and sync' }))
  await screen.findByText(/Online sign-in required.*Synchronization is incomplete/)
  expect(screen.queryByText(/0 pending uploads/)).toBeNull()
})

it('locks the profile if an authorization denial cannot purge its cache', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  vi.mocked(authRequest).mockRejectedValueOnce(new ApiError('forbidden', 'Unavailable.', '', 403))
  store.invalidateAuthorization.mockRejectedValueOnce(new Error('storage unavailable'))
  const synchronizer = { syncProfile: vi.fn() }
  render(<DeviceProfilesScreen store={store} synchronizer={synchronizer} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  const button = await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.click(button)
  await waitFor(() => expect(store.lockProfile).toHaveBeenCalledWith('profile-a'))
  expect(synchronizer.syncProfile).not.toHaveBeenCalled()
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

it('opens a generic PIN screen from the picker without unlocking or signing out', async () => {
  const store = recoveryStore(); store.isUnlocked = () => false
  render(<DeviceProfilesScreen store={store} />)
  await screen.findByRole('heading', { name: 'Choose a device profile' })
  expect(screen.queryByLabelText('Local PIN')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Use profile 1' }))
  expect(screen.getByRole('heading', { name: 'Unlock Profile 1' })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByLabelText('Local PIN'))
  expect(store.switchProfile).not.toHaveBeenCalled()
  expect(authRequest).not.toHaveBeenCalled()
})

it.each(['12345', '1234567890123', 'abc123', '１２３４５６'])('rejects invalid local PIN %s before normal switching', async pin => {
  const store = recoveryStore(); store.isUnlocked = () => false
  render(<DeviceProfilesScreen store={store} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  fireEvent.change(screen.getByLabelText('Local PIN'), { target: { value: pin } })
  fireEvent.submit(screen.getByLabelText('Local PIN').closest('form')!)
  expect((await screen.findByRole('alert')).textContent).toMatch(/6–12 digits/)
  expect(store.switchProfile).not.toHaveBeenCalled()
})

it.each(['000123', '000123456789'])('passes valid PIN %s as an exact string through normal switching', async pin => {
  const store = recoveryStore(); store.isUnlocked = () => false
  render(<DeviceProfilesScreen store={store} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  fireEvent.change(screen.getByLabelText('Local PIN'), { target: { value: pin } })
  fireEvent.submit(screen.getByLabelText('Local PIN').closest('form')!)
  await waitFor(() => expect(store.switchProfile).toHaveBeenCalledWith('profile-a', pin, expect.objectContaining({ online: true, signOut: expect.any(Function) })))
})

it('keeps locked profile labels generic and never reads or renders protected synchronization metadata', async () => {
  const store = recoveryStore()
  store.isUnlocked = () => false
  const pendingCount = vi.fn(async () => 987)
  render(<DeviceProfilesScreen store={store} pendingCount={pendingCount} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await screen.findByLabelText('Local PIN')
  expect(pendingCount).not.toHaveBeenCalled()
  expect(screen.queryByText(/Pending uploads:|\d+ pending uploads|Downloads incomplete|online sign-in required before sync/i)).toBeNull()
  expect(document.body.textContent).not.toMatch(/church-a|device-a|profile-a|ciphertext/)
  expect(screen.getByRole('button', { name: 'Remove selected profile' }).hasAttribute('disabled')).toBe(true)
})

it('announces a PIN error, connects it to the field and enforces the retry delay in both actions', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  store.isUnlocked = () => false
  store.switchProfile.mockRejectedValueOnce(new ProfilePinError('incorrect', new Date(Date.now() + 60_000).toISOString()))
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await screen.findByLabelText('Local PIN')
  await user.type(screen.getByLabelText('Local PIN'), '000000')
  await user.click(screen.getByRole('button', { name: 'Use profile 1' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/PIN.*incorrect/)
  const pin = screen.getByLabelText('Local PIN')
  expect(pin.getAttribute('aria-invalid')).toBe('true')
  expect(pin.getAttribute('aria-describedby')).toContain('profile-pin-error')
  expect((pin as HTMLInputElement).value).toBe('')
  expect(screen.getByText(/Try again in \d+ seconds/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Use profile 1' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Refresh authorization and sync' }).hasAttribute('disabled')).toBe(true)
})

it('does not expose protected status with an unlocked key but expired or unverifiable authorization', async () => {
  const store = { ...recoveryStore(), isLeaseValid: vi.fn(async () => false) }
  const pendingCount = vi.fn(async () => 987)
  render(<DeviceProfilesScreen store={store} pendingCount={pendingCount} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await screen.findByLabelText('Local PIN')
  await waitFor(() => expect(store.isLeaseValid).toHaveBeenCalled())
  expect(pendingCount).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toMatch(/987|Downloads incomplete|Pending uploads:/i)
})

it('does not apply a bootstrap that returns after the profile locks', async () => {
  const user = userEvent.setup()
  const store = recoveryStore()
  let unlocked = true
  store.isUnlocked = () => unlocked
  let release!: (value: unknown) => void
  vi.mocked(authRequest).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await user.click(await screen.findByRole('button', { name: 'Refresh authorization and sync' }))
  await waitFor(() => expect(authRequest).toHaveBeenCalled())
  await act(async () => {
    unlocked = false
    store.onLock.mock.calls[0][0]('profile-a', 'background')
    release({ actor: { id: '11' } })
  })
  expect(store.saveBootstrap).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toMatch(/0 pending uploads|Downloads incomplete|Synchronization complete/)
})

it('clears protected status on lock and ignores an earlier pending-count completion', async () => {
  const store = recoveryStore()
  let locked = false
  store.isUnlocked = () => !locked
  let release!: (count: number) => void
  render(<DeviceProfilesScreen store={store} pendingCount={() => new Promise(resolve => { release = resolve })} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await screen.findByLabelText('Local PIN')
  await screen.findByText(/Downloads incomplete/)
  await act(async () => {
    locked = true
    const callback = store.onLock.mock.calls[0][0] as (id: string, reason: string) => void
    callback('profile-a', 'background')
    release(987)
  })
  expect(document.body.textContent).not.toMatch(/987|Downloads incomplete|Pending uploads:/i)
  expect(screen.queryByRole('button', { name: 'Lock profile' })).toBeNull()
})

it('requires selected-profile confirmation after a safety check and never invokes removal on cancel', async () => {
  const user = userEvent.setup()
  const store = { ...recoveryStore(), assessRemoval: vi.fn(async () => ({ status: 'ready' as const })) }
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } },
  })
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await user.click(await screen.findByRole('button', { name: 'Remove selected profile' }))
  await screen.findByRole('dialog', { name: 'Remove Profile 1?' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep profile' }))
  expect(store.purgeProfile).not.toHaveBeenCalled()
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(store.purgeProfile).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Remove selected profile' }))
  await screen.findByRole('dialog')
  const remove = screen.getByRole('button', { name: 'Permanently remove Profile 1' })
  expect(remove.hasAttribute('disabled')).toBe(true)
  await user.type(screen.getByLabelText('Type Profile 1 to confirm'), 'Profile 1')
  await user.click(remove)
  await waitFor(() => expect(store.purgeProfile).toHaveBeenCalledWith('profile-a', { confirmedProfileId: 'profile-a' }))
})

it('offers an accessible PIN unlock and online profile creation flow', async () => {
  const store = {
    listProfiles: vi.fn(async () => [{
      id: 'profile-a', actorId: '11', deviceId: 'device-a', churchId: 'church-a', createdAt: '2026-09-28T00:00:00Z',
      requiresReauthentication: false, failedAttempts: 0, retryAfter: null, leaseExpiresAt: null, leaseSignature: null,
      salt: 'salt', iterations: 600_000,
      wrappedDataKey: { algorithm: 'AES-256-GCM' as const, iv: 'iv', ciphertext: 'ciphertext', schemaVersion: 1 },
    }]),
    unlockProfile: vi.fn(), switchProfile: vi.fn(), createProfile: vi.fn(), saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), isLeaseValid: vi.fn(async () => true), assessRemoval: vi.fn(async () => ({ status: 'unknown' as const })), onLock: vi.fn((listener: Parameters<LocalProfileStore['onLock']>[0]) => { void listener; return () => {} }), isUnlocked: () => true, lockProfile: vi.fn(),
  }
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))

  expect(await screen.findByRole('heading', { name: 'Manage Profile 1' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Use profile 1' })).toBeTruthy()
  expect(screen.getByLabelText('Local PIN').getAttribute('inputmode')).toBe('numeric')
  expect(screen.getByLabelText('Local PIN').getAttribute('type')).toBe('password')
  expect(screen.getByText(/Your local PIN is not your church account password/)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: '‹ Profiles' })); expect(screen.getByRole('link', { name: 'Prepare this device' }).getAttribute('href')).toBe('/account/prepare')
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
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), isLeaseValid: vi.fn(async () => true), assessRemoval: vi.fn(async () => ({ status: 'unknown' as const })), onLock: vi.fn((listener: Parameters<LocalProfileStore['onLock']>[0]) => { void listener; return () => {} }), isUnlocked: () => true, lockProfile: vi.fn(),
  }
  const unlocked = vi.fn()
  render(<DeviceProfilesScreen store={store} onUnlocked={unlocked} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
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
    saveBootstrap: vi.fn(), invalidateAuthorization: vi.fn(), purgeProfile: vi.fn(), isLeaseValid: vi.fn(async () => true), assessRemoval: vi.fn(async () => ({ status: 'unknown' as const })), onLock: vi.fn((listener: Parameters<LocalProfileStore['onLock']>[0]) => { void listener; return () => {} }), isUnlocked: () => true, lockProfile: vi.fn(),
  }
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await screen.findByRole('button', { name: 'Refresh authorization and sync' })
  await user.type(screen.getByLabelText('Local PIN'), '184629')
  await user.click(screen.getByRole('button', { name: 'Refresh authorization and sync' }))

  await waitFor(() => expect(store.invalidateAuthorization).toHaveBeenCalledWith(profile.id))
  expect(store.saveBootstrap).not.toHaveBeenCalled()
  expect(syncClient.syncProfile).not.toHaveBeenCalled()
})

it('keeps a correct local PIN from entering Attendance when the encrypted lease is unavailable', async () => {
  const store = recoveryStore(), attendance = vi.fn()
  store.isLeaseValid.mockResolvedValue(false)
  render(<DeviceProfilesScreen store={store} onUnlocked={attendance} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  fireEvent.change(screen.getByLabelText('Local PIN'), { target: { value: '000123' } })
  fireEvent.submit(screen.getByLabelText('Local PIN').closest('form')!)
  await screen.findByText(/The PIN cannot renew expired offline access/)
  expect(attendance).not.toHaveBeenCalled()
  expect(store.saveBootstrap).not.toHaveBeenCalled()
})

it.each(['blocked', 'unknown'] as const)('offers cancellable fail-closed removal for %s work without a purge', async status => {
  const store = { ...recoveryStore(), assessRemoval: vi.fn(async () => ({ status })) }
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } },
  })
  render(<DeviceProfilesScreen store={store} pendingCount={async () => 0} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await userEvent.click(screen.getByRole('button', { name: 'Remove selected profile' }))
  await screen.findByRole('dialog', { name: 'This profile cannot be removed' })
  expect(screen.getByRole('link', { name: 'Open Sync' }).getAttribute('href')).toBe('/account/sync')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(store.purgeProfile).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove selected profile' }))
})

it('keeps a verified lease distinct from an unavailable upload count', async () => {
  const store = recoveryStore()
  render(<DeviceProfilesScreen store={store} pendingCount={async () => { throw new Error('Synthetic count read failed') }} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Use profile 1' }))
  await waitFor(() => expect(store.isLeaseValid).toHaveBeenCalled())
  await screen.findByText(/Pending uploads: unavailable or checking/)
  expect(screen.queryByRole('heading', { name: 'Online sign-in required' })).toBeNull()
  expect(screen.queryByText(/0 pending uploads/)).toBeNull()
})
