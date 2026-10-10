import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { readPreparationAccess, validatePreparationBootstrap, type PreparationAccess } from './preparation-access'
vi.mock('../auth/transport', () => ({ authRequest: vi.fn() }))
const church = '00000000-0000-4000-8000-000000000010'
const ministry = '00000000-0000-4000-8000-000000000020'
function fixture(role = 'teacher', assigned = [ministry]) {
  vi.mocked(authRequest).mockImplementation(async path => {
    if (path === '/auth/session') return { id: 11, email_verified: true, mfa_confirmed: true, workspaces: [{ church_id: church, name: 'Synthetic church', role }] } as never
    if (path === '/api/me') return { id: 11, email_verified: true, memberships: [{ church_id: church, role, status: 'active' }], assignments: { ministry_ids: assigned }, active_session: { mfa_confirmed: true } } as never
    return { data: [{ id: ministry, name: 'Assigned', status: 'active', version: 1 }, { id: '00000000-0000-4000-8000-000000000021', name: 'Other', status: 'active', version: 1 }] } as never
  })
}
afterEach(() => vi.resetAllMocks())
it('uses only verified workspaces and filters Teacher scope', async () => {
  fixture()
  const access = await readPreparationAccess(church) as PreparationAccess
  expect(access?.ministries.map(item => item.id)).toEqual([ministry])
  expect(access?.actorId).toBe('11')
  expect(authRequest).toHaveBeenCalledWith('/api/me', 'GET', undefined, church)
})
it('allows Owner scope and reports a Teacher without assignments', async () => {
  fixture('owner', [])
  expect((await readPreparationAccess(church) as PreparationAccess).ministries).toHaveLength(2)
  fixture('teacher', [])
  expect((await readPreparationAccess(church) as PreparationAccess).ministries).toEqual([])
})
it('rejects an unverified church before tenant requests', async () => {
  fixture()
  await expect(readPreparationAccess('00000000-0000-4000-8000-000000000099')).rejects.toThrow()
  expect(authRequest).toHaveBeenCalledTimes(1)
})
it.each(['identity', 'membership', 'email', 'assurance'])('fails closed on changed %s', async kind => {
  fixture('owner')
  const original = vi.mocked(authRequest).getMockImplementation()!
  vi.mocked(authRequest).mockImplementation(async (...args) => {
    const value = await original(...args) as unknown as Record<string, unknown>
    if (args[0] === '/api/me') {
      if (kind === 'identity') value.id = 12
      if (kind === 'membership') value.memberships = []
      if (kind === 'email') value.email_verified = false
      if (kind === 'assurance') value.active_session = { mfa_confirmed: false }
    }
    return value as never
  })
  await expect(readPreparationAccess(church)).rejects.toThrow()
})
it('rejects unauthorized roster and bootstrap scope without reflecting protected payload', async () => {
  fixture()
  const access = await readPreparationAccess(church) as PreparationAccess
  expect(() => validatePreparationBootstrap(access, { actor: { id: '12' }, ministries: [], roster: [] } as never)).toThrow()
  expect(() => validatePreparationBootstrap(access, { actor: { id: '11' }, ministries: [{ id: ministry }], roster: [{ ministry_ids: ['foreign'] }] } as never)).toThrow()
})

it('fails closed when current-session assurance is unknown even for a Teacher', async () => {
  fixture('teacher')
  const original = vi.mocked(authRequest).getMockImplementation()!
  vi.mocked(authRequest).mockImplementation(async (...args) => {
    const value = await original(...args) as unknown as Record<string, unknown>
    if (args[0] === '/api/me') value.active_session = undefined
    return value as never
  })
  await expect(readPreparationAccess(church)).rejects.toThrow()
})
