// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { StudentsScreen } from '../students/StudentsScreen'
import { MinistriesScreen } from '../ministries/MinistriesScreen'
import { TeacherManagementScreen } from '../teachers/TeacherManagementScreen'
import { ChurchWorkspaceContext } from '../../app/workspace-context'
import { authRequest } from '../auth/transport'
import { ApiError } from '../../api/client'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn(), safeAuthMessage: () => 'Check your account access or information.' }))
const request=vi.mocked(authRequest)
const church='12345678-1234-4234-8234-123456789012',other='87654321-4321-4321-8321-210987654321'
const ministry={id:'ministry-id',name:'Primary',status:'active',version:1}
const student={id:'student-id',first_name:'Pilot',last_name:'Student',display_name:'Pilot Student',gender:'unspecified',status:'active',ministry_ids:[ministry.id],date_of_birth:'2018-01-02'}
let role:'owner'|'teacher'='owner'
beforeAll(()=>Object.defineProperties(HTMLDialogElement.prototype,{
 showModal:{configurable:true,value:function(this:HTMLDialogElement){this.open=true}},close:{configurable:true,value:function(this:HTMLDialogElement){this.open=false}},
}))
beforeEach(()=>{
 history.replaceState(null,'','/account/students?church='+church)
 request.mockImplementation(async(path,method)=>{
  if(path==='/api/me')return{id:11,memberships:[{church_id:church,role,status:'active'}],active_session:{mfa_confirmed:role==='owner'}}
  if(path==='/api/students/student-id'&&method==='GET')return student
  if(path.startsWith('/api/students'))return{data:[student]}
  if(path.startsWith('/api/teachers'))return{data:[{id:'teacher-id',display_name:'Pilot Teacher',status:'active',ministry_ids:[ministry.id],can_manage:true}],has_more:false,can_invite:true}
  if(path.startsWith('/api/teacher-invitations'))return{data:[],has_more:false}
  return{data:[ministry]}
 })
})
afterEach(()=>{cleanup();vi.resetAllMocks();vi.restoreAllMocks();role='owner';history.replaceState(null,'','/')})

