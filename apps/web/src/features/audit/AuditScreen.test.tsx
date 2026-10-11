// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuditScreen } from './AuditScreen'
import { authRequest } from '../auth/transport'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn(), safeAuthMessage: () => 'Access unavailable.' }))
const request = vi.mocked(authRequest)
const church = '12345678-1234-4234-8234-123456789012'
const event = { id: '00000000-0000-4000-8000-000000000020', category:'church', actor_type:'user',actor_id:'11',target_type:'system',target_id:null, action: 'teacher.invited', result: 'success', occurred_at: '2026-09-22T00:00:00Z', correlation_id: '00000000-0000-4000-8000-000000000030' }
beforeEach(() => {
  history.replaceState(null, '', '/account/audit?church=' + church)
  request.mockImplementation(async (path) => path === '/api/me'
    ? { id:11,email_verified:true,memberships: [{ role: 'owner', status: 'active', church_id: church }], active_session: { mfa_confirmed: true } }
    : { data: [event], scope: 'church', page: 1, per_page: 25, has_more: true })
})
afterEach(() => { cleanup(); vi.resetAllMocks(); history.replaceState(null, '', '/') })

it('shows safe event projections and requests server pages for the active church', async () => {
  render(<AuditScreen />)
  await screen.findByText('Teacher invited')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/audit-events?page=2&per_page=25', 'GET', undefined, church))
})

it('does not expose an Owner audit view without current MFA', async () => {
  request.mockResolvedValue({ id:11,email_verified:true,memberships: [{ role: 'owner', status: 'active', church_id: church }], active_session: { mfa_confirmed: false } })
  render(<AuditScreen />)
  await screen.findByText('Access unavailable.')
  expect(request).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
})

it('shows Teachers only their activity view', async () => {
  request.mockImplementation(async (path) => path === '/api/me'
    ? { id:11,email_verified:true,memberships: [{ role: 'teacher', status: 'active', church_id: church }] }
    : { data: [], scope: 'own', page: 1, per_page: 25, has_more: false })
  render(<AuditScreen />)
  await screen.findByRole('heading', { name: 'My activity' })
  expect(screen.queryByText('Church audit')).toBeNull()
})

it('clears events and pagination when the server denies a later page', async () => {
  render(<AuditScreen />)
  await screen.findByText('Teacher invited')
  request.mockRejectedValue({ status: 403 })
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Access unavailable.')
  expect(screen.queryByText('Teacher invited')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
})

it('requires the separate platform session and uses only the platform endpoint', async () => {
  request.mockImplementation(async (path) => path === '/platform/me' ? { handle: 'sage.dev', online_only: true } : { data: [], scope: 'platform', page: 1, per_page: 25, has_more: false })
  render(<AuditScreen platform />)
  await screen.findByRole('heading', { name: 'Platform audit' })
  expect(request.mock.calls.every(([path]) => path.startsWith('/platform/'))).toBe(true)
})

it('suppresses a late page after expiration and never renders extra audit metadata',async()=>{
  render(<AuditScreen />);await screen.findByText('Teacher invited')
  let finish!:(value:unknown)=>void
  request.mockImplementation(async path=>path==='/api/me'?{id:11,email_verified:true,memberships:[{role:'owner',status:'active',church_id:church}],active_session:{mfa_confirmed:true}}:await new Promise(resolve=>{finish=resolve}))
  await userEvent.click(screen.getByRole('button',{name:'Next'}));await waitFor(()=>expect(finish).toBeTruthy())
  window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status:401}}))
  finish({data:[{...event,metadata_json:{student_name:'Forbidden synthetic detail'}}],scope:'church',page:2,per_page:25,has_more:false})
  await screen.findByRole('alert');expect(screen.queryByText('Teacher invited')).toBeNull();expect(document.body.textContent).not.toContain('Forbidden synthetic detail')
})

it('rejects competing actor events in the Teacher own scope',async()=>{
  request.mockImplementation(async path=>path==='/api/me'?{id:11,email_verified:true,memberships:[{role:'teacher',status:'active',church_id:church}]}:{data:[{...event,action:'sync.accepted',actor_id:'22'}],scope:'own',page:1,per_page:25,has_more:false})
  render(<AuditScreen />);await screen.findByRole('alert');expect(screen.queryByText('Sync accepted')).toBeNull()
})
