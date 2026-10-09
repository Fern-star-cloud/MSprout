// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { authRequest } from '../features/auth/transport'
import { profileStore } from '../offline/profile-store'

vi.mock('../features/auth/transport', async importOriginal => {
  const actual = await importOriginal() as typeof import('../features/auth/transport')
  return { ...actual, authRequest: vi.fn() }
})
const church = '11111111-1111-4111-8111-111111111111'
let role: 'owner' | 'teacher'
beforeEach(() => {
  role = 'owner'
  vi.mocked(authRequest).mockImplementation(async path => {
    if (path === '/auth/session') return {id:7,email_verified:true,workspaces:[{church_id:church,name:'Verified church',role}]} as never
    if (path === '/api/me') return {id:7,memberships:[{church_id:church,status:'active',role}],active_session:{mfa_confirmed:true},assignments:{ministry_ids:['assigned']}} as never
    if (path === '/api/ministries') return {data:[{id:'assigned',name:'Assigned ministry',status:'active'},{id:'unassigned',name:'Unassigned ministry',status:'active'}]} as never
    return {data:[]} as never
  })
  vi.spyOn(profileStore,'activeProfile').mockResolvedValue(null)
})
afterEach(() => {cleanup();vi.restoreAllMocks();vi.clearAllMocks();history.replaceState(null,'','/')})

it('Home presents a verified church and supported actions without invented metrics', async () => {
  history.replaceState(null,'','/account/home')
  render(<App />)
  await screen.findByRole('heading',{name:'Home'})
  expect(screen.getByText('Verified church')).toBeTruthy()
  expect(screen.getAllByRole('link',{name:'Take attendance'})[0].getAttribute('href')).toContain('/account/attendance')
  expect(screen.getByRole('heading',{name:'Prepare your ministry'})).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/\d+ changes waiting|attendance rate/i)
})

it('Teacher Home and navigation expose only assignment-scoped destinations', async () => {
  role='teacher';history.replaceState(null,'','/account/home')
  render(<App />)
  await screen.findByText('Assigned ministry')
  expect(screen.queryByText('Unassigned ministry')).toBeNull()
  const phone=within(screen.getByRole('navigation',{name:'Phone navigation'}))
  expect(phone.getAllByRole('link').map(link=>link.textContent)).toEqual(['Home','Attendance','Sync','More'])
  expect(screen.queryByRole('link',{name:'Teachers'})).toBeNull()
  expect(screen.queryByRole('link',{name:'Import'})).toBeNull()
})

it('keeps Attendance visible while optional online navigation assurance fails', async () => {
  vi.mocked(authRequest).mockRejectedValue({status:401})
  history.replaceState(null,'','/account/attendance')
  render(<App />)
  await screen.findByRole('heading',{name:'Take attendance'})
  await waitFor(()=>expect(screen.queryByRole('link',{name:'People'})).toBeNull())
  expect(screen.queryByText('Verified church')).toBeNull()
})

it('does not query a web session or infer a role for offline Attendance', async () => {
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false)
  history.replaceState(null,'','/attendance')
  render(<App />)
  await screen.findByRole('heading',{name:'Take attendance'})
  expect(authRequest).not.toHaveBeenCalled()
  expect(screen.queryByText('Owner',{exact:true})).toBeNull()
  expect(screen.queryByText('Teacher',{exact:true})).toBeNull()
})

it('does not publish an Owner identity or management navigation before scoped validation', async () => {
  let resolve!: (value: never) => void
  const implementation=vi.mocked(authRequest).getMockImplementation()!
  vi.mocked(authRequest).mockImplementation((...args)=>args[0]==='/api/me' ? new Promise(done=>{resolve=done}) : implementation(...args))
  history.replaceState(null,'','/account/home');render(<App />)
  await waitFor(()=>expect(authRequest).toHaveBeenCalledWith('/api/me','GET',undefined,church))
  expect(screen.queryByText('Verified church')).toBeNull()
  expect(screen.queryByRole('link',{name:'Teachers'})).toBeNull()
  resolve({id:7,memberships:[{church_id:church,status:'active',role}],active_session:{mfa_confirmed:true}} as never)
  await screen.findByRole('heading',{name:'Home'})
  expect(screen.getByText('Verified church')).toBeTruthy()
})

