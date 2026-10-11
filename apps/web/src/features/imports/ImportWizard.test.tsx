// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ImportScreen } from './ImportScreen'
import { authRequest, authUpload } from '../auth/transport'
import { ApiError } from '../../api/client'
vi.mock('../auth/transport',()=>({authRequest:vi.fn(),authUpload:vi.fn(),authDownload:vi.fn(),safeAuthMessage:()=> 'Safe import error.'}))
const request=vi.mocked(authRequest),upload=vi.mocked(authUpload)
const church='11111111-1111-4111-8111-111111111111',batch='22222222-2222-4222-8222-222222222222',ministry='33333333-3333-4333-8333-333333333333'
const ids=['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777']
const rows=ids.map((id,index)=>({id,row_number:index+2,status:['valid','needs_mapping','invalid','duplicate'][index],source:{first_name:'Synthetic',last_name:'Row '+index},data:{first_name:'Synthetic',last_name:'Row '+index,gender:'unspecified'},ministry_names:index===1?['Unknown Group']:[],ministry_ids:[],unknown_ministries:index===1?['Unknown Group']:[],errors:index===2?['Student details are invalid.']:index===3?['A possible existing student requires Owner review and was not selected.']:[],outcome:null}))
const preview={id:batch,state:'previewed',expires_at:'2099-01-01T00:00:00Z',counts:{valid:1,needs_mapping:1,invalid:1,duplicate:1},rows}
const completed={...preview,state:'completed',rows:rows.map((row,index)=>({...row,outcome:index===0?'committed':index===3?'duplicate':'excluded'}))}
const result={id:batch,state:'completed',counts:{committed:1,excluded:2,duplicate:1}}
let current: unknown=preview
beforeEach(()=>{sessionStorage.clear();history.replaceState(null,'','/account/imports?church='+church);current=preview;request.mockImplementation(async(path,method)=>{
 if(path==='/api/me')return{id:11,memberships:[{church_id:church,role:'owner',status:'active'}],active_session:{mfa_confirmed:true}}
 if(path==='/api/ministries')return{data:[{id:ministry,name:'Primary',status:'active',version:1}]}
 if(method==='POST'){current=completed;return result}
 return current
});upload.mockResolvedValue(preview as never)})
afterEach(()=>{cleanup();vi.resetAllMocks();vi.restoreAllMocks();sessionStorage.clear();history.replaceState(null,'','/')})
async function load(){const user=userEvent.setup();render(<ImportScreen/>);await screen.findByLabelText('Student spreadsheet');await user.upload(screen.getByLabelText('Student spreadsheet'),new File(['first_name,last_name\nSynthetic,Row'],'synthetic.csv',{type:'text/csv'}));fireEvent.submit(screen.getByRole('button',{name:'Preview import'}).closest('form')!);await screen.findByRole('heading',{name:'Review and map'});return user}
async function confirm(user:ReturnType<typeof userEvent.setup>){await user.click(screen.getByRole('button',{name:'Review selected'}));await screen.findByRole('heading',{name:'Confirm selected'});await user.click(screen.getByLabelText(/I understand that this creates new student records/))}
it('provides four explicit stages and requires review/confirmation before any commit',async()=>{const user=await load();expect(screen.getByRole('navigation',{name:'Import stages'})).toBeTruthy();expect(request.mock.calls.some(call=>call[1]==='POST')).toBe(false);await confirm(user);expect(request.mock.calls.some(call=>call[1]==='POST')).toBe(false);await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByRole('heading',{name:'Results'});expect(screen.getByText('1 students imported.')).toBeTruthy();expect(screen.getByText('3 rows skipped.')).toBeTruthy()})
it('distinguishes server categories, mapping eligibility and deliberate selection',async()=>{const user=await load();for(const count of ['4 total','1 valid','1 invalid','1 duplicate','1 needs mapping','1 eligible','1 selected'])expect(screen.getByText(count)).toBeTruthy();expect(screen.getByLabelText('Approve row 4')).toHaveProperty('disabled',true);expect(screen.getByLabelText('Approve row 5')).toHaveProperty('disabled',true);expect(screen.getByLabelText('Approve row 3')).toHaveProperty('disabled',true);await user.selectOptions(screen.getByLabelText('Map Unknown Group'),ministry);expect(screen.getByText('2 eligible')).toBeTruthy();expect(screen.getByText('1 selected')).toBeTruthy();await user.click(screen.getByLabelText('Approve row 3'));expect(screen.getByText('2 selected')).toBeTruthy()})
it('invalidates confirmation and dependent selection when mapping or selection changes',async()=>{const user=await load();await user.selectOptions(screen.getByLabelText('Map Unknown Group'),ministry);await user.click(screen.getByLabelText('Approve row 3'));await confirm(user);await user.click(screen.getByRole('button',{name:'Back to review'}));await user.selectOptions(screen.getByLabelText('Map Unknown Group'),'');expect(screen.getByLabelText('Approve row 3')).toHaveProperty('checked',false);await user.click(screen.getByLabelText('Approve row 2'));expect(screen.getByText('0 selected')).toBeTruthy();expect(screen.getByRole('button',{name:'Review selected'})).toHaveProperty('disabled',true);expect(request.mock.calls.some(call=>call[1]==='POST')).toBe(false)})
it('coalesces double submit and retrieves authoritative outcomes after accepted upload',async()=>{const user=await load();await confirm(user);let finish!:(value:unknown)=>void;const base=request.getMockImplementation()!;request.mockImplementation((path,method,...args)=>method==='POST'?new Promise(done=>{finish=done}):base(path,method,...args));const action=screen.getByRole('button',{name:'Import 1 students'});fireEvent.click(action);fireEvent.click(action);await waitFor(()=>expect(request.mock.calls.filter(call=>call[1]==='POST')).toHaveLength(1));current=completed;await act(async()=>finish(result));await screen.findByText('1 students imported.');expect(request).toHaveBeenCalledWith('/api/imports/'+batch,'GET',undefined,church)})
it('reconciles a timeout after successful commit without a replacement upload or POST replay',async()=>{const user=await load();await confirm(user);const base=request.getMockImplementation()!;request.mockImplementation((path,method,...args)=>{if(method==='POST'){current=completed;return Promise.reject({status:500})}return base(path,method,...args)});await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText('1 students imported.');expect(upload).toHaveBeenCalledTimes(1);expect(request.mock.calls.filter(call=>call[1]==='POST')).toHaveLength(1);expect(screen.queryByRole('button',{name:'Retry same selected rows'})).toBeNull()})
it('blocks repeat writes until same-batch status is verified and deliberately retries with the same key',async()=>{const user=await load();await confirm(user);const base=request.getMockImplementation()!;let statusFails=true,posts=0;request.mockImplementation((path,method,...args)=>{if(method==='POST'&&++posts===1)return Promise.reject({status:500});if(path==='/api/imports/'+batch&&statusFails)return Promise.reject({status:500});return base(path,method,...args)});await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText(/Import result not confirmed/);expect(screen.queryByLabelText('Student spreadsheet')).toBeNull();expect(screen.queryByRole('button',{name:'Retry same selected rows'})).toBeNull();statusFails=false;await user.click(screen.getByRole('button',{name:'Check same batch'}));await user.click(await screen.findByRole('button',{name:'Retry same selected rows'}));expect(screen.getByLabelText(/I understand that this creates new student records/)).toHaveProperty('checked',false);await user.click(screen.getByLabelText(/I understand that this creates new student records/));await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText('1 students imported.');const bodies=request.mock.calls.filter(call=>call[1]==='POST').map(call=>call[2]);expect(bodies[1]).toEqual(bodies[0]);expect(upload).toHaveBeenCalledTimes(1)})
it('shows authoritative expiration without a retry or automatic replacement batch',async()=>{const user=await load();await confirm(user);const base=request.getMockImplementation()!;request.mockImplementation((path,method,...args)=>{if(method==='POST'){current={...preview,state:'expired'};return Promise.reject({status:410})}return base(path,method,...args)});await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText(/This batch expired/);expect(screen.queryByRole('button',{name:'Retry same selected rows'})).toBeNull();expect(upload).toHaveBeenCalledTimes(1)})
it('retains only opaque recovery identifiers and restores the same batch after navigation',async()=>{const user=await load();await confirm(user);const base=request.getMockImplementation()!;request.mockImplementation((path,method,...args)=>method==='POST'?Promise.reject({status:500}):path==='/api/imports/'+batch?Promise.reject({status:500}):base(path,method,...args));await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText(/Import result not confirmed/);const stored=Object.values(sessionStorage).join('');expect(stored).toContain(batch);expect(stored).not.toContain('Synthetic');expect(stored).not.toContain('Unknown Group');cleanup();current=completed;request.mockImplementation(base);render(<ImportScreen/>);await screen.findByText('1 students imported.');expect(upload).toHaveBeenCalledTimes(1);expect(request.mock.calls.filter(call=>call[1]==='POST')).toHaveLength(1)})
it('clears protected preview and suppresses delayed upload after authorization invalidation',async()=>{let finish!:(value:unknown)=>void;upload.mockImplementation(()=>new Promise(done=>{finish=done}));const user=userEvent.setup();render(<ImportScreen/>);await screen.findByLabelText('Student spreadsheet');await user.upload(screen.getByLabelText('Student spreadsheet'),new File(['x'],'synthetic.csv'));fireEvent.submit(screen.getByRole('button',{name:'Preview import'}).closest('form')!);await waitFor(()=>expect(finish).toBeTypeOf('function'));act(()=>window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status:403,churchId:church}})));await act(async()=>finish(preview));expect(screen.queryByText('Synthetic Row 0')).toBeNull();expect(screen.queryByLabelText('Student spreadsheet')).toBeNull()})
it.each([['teacher','active',true],['owner','active',false],['owner','inactive',true]])('denies protected import operations for %s/%s/%s before ministry data',async(role,status,mfa)=>{request.mockResolvedValue({id:11,memberships:[{church_id:church,role,status}],active_session:{mfa_confirmed:mfa}});render(<ImportScreen/>);await screen.findByText('Student imports are available only to the church Owner with confirmed MFA.');expect(request.mock.calls.every(call=>call[0]==='/api/me')).toBe(true);expect(screen.queryByRole('navigation',{name:'Import stages'})).toBeNull()})
it('preserves preview context after authoritative validation rejection',async()=>{const user=await load();await confirm(user);const base=request.getMockImplementation()!;request.mockImplementation((path,method,...args)=>method==='POST'?Promise.reject(new ApiError('validation','private','',422)):base(path,method,...args));await user.click(screen.getByRole('button',{name:'Import 1 students'}));await user.click(await screen.findByRole('button',{name:'Back to review'}));expect(screen.getByText('1 valid')).toBeTruthy();expect(screen.getByText('1 selected')).toBeTruthy();expect(screen.queryByText('private')).toBeNull()})

