// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { AttendanceDraft, AttendanceState, CreateAttendanceDraftInput } from './domain'
import { AttendanceScreen } from './AttendanceScreen'

afterEach(() => cleanup())

it('supports search, individual and bulk marking, counts, and safe finalization', async () => {
  let draft: AttendanceDraft = {
    id: 'session-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Primary',
    attendanceDate: '2026-09-28', status: 'draft', version: 1, updatedAt: '2026-09-28T00:00:00Z',
    entries: [
      { studentId: 'student-a', displayName: 'Ana Sprout', gender: 'female', state: 'unmarked' },
      { studentId: 'student-b', displayName: 'Ben Sprout', gender: 'male', state: 'unmarked' },
    ],
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
  }
  const store = {
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
  expect(await screen.findByText('0 marked · 2 unmarked')).toBeTruthy()
  expect(screen.getByText(/Offline.*saving on this device/i)).toBeTruthy()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  window.dispatchEvent(new Event('online'))
  expect(await screen.findByText(/Online.*1 pending/i)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Finalize attendance' }) as HTMLButtonElement).disabled).toBe(true)

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
  expect(await screen.findByText(/Saved on this device — Pending Sync$/)).toBeTruthy()
})

it('keeps the responsive controls usable with text labels and student avatars', async () => {
  const repository = {
    findDraft: vi.fn(async () => null), createDraft: vi.fn(async (input: CreateAttendanceDraftInput) => ({
      id: 'session-a', profileId: input.profileId, churchId: input.churchId, ministryId: input.ministryId,
      ministryName: input.ministryName, attendanceDate: input.attendanceDate, status: 'draft' as const, version: 1,
      updatedAt: '2026-09-28T00:00:00Z', entries: input.students.map(student => ({ studentId: student.id, displayName: student.displayName, gender: student.gender, state: 'unmarked' as const })),
    })), countPending: vi.fn(async () => 0), markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
  }
  const store = {
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => [{ id: 'ministry-a', name: 'Primary', version: 1 }]),
    readEncryptedRoster: vi.fn(async () => [{ id: 'student-a', display_name: 'Ana Sprout', gender: 'female' as const, ministry_ids: ['ministry-a'] }]),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-09-28" />)

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
  }
  const repository = {
    findDraft: vi.fn(async () => assigned ? draft : null),
    createDraft: vi.fn(async () => draft),
    countPending: vi.fn(async () => assigned ? 1 : 0),
    markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
  }
  const store = {
    activeProfile: vi.fn(async () => ({ id: 'profile-a', churchId: 'church-a' })),
    readEncryptedMinistries: vi.fn(async () => assigned ? [{ id: 'ministry-a', name: 'Primary', version: 1 }] : []),
    readEncryptedRoster: vi.fn(async () => assigned
      ? [{ id: 'student-a', display_name: 'Ana Sprout', gender: 'female' as const, ministry_ids: ['ministry-a'] }]
      : []),
  }
  render(<AttendanceScreen repository={repository} store={store} initialDate="2026-09-28" />)
  expect(await screen.findByText('Ana Sprout')).toBeTruthy()

  assigned = false
  window.dispatchEvent(new Event('ministrysprout:sync-complete'))

  await waitFor(() => expect(screen.queryByText('Ana Sprout')).toBeNull())
  expect((screen.getByLabelText('Ministry') as HTMLSelectElement).options).toHaveLength(0)
  expect(screen.getByText('0 marked · 0 unmarked')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Finalize attendance' }) as HTMLButtonElement).disabled).toBe(true)
})

it('clears protected roster state when reconnect requires online reauthentication', async () => {
  let invalid = false
  const draft: AttendanceDraft = {
    id: 'session-a', profileId: 'profile-a', churchId: 'church-a', ministryId: 'ministry-a', ministryName: 'Primary',
    attendanceDate: '2026-09-28', status: 'draft', version: 1, updatedAt: '2026-09-28T00:00:00Z',
    entries: [{ studentId: 'student-a', displayName: 'Ana Sprout', gender: 'female', state: 'unmarked' }],
  }
  const repository = {
    findDraft: vi.fn(async () => draft), createDraft: vi.fn(async () => draft), countPending: vi.fn(async () => 1),
    markStudent: vi.fn(), bulkMark: vi.fn(), finalizeDraft: vi.fn(),
  }
  const store = {
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
  expect(await screen.findByText('Ana Sprout')).toBeTruthy()

  invalid = true
  window.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid'))

  await waitFor(() => expect(screen.queryByText('Ana Sprout')).toBeNull())
  expect(screen.getByRole('alert').textContent).toContain('authenticate this profile')
  expect((screen.getByLabelText('Ministry') as HTMLSelectElement).options).toHaveLength(0)
})
