// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import type { AttendanceDraft, AttendanceState, CreateAttendanceDraftInput } from './domain'
import { AttendanceScreen } from './AttendanceScreen'

afterEach(() => cleanup())
beforeAll(() => Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } },
  close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } },
}))

async function openSession(existing = true) {
  await userEvent.setup().click(await screen.findByRole('button', { name: existing ? 'Resume attendance' : 'Start attendance' }))
}
async function openGuest() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Add temporary guest' }))
}

it('distinguishes acknowledged uploads from an incomplete pull, including after reopening attendance', async () => {
  let syncNeedsPull = true
  const draft: AttendanceDraft = {
    id: 'session-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Music',
    attendanceDate: '2026-09-28', status: 'draft', version: 3, updatedAt: '2026-09-28T00:00:00Z', entries: [], guests: [],
  }
  const repository = {
    findDraft: vi.fn(async () => draft), createDraft: vi.fn(async () => draft), countPending: vi.fn(async () => 0),
    markStudent: vi.fn(async () => draft), bulkMark: vi.fn(async () => draft), finalizeDraft: vi.fn(async () => draft), addGuest: vi.fn(async () => draft),
  }
  const store = {
    onLock: vi.fn(() => () => undefined),
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a', syncNeedsPull })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Music', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => []),
  }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-09-28" />)
  expect(await screen.findByText(/Sync incomplete/)).toBeTruthy()
  expect(screen.queryByText(/No pending changes/)).toBeNull()
  expect(await screen.findByText(/Uploaded changes may already be accepted/)).toBeTruthy()
  syncNeedsPull = false
  act(() => window.dispatchEvent(new Event('ministrysprout:sync-complete')))
  expect(await screen.findByText(/No pending changes/)).toBeTruthy()
  expect(screen.queryByText(/Sync incomplete/)).toBeNull()
  syncNeedsPull = true
  repository.countPending.mockResolvedValue(3)
  store.readEncryptedMinistries.mockRejectedValueOnce(new Error('Authorization unavailable'))
  act(() => window.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid')))
  expect(await screen.findByText(/3 pending.*Sync incomplete/)).toBeTruthy()
})

it('supports search, individual and bulk marking, counts, and safe finalization', async () => {
  let draft: AttendanceDraft = {
    id: 'session-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Primary',
    attendanceDate: '2026-09-28', status: 'draft', version: 1, updatedAt: '2026-09-28T00:00:00Z',
    entries: [
      { studentId: 'student-a', displayName: 'Ana Sprout', gender: 'female', state: 'unmarked' },
      { studentId: 'student-b', displayName: 'Ben Sprout', gender: 'male', state: 'unmarked' },
    ],
    guests: [],
  }
  const repository = {
    findDraft: vi.fn(async () => null),
    createDraft: vi.fn(async () => draft),
    countPending: vi.fn(async () => 1),
    markStudent: vi.fn(async (_profile: string, _draft: string, studentId: string, state: AttendanceState) => {
      draft = { ...draft, entries: draft.entries.map(entry => entry.studentId === studentId ? { ...entry, state } : entry) }
      return draft
    }),
    bulkMark: vi.fn(async (_profile: string, _draft: string, state: AttendanceState, only: AttendanceState | undefined) => {
      draft = { ...draft, entries: draft.entries.map(entry => !only || entry.state === only ? { ...entry, state } : entry) }
      return draft
    }),
    finalizeDraft: vi.fn(async () => { draft = { ...draft, status: 'finalized_pending' }; return draft }),
    addGuest: vi.fn(async (_profile: string, _draft: string, displayName: string, gender: AttendanceDraft['entries'][number]['gender']) => {
      draft = { ...draft, guests: [...draft.guests, { id: 'guest-a', displayName, gender, state: 'present', status: 'pending' }] }
      return draft
    }),
  }
  const store = {
    onLock: vi.fn(() => () => undefined),
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Primary', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => [
      { id: 'student-a', display_name: 'Ana Sprout', gender: 'female' as const, ministry_ids: ['ministry-a'] },
      { id: 'student-b', display_name: 'Ben Sprout', gender: 'male' as const, ministry_ids: ['ministry-a'] },
    ]),
  }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  const user = userEvent.setup()
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-09-28" />)

  expect(await screen.findByRole('heading', { name: 'Take attendance' })).toBeTruthy()
  await openSession(false)
  expect(await screen.findByText('0 marked · 2 unmarked')).toBeTruthy()
  expect(screen.getByText(/Offline.*saving on this device/i)).toBeTruthy()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  window.dispatchEvent(new Event('online'))
  expect(await screen.findByText(/Online.*1 pending/i)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Finalize attendance' }) as HTMLButtonElement).disabled).toBe(true)

  await openGuest()
  await user.type(screen.getByLabelText('Display name'), 'Guest Child')
  await user.selectOptions(screen.getByLabelText('Gender (optional)'), 'female')
  await user.click(screen.getByRole('button', { name: 'Add guest as present' }))
  expect(await screen.findByText('Guest Child')).toBeTruthy()
  expect(screen.getByText('Temporary guest · Present')).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Mark Ana Sprout present' }))
  expect(await screen.findByText('1 marked · 1 unmarked')).toBeTruthy()
  expect(screen.getByText(/Saved on this device$/)).toBeTruthy()

  await user.type(screen.getByRole('searchbox', { name: 'Search roster' }), 'Ben')
  expect(screen.queryByText('Ana Sprout')).toBeNull()
  expect(screen.getByText('Ben Sprout')).toBeTruthy()
  await user.clear(screen.getByRole('searchbox', { name: 'Search roster' }))
  await user.click(screen.getByRole('button', { name: 'Mark all unmarked absent' }))

  await waitFor(() => expect(screen.getByText('2 marked · 0 unmarked')).toBeTruthy())
  expect((screen.getByRole('button', { name: 'Finalize attendance' }) as HTMLButtonElement).disabled).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Finalize attendance' }))
  await user.click(screen.getByRole('button', { name: 'Finalize on this device' }))
  expect(await screen.findByText(/Saved on this device — Pending Sync$/)).toBeTruthy()
})

