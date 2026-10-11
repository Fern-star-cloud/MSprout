// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { authRequest } from '../auth/transport'
import { ConflictReviewScreen } from './ConflictReviewScreen'
vi.mock('../auth/transport', () => ({ authRequest: vi.fn(), safeAuthMessage: () => 'Unable to complete the request.' }))
const church='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000080',guestId='00000000-0000-4000-8000-000000000090',studentId='00000000-0000-4000-8000-000000000091',otherGuest='00000000-0000-4000-8000-000000000092'
const me={id:10,email_verified:true,memberships:[{church_id:church,status:'active',role:'owner'}],active_session:{mfa_confirmed:true}}
const side={value:{state:'present'},actor_id:10,device_id:id,local_time:'2026-09-29T01:00:00Z',server_time:'2026-09-29T01:01:00Z',correlation_id:id}
const conflict={id,session_id:id,record_id:id,field:'state',base_version:3,status:'open',existing:side,incoming:{...side,actor_id:11,value:{state:'absent'}}}
const guest={id:guestId,session_id:id,display_name:'Guest Child',gender:'female',actor_id:10,device_id:id,local_time:side.local_time,server_time:side.server_time}
let conflictRows:unknown[],guestRows:unknown[],currentMe:typeof me,post:(path:string,body?:Record<string,unknown>)=>Promise<unknown>
beforeEach(()=>{
 conflictRows=[structuredClone(conflict)];guestRows=[];currentMe=structuredClone(me)
 post=async path=>{
  if(path.includes('sync-conflicts')){conflictRows=[];return{id,status:'resolved',effective_state:'absent',revision_id:id,version:4}}
  guestRows=guestRows.filter(row=>(row as typeof guest).id!==guestId);const action=path.split('/').pop()
  return{id:guestId,status:action==='promote'?'promoted':action==='link'?'linked':'merged',student_id:action==='merge'?null:studentId,merged_into_guest_id:action==='merge'?otherGuest:null,version:4}
 }
 vi.mocked(authRequest).mockImplementation(async(path,method,body)=>{
  if(method==='POST')return post(path,body)
  if(path==='/api/me')return currentMe
  if(path==='/api/sync-conflicts')return{data:conflictRows}
  if(path.startsWith('/api/sync-conflicts/'))return conflictRows[0]??{...conflict,status:'resolved'}
  if(path==='/api/attendance-guests')return{data:guestRows}
  if(path==='/api/students')return{data:[{id:studentId,display_name:'Known Student',status:'active'}]}
  throw Error('Unsupported fixture path '+path)
 })
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
})
afterEach(()=>{cleanup();vi.resetAllMocks()})
const writes=()=>vi.mocked(authRequest).mock.calls.filter(call=>call[1]==='POST')
async function start(){render(<ConflictReviewScreen initialChurchId={church}/>);await screen.findByRole('button',{name:'Review attendance conflict'});return userEvent.setup()}
async function openConflict(user:ReturnType<typeof userEvent.setup>){await user.click(screen.getByRole('button',{name:'Review attendance conflict'}));await screen.findByRole('radio',{name:'Incoming value · Absent'})}
async function decide(user:ReturnType<typeof userEvent.setup>){await openConflict(user);await user.click(screen.getByRole('radio',{name:'Incoming value · Absent'}));await user.type(screen.getByLabelText('Resolution reason'),'Verified roster.');await user.click(screen.getByRole('button',{name:'Review decision'}))}
async function guestAction(user:ReturnType<typeof userEvent.setup>,action:string){await user.click(screen.getByRole('tab',{name:/Temporary guests/}));await user.click(screen.getByRole('button',{name:'Review Guest Child'}));expect(screen.queryByLabelText('First name')).toBeNull();await user.selectOptions(screen.getByLabelText('Guest action'),action);if(action==='promote'){await user.type(screen.getByLabelText('First name'),'Guest');await user.type(screen.getByLabelText('Last name'),'Child');expect(screen.queryByLabelText('Student')).toBeNull()}else{expect(screen.queryByLabelText('First name')).toBeNull();await user.selectOptions(screen.getByLabelText(action==='link'?'Student':'Canonical guest'),action==='link'?studentId:otherGuest)}await user.click(screen.getByRole('button',{name:'Review guest action'}))}
it('verifies access first, starts with no choice and requires confirmation with cancel/focus return',async()=>{
 const user=await start();expect(vi.mocked(authRequest).mock.calls[0]).toEqual(['/api/me','GET',undefined,church]);await openConflict(user)
 for(const name of ['Existing value · Present','Incoming value · Absent'])expect((screen.getByRole('radio',{name}) as HTMLInputElement).checked).toBe(false)
 expect((screen.getByRole('button',{name:'Review decision'}) as HTMLButtonElement).disabled).toBe(true)
 expect(screen.getByRole('region',{name:'Existing value attendance value'}).textContent).toContain('Present')
 await user.click(screen.getByRole('radio',{name:'Incoming value · Absent'}));await user.type(screen.getByLabelText('Resolution reason'),'Verified roster.');await user.click(screen.getByRole('button',{name:'Review decision'}));expect(writes()).toHaveLength(0)
 const dialog=screen.getByRole('dialog',{name:'Confirm attendance decision'});expect(dialog.textContent).toContain('Absent');expect(dialog.textContent).toContain('Original attendance stays unchanged')
 await user.click(within(dialog).getByRole('button',{name:'Cancel'}));expect(writes()).toHaveLength(0);expect(document.activeElement).toBe(screen.getByRole('button',{name:'Review decision'}))
 await user.click(screen.getByRole('button',{name:'Review decision'}));await user.click(screen.getByRole('button',{name:'Confirm resolution'}))
 await waitFor(()=>expect(writes()).toEqual([[`/api/sync-conflicts/${id}/resolve`,'POST',{choice:'incoming',reason:'Verified roster.'},church]]));await screen.findByText('No attendance conflicts need review.')
})
it('maps existing to the actual Absent value without inferring a Present default',async()=>{
 conflictRows=[{...conflict,existing:conflict.incoming,incoming:conflict.existing}];const user=await start();await user.click(screen.getByRole('button',{name:'Review attendance conflict'}));await user.click(await screen.findByRole('radio',{name:'Existing value · Absent'}));await user.type(screen.getByLabelText('Resolution reason'),'Verified existing.');await user.click(screen.getByRole('button',{name:'Review decision'}));await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await waitFor(()=>expect(writes()[0][2]).toEqual({choice:'existing',reason:'Verified existing.'}))
})
it('blocks whitespace reasons and preserves inputs with safe linked server field feedback',async()=>{
 const user=await start();await openConflict(user);await user.click(screen.getByRole('radio',{name:'Incoming value · Absent'}));fireEvent.change(screen.getByLabelText('Resolution reason'),{target:{value:' \u00a0 '}});expect((screen.getByRole('button',{name:'Review decision'}) as HTMLButtonElement).disabled).toBe(true)
 fireEvent.change(screen.getByLabelText('Resolution reason'),{target:{value:'Verified.'}});await user.click(screen.getByRole('button',{name:'Review decision'}));post=async()=>{throw new ApiError('validation','','',422,{reason:['unsafe raw server value']})};await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText('Check the resolution reason.');expect((screen.getByLabelText('Resolution reason') as HTMLTextAreaElement).value).toBe('Verified.');expect(screen.queryByText('unsafe raw server value')).toBeNull()
})
it('coalesces synchronous duplicate confirmations',async()=>{const user=await start();await decide(user);let finish!:(value:unknown)=>void;post=()=>new Promise(resolve=>{finish=resolve});const button=screen.getByRole('button',{name:'Confirm resolution'});fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(writes()).toHaveLength(1));finish({id,status:'resolved',effective_state:'absent',revision_id:id,version:4})})
it('rechecks changed evidence at mutation time and requires a fresh decision',async()=>{const user=await start();await decide(user);conflictRows=[{...conflict,base_version:4}];await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText(/case changed/i);expect(writes()).toHaveLength(0);expect((screen.getByRole('radio',{name:'Incoming value · Absent'}) as HTMLInputElement).checked).toBe(false)})
it('reads already-resolved status before writing',async()=>{const user=await start();await decide(user);conflictRows=[];await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText(/already resolved/i);expect(writes()).toHaveLength(0)})
it('uses the authoritative resolved preflight without a second unavailable read or an unusable outcome check',async()=>{
 const user=await start();await decide(user);const base=vi.mocked(authRequest).getMockImplementation()!;let reads=0
 vi.mocked(authRequest).mockImplementation(async(...args)=>{if(args[0]===`/api/sync-conflicts/${id}`){reads++;if(reads>1)throw Error('unavailable redundant read');return{...conflict,status:'resolved'}}return base(...args)})
 await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText(/already resolved/i);expect(reads).toBe(1);expect(writes()).toHaveLength(0);expect(screen.queryByRole('button',{name:'Check current outcome'})).toBeNull()
})
it('reconciles a lost accepted response without replay',async()=>{const user=await start();await decide(user);post=async()=>{conflictRows=[];throw Error('lost response')};await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText(/already resolved/i);expect(writes()).toHaveLength(1)})
it('blocks unknown outcomes until an authoritative read succeeds',async()=>{
 const user=await start();await decide(user);post=async()=>{throw Error('lost response')};const base=vi.mocked(authRequest).getMockImplementation()!
 vi.mocked(authRequest).mockImplementation(async(...args)=>{if(args[0]===`/api/sync-conflicts/${id}`&&writes().length)throw Error('unavailable');return base(...args)})
 await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText(/Outcome not confirmed/);expect(screen.queryByRole('button',{name:'Confirm resolution'})).toBeNull();expect(writes()).toHaveLength(1)
 vi.mocked(authRequest).mockImplementation(base);await user.click(screen.getByRole('button',{name:'Check current outcome'}));await screen.findByText(/still open/i);expect(writes()).toHaveLength(1)
})
it.each(['promote','link','merge'])('shows one guest form, confirms %s and disables confirmed dispositions',async action=>{
 guestRows=[guest,{...guest,id:otherGuest,display_name:'Other Guest'}];const user=await start();await guestAction(user,action);expect(screen.queryByLabelText(/guardian/i)).toBeNull();expect(writes()).toHaveLength(0)
 await user.click(screen.getByRole('button',{name:'Confirm guest action'}));await screen.findByText(action==='promote'?'Promoted':action==='link'?'Linked':'Merged',{exact:true});expect(writes()).toHaveLength(1);expect(writes()[0][2]).toEqual(action==='promote'?{first_name:'Guest',last_name:'Child',gender:'female'}:action==='link'?{student_id:studentId}:{guest_id:otherGuest});expect(screen.queryByRole('button',{name:'Review Guest Child'})).toBeNull()
})
it('does not claim a guest disposition from absence in the bounded pending list',async()=>{guestRows=[guest];const user=await start();await guestAction(user,'link');post=async()=>{guestRows=[];throw Error('lost response')};await user.click(screen.getByRole('button',{name:'Confirm guest action'}));await screen.findByText(/disposition is unavailable/i);expect(screen.queryByText('Linked',{exact:true})).toBeNull();expect(writes()).toHaveLength(1)})
it('shows Teachers only a restricted notice without requesting Owner evidence or guests',async()=>{
 currentMe={...me,memberships:[{...me.memberships[0],role:'teacher'}],active_session:{mfa_confirmed:false}};const base=vi.mocked(authRequest).getMockImplementation()!;vi.mocked(authRequest).mockImplementation(async(...args)=>args[0]==='/api/sync-conflicts'?{needs_owner_review:true}:base(...args))
 render(<ConflictReviewScreen initialChurchId={church}/>);await screen.findByText('Needs Owner Review');expect(screen.queryByText(/Device/)).toBeNull();expect(screen.queryByRole('tab')).toBeNull();expect(vi.mocked(authRequest).mock.calls.map(call=>call[0])).toEqual(['/api/me','/api/sync-conflicts'])
})
it.each(['inactive','no-mfa','foreign','unverified'])('denies %s before queue requests',async mode=>{if(mode==='inactive')currentMe.memberships[0].status='inactive';if(mode==='no-mfa')currentMe.active_session.mfa_confirmed=false;if(mode==='foreign')currentMe.memberships[0].church_id=otherGuest;if(mode==='unverified')currentMe.email_verified=false;render(<ConflictReviewScreen initialChurchId={church}/>);await screen.findByRole('alert');expect(authRequest).toHaveBeenCalledTimes(1);expect(screen.queryByText('Present')).toBeNull()})
it('clears protected presentation on session invalidation',async()=>{const user=await start();await openConflict(user);window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status:401,churchId:church}}));await waitFor(()=>expect(screen.queryByText('Present')).toBeNull());expect(screen.queryByLabelText('Resolution reason')).toBeNull()})
it('rechecks actor and clears another actor’s pending decision before mutation',async()=>{const user=await start();await decide(user);currentMe={...me,id:22};await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByRole('alert');expect(writes()).toHaveLength(0);expect(screen.queryByText('Present')).toBeNull()})
it('rejects an unexpected Owner evidence response for a verified Teacher',async()=>{currentMe={...me,memberships:[{...me.memberships[0],role:'teacher'}],active_session:{mfa_confirmed:false}};render(<ConflictReviewScreen initialChurchId={church}/>);await screen.findByRole('alert');expect(screen.queryByText('Present')).toBeNull();expect(authRequest).toHaveBeenCalledTimes(2)})
it('requires a new explicit choice after a stale case and then uses the newly reviewed version',async()=>{const user=await start();await decide(user);conflictRows=[{...conflict,base_version:4}];await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText(/case changed/i);await user.click(screen.getByRole('radio',{name:'Existing value · Present'}));await user.type(screen.getByLabelText('Resolution reason'),'Verified newer case.');await user.click(screen.getByRole('button',{name:'Review decision'}));await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await waitFor(()=>expect(writes()).toHaveLength(1))})
it('never applies a protected late queue response after session invalidation',async()=>{
 let finish!:(value:unknown)=>void;const base=vi.mocked(authRequest).getMockImplementation()!;vi.mocked(authRequest).mockImplementation(async(...args)=>args[0]==='/api/sync-conflicts'?new Promise(resolve=>{finish=resolve}):base(...args))
 render(<ConflictReviewScreen initialChurchId={church}/>);await waitFor(()=>expect(authRequest).toHaveBeenCalledTimes(2));window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status:401}}));finish({data:[conflict]});await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Review attendance conflict'})).toBeNull()
})
it('never restores a pending confirmation when offline presentation is reverified',async()=>{
 const user=await start();await decide(user);window.dispatchEvent(new Event('offline'));await screen.findByRole('alert');expect(screen.queryByRole('dialog')).toBeNull();await user.click(screen.getByRole('button',{name:'Check account access'}));await screen.findByRole('button',{name:'Review attendance conflict'});expect(screen.queryByRole('dialog')).toBeNull();expect(writes()).toHaveLength(0)
})
it('suppresses a late write result after expiry without restoring data or success',async()=>{
 const user=await start();await decide(user);let finish!:(value:unknown)=>void;post=()=>new Promise(resolve=>{finish=resolve});await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await waitFor(()=>expect(writes()).toHaveLength(1));window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status:419}}));finish({id,status:'resolved',effective_state:'absent',revision_id:id,version:4});await screen.findByRole('alert');expect(screen.queryByText(/server accepted/)).toBeNull();expect(screen.queryByText('Present')).toBeNull()
})
it('isolates another church on direct context changes',async()=>{
 const view=render(<ConflictReviewScreen initialChurchId={church}/>);await screen.findByRole('button',{name:'Review attendance conflict'});view.rerender(<ConflictReviewScreen initialChurchId={otherGuest}/>);await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Review attendance conflict'})).toBeNull();expect(screen.queryByText('Present')).toBeNull()
})
it('offers merge targets only in the current session and requires a deliberate target',async()=>{
 guestRows=[guest,{...guest,id:otherGuest,session_id:otherGuest,display_name:'Foreign Session Guest'}];const user=await start();await user.click(screen.getByRole('tab',{name:/Temporary guests/}));await user.click(screen.getByRole('button',{name:'Review Guest Child'}));await user.selectOptions(screen.getByLabelText('Guest action'),'merge');expect(screen.queryByRole('option',{name:'Foreign Session Guest'})).toBeNull();expect((screen.getByLabelText('Canonical guest') as HTMLSelectElement).value).toBe('');await user.click(screen.getByRole('button',{name:'Review guest action'}));expect(screen.queryByRole('dialog')).toBeNull();expect(writes()).toHaveLength(0)
})
it('invalidates an old decision if validation reconciliation discovers competing evidence changed during submission',async()=>{
 const user=await start();await decide(user);post=async()=>{conflictRows=[{...conflict,incoming:{...side,value:{state:'present'}}}];throw new ApiError('validation','','',422,{reason:['Check field']})}
 await user.click(screen.getByRole('button',{name:'Confirm resolution'}));await screen.findByText(/case changed/i);expect((screen.getByRole('radio',{name:'Existing value · Present'}) as HTMLInputElement).checked).toBe(false);expect((screen.getByRole('button',{name:'Review decision'}) as HTMLButtonElement).disabled).toBe(true)
})
it('returns to the same guest queue and its original keyboard trigger after canceling review',async()=>{
 guestRows=[guest];const user=await start();await user.click(screen.getByRole('tab',{name:/Temporary guests/}));const trigger=screen.getByRole('button',{name:'Review Guest Child'});await user.click(trigger);await user.click(screen.getByRole('button',{name:'Back to queues'}));expect(screen.getByRole('tab',{name:/Temporary guests/}).getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(trigger)
})
it('does not offer a confirmed guest again even if a later pending projection is stale',async()=>{
 guestRows=[guest];const user=await start();await guestAction(user,'link');await user.click(screen.getByRole('button',{name:'Confirm guest action'}));await screen.findByText('Linked',{exact:true});guestRows=[guest];await user.click(screen.getByRole('button',{name:'Refresh review queues'}));await screen.findByRole('tab',{name:/Temporary guests/});await user.click(screen.getByRole('tab',{name:/Temporary guests/}));expect(screen.queryByRole('button',{name:'Review Guest Child'})).toBeNull();expect(writes()).toHaveLength(1)
})
it('focuses the exposed guest queue after asynchronous success removes the original trigger',async()=>{
 guestRows=[guest];const user=await start();await guestAction(user,'link');await user.click(screen.getByRole('button',{name:'Confirm guest action'}));await screen.findByText('Linked',{exact:true});await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Pending temporary guests'})))
})
it('restores queue focus after native dialog closing restores an earlier focus target',async()=>{
 const originalTabIndex=document.body.getAttribute('tabindex');document.body.tabIndex=-1
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');document.body.focus()}
 try{guestRows=[guest];const user=await start();await guestAction(user,'link');await user.click(screen.getByRole('button',{name:'Confirm guest action'}));await screen.findByText('Linked',{exact:true});await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Pending temporary guests'})))}finally{if(originalTabIndex===null)document.body.removeAttribute('tabindex');else document.body.setAttribute('tabindex',originalTabIndex)}
})
