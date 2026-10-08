// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { authRequest } from '../features/auth/transport'
import App from '../App'
import { profileStore } from '../offline/profile-store'

vi.mock('../features/auth/transport', () => ({ authRequest: vi.fn(), authDownload: vi.fn(), authUpload: vi.fn(), safeAuthMessage: () => 'Unable to load.' }))

const church = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
let role: 'owner' | 'teacher'
let workspaces: { church_id: string; name: string; role: 'owner' | 'teacher' }[]

beforeEach(() => {
  role = 'owner'
  workspaces = [{ church_id: church, name: 'Authorized church', role }]
  vi.mocked(authRequest).mockImplementation(async path => {
    if (path === '/auth/session') return { id: 7, email_verified: true, mfa_confirmed: true, workspaces } as never
    if (path === '/api/me') return { id: 7, memberships: workspaces.map(item => ({ ...item, status: 'active' })), active_session: { mfa_confirmed: true } } as never
    if (path.startsWith('/api/attendance-reports')) return { data: { role, can_export: role === 'owner', filters: { date_from: '2026-10-01', date_to: '2026-10-08', ministry_id: null }, summary: { present_count: 0, absent_count: 0, finalized_record_count: 0, attendance_rate: 0, pending_count: 0, conflict_count: 0, correction_count: 0 }, sessions: [] } } as never
    if (path === '/api/birthdays/today') return { data: { role, local_date: '2026-10-08', timezone: 'Asia/Manila', count: 0, birthdays: [] } } as never
    if (path === '/api/sync-conflicts') return { role, data: [] } as never
    return { data: [] } as never
  })
})
afterEach(() => { cleanup(); history.replaceState(null, '', '/'); vi.clearAllMocks(); vi.restoreAllMocks() })

it.each([
  ['conflicts', '/api/sync-conflicts'], ['reports', '/api/attendance-reports'], ['birthdays', '/api/birthdays/today'],
  ['ministries', '/api/ministries'], ['students', '/api/students'], ['imports', '/api/ministries'],
])('bootstraps Owner direct navigation and refresh for %s without raw ids', async (page, endpoint) => {
  history.replaceState(null, '', `/account/${page}`)
  const view = render(<App />)
  await waitFor(() => expect(vi.mocked(authRequest).mock.calls.some(([path, , , id]) => path.startsWith(endpoint) && id === church)).toBe(true))
  expect(screen.queryByLabelText('Church workspace ID')).toBeNull()
  expect(authRequest).toHaveBeenCalledWith('/auth/session')
  expect(screen.getAllByRole('link', { name: 'Students' })[0].getAttribute('href')).toBe('/account/students')
  view.unmount()
  render(<App />)
  await waitFor(() => expect(vi.mocked(authRequest).mock.calls.filter(([path]) => path === '/auth/session').length).toBe(2))
})

it('does not mount protected modules before bootstrap and scoped account validation', async () => {
  vi.mocked(authRequest).mockImplementation(() => new Promise(() => {}))
  history.replaceState(null, '', '/account/students')
  render(<App />)
  expect(await screen.findByText('Loading church workspace…')).toBeTruthy()
  expect(authRequest).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('heading', { name: 'Students' })).toBeNull()
})

it.each([401, 419, 403, 500])('blocks protected data on bootstrap HTTP %s', async status => {
  vi.mocked(authRequest).mockRejectedValue(new ApiError('denied', 'private detail', '', status))
  history.replaceState(null, '', '/account/students')
  render(<App />)
  await screen.findByRole('alert')
  expect(vi.mocked(authRequest).mock.calls.every(([path]) => path === '/auth/session')).toBe(true)
  expect(document.body.textContent).not.toContain('private detail')
})

it('requires membership and rejects a query pointing at another tenant', async () => {
  history.replaceState(null, '', `/account/students?church=${other}`)
  render(<App />)
  await screen.findByText('This church workspace is unavailable for your account.')
  expect(vi.mocked(authRequest).mock.calls.every(([path]) => path === '/auth/session')).toBe(true)
})

it('handles missing membership and offers verified multi membership selection', async () => {
  workspaces = []
  history.replaceState(null, '', '/account/students')
  const view = render(<App />)
  await screen.findByText('No active church workspace is available for your account.')
  view.unmount()
  workspaces = [{ church_id: church, name: 'First church', role }, { church_id: other, name: 'Second church', role }]
  render(<App />)
  const selector = await screen.findByLabelText('Church workspace')
  expect(vi.mocked(authRequest).mock.calls.every(([path]) => path === '/auth/session')).toBe(true)
  fireEvent.change(selector, { target: { value: other } })
  await waitFor(() => expect(authRequest).toHaveBeenCalledWith('/api/students', 'GET', undefined, other))
  expect(location.search).toContain(other)
  expect(screen.getAllByRole('link', { name: 'Reports' })[0].getAttribute('href')).toBe(`/account/reports?church=${other}`)
  expect(screen.getAllByRole('link', { name: 'Students' })[0].getAttribute('aria-current')).toBe('page')
  expect(screen.queryByLabelText('Church workspace ID')).toBeNull()
})