it.each([401,403,419])('clears protected rows and stops replay when submission receives HTTP %s',async(status)=>{
 const user=await load();await confirm(user);const base=request.getMockImplementation()!
 request.mockImplementation((path,method,...args)=>method==='POST'?Promise.reject(new ApiError('denied','private','',status)):base(path,method,...args))
 await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByRole('alert')
 expect(screen.queryByText('Synthetic Row 0')).toBeNull();expect(screen.queryByRole('button',{name:'Retry same selected rows'})).toBeNull()
 expect(request.mock.calls.filter(call=>call[0]==='/api/imports/'+batch)).toHaveLength(0)
})

it('blocks submission when recovery identifiers cannot be retained',async()=>{
 const user=await load();await confirm(user);vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('Storage denied')})
 await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText('Browser recovery storage is unavailable. No import was submitted.')
 expect(request.mock.calls.some(call=>call[1]==='POST')).toBe(false);expect(screen.getByLabelText(/I understand that this creates new student records/)).toHaveProperty('checked',false)
})

it('requires a new review when an authorized ministry becomes archived before submission',async()=>{
 const user=await load();await user.selectOptions(screen.getByLabelText('Map Unknown Group'),ministry);await user.click(screen.getByLabelText('Approve row 3'));await confirm(user)
 const base=request.getMockImplementation()!;request.mockImplementation((path,...args)=>path==='/api/ministries'?Promise.resolve({data:[]}):base(path,...args))
 await user.click(screen.getByRole('button',{name:'Import 2 students'}));await screen.findByText('Ministry availability changed. Review the selected rows and confirm again.')
 expect(screen.getByLabelText('Approve row 3')).toHaveProperty('checked',false);expect(request.mock.calls.some(call=>call[1]==='POST')).toBe(false)
})

