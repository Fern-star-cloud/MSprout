// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'
import { authRequest } from './transport'
import { ApiError } from '../../api/client'

vi.mock('./transport', async original => ({ ...await original() as typeof import('./transport'), authRequest: vi.fn() }))
const church='00000000-0000-4000-8000-000000000010'
const session={id:11,email_verified:true,mfa_confirmed:true,workspaces:[{church_id:church,name:'Synthetic church',role:'owner'}]}
afterEach(()=>{cleanup();vi.resetAllMocks();history.replaceState(null,'','/')})

it('checks the addressable Account on reload and offers deliberate Home continuation',async()=>{
 history.replaceState(null,'',`/account?returnTo=${encodeURIComponent(`/account/home?church=${church}`)}`)
 vi.mocked(authRequest).mockResolvedValue(session)
 render(<AuthScreen initialPage="account" />)
 await screen.findByText('Email: Verified')
 expect(authRequest).toHaveBeenCalledWith('/auth/session')
 expect(screen.queryByRole('button',{name:'Sign in'})).toBeNull()
 expect(screen.getByRole('link',{name:'Continue to church Home'}).getAttribute('href')).toBe(`/account/home?church=${church}`)
 expect(location.pathname).toBe('/account')
})

it('does not assert verification before the session response or preserve it after invalidation',async()=>{
 let release!:(value:unknown)=>void
 vi.mocked(authRequest).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
 render(<AuthScreen initialPage="account" />)
 expect(screen.queryByText('Email: Verified')).toBeNull()
 await waitFor(()=>expect(release).toBeTypeOf('function'))
 await act(async()=>release(session))
 await screen.findByText('Email: Verified')
 vi.mocked(authRequest).mockRejectedValue({status:401})
 fireEvent(window,new CustomEvent('church-workspace-invalidated',{detail:{status:401}}))
 expect(screen.queryByText('Email: Verified')).toBeNull()
 await screen.findByRole('link',{name:'Sign in'})
})

it('hides a late Account response after going offline',async()=>{
 let release!:(value:unknown)=>void
 vi.mocked(authRequest).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
 render(<AuthScreen initialPage="account" />)
 await waitFor(()=>expect(release).toBeTypeOf('function'))
 await act(async()=>{fireEvent(window,new Event('offline'));release(session)})
 expect(screen.queryByText('Email: Verified')).toBeNull()
 expect(screen.queryByText('Synthetic church')).toBeNull()
})

it('reconciles an uncertain login through an explicit session check before another credential attempt',async()=>{
 vi.mocked(authRequest).mockRejectedValueOnce(new TypeError('synthetic network loss')).mockResolvedValue(session)
 const user=userEvent.setup();render(<AuthScreen initialPage="login" />)
 await user.type(screen.getByLabelText('Email'),'synthetic@example.test')
 await user.type(screen.getByLabelText('Password'),'Synthetic-password1!')
 await user.click(screen.getByRole('button',{name:'Sign in'}))
 await screen.findByRole('alert')
 expect(screen.getByRole('button',{name:'Sign in'}).hasAttribute('disabled')).toBe(true)
 await user.click(screen.getByRole('button',{name:'Continue signed-in session'}))
 await screen.findByText('Email: Verified')
 expect(vi.mocked(authRequest).mock.calls.filter(([path])=>path==='/login')).toHaveLength(1)
})

it('clears a recovery code after a rejected challenge',async()=>{
 vi.mocked(authRequest).mockRejectedValue({status:422})
 const user=userEvent.setup();render(<AuthScreen initialPage="challenge"/>)
 await user.click(screen.getByRole('button',{name:'Use a recovery code'}))
 await user.type(screen.getByLabelText('Recovery code'),'synthetic-recovery')
 await user.click(screen.getByRole('button',{name:'Verify sign-in'}));await screen.findByRole('alert')
 expect((screen.getByLabelText('Recovery code') as HTMLInputElement).value).toBe('')
})

