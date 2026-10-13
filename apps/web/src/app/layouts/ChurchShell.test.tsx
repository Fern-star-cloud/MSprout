// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ChurchNavigationContext } from '../workspace-context'
import { resolveRoute } from '../routes'
import { navigationFor } from '../navigation'
import { ChurchShell } from './ChurchShell'

afterEach(cleanup)
const church = '11111111-1111-4111-8111-111111111111'
function shell(path: string, role: 'owner' | 'teacher' = 'owner') {
  return <ChurchNavigationContext.Provider value={{ workspace: { church_id: church, name: 'Verified church', role }, assignments: [], selector: null }}>
    <ChurchShell route={resolveRoute(path)!} routeKey={path}><h1>Existing content</h1></ChurchShell>
  </ChurchNavigationContext.Provider>
}

it('compacts People on every Owner screen, reveals the active child and identifies the controlled group', () => {
  const view = render(shell('/account/reports'))
  const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }))
  const toggle = nav.getByRole('button', { name: 'Show People destinations' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(nav.queryByRole('link', { name: 'Students' })).toBeNull()
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)?.hidden).toBe(true)
  expect(nav.getByRole('link', { name: 'Reports & history' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(toggle)
  expect(nav.getByRole('link', { name: 'Import' }).getAttribute('href')).toBe('/account/imports')
  view.rerender(shell('/account/students'))
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(nav.getByRole('link', { name: 'Students' }).getAttribute('aria-current')).toBe('page')
  expect(nav.getByRole('link', { name: 'People' }).getAttribute('aria-current')).toBe('location')
  fireEvent.click(toggle)
  expect(nav.queryByRole('link', { name: 'Students' })).toBeNull()
  expect(nav.getByRole('link', { name: 'People' }).getAttribute('aria-current')).toBe('location')
})

it('marks Owner mobile More and People descendants while retaining a persistent truthful Sync destination', () => {
  const view = render(shell('/account/birthdays'))
  const phone = within(screen.getByRole('navigation', { name: 'Phone navigation' }))
  expect(phone.getAllByRole('link').map(a => a.textContent)).toEqual(['Home', 'Attendance', 'Review', 'People', 'More'])
  expect(phone.getByRole('link', { name: 'More' }).getAttribute('aria-current')).toBe('location')
  expect(screen.getAllByRole('link', { name: 'Sync & device' }).every(a => a.getAttribute('href') === '/account/sync')).toBe(true)
  view.rerender(shell('/account/students'))
  expect(phone.getByRole('link', { name: 'People' }).getAttribute('aria-current')).toBe('location')
  expect(document.body.textContent).not.toMatch(/\d+ pending|profile unlocked/i)
})

it('Teacher hierarchy preserves scoped destinations without Owner administration after a role change', () => {
  const view = render(shell('/account/students'))
  view.rerender(shell('/account/reports', 'teacher'))
  const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }))
  expect(nav.getAllByRole('link').map(a => a.textContent)).toEqual(['Home', 'Attendance', 'My ministries', 'More', 'Sync & device', 'Account'])
  expect(screen.queryByRole('button', { name: 'Show People destinations' })).toBeNull()
  const more = navigationFor('teacher').more
  for (const label of ['My ministries', 'Recent sessions', 'Birthdays', 'My activity', 'Account', 'Assigned roster']) expect(more.some(item => item.label === label)).toBe(true)
  expect(more.some(item => ['people', 'teachers', 'imports', 'conflicts'].includes(item.id))).toBe(false)
})
