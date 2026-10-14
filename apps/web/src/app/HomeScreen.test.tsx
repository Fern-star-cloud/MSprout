// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HomeScreen } from './HomeScreen'
import { ChurchNavigationContext } from './workspace-context'
import { authRequest } from '../features/auth/transport'

vi.mock('../features/auth/transport', () => ({ authRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks(); history.replaceState(null, '', '/') })
const church = '00000000-0000-4000-8000-000000000010'
function home(role: 'owner' | 'teacher', assignments = ['assigned']) {
  return render(<ChurchNavigationContext.Provider value={{ workspace: { church_id: church, name: 'Verified synthetic church', role }, assignments, selector: null }}><HomeScreen /></ChurchNavigationContext.Provider>)
}

it('Owner presents the three Pack 01 groups and supported preparation actions', () => {
  home('owner')
  const groups = screen.getAllByRole('region')
  expect(groups.map(group => within(group).getByRole('heading').textContent)).toEqual(['Device status', 'Prepare your ministry', 'Needs review'])
  expect(screen.getByText('Ready for Sunday.')).toBeTruthy()
  expect(within(groups[1]).getAllByRole('link').map(link => link.textContent)).toEqual(['Students', 'Ministries', 'Teachers'])
  expect(document.body.textContent).not.toMatch(/\d+ changes|unlocked|synchronization complete/i)
  expect(authRequest).not.toHaveBeenCalled()
})

it('Teacher puts attendance and existing Recent sessions inside each active assigned ministry', async () => {
  vi.mocked(authRequest).mockResolvedValue({ data: [
    { id: 'assigned', name: 'Assigned synthetic ministry', status: 'active' },
    { id: 'other', name: 'Other ministry', status: 'active' },
    { id: 'archived', name: 'Archived ministry', status: 'archived' },
  ] })
  history.replaceState(null, '', `/account/home?church=${church}`)
  home('teacher', ['assigned', 'archived'])
  const group = await screen.findByRole('region', { name: 'Assigned synthetic ministry' })
  expect(within(group).getByText('Your assigned ministry')).toBeTruthy()
  expect(within(group).getByRole('link', { name: 'Take attendance' }).getAttribute('href')).toBe(`/account/attendance?church=${church}`)
  expect(within(group).getByRole('link', { name: 'Recent sessions' }).getAttribute('href')).toBe(`/account/reports?church=${church}`)
  expect(screen.queryByText('Other ministry')).toBeNull()
  expect(screen.queryByText('Archived ministry')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Device status' })).toBeNull()
  expect(document.body.textContent).not.toMatch(/\d+ changes|unlocked|synchronization complete/i)
})

it('Teacher keeps empty and failed assignments distinct and retains a permitted recovery link', async () => {
  vi.mocked(authRequest).mockRejectedValue(new Error('private failure'))
  home('teacher')
  await screen.findByText(/Assigned ministries are unavailable/)
  expect(screen.queryByText('No assigned ministries available')).toBeNull()
  expect(screen.getByRole('link', { name: 'My ministries' }).getAttribute('href')).toBe('/account/ministries')
  expect(document.body.textContent).not.toContain('private failure')
})

it('Teacher renders every actual assigned ministry without selecting or starting a session', async () => {
  vi.mocked(authRequest).mockResolvedValue({ data: [{ id: 'assigned', name: 'First ministry', status: 'active' }, { id: 'second', name: 'Second ministry', status: 'active' }] })
  home('teacher', ['assigned', 'second'])
  await screen.findByRole('region', { name: 'Second ministry' })
  expect(screen.getAllByRole('link', { name: 'Take attendance' })).toHaveLength(2)
  expect(vi.mocked(authRequest).mock.calls).toEqual([['/api/ministries', 'GET', undefined, church]])
})

it('Teacher keeps one truthful contextual Sync recovery above assigned ministries', async () => {
  vi.mocked(authRequest).mockResolvedValue({ data: [{ id: 'assigned', name: 'Assigned synthetic ministry', status: 'active' }] })
  home('teacher')
  const ministry = await screen.findByRole('region', { name: 'Assigned synthetic ministry' })
  const sync = screen.getByRole('link', { name: 'Sync status not checked Open Sync' })
  expect(sync.compareDocumentPosition(ministry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByRole('link').filter(link => link.getAttribute('href') === '/account/sync')).toHaveLength(1)
  expect(document.body.textContent).not.toMatch(/\d+ changes|unlocked|synchronization complete/i)
})