it('separates confirmed MFA from new enrollment and directs explicit sign-in assurance renewal',async()=>{
 vi.mocked(authRequest).mockResolvedValue(session)
 render(<AuthScreen initialPage="mfa"/>)
 await screen.findByText(/Your authenticator is already confirmed/)
 expect(screen.queryByRole('button',{name:'Set up authenticator'})).toBeNull()
 expect(vi.mocked(authRequest).mock.calls.some(([,method])=>method==='POST')).toBe(false)
 expect(screen.getByRole('link',{name:'Open Account'})).toBeTruthy()
})

it('does not label an authoritative existing-session conflict as an uncertain login',async()=>{
 vi.mocked(authRequest).mockRejectedValue(new ApiError('already_authenticated','','',409))
 const user=userEvent.setup();render(<AuthScreen initialPage="login"/>)
 await user.type(screen.getByLabelText('Email'),'synthetic@example.test');await user.type(screen.getByLabelText('Password'),'Synthetic-password1!')
 await user.click(screen.getByRole('button',{name:'Sign in'}));await screen.findByRole('alert')
 expect(screen.queryByText(/The sign-in outcome is uncertain/)).toBeNull()
})

it('allows a verified applicant without membership to deliberately return to their application',async()=>{
 history.replaceState(null,'','/account?returnTo=%2Faccount%2Fapplication')
 vi.mocked(authRequest).mockResolvedValue({...session,workspaces:[]})
 render(<AuthScreen initialPage="account"/>)
 expect((await screen.findByRole('link',{name:'Continue to requested destination'})).getAttribute('href')).toBe('/account/application')
 expect(location.pathname).toBe('/account')
})

it('does not reveal a late authenticator setup key after account access is invalidated',async()=>{
 let release!:(value:unknown)=>void
 vi.mocked(authRequest).mockImplementation(async(path)=>{
  if(path==='/auth/session')return {...session,mfa_confirmed:false}
  if(path==='/user/two-factor-secret-key')return new Promise(resolve=>{release=resolve})
  return {}
 })
 const user=userEvent.setup();render(<AuthScreen initialPage="mfa"/>)
 await user.type(await screen.findByLabelText('Current password'),'Synthetic-password1!')
 await user.click(screen.getByRole('button',{name:'Set up authenticator'}))
 await waitFor(()=>expect(release).toBeTypeOf('function'))
 await act(async()=>{fireEvent(window,new CustomEvent('church-workspace-invalidated',{detail:{status:401}}));release({secretKey:'synthetic-setup-secret'})})
 await user.click(screen.getByRole('button',{name:'Check signed-in session'}))
 await screen.findByRole('button',{name:'Set up authenticator'})
 expect(screen.queryByText('synthetic-setup-secret')).toBeNull()
})

it('checks the session before repeating an authenticator challenge whose response was lost',async()=>{
 vi.mocked(authRequest).mockRejectedValueOnce(new TypeError('synthetic lost challenge response')).mockResolvedValue(session)
 const user=userEvent.setup();render(<AuthScreen initialPage="challenge"/>)
 await user.type(screen.getByLabelText('Authenticator code'),'123456')
 await user.click(screen.getByRole('button',{name:'Verify sign-in'}));await screen.findByRole('alert')
 expect(screen.getByRole('button',{name:'Verify sign-in'}).hasAttribute('disabled')).toBe(true)
 await user.click(screen.getByRole('button',{name:'Continue signed-in session'}))
 await screen.findByText('Email: Verified')
 expect(vi.mocked(authRequest).mock.calls.filter(([path])=>path==='/two-factor-challenge')).toHaveLength(1)
})

it('releases an uncertain login after authoritative session expiry invalidates the pending check',async()=>{
 vi.mocked(authRequest).mockImplementation(async path=>{
  if(path==='/auth/session'){window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status:401}}));throw {status:401}}
  throw new TypeError('synthetic lost login response')
 })
 const user=userEvent.setup();render(<AuthScreen initialPage="login"/>)
 await user.type(screen.getByLabelText('Email'),'synthetic@example.test');await user.type(screen.getByLabelText('Password'),'Synthetic-password1!')
 await user.click(screen.getByRole('button',{name:'Sign in'}));await screen.findByRole('alert')
 await user.click(screen.getByRole('button',{name:'Continue signed-in session'}))
 await waitFor(()=>expect(screen.getByRole('button',{name:'Sign in'}).hasAttribute('disabled')).toBe(false))
})
