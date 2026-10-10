// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { ProfilePinError, type LocalProfileStore } from '../../offline/profile-store'
import type { ProfileRecord } from '../../offline/schema'
import { SyncScreen } from './SyncScreen'
import { readPreparationAccess } from '../device-profiles/preparation-access'
import { authRequest } from '../auth/transport'

vi.mock('../device-profiles/preparation-access', () => ({ readPreparationAccess: vi.fn() }))
vi.mock('../auth/transport', () => ({ authRequest: vi.fn() }))
const profile = { id: 'profile-a', actorId: '11', churchId: 'church-a', deviceId: 'device-a', retryAfter: null } as ProfileRecord
const verified = { actorId: '11', scope: 'same', workspace: { church_id: 'church-a', name: 'Church', role: 'teacher' }, ministries: [] }
let unlocked: boolean
let lockListener: Parameters<LocalProfileStore['onLock']>[0]
function fixture() {
  const store = {
    listProfiles: vi.fn(async () => [profile]), isUnlocked: vi.fn(() => unlocked),
    unlockProfile: vi.fn(async () => { unlocked = true }), lockProfile: vi.fn(() => { unlocked = false; lockListener?.(profile.id, 'manual') }),
    onLock: vi.fn((listener: typeof lockListener) => { lockListener = listener; return () => {} }),
  }
  const recovery = { continue: vi.fn(async () => ({ pushed: 2, acknowledged: 2, conflicts: 0, rejected: 0, pulled: 4, nextCursor: '4' })) }
  const statusReader = vi.fn(async () => ({ pending: 0, quarantined: 0, reviews: 0, downloads: 'incomplete' as 'incomplete' | 'complete' | 'unknown' }))
  return { store, recovery, statusReader, subscribe: () => () => {} }
}
beforeEach(() => {
  unlocked = true
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  vi.mocked(readPreparationAccess).mockResolvedValue(verified as never)
  vi.mocked(authRequest).mockResolvedValue({ needs_owner_review: false } as never)
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('shows independent states and zero uploads with incomplete downloads; viewing has no mutations', async () => {
  const f = fixture(); render(<SyncScreen {...f} />)
  await screen.findByText('0 pending uploads')
  expect(screen.getByRole('heading', { name: 'Downloads incomplete' })).toBeTruthy()
  for (const name of ['Connection', 'Church-account session', 'Profile unlock', 'Uploads', 'Downloads', 'Unresolved review']) expect(screen.getByRole('heading', { name })).toBeTruthy()
  expect(f.recovery.continue).not.toHaveBeenCalled()
  expect(f.store.unlockProfile).not.toHaveBeenCalled()
  expect(f.store.lockProfile).not.toHaveBeenCalled()
  expect(vi.mocked(authRequest).mock.calls.every(call => call[0] === '/api/sync-conflicts')).toBe(true)
})
it('preserves unknown counts and announces checking instead of zero or success', async () => {
  const f = fixture(); f.statusReader.mockResolvedValue({ pending: null, quarantined: null, reviews: null, downloads: 'unknown' } as never)
  render(<SyncScreen {...f} />)
  await screen.findByText('Upload count unavailable')
  expect(screen.queryByText('0 pending uploads')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Synchronization complete' })).toBeNull()
})
it('verifies the matching account then directly unlocks the original profile without synchronizing', async () => {
  unlocked = false; const f = fixture(); const user = userEvent.setup(); render(<SyncScreen {...f} />)
  const button = await screen.findByRole('button', { name: 'Unlock existing profile' })
  await user.type(screen.getByLabelText('Existing local PIN'), '001234')
  await user.click(button)
  await waitFor(() => expect(f.store.unlockProfile).toHaveBeenCalledWith(profile.id, '001234'))
  expect(vi.mocked(readPreparationAccess).mock.invocationCallOrder.at(-1)!).toBeLessThan(f.store.unlockProfile.mock.invocationCallOrder[0])
  expect(f.recovery.continue).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Existing local PIN')).toBeNull()
})
it.each([401, 403, 419])('withholds recovery after account denial %s', async (status) => {
  unlocked = false; vi.mocked(readPreparationAccess).mockRejectedValue(new ApiError('denied', '', '', status))
  const f = fixture(); render(<SyncScreen {...f} />)
  await screen.findByText(/Account access could not be verified/)
  expect(f.store.unlockProfile).not.toHaveBeenCalled(); expect(f.recovery.continue).not.toHaveBeenCalled()
  expect(screen.queryByText('0 pending uploads')).toBeNull()
})
it('rejects a different actor before unlock and keeps generic profile labels', async () => {
  unlocked = false; vi.mocked(readPreparationAccess).mockResolvedValue({ ...verified, actorId: '12' } as never)
  const f = fixture(); render(<SyncScreen {...f} />)
  await screen.findByText(/Account access could not be verified/)
  expect(f.store.unlockProfile).not.toHaveBeenCalled()
  expect(screen.queryByText(profile.actorId)).toBeNull()
})
it('coalesces duplicate clicks, waits for completion and leaves quarantined review visible', async () => {
  const f = fixture(); let finish!: () => void
  f.recovery.continue.mockImplementation(() => new Promise(resolve => { finish = () => { f.statusReader.mockResolvedValue({ pending: 0, quarantined: 2, reviews: 0, downloads: 'complete' }); resolve({ pushed: 2, acknowledged: 0, conflicts: 2, rejected: 0, pulled: 4, nextCursor: '4' }) } }))
  render(<SyncScreen {...f} />)
  const button = await screen.findByRole('button', { name: 'Continue synchronization' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(f.recovery.continue).toHaveBeenCalledOnce())
  expect(screen.queryByRole('heading', { name: 'Synchronization complete' })).toBeNull()
  await act(async () => finish())
  await screen.findByText('2 quarantined items retained on this device')
  expect(screen.getByRole('heading', { name: 'Transfers complete — review remains' })).toBeTruthy()
})
it('reports uncertain accepted outcomes and preserves retry after a lost response', async () => {
  const f = fixture(); f.recovery.continue.mockRejectedValue(new TypeError('response lost'))
  render(<SyncScreen {...f} />)
  const button = await screen.findByRole('button', { name: 'Continue synchronization' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  await screen.findByText(/Uploaded changes may already be accepted/)
  expect(screen.queryByText('2 server accepted')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Synchronization complete' })).toBeNull()
})
it('clears protected counts and late success when the profile locks during synchronization', async () => {
  const f = fixture(); let finish!: () => void
  f.recovery.continue.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ pushed: 2, acknowledged: 2, conflicts: 0, rejected: 0, pulled: 0, nextCursor: '4' }) }))
  render(<SyncScreen {...f} />)
  const button = await screen.findByRole('button', { name: 'Continue synchronization' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  await waitFor(() => expect(f.recovery.continue).toHaveBeenCalledOnce())
  act(() => f.store.lockProfile()); await act(async () => finish())
  await screen.findByText('Locked — encrypted work retained')
  expect(screen.queryByText('0 pending uploads')).toBeNull()
  expect(screen.queryByText('2 server accepted')).toBeNull()
})

it('keeps the verified account separate from a failed PIN and announces the enforced delay', async () => {
  unlocked = false; const f = fixture(); f.store.unlockProfile.mockRejectedValue(new ProfilePinError('incorrect', new Date(Date.now() + 60_000).toISOString()))
  render(<SyncScreen {...f} />)
  const button = await screen.findByRole('button', { name: 'Unlock existing profile' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Existing local PIN'), { target: { value: '001234' } }); fireEvent.click(button)
  await screen.findByText(/The existing local PIN is incorrect/)
  expect(screen.getByText('Matching account verified')).toBeTruthy()
  expect(screen.getByText(/Reloading does not remove the delay/)).toBeTruthy()
  expect((button as HTMLButtonElement).disabled).toBe(true)
})

it('repeated online events cannot strand verification or cancel a user action', async () => {
  const f = fixture(); let finish!: () => void
  f.recovery.continue.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ pushed: 0, acknowledged: 0, conflicts: 0, rejected: 0, pulled: 2, nextCursor: '4' }) }))
  render(<SyncScreen {...f} />)
  const button = await screen.findByRole('button', { name: 'Continue synchronization' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  await waitFor(() => expect(f.recovery.continue).toHaveBeenCalledOnce())
  act(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online')) })
  await act(async () => finish())
  await screen.findByText(/Transfer attempt finished/)
  expect(screen.getByText('Matching account verified')).toBeTruthy()
  expect(f.recovery.continue).toHaveBeenCalledOnce()
})

it('withholds success when the account invalidates during a pending transfer', async () => {
  const f = fixture(); let finish!: () => void
  f.recovery.continue.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ pushed: 2, acknowledged: 2, conflicts: 0, rejected: 0, pulled: 0, nextCursor: '4' }) }))
  render(<SyncScreen {...f} />)
  const button = await screen.findByRole('button', { name: 'Continue synchronization' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  await waitFor(() => expect(f.recovery.continue).toHaveBeenCalledOnce())
  act(() => window.dispatchEvent(new CustomEvent('church-workspace-invalidated', { detail: { status: 419 } })))
  await act(async () => finish())
  expect(screen.getByText('Account verification required')).toBeTruthy()
  expect(screen.queryByText('2 server accepted')).toBeNull()
  expect(f.store.lockProfile).toHaveBeenCalled()
})

it('leaves server review unknown when its read fails, even after completed downloads', async () => {
  const f = fixture(); f.statusReader.mockResolvedValue({ pending: 0, quarantined: 0, reviews: 0, downloads: 'complete' })
  vi.mocked(authRequest).mockRejectedValue(new TypeError('unavailable'))
  render(<SyncScreen {...f} />)
  await screen.findByRole('heading', { name: 'Transfers complete — server review unknown' })
  expect(screen.queryByRole('heading', { name: 'Synchronization complete' })).toBeNull()
})

it('cannot turn an interrupted new attempt green by reading evidence from an older completed sync', async () => {
  const f = fixture(); f.statusReader.mockResolvedValue({ pending: 0, quarantined: 0, reviews: 0, downloads: 'complete' })
  render(<SyncScreen {...f} />)
  await screen.findByRole('heading', { name: 'Synchronization complete' })
  f.recovery.continue.mockRejectedValue(new TypeError('service unavailable before pull'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue synchronization' }))
  await screen.findByText(/Synchronization incomplete\. Uploaded changes may already be accepted/)
  fireEvent.click(screen.getByRole('button', { name: 'Check device status' }))
  await screen.findByText(/Device status checked/)
  expect(screen.queryByRole('heading', { name: 'Synchronization complete' })).toBeNull()
})

it('reflects reconnect authorization denial without starting another synchronization', async () => {
  const f = fixture(); render(<SyncScreen {...f} />)
  await screen.findByText('0 pending uploads')
  f.store.listProfiles.mockResolvedValue([{ ...profile, requiresReauthentication: true }])
  act(() => window.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid')))
  await screen.findByText('Account verification required')
  expect(screen.queryByText('0 pending uploads')).toBeNull()
  expect(f.recovery.continue).not.toHaveBeenCalled()
})

it('never announces sending uploads during a read-only status check with pending work', async () => {
  const f = fixture(); f.statusReader.mockResolvedValue({ pending: 2, quarantined: 0, reviews: 0, downloads: 'incomplete' })
  render(<SyncScreen {...f} />)
  await screen.findByText('2 pending uploads')
  let finish!: () => void
  f.statusReader.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ pending: 2, quarantined: 0, reviews: 0, downloads: 'incomplete' }) }))
  fireEvent.click(screen.getByRole('button', { name: 'Check device status' }))
  expect(screen.queryByText(/Sending saved changes/)).toBeNull()
  expect(f.recovery.continue).not.toHaveBeenCalled()
  await act(async () => finish())
})
