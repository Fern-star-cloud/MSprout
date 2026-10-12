// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../api/client'
import { ChurchWorkspaceBoundary } from '../../app/ChurchWorkspaceBoundary'
import { ChurchWorkspaceContext, type ChurchWorkspace } from '../../app/workspace-context'
import { authRequest } from '../auth/transport'
import { ReportScreen } from './ReportScreen'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn(), authDownload: vi.fn(), authUpload: vi.fn(), safeAuthMessage: () => 'Report unavailable.' }))
const church = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const ministry = '33333333-3333-4333-8333-333333333333'
const pending = async () => null
let actor: number, role: 'owner' | 'teacher', assignments: string[], mfa: boolean, selected: string
const workspace = (): ChurchWorkspace => ({ church_id: selected, name: 'Synthetic church', role })
const session = () => ({ id: actor, email_verified: true, workspaces: [workspace()] })
const account = () => ({ id: actor, email_verified: true, memberships: [{ church_id: selected, role, status: 'active' }], assignments: { ministry_ids: [...assignments] }, active_session: { mfa_confirmed: mfa } })
function report(path: string, total = 1000) {
  const query = new URLSearchParams(path.split('?')[1])
  return { data: { role, can_export: role === 'owner', filters: { date_from: query.get('date_from'), date_to: query.get('date_to'), ministry_id: query.get('ministry_id') }, summary: { present_count: total, absent_count: 0, finalized_record_count: total, attendance_rate: 1, pending_count: 0, conflict_count: 0, correction_count: 0 }, sessions: [] } }
}
beforeEach(() => {
  actor = 11; role = 'owner'; assignments = [ministry]; mfa = true; selected = church
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  // Every verification returns fresh JSON-shaped values, as real transport parsing does.
  vi.mocked(authRequest).mockImplementation(async path => {
    if (path === '/auth/session') return session() as never
    if (path === '/api/me') return account() as never
    if (path.startsWith('/api/attendance-reports')) return report(path) as never
    return { data: [] } as never
  })
})
afterEach(() => { cleanup(); history.replaceState(null, '', '/'); vi.resetAllMocks(); vi.restoreAllMocks() })
const reads = () => vi.mocked(authRequest).mock.calls.filter(([path]) => path.startsWith('/api/attendance-reports'))
const protectedView = () => render(<ChurchWorkspaceBoundary><ReportScreen pendingLocalCount={pending}/></ChurchWorkspaceBoundary>)
const totals = () => screen.getByRole('heading', { name: 'Finalized attendance totals' })
const drainLoadTimer = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })

it('keeps a loaded report when a direct verified context is a new equivalent object', async () => {
  const content = () => <ChurchWorkspaceContext.Provider value={workspace()}><ReportScreen pendingLocalCount={pending}/></ChurchWorkspaceContext.Provider>
  const view = render(content())
  await screen.findByText('Finalized attendance totals')
  const displayed = totals()
  view.rerender(content())
  await drainLoadTimer()
  expect(authRequest).toHaveBeenCalledTimes(3)
  expect(totals()).toBe(displayed)
  expect(screen.queryByText('Checking access and loading attendance report…')).toBeNull()
})

it('uses five GETs for warm Reports entry after fresh equivalent navigation verification', async () => {
  history.replaceState(null, '', '/account/students')
  render(<App/>)
  await screen.findByRole('button', { name: 'Add student' })
  const implementation = vi.mocked(authRequest).getMockImplementation()!
  let finish!: (value: never) => void
  vi.mocked(authRequest).mockImplementation((...args) => args[0] === '/auth/session' ? new Promise(resolve => { finish = resolve }) : implementation(...args))
  vi.mocked(authRequest).mockClear()
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Reports' }))
  await screen.findByText('Finalized attendance totals')
  const displayed = totals()
  await act(async () => { finish(session() as never) })
  await drainLoadTimer()
  expect(vi.mocked(authRequest).mock.calls.map(([path]) => path.split('?')[0]).sort()).toEqual(['/auth/session', '/api/me', '/api/me', '/api/attendance-reports', '/api/ministries'].sort())
  expect(totals()).toBe(displayed)
})

it.each(['owner', 'teacher'] as const)('retains %s report through equivalent focus verification using only two GETs', async verifiedRole => {
  role = verifiedRole
  protectedView()
  await screen.findByText('Finalized attendance totals')
  const displayed = totals(), implementation = vi.mocked(authRequest).getMockImplementation()!
  let finish!: (value: never) => void
  vi.mocked(authRequest).mockImplementation((...args) => args[0] === '/auth/session' ? new Promise(resolve => { finish = resolve }) : implementation(...args))
  vi.mocked(authRequest).mockClear()
  fireEvent.focus(window)
  expect(totals()).toBe(displayed)
  await waitFor(() => expect(finish).toBeTruthy())
  await act(async () => { finish(session() as never) })
  await drainLoadTimer()
  expect(vi.mocked(authRequest).mock.calls.map(([path]) => path)).toEqual(['/auth/session', '/api/me'])
  expect(totals()).toBe(displayed)
  expect(screen.queryByText('Checking access and loading attendance report…')).toBeNull()
  if (role === 'teacher') expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
})

