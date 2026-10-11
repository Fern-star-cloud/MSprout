// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { ConflictReviewScreen } from './ConflictReviewScreen'
vi.mock('../auth/transport',()=>({authRequest:vi.fn(),safeAuthMessage:()=> 'Unable to load review items.'}))
const church='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000080',other='00000000-0000-4000-8000-000000000081'
const me={id:10,email_verified:true,memberships:[{church_id:church,status:'active',role:'owner'}],active_session:{mfa_confirmed:true}}
const side={value:{state:'present'},actor_id:10,device_id:id,local_time:'2026-09-29T01:00:00Z',server_time:'2026-09-29T01:01:00Z',correlation_id:id}
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}})
afterEach(()=>{cleanup();vi.resetAllMocks()})
it('shows Owner evidence side by side and submits only the bounded reason and actual choice',async()=>{
 const conflict={id,session_id:id,record_id:id,field:'state',base_version:3,status:'open',existing:side,incoming:{...side,value:{state:'absent'},actor_id:11,device_id:other,local_time:'2026-09-29T01:02:00Z',server_time:'2026-09-29T01:03:00Z'}}
 vi.mocked(authRequest).mockImplementation(async(path,method)=>{if(path==='/api/me')return me;if(method==='POST')return{id,status:'resolved',effective_state:'absent',revision_id:other,version:4};if(path===`/api/sync-conflicts/${id}`)return conflict;return{data:path==='/api/sync-conflicts'?[conflict]:[]}})
 const user=userEvent.setup();render(<ConflictReviewScreen initialChurchId={church}/>);await user.click(await screen.findByRole('button',{name:'Review attendance conflict'}))
 const incoming=screen.getByRole('region',{name:'Incoming value attendance value'});await user.click(within(incoming).getByText('Supported provenance'))
 expect(screen.getByText('11')).toBeTruthy();expect(screen.getByText(other)).toBeTruthy();expect(screen.getByText('2026-09-29T01:02:00Z')).toBeTruthy();expect(screen.getByText('2026-09-29T01:03:00Z')).toBeTruthy()
 await user.click(screen.getByRole('radio',{name:'Incoming value · Absent'}));await user.type(screen.getByLabelText('Resolution reason'),'Confirmed against the signed paper roster.');await user.click(screen.getByRole('button',{name:'Review decision'}));await user.click(screen.getByRole('button',{name:'Confirm resolution'}))
 await waitFor(()=>expect(authRequest).toHaveBeenCalledWith(`/api/sync-conflicts/${id}/resolve`,'POST',{choice:'incoming',reason:'Confirmed against the signed paper roster.'},church));expect(await screen.findByText('No attendance conflicts need review.')).toBeTruthy()
})
it('shows Teachers only the Needs Owner Review status without evidence details',async()=>{
 vi.mocked(authRequest).mockImplementation(async path=>path==='/api/me'?{...me,memberships:[{...me.memberships[0],role:'teacher'}],active_session:{mfa_confirmed:false}}:{needs_owner_review:true})
 render(<ConflictReviewScreen initialChurchId={church}/>);expect(await screen.findByText('Needs Owner Review')).toBeTruthy();expect(screen.queryByText(/Device/)).toBeNull();expect(screen.queryByLabelText('Resolution reason')).toBeNull()
})
it('lets an Owner explicitly promote a pending guest without guardian details',async()=>{
 const guest={id,session_id:other,display_name:'Guest Child',gender:'female',actor_id:10,device_id:other,local_time:side.local_time,server_time:side.server_time}
 vi.mocked(authRequest).mockImplementation(async(path,method)=>{if(path==='/api/me')return me;if(method==='POST')return{id,status:'promoted',student_id:other,merged_into_guest_id:null,version:2};return{data:path==='/api/attendance-guests'?[guest]:[]}})
 const user=userEvent.setup();render(<ConflictReviewScreen initialChurchId={church}/>);await user.click(await screen.findByRole('tab',{name:/Temporary guests/}));await user.click(screen.getByRole('button',{name:'Review Guest Child'}));await user.selectOptions(screen.getByLabelText('Guest action'),'promote')
 expect(screen.queryByLabelText(/guardian/i)).toBeNull();const form=screen.getByRole('form',{name:'Promote Guest Child'});await user.type(within(form).getByLabelText('First name'),'Guest');await user.type(within(form).getByLabelText('Last name'),'Child');await user.click(screen.getByRole('button',{name:'Review guest action'}));await user.click(screen.getByRole('button',{name:'Confirm guest action'}))
 await waitFor(()=>expect(authRequest).toHaveBeenCalledWith(`/api/attendance-guests/${id}/promote`,'POST',{first_name:'Guest',last_name:'Child',gender:'female'},church))
})
