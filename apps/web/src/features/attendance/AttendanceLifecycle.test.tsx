// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { AttendanceScreen } from './AttendanceScreen'
import type { AttendanceDraft, AttendanceState, CreateAttendanceDraftInput } from './domain'

beforeAll(() => Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } },
  close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } },
}))
afterEach(cleanup)
const date = '2026-10-10'
function fixture(existing = false) {
  let draft: AttendanceDraft = { id: 'session-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Primary', attendanceDate: date, status: 'draft', version: 1, updatedAt: date,
    entries: [{ studentId: 'a', displayName: 'Synthetic Ana', gender: 'female', state: 'unmarked' }, { studentId: 'b', displayName: 'Synthetic Ben', gender: 'male', state: 'unmarked' }], guests: [] }
  let found = existing, lock = () => {}, pending = existing ? 1 : 0
  const repository = {
    findDraft: vi.fn(async (_profile: string, ministry: string, selectedDate: string) => found && ministry === 'ministry-a' && selectedDate === date ? structuredClone(draft) : null),
    createDraft: vi.fn(async (input: CreateAttendanceDraftInput) => { found = true; pending++; return structuredClone({ ...draft, attendanceDate: input.attendanceDate }) }),
    countPending: vi.fn(async () => pending),
    markStudent: vi.fn(async (_profile: string, _id: string, student: string, state: AttendanceState) => { draft = { ...draft, version: draft.version + 1, entries: draft.entries.map(entry => entry.studentId === student ? { ...entry, state } : entry) }; pending++; return structuredClone(draft) }),
    bulkMark: vi.fn(async (_profile: string, _id: string, state: AttendanceState) => { draft = { ...draft, entries: draft.entries.map(entry => ({ ...entry, state })) }; return structuredClone(draft) }),
    addGuest: vi.fn(async (_profile: string, _id: string, displayName: string, gender: AttendanceDraft['entries'][number]['gender']) => { draft = { ...draft, guests: [...draft.guests, { id: 'guest-a', displayName, gender, state: 'present', status: 'pending' }] }; pending++; return structuredClone(draft) }),
    finalizeDraft: vi.fn(async () => { draft = { ...draft, status: 'finalized_pending' }; pending++; return structuredClone(draft) }),
  }
  const store = {
    onLock: (listener: (id: string, reason: 'manual') => void) => { lock = () => listener('profile-a', 'manual'); return () => {} },
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a', syncNeedsPull: true })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Primary', version: 1 }, { id: 'ministry-b', name: 'Music', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => draft.entries.map(entry => ({ id: entry.studentId, display_name: entry.displayName, gender: entry.gender, ministry_ids: ['ministry-a'] }))),
  }
  const user = userEvent.setup()
  return { repository, store, user, lock: () => lock(), get: () => draft, set: (value: AttendanceDraft) => { draft = value }, mount: () => render(<AttendanceScreen repository={repository} store={store} initialDate={date} />) }
}
async function open(f: ReturnType<typeof fixture>, existing = false) {
  f.mount()
  await f.user.click(await screen.findByRole('button', { name: existing ? 'Resume attendance' : 'Start attendance' }))
  await screen.findByText('Synthetic Ana')
}

it('viewing and changing ministry/date performs no creation or mutation', async () => {
  const f = fixture(); f.mount()
  await screen.findByRole('button', { name: 'Start attendance' })
  fireEvent.change(screen.getByLabelText('Attendance date'), { target: { value: '2026-10-11' } })
  await f.user.selectOptions(screen.getByLabelText('Ministry'), 'ministry-b')
  await screen.findByText('No draft for this date')
  expect(f.repository.createDraft).not.toHaveBeenCalled()
  expect(f.repository.markStudent).not.toHaveBeenCalled()
  expect(f.repository.addGuest).not.toHaveBeenCalled()
  expect(f.repository.finalizeDraft).not.toHaveBeenCalled()
  expect(f.repository.findDraft).toHaveBeenLastCalledWith('profile-a', 'ministry-b', '2026-10-11')
})

it('coalesces repeated Start before rendering pending state', async () => {
  const f = fixture(); let finish!: (value: AttendanceDraft) => void
  f.repository.createDraft.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  f.mount(); const start = await screen.findByRole('button', { name: 'Start attendance' })
  act(() => { start.click(); start.click() })
  expect(f.repository.createDraft).toHaveBeenCalledOnce()
  expect(screen.getByText('Starting attendance on this device…')).toBeTruthy()
  expect((screen.getByLabelText('Attendance date') as HTMLInputElement).disabled).toBe(true)
  await act(async () => finish(f.get()))
  expect(await screen.findByText('Synthetic Ana')).toBeTruthy()
  expect(screen.getByText('✓ Saved on this device')).toBeTruthy()
})

