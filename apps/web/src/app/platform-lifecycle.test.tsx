// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AppRouter } from './router'
import { authRequest } from '../features/auth/transport'
import { ApiError } from '../api/client'

vi.mock('../features/auth/transport',async original=>({...await original() as typeof import('../features/auth/transport'),authRequest:vi.fn()}))
const session={handle:'sage.dev',online_only:true}
const application={id:'00000000-0000-4000-8000-000000000060',church_name:'Synthetic application',city:'Synthetic city',status:'pending'}
const health={status:'healthy',checked_at:'2026-10-10T00:00:00Z',api:{status:'ok'},database:{status:'ok',size_bytes:2048,growth_bytes_24h:0},queue:{status:'ok',pending_count:42,failed_24h:0,oldest_age_seconds:0},scheduler:{status:'ok',last_run_at:null},birthdays:{status:'ok',failed_24h:0,last_dispatch_at:null},synchronization:{events_24h:0,rejected_24h:0,open_conflicts:0,error_rate:0}}
function open(path='/account/platform-applications'){history.replaceState(null,'',path);return render(<AppRouter/>)}
function defaults(){vi.mocked(authRequest).mockImplementation(async path=>path==='/platform/me'?session:path.startsWith('/platform/applications')?{data:[application],has_more:false}:path==='/platform/system-health'?health:{scope:'platform',data:[],has_more:false})}
afterEach(()=>{cleanup();vi.resetAllMocks();vi.restoreAllMocks();history.replaceState(null,'','/')})

it('checks platform assurance before displaying navigation or requesting a protected destination',async()=>{
 let release!:(value:unknown)=>void
 vi.mocked(authRequest).mockImplementation(path=>path==='/platform/me'?new Promise(resolve=>{release=resolve}):Promise.resolve({data:[application]}))
 open();await waitFor(()=>expect(release).toBeTypeOf('function'))
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 expect(vi.mocked(authRequest).mock.calls.map(([path])=>path)).toEqual(['/platform/me'])
 await act(async()=>release(session));await screen.findByText('Synthetic application')
 expect(screen.getByRole('navigation',{name:'Platform navigation'})).toBeTruthy()
 expect(screen.getAllByRole('link',{name:'Account'}).length).toBeGreaterThan(0)
 expect(vi.mocked(authRequest).mock.calls.every(([path,,,church])=>path.startsWith('/platform/')&&!church)).toBe(true)
})

it.each([401,403,419])('hides platform navigation and data after initial HTTP %s denial',async status=>{
 vi.mocked(authRequest).mockRejectedValue(new ApiError('denied','untrusted private text','',status))
 open();await screen.findByRole('alert')
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 expect(screen.queryByText('Synthetic application')).toBeNull()
 expect(vi.mocked(authRequest).mock.calls.every(([path])=>path==='/platform/me')).toBe(true)
 expect(document.body.textContent).not.toContain('untrusted private text')
})

it.each([{handle:'church-owner',online_only:true},{handle:'sage.dev',online_only:false},{id:11,email_verified:true,mfa_confirmed:true,workspaces:[]}])('refuses malformed or church session projection',async value=>{
 vi.mocked(authRequest).mockResolvedValue(value);open();await screen.findByRole('alert')
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 expect(vi.mocked(authRequest).mock.calls.every(([path])=>path==='/platform/me')).toBe(true)
})

it('reloads Platform Account through the existing platform-login destination without resubmitting credentials',async()=>{
 defaults();open('/account/platform-login')
 await screen.findByText('Signed in as sage.dev')
 expect(screen.queryByLabelText('Handle')).toBeNull()
 expect(screen.getByRole('button',{name:'Sign out of platform'})).toBeTruthy()
 expect(screen.getByRole('link',{name:'Open Applications'}).getAttribute('href')).toBe('/account/platform-applications')
 expect(vi.mocked(authRequest).mock.calls.map(([path])=>path)).toEqual(['/platform/me'])
})

it('clears navigation immediately on route transition and ignores a late resource response',async()=>{
 defaults();let release!:(value:unknown)=>void
 const base=vi.mocked(authRequest).getMockImplementation()!
 vi.mocked(authRequest).mockImplementation((...args)=>args[0]==='/platform/system-health'?new Promise(resolve=>{release=resolve}):base(...args))
 open('/account/platform-system-health');await waitFor(()=>expect(release).toBeTypeOf('function'))
 vi.mocked(authRequest).mockImplementation(()=>new Promise(()=>{}))
 fireEvent.click(within(screen.getByRole('navigation',{name:'Platform navigation'})).getByRole('link',{name:'Applications'}))
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 await act(async()=>release(health));expect(screen.queryByText(/42 pending/)).toBeNull()
})