it('keeps the responsive controls usable with text labels and student avatars', async () => {
  const repository = {
    findDraft: vi.fn(async () => null), createDraft: vi.fn(async (input: CreateAttendanceDraftInput) => ({
      id: 'session-a', profileId: input.profileId, churchId: input.churchId, ministryId: input.ministryId,
      ministryName: input.ministryName, attendanceDate: input.attendanceDate, status: 'draft' as const, version: 1,
      updatedAt: '2026-09-28T00:00:00Z', entries: input.students.map(student => ({ studentId: student.id, displayName: student.displayName, gender: student.gender, state: 'unmarked' as const })),
      guests: [],
    })), countPending: vi.fn(async () => 0), markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
    addGuest: vi.fn(),
  }
  const store = {
    onLock: vi.fn(() => () => undefined),
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Primary', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => [{ id: 'student-a', display_name: 'Ana Sprout', gender: 'female' as const, ministry_ids: ['ministry-a'] }]),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-09-28" />)

  await openSession(false)
  expect(await screen.findByRole('img', { name: 'Ana Sprout avatar' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Mark Ana Sprout present' }).textContent).toContain('Present')
  expect(screen.getByRole('button', { name: 'Mark Ana Sprout absent' }).textContent).toContain('Absent')
  expect(screen.getByLabelText('Ministry')).toBeTruthy()
  expect(screen.getByLabelText('Attendance date')).toBeTruthy()
})

it('removes stale child data from memory after synchronization revokes the assignment', async () => {
  let assigned = true
  const draft: AttendanceDraft = {
    id: 'session-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Primary',
    attendanceDate: '2026-09-28', status: 'draft', version: 1, updatedAt: '2026-09-28T00:00:00Z',
    entries: [{ studentId: 'student-a', displayName: 'Ana Sprout', gender: 'female', state: 'unmarked' }],
    guests: [],
  }
  const repository = {
    findDraft: vi.fn(async () => assigned ? draft : null),
    createDraft: vi.fn(async () => draft),
    countPending: vi.fn(async () => assigned ? 1 : 0),
    markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
    addGuest: vi.fn(),
  }
  const store = {
    onLock: vi.fn(() => () => undefined),
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => assigned ? [{ id: 'ministry-a', name: 'Primary', version: 1 }] : []),
    readEncryptedRoster: vi.fn(async () => assigned
      ? [{ id: 'student-a', display_name: 'Ana Sprout', gender: 'female' as const, ministry_ids: ['ministry-a'] }]
      : []),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-09-28" />)
  await openSession()
  expect(await screen.findByText('Ana Sprout')).toBeTruthy()

  assigned = false
  window.dispatchEvent(new Event('ministrysprout:sync-complete'))

  await waitFor(() => expect(screen.queryByText('Ana Sprout')).toBeNull())
  expect((screen.getByLabelText('Ministry') as HTMLSelectElement).options).toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Finalize attendance' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Start attendance' })).toBeNull()
})

it('clears protected roster state when reconnect requires online reauthentication', async () => {
  let invalid = false
  const draft: AttendanceDraft = {
    id: 'session-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Primary',
    attendanceDate: '2026-09-28', status: 'draft', version: 1, updatedAt: '2026-09-28T00:00:00Z',
    entries: [{ studentId: 'student-a', displayName: 'Ana Sprout', gender: 'female', state: 'unmarked' }],
    guests: [],
  }
  const repository = {
    findDraft: vi.fn(async () => draft), createDraft: vi.fn(async () => draft), countPending: vi.fn(async () => 1),
    markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
    addGuest: vi.fn(),
  }
  const store = {
    onLock: vi.fn(() => () => undefined),
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => {
      if (invalid) throw new Error('expired')
      return [{ id: 'ministry-a', name: 'Primary', version: 1 }]
    }),
    readEncryptedRoster: vi.fn(async () => {
      if (invalid) throw new Error('expired')
      return [{ id: 'student-a', display_name: 'Ana Sprout', gender: 'female' as const, ministry_ids: ['ministry-a'] }]
    }),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-09-28" />)
  await openSession()
  expect(await screen.findByText('Ana Sprout')).toBeTruthy()

  invalid = true
  window.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid'))

  await waitFor(() => expect(screen.queryByText('Ana Sprout')).toBeNull())
  expect(screen.getByRole('alert').textContent).toContain('authenticate this profile')
  expect((screen.getByLabelText('Ministry') as HTMLSelectElement).options).toHaveLength(0)
})

it('preserves unsaved guest input and never shows a save receipt when storage fails', async () => {
  const draft: AttendanceDraft = {
    id: 'draft-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Music',
    attendanceDate: '2026-10-08', status: 'draft', version: 1, updatedAt: '2026-10-08T10:20:00Z', entries: [], guests: [],
  }
  const repository = {
    findDraft: vi.fn(async () => draft), createDraft: vi.fn(async () => draft), countPending: vi.fn(async () => 1),
    markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
    addGuest: vi.fn(async () => { throw new DOMException('Full', 'QuotaExceededError') }),
  }
  const store = {
    onLock: vi.fn(() => () => undefined),
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Music', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => []),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-10-08" />)
  await screen.findByText(/1 pending/)
  const user = userEvent.setup()
  await openSession()
  await openGuest()
  await user.type(screen.getByLabelText('Display name'), 'MTQA Offline Guest')
  await user.selectOptions(screen.getByLabelText('Gender (optional)'), 'female')
  await user.click(screen.getByRole('button', { name: 'Add guest as present' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('MTQA Offline Guest')
  expect((screen.getByLabelText('Gender (optional)') as HTMLSelectElement).value).toBe('female')
  expect(screen.queryByText(/Saved on this device$/)).toBeNull()
})

it('clears plaintext on lock and does not restore it when an in-flight guest save finishes', async () => {
  const draft: AttendanceDraft = {
    id: 'draft-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Music',
    attendanceDate: '2026-10-08', status: 'draft', version: 1, updatedAt: '2026-10-08T10:20:00Z', entries: [], guests: [],
  }
  let locked = () => undefined as void
  let finish: (draft: AttendanceDraft) => void = () => undefined
  const repository = {
    findDraft: vi.fn(async () => draft), createDraft: vi.fn(async () => draft), countPending: vi.fn(async () => 1),
    markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
    addGuest: vi.fn(() => new Promise<AttendanceDraft>(resolve => { finish = resolve })),
  }
  const store = {
    onLock: (listener: (profileId: string, reason: 'manual') => void) => { locked = () => listener('profile-a', 'manual'); return () => undefined },
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Music', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => []),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-10-08" />)
  await screen.findByText(/1 pending/)
  const user = userEvent.setup()
  await openSession()
  await openGuest()
  await user.type(screen.getByLabelText('Display name'), 'MTQA Offline Guest')
  await user.click(screen.getByRole('button', { name: 'Add guest as present' }))
  act(() => locked())
  expect(await screen.findByRole('link', { name: 'Unlock an existing device profile' })).toBeTruthy()
  await act(async () => finish({ ...draft, guests: [{ id: 'guest-a', displayName: 'MTQA Offline Guest', gender: 'unspecified', state: 'present', status: 'pending' }] }))
  expect(screen.queryByText('MTQA Offline Guest')).toBeNull()
  expect(screen.queryByLabelText('Display name')).toBeNull()
  expect(screen.queryByText(/Saved on this device$/)).toBeNull()
})

it('does not label a durable guest save as unsaved when only refreshing the pending count fails', async () => {
  const draft: AttendanceDraft = {
    id: 'draft-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Music',
    attendanceDate: '2026-10-08', status: 'draft', version: 1, updatedAt: '2026-10-08T10:20:00Z', entries: [], guests: [],
  }
  const savedDraft: AttendanceDraft = { ...draft, guests: [{ id: 'guest-a', displayName: 'MTQA Offline Guest', gender: 'unspecified', state: 'present', status: 'pending' }] }
  const repository = {
    findDraft: vi.fn(async () => draft), createDraft: vi.fn(async () => draft),
    countPending: vi.fn(async () => 1),
    markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(), addGuest: vi.fn(async () => savedDraft),
  }
  const store = {
    onLock: vi.fn(() => () => undefined),
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Music', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => []),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-10-08" />)
  await screen.findByText(/1 pending/)
  const user = userEvent.setup()
  await openSession()
  await openGuest()
  repository.countPending.mockRejectedValueOnce(new Error('Count unavailable'))
  await user.type(screen.getByLabelText('Display name'), 'MTQA Offline Guest')
  await user.click(screen.getByRole('button', { name: 'Add guest as present' }))
  expect(await screen.findByText(/Saved on this device$/)).toBeTruthy()
  expect(screen.getByText('MTQA Offline Guest')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('pending count')
  expect(screen.queryByText(/This change was not saved/)).toBeNull()
})
