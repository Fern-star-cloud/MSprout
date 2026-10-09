// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CaptchaChallenge } from './CaptchaChallenge'
afterEach(()=>{cleanup();delete window.turnstile;vi.unstubAllEnvs();vi.restoreAllMocks()})
it('uses the real widget action and revokes expired and failed proof',async()=>{
 vi.stubEnv('VITE_TURNSTILE_SITE_KEY','synthetic-public-site-key')
 let options!:Parameters<NonNullable<Window['turnstile']>['render']>[1]
 window.turnstile={render:vi.fn((_,value)=>{options=value;return 'synthetic-widget'}),remove:vi.fn()}
 const token=vi.fn();const view=render(<CaptchaChallenge onToken={token}/>)
 expect(screen.getByRole('group',{name:'Application verification'})).toBeTruthy()
 await act(async()=>{})
 expect(options.action).toBe('church_application')
 await act(async()=>options.callback('synthetic-proof'));expect(token).toHaveBeenLastCalledWith('synthetic-proof')
 await act(async()=>options['expired-callback']());expect(token).toHaveBeenLastCalledWith('')
 await act(async()=>options['error-callback']());expect(token).toHaveBeenLastCalledWith('')
 expect(screen.getByRole('alert')).toBeTruthy()
 view.unmount();expect(window.turnstile.remove).toHaveBeenCalledWith('synthetic-widget')
 options.callback('late-proof');expect(token).not.toHaveBeenLastCalledWith('late-proof')
})
it('fails closed without configuration',()=>{
 vi.stubEnv('VITE_TURNSTILE_SITE_KEY','');const token=vi.fn();render(<CaptchaChallenge onToken={token}/>)
 expect(screen.getByRole('alert')).toBeTruthy();expect(token).not.toHaveBeenCalled()
})
it('revokes a token when the widget fails during render',async()=>{
 vi.stubEnv('VITE_TURNSTILE_SITE_KEY','synthetic-public-site-key')
 window.turnstile={render:(_,options)=>{options.callback('synthetic-proof');throw new Error('synthetic failure')},remove:vi.fn()}
 const token=vi.fn();render(<CaptchaChallenge onToken={token}/>);await screen.findByRole('alert')
 expect(token).toHaveBeenLastCalledWith('')
})