it('starts list-first with separate student Add/Edit modes and server-backed detail',async()=>{
 const user=userEvent.setup();render(<StudentsScreen/>)
 await screen.findByRole('button',{name:'View Pilot Student'})
 expect(screen.queryByRole('form',{name:'Add student'})).toBeNull()
 await user.click(screen.getByRole('button',{name:'Add student'}))
 expect(screen.getByRole('form',{name:'Add student'})).toBeTruthy()
 await user.click(screen.getByRole('button',{name:'Cancel'}))
 await user.click(screen.getByRole('button',{name:'View Pilot Student'}))
 await screen.findByRole('heading',{name:'Pilot Student'})
 expect(request).toHaveBeenCalledWith('/api/students/student-id','GET',undefined,church)
 await user.click(screen.getByRole('button',{name:'Edit student'}))
 expect(screen.getByLabelText('First name')).toHaveProperty('value','Pilot')
})
it('requires a named student archive confirmation and cancellation writes nothing',async()=>{
 const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'View Pilot Student'}))
 await user.click(await screen.findByRole('button',{name:'Archive student'}))
 const dialog=screen.getByRole('dialog',{name:'Archive Pilot Student?'})
 expect(request.mock.calls.some(call=>call[1]==='POST')).toBe(false)
 await user.click(within(dialog).getByRole('button',{name:'Cancel'}))
 expect(request.mock.calls.some(call=>call[1]==='POST')).toBe(false)
})
it('uses supported ministry filtering and labels search as loaded authorized records',async()=>{
 const user=userEvent.setup();render(<StudentsScreen/>);await screen.findByRole('button',{name:'View Pilot Student'})
 expect(screen.getByLabelText('Search loaded students')).toBeTruthy()
 await user.selectOptions(screen.getByLabelText('Ministry filter'),ministry.id)
 await waitFor(()=>expect(request.mock.calls.some(call=>call[0].includes('ministry_id=ministry-id'))).toBe(true))
})
it('clears a revoked student detail and suppresses its late response',async()=>{
 let resolve!:(value:unknown)=>void
 const base=request.getMockImplementation()!
 request.mockImplementation((path,...args)=>path==='/api/students/student-id'?new Promise(done=>{resolve=done}):base(path,...args))
 const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'View Pilot Student'}))
 act(()=>window.dispatchEvent(new CustomEvent('church-workspace-invalidated',{detail:{status:403,churchId:church}})))
 await waitFor(()=>expect(screen.queryByRole('button',{name:'View Pilot Student'})).toBeNull())
 resolve(student);await waitFor(()=>expect(screen.queryByRole('heading',{name:'Pilot Student'})).toBeNull())
 expect(screen.queryByRole('button',{name:'Add student'})).toBeNull()
})
it('does not request records for a wrong-church membership',async()=>{
 request.mockResolvedValue({id:11,memberships:[{church_id:other,role:'owner',status:'active'}],active_session:{mfa_confirmed:true}})
 render(<StudentsScreen/>);await screen.findByRole('alert')
 expect(request.mock.calls.every(call=>call[0]==='/api/me')).toBe(true)
})
it('provides ministry detail, distinct Add and named archive modes',async()=>{
 const user=userEvent.setup();render(<MinistriesScreen/>);await user.click(await screen.findByRole('button',{name:'View Primary'}))
 await user.click(screen.getByRole('button',{name:'Archive ministry'}))
 expect(screen.getByRole('dialog',{name:'Archive Primary?'})).toBeTruthy()
})
it('shows Teachers only read-only assigned scope and no Owner or import controls',async()=>{
 role='teacher';const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'View Pilot Student'}))
 await screen.findByRole('heading',{name:'Pilot Student'})
 expect(screen.queryByText('2018-01-02')).toBeNull()
 for(const name of ['Add student','Edit student','Archive student'])expect(screen.queryByRole('button',{name})).toBeNull()
 expect(screen.queryByRole('link',{name:'Import students'})).toBeNull()
})
it('keeps ownership transfer separate from ordinary Teacher list actions',async()=>{
 const user=userEvent.setup();render(<TeacherManagementScreen/>);await user.click(await screen.findByRole('button',{name:'View Pilot Teacher'}))
 const protectedFlow=screen.getByRole('region',{name:'Ownership transfer'})
 expect(within(protectedFlow).getByRole('button',{name:'Transfer ownership'})).toBeTruthy()
 expect(screen.queryByLabelText('Church workspace ID')).toBeNull()
})
it('discards old church data and stale completions on a verified context change',async()=>{
 const view=render(<ChurchWorkspaceContext.Provider value={{church_id:church,name:'Pilot',role:'owner'}}><StudentsScreen/></ChurchWorkspaceContext.Provider>)
 await screen.findByRole('button',{name:'View Pilot Student'})
 request.mockResolvedValue({id:11,memberships:[],active_session:{mfa_confirmed:true}})
 view.rerender(<ChurchWorkspaceContext.Provider value={{church_id:other,name:'Other',role:'owner'}}><StudentsScreen/></ChurchWorkspaceContext.Provider>)
 expect(screen.queryByRole('button',{name:'View Pilot Student'})).toBeNull()
 await screen.findByRole('alert')
})
it('preserves safe student input and links field errors after rejected validation',async()=>{
 const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'Add student'}))
 await user.type(screen.getByLabelText('First name'),'Synthetic');await user.type(screen.getByLabelText('Last name'),'Example')
 const base=request.getMockImplementation()!;request.mockImplementation((path,method,...args)=>method==='POST'?Promise.reject(new ApiError('validation','unsafe','',422,{first_name:['unsafe text']})):base(path,method,...args))
 await user.click(screen.getByRole('button',{name:'Save student'}))
 await screen.findByRole('alert')
 expect(screen.getByLabelText('First name')).toHaveProperty('value','Synthetic')
 expect(screen.getByLabelText('First name').getAttribute('aria-invalid')).toBe('true')
 expect(screen.queryByText('unsafe text')).toBeNull()
})
it('creates a student once during duplicate submission with only supported fields',async()=>{
 let finish!:(value:unknown)=>void;const base=request.getMockImplementation()!
 request.mockImplementation((path,method,...args)=>method==='POST'?new Promise(done=>{finish=done}):base(path,method,...args))
 const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'Add student'}))
 await user.type(screen.getByLabelText('First name'),'Synthetic');await user.type(screen.getByLabelText('Last name'),'Example');await user.click(screen.getByLabelText('Primary'))
 const form=screen.getByRole('form',{name:'Add student'});fireEvent.submit(form);fireEvent.submit(form)
 expect(request.mock.calls.filter(call=>call[1]==='POST')).toHaveLength(1)
 expect(request.mock.calls.find(call=>call[1]==='POST')?.[2]).toMatchObject({first_name:'Synthetic',last_name:'Example',ministry_ids:['ministry-id']})
 await act(async()=>finish(student));await screen.findByRole('button',{name:'View Pilot Student'})
})
it('saves student details without replacing enrollments and uses deliberate enrollment replacement',async()=>{
 const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'View Pilot Student'}))
 await user.click(await screen.findByRole('button',{name:'Edit student'}));await user.click(screen.getByRole('button',{name:'Save student'}))
 await waitFor(()=>expect(request.mock.calls.some(call=>call[1]==='PUT')).toBe(true))
 expect(request.mock.calls.find(call=>call[1]==='PUT')?.[2]).not.toHaveProperty('ministry_ids')
 await user.click(await screen.findByRole('button',{name:'View Pilot Student'}));await user.click(await screen.findByRole('button',{name:'Edit enrollments'}))
 await user.click(screen.getByLabelText('Primary'));await user.click(screen.getByRole('button',{name:'Save enrollments'}))
 await waitFor(()=>expect(request).toHaveBeenCalledWith('/api/students/student-id/enrollments','PUT',{ministry_ids:[]},church))
})
it('archives and restores existing students with explicit confirmation under status filtering',async()=>{
 let archived=false;const base=request.getMockImplementation()!
 request.mockImplementation((path,method,...args)=>{
  if(path.endsWith('/archive')){archived=true;return Promise.resolve({...student,status:'archived'})}
  if(path.endsWith('/restore')){archived=false;return Promise.resolve(student)}
  if(path==='/api/students/student-id')return Promise.resolve({...student,status:archived?'archived':'active'})
  if(path.startsWith('/api/students'))return Promise.resolve({data:[{...student,status:archived?'archived':'active'}]})
  return base(path,method,...args)
 })
 const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'View Pilot Student'}));await user.click(await screen.findByRole('button',{name:'Archive student'}));await user.click(screen.getByRole('button',{name:'Confirm archive'}))
 await user.selectOptions(await screen.findByLabelText('Status filter'),'archived');await user.click(await screen.findByRole('button',{name:'View Pilot Student'}));await user.click(await screen.findByRole('button',{name:'Restore student'}));await user.click(screen.getByRole('button',{name:'Confirm restore'}))
 await waitFor(()=>expect(request).toHaveBeenCalledWith('/api/students/student-id/restore','POST',undefined,church))
})
it('suppresses old loaded roster after delayed assignment refresh resolves without access',async()=>{
 let finish!:(value:unknown)=>void;render(<StudentsScreen/>);await screen.findByRole('button',{name:'View Pilot Student'})
 request.mockImplementation(()=>new Promise(done=>{finish=done}));act(()=>window.dispatchEvent(new Event('focus')))
 expect(screen.queryByRole('button',{name:'View Pilot Student'})).toBeNull()
 await waitFor(()=>expect(finish).toBeTypeOf('function'));await act(async()=>finish({memberships:[],active_session:{mfa_confirmed:false}}))
 await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Add student'})).toBeNull()
})
it('never blindly repeats an uncertain creation and clears protected forms on interruption',async()=>{
 const user=userEvent.setup();render(<StudentsScreen/>);await user.click(await screen.findByRole('button',{name:'Add student'}));await user.type(screen.getByLabelText('First name'),'Synthetic');await user.type(screen.getByLabelText('Last name'),'Example')
 request.mockRejectedValue({status:500});await user.click(screen.getByRole('button',{name:'Save student'}));expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('outcome could not be confirmed'))
 expect(screen.queryByLabelText('First name')).toBeNull();expect(request.mock.calls.filter(call=>call[1]==='POST')).toHaveLength(1)
})
it('keeps Teacher and invitation pagination supplied by the existing contracts',async()=>{
 const base=request.getMockImplementation()!;request.mockImplementation(async(path,...args)=>{
  const response=await base(path,...args) as Record<string,unknown>
  return path.startsWith('/api/teachers')||path.startsWith('/api/teacher-invitations')?{...response,has_more:true}:response
 })
 const user=userEvent.setup();render(<TeacherManagementScreen/>);await user.click(await screen.findByRole('button',{name:'Next Teachers'}));await waitFor(()=>expect(request).toHaveBeenCalledWith('/api/teachers?page=2','GET',undefined,church))
 await user.click(await screen.findByRole('button',{name:'Next invitations'}));await waitFor(()=>expect(request).toHaveBeenCalledWith('/api/teacher-invitations?page=2','GET',undefined,church))
})
it('invalidates old selection when the same church route ministry hint changes',async()=>{
 const view=render(<StudentsScreen/>);await screen.findByRole('button',{name:'View Pilot Student'})
 history.replaceState(null,'','/account/students?church='+church+'&ministry=unassigned-id');view.rerender(<StudentsScreen/>)
 expect(screen.queryByRole('button',{name:'View Pilot Student'})).toBeNull()
 await screen.findByRole('alert');expect(request.mock.calls.some(call=>call[0].includes('ministry_id=unassigned-id'))).toBe(false)
})
it('distinguishes no Teacher assignment from an assigned ministry with no students',async()=>{
 role='teacher';const base=request.getMockImplementation()!
 request.mockImplementation((path,...args)=>path.startsWith('/api/ministries')||path.startsWith('/api/students')?Promise.resolve({data:[]}):base(path,...args))
 render(<StudentsScreen/>);await screen.findByText('No ministry assigned. Check with your church Owner.')
 expect(screen.queryByRole('button',{name:'Add student'})).toBeNull()
})