it('updates online role navigation without remounting independently authorized Attendance', async () => {
  history.replaceState(null,'','/account/attendance');render(<App />)
  await screen.findByRole('link',{name:'Choose a device profile'})
  const heading=screen.getByRole('heading',{name:'Take attendance'})
  await screen.findByText('Owner',{exact:true})
  role='teacher';fireEvent.focus(window)
  await screen.findByText('Teacher',{exact:true})
  expect(screen.getByRole('heading',{name:'Take attendance'})).toBe(heading)
  expect(screen.queryByRole('link',{name:'Teachers'})).toBeNull()
})

it('shows unavailable Teacher Home data distinctly from an empty assignment list', async () => {
  role='teacher';const implementation=vi.mocked(authRequest).getMockImplementation()!
  vi.mocked(authRequest).mockImplementation((...args)=>args[0]==='/api/ministries' ? Promise.reject(new Error('unavailable')) : implementation(...args))
  history.replaceState(null,'','/account/home');render(<App />)
  await screen.findByText(/Assigned ministries are unavailable/)
  expect(screen.queryByText('No assigned ministries available')).toBeNull()
})

it('clears the prior multi-church presentation immediately when the URL selection is removed', async () => {
  const implementation=vi.mocked(authRequest).getMockImplementation()!
  const workspaces=[{church_id:church,name:'Verified church',role},{church_id:'22222222-2222-4222-8222-222222222222',name:'Other church',role}]
  vi.mocked(authRequest).mockImplementation((...args)=>args[0]==='/auth/session' ? Promise.resolve({id:7,email_verified:true,workspaces} as never) : implementation(...args))
  history.replaceState(null,'',`/account/home?church=${church}`);render(<App />)
  await screen.findByRole('heading',{name:'Home'})
  let complete!: (value: never) => void
  vi.mocked(authRequest).mockImplementation((...args)=>args[0]==='/auth/session' ? new Promise(done=>{complete=done}) : implementation(...args))
  history.pushState(null,'','/account/home');fireEvent(window,new PopStateEvent('popstate'))
  expect(screen.queryByRole('heading',{name:'Home'})).toBeNull()
  expect(screen.queryByText('Verified church',{selector:'.workspace-identity > span'})).toBeNull()
  expect(screen.queryByRole('link',{name:'Teachers'})).toBeNull()
  complete({id:7,email_verified:true,workspaces} as never)
  await screen.findByText('Choose an authorized church workspace to continue.')
})

it('unknown suffixes show an explicit unavailable page rather than a module or sign-in form', async () => {
  history.replaceState(null,'','/unexpected/students')
  render(<App />)
  expect(await screen.findByRole('heading',{name:'Page not found'})).toBeTruthy()
  expect(authRequest).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading',{name:'Students'})).toBeNull()
})

it('More reaches Account and Sync and native modified clicks remain untouched', async () => {
  history.replaceState(null,'','/account/more')
  render(<App />)
  await screen.findByRole('heading',{name:'More'})
  const main=within(screen.getByRole('main'))
  expect(main.getByRole('link',{name:'Account'}).getAttribute('href')).toContain('/account')
  const sync=main.getByRole('link',{name:'Sync & device'})
  let prevented=true
  const observe=(event:Event)=>{prevented=event.defaultPrevented;event.preventDefault()}
  window.addEventListener('click',observe)
  fireEvent.click(sync,{ctrlKey:true})
  window.removeEventListener('click',observe)
  expect(prevented).toBe(false)
  expect(location.pathname).toBe('/account/more')
  fireEvent.click(sync)
  await screen.findByRole('heading',{name:'Sync & device'})
  expect(location.pathname).toBe('/account/sync')
  history.replaceState(null,'','/account/more');fireEvent(window,new PopStateEvent('popstate'))
  await screen.findByRole('heading',{name:'More'})
})