it('Resume reads and preserves existing marks instead of creating another session', async () => {
  const f = fixture(true); f.set({ ...f.get(), entries: f.get().entries.map(entry => ({ ...entry, state: 'absent' })) })
  f.mount(); expect(await screen.findByText('Saved draft found')).toBeTruthy()
  expect(screen.queryByText('Synthetic Ana')).toBeNull()
  await f.user.click(screen.getByRole('button', { name: 'Resume attendance' }))
  expect((await screen.findByRole('button', { name: 'Mark Synthetic Ana absent' })).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Mark Synthetic Ben absent' }).getAttribute('aria-pressed')).toBe('true')
  expect(f.repository.createDraft).not.toHaveBeenCalled()
  expect(f.repository.markStudent).not.toHaveBeenCalled()
})

it('filters current states accessibly without hiding the full-scope finalization blocker', async () => {
  const f = fixture(); await open(f)
  await f.user.click(screen.getByRole('button', { name: 'Mark Synthetic Ana present' }))
  await f.user.click(screen.getByRole('button', { name: 'Present' }))
  expect(screen.queryByText('Synthetic Ben')).toBeNull()
  expect(screen.getByText('Synthetic Ana')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Present' }).getAttribute('aria-pressed')).toBe('true')
  expect((screen.getByRole('button', { name: 'Finalize attendance' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Mark 1 remaining student first')).toBeTruthy()
  await f.user.click(screen.getByRole('button', { name: 'Unmarked' }))
  expect(screen.queryByText('Synthetic Ana')).toBeNull()
  expect(screen.getByText('Synthetic Ben')).toBeTruthy()
})

it('finalization requires confirmation, supports cancellation and locks only after confirm', async () => {
  const f = fixture(); await open(f)
  await f.user.click(screen.getByRole('button', { name: 'Mark all unmarked present' }))
  await f.user.click(screen.getByRole('button', { name: 'Finalize attendance' }))
  const dialog = screen.getByRole('dialog', { name: 'Finalize this session?' })
  expect(within(dialog).getByText('2 regular students + 0 guests')).toBeTruthy()
  expect(f.repository.finalizeDraft).not.toHaveBeenCalled()
  await f.user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
  expect(f.repository.finalizeDraft).not.toHaveBeenCalled()
  await f.user.click(screen.getByRole('button', { name: 'Finalize attendance' }))
  await f.user.click(screen.getByRole('button', { name: 'Finalize on this device' }))
  expect(await screen.findByText('Finalized on this device')).toBeTruthy()
  expect(f.repository.finalizeDraft).toHaveBeenCalledOnce()
  expect((screen.getByRole('button', { name: 'Mark Synthetic Ana present' }) as HTMLButtonElement).disabled).toBe(true)
})

it('guest failure retains approved input and committed success never invites resubmission on count failure', async () => {
  const f = fixture(); await open(f)
  await f.user.click(screen.getByRole('button', { name: 'Add temporary guest' }))
  await f.user.type(screen.getByLabelText('Display name'), '  Synthetic Guest  ')
  await f.user.selectOptions(screen.getByLabelText('Gender (optional)'), 'female')
  f.repository.addGuest.mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'))
  await f.user.click(screen.getByRole('button', { name: 'Add guest as present' }))
  expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('  Synthetic Guest  ')
  expect((screen.getByLabelText('Gender (optional)') as HTMLSelectElement).value).toBe('female')
  expect(screen.queryByText('Saved on this device')).toBeNull()
  f.repository.countPending.mockRejectedValueOnce(new Error('unavailable'))
  await f.user.click(screen.getByRole('button', { name: 'Add guest as present' }))
  expect(await screen.findByText('Synthetic Guest')).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'Add temporary guest' })).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('pending count')
  expect(screen.queryByText(/This change was not saved/)).toBeNull()
  expect(f.repository.addGuest).toHaveBeenCalledTimes(2)
})

it('late date lookup cannot replace the newer selection or create attendance', async () => {
  const f = fixture(); let finish!: (draft: AttendanceDraft) => void
  f.repository.findDraft.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  f.mount(); await waitFor(() => expect(f.repository.findDraft).toHaveBeenCalledOnce())
  fireEvent.change(screen.getByLabelText('Attendance date'), { target: { value: '2026-10-11' } })
  await screen.findByText('No draft for this date')
  await act(async () => finish(f.get()))
  expect(screen.queryByRole('button', { name: 'Resume attendance' })).toBeNull()
  expect(f.repository.createDraft).not.toHaveBeenCalled()
})

it('lock during Start clears plaintext and ignores a late committed result', async () => {
  const f = fixture(); let finish!: (draft: AttendanceDraft) => void
  f.repository.createDraft.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  f.mount(); await f.user.click(await screen.findByRole('button', { name: 'Start attendance' }))
  act(() => f.lock()); await act(async () => finish(f.get()))
  expect(screen.queryByText('Synthetic Ana')).toBeNull()
  expect(screen.queryByLabelText('Display name')).toBeNull()
  expect(screen.queryByText('Saved on this device')).toBeNull()
})

it('selection failure remains unknown and never offers Start over uncertain existing work', async () => {
  const f = fixture(); f.repository.findDraft.mockRejectedValueOnce(new Error('unreadable'))
  f.mount(); await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Start attendance' })).toBeNull()
  expect(f.repository.createDraft).not.toHaveBeenCalled()
})

it('authorization interruption clears plaintext immediately and suppresses an earlier save', async () => {
  const f = fixture(true); await open(f, true)
  let finish!: (value: AttendanceDraft) => void
  f.repository.addGuest.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await f.user.click(screen.getByRole('button', { name: 'Add temporary guest' }))
  await f.user.type(screen.getByLabelText('Display name'), 'Synthetic interrupted guest')
  await f.user.click(screen.getByRole('button', { name: 'Add guest as present' }))
  f.store.readEncryptedRoster.mockImplementationOnce(() => new Promise(() => {}))
  act(() => window.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid')))
  expect(screen.queryByText('Synthetic Ana')).toBeNull()
  expect(screen.queryByLabelText('Display name')).toBeNull()
  await act(async () => finish({ ...f.get(), guests: [{ id: 'late', displayName: 'Synthetic interrupted guest', gender: 'unspecified', state: 'present', status: 'pending' }] }))
  expect(screen.queryByText('Synthetic interrupted guest')).toBeNull()
  expect(screen.queryByText('Saved on this device')).toBeNull()
})

it('unknown queue counts remain unknown without removing an authorized resumed roster', async () => {
  const f = fixture(true); await open(f, true)
  f.repository.countPending.mockRejectedValueOnce(new Error('Count unavailable'))
  act(() => window.dispatchEvent(new Event('ministrysprout:sync-complete')))
  await screen.findByText(/Upload count unavailable/)
  expect(screen.getByText('Synthetic Ana')).toBeTruthy()
  expect(screen.queryByText(/No pending uploads/)).toBeNull()
})

it('rejects a mismatched profile binding before exposing a saved session', async () => {
  const f = fixture(true); f.set({ ...f.get(), profileId: 'profile-other' })
  f.mount(); await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Resume attendance' })).toBeNull()
  expect(screen.queryByText('Synthetic Ana')).toBeNull()
  expect(f.repository.createDraft).not.toHaveBeenCalled()
})

it('coalesces guest submission and waits for a concurrent Sync refresh before showing the committed roster', async () => {
  const f = fixture(true); await open(f, true)
  let finish!: (value: AttendanceDraft) => void
  f.repository.addGuest.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await f.user.click(screen.getByRole('button', { name: 'Add temporary guest' }))
  await f.user.type(screen.getByLabelText('Display name'), 'Synthetic single guest')
  const form = screen.getByLabelText('Display name').closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form); window.dispatchEvent(new Event('ministrysprout:sync-complete')) })
  expect(f.repository.addGuest).toHaveBeenCalledOnce()
  expect(f.repository.findDraft).toHaveBeenCalledTimes(2)
  f.set({ ...f.get(), guests: [{ id: 'guest-a', displayName: 'Synthetic single guest', gender: 'unspecified', state: 'present', status: 'pending' }] })
  await act(async () => finish(f.get()))
  expect(await screen.findByText('Synthetic single guest')).toBeTruthy()
  await waitFor(() => expect(f.repository.findDraft).toHaveBeenCalledTimes(3))
  expect(f.repository.addGuest).toHaveBeenCalledOnce()
})

it('expired protected reads expose neither Start nor roster and make no writes', async () => {
  const f = fixture(true); f.store.readEncryptedRoster.mockRejectedValueOnce(new Error('Authorization expired'))
  f.mount(); await screen.findByText(/valid offline authorization/)
  expect(screen.queryByText('Synthetic Ana')).toBeNull()
  expect(f.repository.findDraft).not.toHaveBeenCalled()
  expect(f.repository.createDraft).not.toHaveBeenCalled()
})

it('a Sync read started before marking cannot replace the newer committed attendance', async () => {
  const f = fixture(true); await open(f, true)
  let finish!: (value: AttendanceDraft) => void
  const old = structuredClone(f.get())
  f.repository.findDraft.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  act(() => window.dispatchEvent(new Event('ministrysprout:sync-complete')))
  await waitFor(() => expect(f.repository.findDraft).toHaveBeenCalledTimes(3))
  await f.user.click(screen.getByRole('button', { name: 'Mark Synthetic Ana present' }))
  await act(async () => finish(old))
  expect(screen.getByRole('button', { name: 'Mark Synthetic Ana present' }).getAttribute('aria-pressed')).toBe('true')
  expect(f.repository.markStudent).toHaveBeenCalledOnce()
})

it.each(['finalized_pending', 'finalized', 'needs_review', 'revised'] as const)('Resume keeps %s attendance read-only without recreating its event', async status => {
  const f = fixture(true); f.set({ ...f.get(), status })
  await open(f, true)
  expect((screen.getByRole('button', { name: 'Mark Synthetic Ana present' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Add temporary guest' }) as HTMLButtonElement).disabled).toBe(true)
  expect(f.repository.createDraft).not.toHaveBeenCalled()
  if (status === 'needs_review') expect(screen.getByText(/attendance needs review/)).toBeTruthy()
})
