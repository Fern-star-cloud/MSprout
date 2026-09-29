import { describe, expect, it, vi } from 'vitest'
import { installReconnectSynchronization } from './reconnect'

describe('reconnect synchronization', () => {
  it('synchronizes only the unlocked active profile and coalesces concurrent online events', async () => {
    const target = new EventTarget()
    let finish: (() => void) | undefined
    const syncProfile = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const stop = installReconnectSynchronization(target, { activeProfile: async () => ({ id: 'profile-a' }) }, { syncProfile })

    target.dispatchEvent(new Event('online'))
    target.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(syncProfile).toHaveBeenCalledOnce())
    finish?.()
    await vi.waitFor(() => expect(syncProfile).toHaveBeenCalledWith('profile-a'))

    stop()
    target.dispatchEvent(new Event('online'))
    expect(syncProfile).toHaveBeenCalledOnce()
  })

  it('signals the UI to clear protected data when reconnect synchronization fails', async () => {
    const target = new EventTarget()
    const invalid = vi.fn()
    target.addEventListener('ministrysprout:sync-authorization-invalid', invalid)
    installReconnectSynchronization(
      target,
      { activeProfile: async () => ({ id: 'profile-a' }) },
      { syncProfile: vi.fn(async () => { throw new Error('Authenticate online') }) },
    )

    target.dispatchEvent(new Event('online'))

    await vi.waitFor(() => expect(invalid).toHaveBeenCalledOnce())
  })
})
