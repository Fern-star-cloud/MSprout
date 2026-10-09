// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ApplicationScreen } from './ApplicationScreen'
import { authRequest } from '../auth/transport'
import { ApiError } from '../../api/client'

vi.mock('../auth/transport',async original=>({...await original() as typeof import('../auth/transport'),authRequest:vi.fn()}))
vi.mock('./CaptchaChallenge',()=>({CaptchaChallenge:({onToken}:{onToken:(token:string)=>void})=><button type="button" onClick={()=>onToken('synthetic-proof')}>Complete verification</button>}))
const church='00000000-0000-4000-8000-000000000010'
const session={id:11,email_verified:true,mfa_confirmed:true,workspaces:[{church_id:church,name:'Synthetic church',role:'owner'}]}
const pending={id:'application',status:'pending',church_name:'Synthetic church'}
afterEach(()=>{cleanup();vi.resetAllMocks();history.replaceState(null,'','/')})
async function fill(){const user=userEvent.setup();await user.type(await screen.findByLabelText('Church name'),'Synthetic church');await user.type(screen.getByLabelText('City'),'Synthetic city');await user.click(screen.getByRole('button',{name:'Complete verification'}));return user}

it('retains non-secret inputs across field rejection and a status refresh',async()=>{
 vi.mocked(authRequest).mockImplementation(async(path,method)=>path==='/auth/session'?session:method==='POST'?Promise.reject(new ApiError('validation_failed','unsafe server text','',422,{city:['unsafe text']})):{application:null})
 render(<ApplicationScreen/>);const user=await fill();await user.click(screen.getByRole('button',{name:'Submit application'}))
 const alert=await screen.findByRole('alert');expect(alert.textContent).not.toMatch(/unsafe/)
 expect(screen.getByLabelText('City').getAttribute('aria-invalid')).toBe('true')
 await user.click(screen.getByRole('button',{name:'Refresh status'}))
 await waitFor(()=>expect((screen.getByLabelText('Church name') as HTMLInputElement).value).toBe('Synthetic church'))
 expect((screen.getByLabelText('City') as HTMLInputElement).value).toBe('Synthetic city')
})

it('blocks repeat submission after uncertain transport and discovers the accepted application',async()=>{
 let accepted=false
 vi.mocked(authRequest).mockImplementation(async(path,method)=>{
  if(path==='/auth/session')return session
  if(method==='POST'){accepted=true;throw new TypeError('synthetic lost response')}
  if(accepted)throw new Error('synthetic unavailable reconciliation')
  return {application:null}
 })
 render(<ApplicationScreen/>);const user=await fill();await user.click(screen.getByRole('button',{name:'Submit application'}));await screen.findByRole('alert')
 await user.click(screen.getByRole('button',{name:'Complete verification'}))
 expect(screen.getByRole('button',{name:'Submit application'}).hasAttribute('disabled')).toBe(true)
 vi.mocked(authRequest).mockImplementation(async path=>path==='/auth/session'?session:{application:pending})
 await user.click(screen.getByRole('button',{name:'Check submission outcome'}))
 await screen.findByRole('heading',{name:'Pending review'})
 expect(vi.mocked(authRequest).mock.calls.filter(([,method])=>method==='POST')).toHaveLength(1)
})

it('does not show an empty form when authoritative current-state retrieval fails',async()=>{
 vi.mocked(authRequest).mockImplementation(async path=>path==='/auth/session'?session:Promise.reject({status:503}))
 render(<ApplicationScreen/>);await screen.findByRole('alert');expect(screen.queryByLabelText('Church name')).toBeNull()
})

it('continues an approved applicant to verified Home with assurance still enforced there',async()=>{
 vi.mocked(authRequest).mockImplementation(async path=>path==='/auth/session'?session:{application:{...pending,status:'approved',church_id:church}})
 render(<ApplicationScreen/>);expect((await screen.findByRole('link',{name:'Continue to church Home'})).getAttribute('href')).toBe(`/account/home?church=${church}`)
 expect(screen.queryByRole('link',{name:'Manage Teachers'})).toBeNull()
})

it('clears application presentation on invalidation and discards a late status response',async()=>{
 let release!:(value:unknown)=>void
 vi.mocked(authRequest).mockImplementation(async path=>path==='/auth/session'?session:new Promise(resolve=>{release=resolve}))
 render(<ApplicationScreen/>);await waitFor(()=>expect(release).toBeTypeOf('function'))
 await act(async()=>{fireEvent(window,new CustomEvent('church-workspace-invalidated',{detail:{status:401}}));release({application:pending})})
 expect(screen.queryByText('Synthetic church')).toBeNull()
 expect(screen.queryByLabelText('Church name')).toBeNull()
})

it('requires a successful current-state read before retrying the same retained application',async()=>{
 let reads=0
 vi.mocked(authRequest).mockImplementation(async(path,method)=>{
  if(path==='/auth/session')return session
  if(method==='POST')throw new TypeError('synthetic uncertain response')
  if(++reads===2)throw new Error('synthetic unavailable current state')
  return {application:null}
 })
 render(<ApplicationScreen/>);const user=await fill();await user.click(screen.getByRole('button',{name:'Submit application'}));await screen.findByRole('alert')
 await user.click(screen.getByRole('button',{name:'Check submission outcome'}));await screen.findByRole('alert')
 expect(screen.queryByLabelText('Church name')).toBeNull()
 await user.click(screen.getByRole('button',{name:'Check submission outcome'}))
 expect((await screen.findByLabelText('Church name') as HTMLInputElement).value).toBe('Synthetic church')
 expect(screen.getByRole('button',{name:'Submit application'}).hasAttribute('disabled')).toBe(true)
 await user.click(screen.getByRole('button',{name:'Complete verification'}))
 expect(screen.getByRole('button',{name:'Submit application'}).hasAttribute('disabled')).toBe(false)
 expect(vi.mocked(authRequest).mock.calls.filter(([,method])=>method==='POST')).toHaveLength(1)
})

it('does not transfer retained application inputs to another signed-in actor',async()=>{
 let actorId=11
 vi.mocked(authRequest).mockImplementation(async path=>path==='/auth/session'?{...session,id:actorId}:{application:null})
 render(<ApplicationScreen/>);const user=await fill();actorId=22
 await user.click(screen.getByRole('button',{name:'Refresh status'}))
 expect((await screen.findByLabelText('Church name') as HTMLInputElement).value).toBe('')
 expect((screen.getByLabelText('City') as HTMLInputElement).value).toBe('')
})