it('clears protected presentation while renewing the session on focus and reports expiry',async()=>{
 defaults();open();await screen.findByText('Synthetic application')
 let reject!:(value:unknown)=>void
 vi.mocked(authRequest).mockImplementation(()=>new Promise((_,fail)=>{reject=fail}))
 fireEvent(window,new Event('focus'))
 expect(screen.queryByText('Synthetic application')).toBeNull()
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 await act(async()=>reject(new ApiError('expired','','',401)))
 expect((await screen.findByRole('alert')).textContent).toMatch(/expired/i)
})

it('clears protected state before logout completes and ignores a pending health response',async()=>{
 defaults();let healthRelease!:(value:unknown)=>void,logoutRelease!:(value:unknown)=>void
 const base=vi.mocked(authRequest).getMockImplementation()!
 vi.mocked(authRequest).mockImplementation((...args)=>args[0]==='/platform/system-health'?new Promise(resolve=>{healthRelease=resolve}):args[0]==='/platform/logout'?new Promise(resolve=>{logoutRelease=resolve}):base(...args))
 open('/account/platform-system-health');await waitFor(()=>expect(healthRelease).toBeTypeOf('function'))
 fireEvent.click(screen.getByRole('button',{name:'Sign out of platform'}))
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 await act(async()=>{healthRelease(health);logoutRelease(undefined)})
 expect(screen.queryByText(/42 pending/)).toBeNull()
 await screen.findByText(/signed out of platform/i)
 expect(vi.mocked(authRequest).mock.calls.some(([path])=>path==='/logout')).toBe(false)
})

it('keeps navigation hidden when sign-out cannot be confirmed',async()=>{
 defaults();open();await screen.findByText('Synthetic application')
 vi.mocked(authRequest).mockRejectedValue(new TypeError('synthetic lost logout response'))
 fireEvent.click(screen.getByRole('button',{name:'Sign out of platform'}))
 expect((await screen.findByRole('alert')).textContent).toMatch(/could not be confirmed/i)
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 expect(screen.queryByText('Synthetic application')).toBeNull()
})

it('separates church invalidation from platform invalidation',async()=>{
 defaults();open();await screen.findByText('Synthetic application')
 fireEvent(window,new CustomEvent('church-workspace-invalidated',{detail:{status:401}}))
 expect(screen.getByText('Synthetic application')).toBeTruthy()
 fireEvent(window,new CustomEvent('platform-session-invalidated',{detail:{status:401}}))
 expect(screen.queryByText('Synthetic application')).toBeNull()
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
})

it('makes offline platform presentation generic and verifies again before reconnecting',async()=>{
 defaults();open();await screen.findByText('Synthetic application')
 fireEvent(window,new Event('offline'))
 expect(screen.queryByText('Synthetic application')).toBeNull()
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 expect(screen.queryByText('sage.dev')).toBeNull()
 vi.mocked(authRequest).mockImplementation(()=>new Promise(()=>{}))
 fireEvent(window,new Event('online'))
 expect(screen.queryByText('Synthetic application')).toBeNull()
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
})

it('discards an old session response after offline and a new context check',async()=>{
 let release!:(value:unknown)=>void
 vi.mocked(authRequest).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve})).mockImplementation(()=>new Promise(()=>{}))
 open();await waitFor(()=>expect(release).toBeTypeOf('function'))
 fireEvent(window,new Event('offline'));fireEvent(window,new Event('online'))
 await act(async()=>release(session))
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
 expect(vi.mocked(authRequest).mock.calls.every(([path])=>path==='/platform/me')).toBe(true)
})

it('keeps a renewed verified session after a repeated online notification',async()=>{
 defaults();open();await screen.findByText('Synthetic application')
 fireEvent(window,new Event('offline'));fireEvent(window,new Event('online'))
 await screen.findByText('Synthetic application')
 fireEvent(window,new Event('online'))
 await waitFor(()=>expect(screen.getByText('Synthetic application')).toBeTruthy())
 expect(screen.getByRole('navigation',{name:'Platform navigation'})).toBeTruthy()
})

it('performs no platform request when loaded offline',async()=>{
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);open()
 await screen.findByText(/Protected platform information is unavailable offline/)
 expect(authRequest).not.toHaveBeenCalled()
 expect(screen.queryByRole('navigation',{name:'Platform navigation'})).toBeNull()
})