it('does not expose a previous actor’s retained batch to another signed-in Owner',async()=>{
 const user=await load();await confirm(user);const base=request.getMockImplementation()!
 request.mockImplementation((path,method,...args)=>method==='POST'||path==='/api/imports/'+batch?Promise.reject({status:500}):base(path,method,...args))
 await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText(/Import result not confirmed/);cleanup();request.mockClear()
 request.mockImplementation((path,...args)=>path==='/api/me'?Promise.resolve({id:12,memberships:[{church_id:church,role:'owner',status:'active'}],active_session:{mfa_confirmed:true}}):base(path,...args))
 render(<ImportScreen/>);await screen.findByLabelText('Student spreadsheet')
 expect(request.mock.calls.some(call=>call[0]==='/api/imports/'+batch)).toBe(false);expect(screen.queryByText('Synthetic Row 0')).toBeNull()
})

it.each(['csv','xlsx'])('accepts the exact 5 MiB %s file boundary for authoritative server inspection',async(extension)=>{
 render(<ImportScreen/>);const input=await screen.findByLabelText('Student spreadsheet');const file=new File([new Uint8Array(5*1024*1024)],'synthetic.'+extension)
 fireEvent.change(input,{target:{files:[file]}});fireEvent.submit(screen.getByRole('button',{name:'Preview import'}).closest('form')!)
 await waitFor(()=>expect(upload).toHaveBeenCalledWith('/api/imports/students/preview',file,church))
})