it('allows Teacher roster reads and keeps Owner controls unavailable', async () => {
  role = 'teacher'; workspaces[0].role = role
  history.replaceState(null, '', '/account/students')
  const view = render(<App />)
  await waitFor(() => expect(authRequest).toHaveBeenCalledWith('/api/students', 'GET', undefined, church))
  expect(screen.queryByRole('button', { name: 'Add student' })).toBeNull()
  view.unmount()
  history.replaceState(null, '', '/account/imports')
  render(<App />)
  await screen.findByText('Student imports are available only to the church Owner with confirmed MFA.')
  expect(screen.queryByLabelText('Student spreadsheet')).toBeNull()
})

it('clears modules on session invalidation and rechecks membership on focus', async () => {
  history.replaceState(null, '', '/account/students')
  const view = render(<App />)
  await waitFor(() => expect(authRequest).toHaveBeenCalledWith('/api/students', 'GET', undefined, church))
  fireEvent(window, new CustomEvent('church-workspace-invalidated', { detail: { status: 401 } }))
  expect(screen.queryByRole('heading', { name: 'Students' })).toBeNull()
  await screen.findByRole('link', { name: 'Sign in' })
  view.unmount()
  render(<App />)
  await screen.findByRole('heading', { name: 'Students' })
  workspaces = []
  fireEvent.focus(window)
  await screen.findByText('No active church workspace is available for your account.')
  expect(screen.queryByRole('heading', { name: 'Students' })).toBeNull()
})

it('preserves the encrypted profile attendance route when no online session exists', async () => {
  vi.mocked(authRequest).mockRejectedValue(new ApiError('denied', '', '', 401))
  history.replaceState(null, '', '/account/attendance')
  render(<App />)
  await screen.findByRole('heading', { name: 'Take attendance' })
  expect(authRequest).not.toHaveBeenCalled()
})

it.each(['conflicts', 'reports', 'birthdays', 'ministries', 'students', 'imports'])('opens %s with Teacher membership without Owner write controls', async page => {
  role = 'teacher'; workspaces[0].role = role
  history.replaceState(null, '', `/account/${page}`)
  render(<App />)
  await waitFor(() => expect(vi.mocked(authRequest).mock.calls.some(([path, , , id]) => path !== '/api/me' && path.startsWith('/api/') && id === church)).toBe(true))
  expect(screen.queryByRole('button', { name: /Add student|Add ministry|Preview import|Download CSV/ })).toBeNull()
})

it('denies a scoped preflight failure before mounting child requests', async () => {
  vi.mocked(authRequest).mockImplementation(async path => {
    if (path === '/auth/session') return { id: 7, email_verified: true, workspaces } as never
    throw new ApiError('forbidden', '', '', 403)
  })
  history.replaceState(null, '', '/account/students')
  render(<App />)
  await screen.findByRole('link', { name: 'Check MFA' })
  expect(vi.mocked(authRequest).mock.calls.every(([path]) => ['/auth/session', '/api/me'].includes(path))).toBe(true)
})

it('rejects an actor change between discovery and scoped validation', async () => {
  vi.mocked(authRequest).mockImplementation(async path => path === '/auth/session'
    ? { id: 7, email_verified: true, workspaces } as never
    : { id: 8, memberships: [{ church_id: church, role, status: 'active' }] } as never)
  history.replaceState(null, '', '/account/students')
  render(<App />)
  await screen.findByText('Your church membership changed. Reload your workspace.')
  expect(screen.queryByRole('heading', { name: 'Students' })).toBeNull()
})

it('does not resurrect workspace after logout while bootstrap is pending', async () => {
  let resolve!: (value: never) => void
  vi.mocked(authRequest).mockImplementation(() => new Promise(done => { resolve = done }))
  history.replaceState(null, '', '/account/students')
  render(<App />)
  await screen.findByText('Loading church workspace…')
  fireEvent(window, new CustomEvent('church-workspace-invalidated', { detail: { status: 401 } }))
  resolve({ id: 7, email_verified: true, workspaces } as never)
  await screen.findByRole('link', { name: 'Sign in' })
  expect(authRequest).toHaveBeenCalledTimes(1)
})

it('uses only the unlocked encrypted profile for offline birthdays and fails closed on an expired lease', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  vi.spyOn(profileStore, 'activeProfile').mockResolvedValue({ id: 'offline-test-profile', churchId: church })
  const authorization = vi.spyOn(profileStore, 'readEncryptedAuthorization').mockRejectedValue(new Error('Expired lease'))
  history.replaceState(null, '', '/account/birthdays')
  render(<App />)
  await screen.findByRole('alert')
  expect(authorization).toHaveBeenCalledWith('offline-test-profile')
  expect(authRequest).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: "Today's Birthdays" })).toBeNull()
})