it.each(['actor', 'church', 'role', 'assignment'])('invalidates Reports on a legitimate %s change and discards previous-scope completion', async change => {
  if (change === 'assignment') role = 'teacher'
  const view = protectedView()
  await screen.findByText('Finalized attendance totals')
  const implementation = vi.mocked(authRequest).getMockImplementation()!
  const finishes: ((value: never) => void)[] = []
  let oldPayload: ReturnType<typeof report>
  vi.mocked(authRequest).mockImplementation((...args) => {
    if (!args[0].startsWith('/api/attendance-reports')) return implementation(...args)
    oldPayload ??= report(args[0])
    return new Promise(resolve => { finishes.push(resolve) })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
  await waitFor(() => expect(finishes).toHaveLength(1))
  if (change === 'actor') actor = 22
  if (change === 'role') role = 'teacher'
  if (change === 'assignment') assignments = []
  if (change === 'church') {
    selected = other
    history.replaceState(null, '', `/?church=${other}`)
    view.rerender(<ChurchWorkspaceBoundary routeKey={other}><ReportScreen pendingLocalCount={pending}/></ChurchWorkspaceBoundary>)
  } else fireEvent.focus(window)
  await waitFor(() => expect(finishes).toHaveLength(2))
  expect(screen.queryByText('Finalized attendance totals')).toBeNull()
  if (change === 'church') expect(authRequest).toHaveBeenCalledWith('/api/me', 'GET', undefined, other)
  const path = reads().at(-1)![0]
  await act(async () => { finishes[1](report(path, 2000) as never) })
  await screen.findByText('Finalized attendance totals')
  await act(async () => { finishes[0](oldPayload! as never) })
  expect(screen.queryByText('1000', { exact: true })).toBeNull()
  expect(screen.getAllByText('2000', { exact: true })).toHaveLength(2)
  if (change === 'role') expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
})

it('lets an in-flight authorized report complete through equivalent focus verification', async () => {
  const implementation = vi.mocked(authRequest).getMockImplementation()!
  let finish!: (value: never) => void, path = ''
  vi.mocked(authRequest).mockImplementation((...args) => {
    if (args[0].startsWith('/api/attendance-reports')) {
      path = args[0]; return new Promise(resolve => { finish = resolve })
    }
    return implementation(...args)
  })
  protectedView()
  await waitFor(() => expect(finish).toBeTruthy())
  fireEvent.focus(window)
  await waitFor(() => expect(vi.mocked(authRequest).mock.calls.filter(([endpoint]) => endpoint === '/auth/session')).toHaveLength(2))
  await drainLoadTimer()
  expect(reads()).toHaveLength(1)
  await act(async () => { finish(report(path) as never) })
  await screen.findByText('Finalized attendance totals')
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each([401, 403, 419, 'mfa'] as const)('removes loaded results when delayed focus verification denies access: %s', async denial => {
  protectedView()
  await screen.findByText('Finalized attendance totals')
  const implementation = vi.mocked(authRequest).getMockImplementation()!
  let reject!: (reason: unknown) => void
  vi.mocked(authRequest).mockImplementation((...args) => {
    if (denial === 'mfa' && args[0] === '/api/me') return Promise.resolve({ ...account(), active_session: { mfa_confirmed: false } } as never)
    const deniedPath = denial === 403 ? '/api/me' : '/auth/session'
    if (denial !== 'mfa' && args[0] === deniedPath) return new Promise((_, fail) => { reject = fail })
    return implementation(...args)
  })
  fireEvent.focus(window)
  if (denial !== 'mfa') {
    await waitFor(() => expect(reject).toBeTruthy())
    expect(totals()).toBeTruthy()
    await act(async () => { reject(new ApiError('denied', '', '', denial)) })
  }
  await screen.findByRole('alert')
  expect(screen.queryByText('Finalized attendance totals')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
  expect(reads()).toHaveLength(1)
})

it.each([401, 403, 419])('does not restore an outstanding report after delayed focus denial %s', async status => {
  protectedView()
  await screen.findByText('Finalized attendance totals')
  const implementation = vi.mocked(authRequest).getMockImplementation()!
  let finish!: (value: never) => void, reject!: (reason: unknown) => void, path = ''
  vi.mocked(authRequest).mockImplementation((...args) => {
    if (args[0] === '/auth/session') return new Promise((_, fail) => { reject = fail })
    if (args[0].startsWith('/api/attendance-reports')) {
      path = args[0]; return new Promise(resolve => { finish = resolve })
    }
    return implementation(...args)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
  await waitFor(() => expect(finish).toBeTruthy())
  fireEvent.focus(window)
  await waitFor(() => expect(reject).toBeTruthy())
  await act(async () => { reject(new ApiError('denied', '', '', status)) })
  await screen.findByRole('alert')
  await act(async () => { finish(report(path) as never) })
  expect(screen.queryByText('Finalized attendance totals')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
})