it('rejects one byte over 5 MiB without creating a batch',async()=>{
 render(<ImportScreen/>);const input=await screen.findByLabelText('Student spreadsheet');fireEvent.change(input,{target:{files:[new File([new Uint8Array(5*1024*1024+1)],'synthetic.csv')]}})
 fireEvent.submit(screen.getByRole('button',{name:'Preview import'}).closest('form')!);await screen.findByText('Choose a CSV or XLSX file no larger than 5 MiB.')
 expect(upload).not.toHaveBeenCalled()
})

it('shows reviewed server file errors and moves focus to an accessible error summary',async()=>{
 upload.mockRejectedValue(new ApiError('validation','private','',422,{file:['The spreadsheet exceeds 500 data rows.','private child detail']}))
 render(<ImportScreen/>);const input=await screen.findByLabelText('Student spreadsheet');fireEvent.change(input,{target:{files:[new File(['x'],'synthetic.csv')]}})
 fireEvent.submit(screen.getByRole('button',{name:'Preview import'}).closest('form')!);const message=await screen.findByRole('alert')
 expect(message.textContent).toContain('The spreadsheet exceeds 500 data rows.');expect(message).toBe(document.activeElement);expect(screen.queryByText('private child detail')).toBeNull()
})

it.each([401,419])('honors global session expiry HTTP %s even when another church request detected it',async(status)=>{
 await load();act(()=>window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status,churchId:ministry}})))
 await screen.findByRole('alert');expect(screen.queryByText('Synthetic Row 0')).toBeNull();expect(screen.queryByRole('button',{name:'Review selected'})).toBeNull()
})

it('keeps accepted counts and rows unresolved until authoritative row outcomes arrive',async()=>{
 const user=await load();await confirm(user);const base=request.getMockImplementation()!;let outcomes=false
 request.mockImplementation((path,...args)=>path==='/api/imports/'+batch&&!outcomes?Promise.resolve({...completed,rows}):base(path,...args))
 await user.click(screen.getByRole('button',{name:'Import 1 students'}));await screen.findByText(/The server accepted this batch/)
 expect(screen.queryByText('0 students imported.')).toBeNull();expect(screen.queryByRole('button',{name:'Upload another file'})).toBeNull();expect(screen.queryByRole('button',{name:'Download corrections CSV'})).toBeNull()
 outcomes=true;await user.click(screen.getByRole('button',{name:'Check same batch'}));await screen.findByText('1 students imported.');expect(upload).toHaveBeenCalledTimes(1)
})

it('fails closed with truthful guidance when a saved batch reference is malformed',async()=>{
 sessionStorage.setItem('msprout:import-recovery:'+church+':11','not valid JSON');render(<ImportScreen/>);await screen.findByText('The saved import reference could not be read. Check browser recovery storage before continuing.')
 expect(screen.queryByLabelText('Student spreadsheet')).toBeNull();expect(upload).not.toHaveBeenCalled()
})
