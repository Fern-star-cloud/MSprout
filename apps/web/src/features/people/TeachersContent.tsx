import { useCallback, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { useWorkspaceChurchId } from '../../app/workspace-context'
import { Button, Dialog, Field } from '../../components/ui/Foundations'
import { authRequest } from '../auth/transport'
import { backToList, usePeopleAccess } from './usePeopleAccess'
import { PeopleFrame, PeopleHeading, PeopleState, RecordStatus, DetailHeading } from './PeopleUi'
type Teacher=components['schemas']['Teacher']
type Ministry=components['schemas']['AssignedMinistry']
type Invitation=components['schemas']['TeacherInvitation']
type Data={teachers:components['schemas']['TeacherList'];invitations:components['schemas']['TeacherInvitationList'];ministries:Ministry[]}
type Access=ReturnType<typeof usePeopleAccess<Data>>
type Confirmation={action:'assign'|'revoke'|'transfer';teacher:Teacher}|{action:'invitation';invitation:Invitation}|{action:'invite';email:string;ministry_ids:string[]}|null
export function TeacherManagementScreen(){const church=useWorkspaceChurchId(new URLSearchParams(location.search).get('church')??'');return <ScopedTeachers key={church} church={church}/>}
function ScopedTeachers({church}:{church:string}){
 const [teacherPage,setTeacherPage]=useState(1),[invitationPage,setInvitationPage]=useState(1),[search,setSearch]=useState(''),[status,setStatus]=useState('all')
 const load=useCallback(async()=>{
  const [teachers,invitations,ministries]=await Promise.all([
   authRequest<components['schemas']['TeacherList']>('/api/teachers?page='+teacherPage,'GET',undefined,church),
   authRequest<components['schemas']['TeacherInvitationList']>('/api/teacher-invitations?page='+invitationPage,'GET',undefined,church),
   authRequest<components['schemas']['AssignedMinistries']>('/api/assigned-ministries','GET',undefined,church)])
  return{teachers,invitations,ministries:ministries.data}
 },[church,teacherPage,invitationPage])
 const access=usePeopleAccess(church,load,true)
 return <PeopleFrame><PeopleHeading title="Teachers" owner={access.role==='owner'} church={church}/><PeopleState {...access}/>
 {access.phase==='ready'&&access.data&&<TeacherViews key={access.epoch} access={access} data={access.data} search={search} setSearch={setSearch} status={status} setStatus={setStatus} teacherPage={teacherPage} invitationPage={invitationPage} setTeacherPage={value=>{access.refresh();setTeacherPage(value)}} setInvitationPage={value=>{access.refresh();setInvitationPage(value)}}/>}</PeopleFrame>
}
function TeacherViews({access,data,search,setSearch,status,setStatus,teacherPage,setTeacherPage,invitationPage,setInvitationPage}:{access:Access;data:Data;search:string;setSearch:(value:string)=>void;status:string;setStatus:(value:string)=>void;teacherPage:number;setTeacherPage:(value:number)=>void;invitationPage:number;setInvitationPage:(value:number)=>void}){
 const [teacher,setTeacher]=useState<Teacher|null>(null),[inviting,setInviting]=useState(false),[confirm,setConfirm]=useState<Confirmation>(null)
 const trigger=useRef<HTMLElement|null>(null),cancel=useRef<HTMLButtonElement>(null),dialogTrigger=useRef<HTMLElement|null>(null)
 const filtered=data.teachers.data.filter(row=>(status==='all'||row.status===status)&&row.display_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
 const names=(ids:string[])=>ids.map(id=>data.ministries.find(item=>item.id===id)?.name??'Unavailable ministry').join(', ')||'No assigned ministries'
 const back=()=>backToList(()=>{setTeacher(null);setInviting(false)},trigger)
 const open=(value:Confirmation,button:HTMLElement)=>{dialogTrigger.current=button;setConfirm(value)}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!confirm)return
  const form=event.currentTarget,fields=new FormData(form)
  if(confirm.action==='assign')await access.mutate('/api/teachers/'+confirm.teacher.id+'/assignments','PUT',{ministry_ids:fields.getAll('ministry_ids').map(String)})
  else if(confirm.action==='revoke')await access.mutate('/api/teachers/'+confirm.teacher.id,'DELETE')
  else if(confirm.action==='invitation')await access.mutate('/api/teacher-invitations/'+confirm.invitation.id,'DELETE')
  else if(confirm.action==='invite')await access.mutate('/api/teacher-invitations','POST',{email:confirm.email,ministry_ids:confirm.ministry_ids})
  else{
   const password=String(fields.get('password')),code=String(fields.get('code'))
   // Clear assurance material before awaiting any result, including failures.
   form.reset()
   await access.mutate('/api/ownership-transfer','POST',{target_membership_id:confirm.teacher.id,password,code},true)
  }
 }
 const target=confirm?('teacher' in confirm?confirm.teacher.display_name:'invitation' in confirm?confirm.invitation.email:confirm.email):''
 const title=confirm?.action==='assign'?`Edit assignments for ${target}`:confirm?.action==='revoke'?`Revoke access for ${target}?`:confirm?.action==='transfer'?`Transfer ownership to ${target}?`:confirm?.action==='invite'?`Invite ${target}?`:`Revoke invitation for ${target}?`
 return <div className={teacher||inviting?'has-detail':''}>
 {!teacher&&!inviting&&data.teachers.can_invite&&<Button onClick={event=>{trigger.current=event.currentTarget;setInviting(true)}}>Invite a Teacher</Button>}
 <div className="people-master-detail"><div className="people-list" hidden={inviting}><div className="people-filters"><Field label="Search loaded Teachers" value={search} onChange={event=>setSearch(event.target.value)}/><label>Status filter<select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All membership statuses</option><option value="active">Active</option><option value="revoked">Revoked</option></select></label></div>
 <p>Search applies only to the currently loaded authorized Teacher page. Showing {filtered.length} of {data.teachers.data.length} records on page {teacherPage}.</p>
 {!data.teachers.data.length?<p>No Teachers on this page.</p>:!filtered.length?<p>No matching Teachers on the loaded page.</p>:<table className="people-table"><caption>Teacher memberships</caption><thead><tr><th scope="col">Teacher</th><th scope="col">Ministries</th><th scope="col">Status</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td><Button variant="secondary" onClick={event=>{trigger.current=event.currentTarget;setTeacher(row)}}>View {row.display_name}</Button></td><td data-label="Ministries">{names(row.ministry_ids)}</td><td data-label="Status"><RecordStatus status={row.status}/></td></tr>)}</tbody></table>}
 <nav className="people-actions" aria-label="Teacher pages"><Button variant="secondary" disabled={access.busy||teacherPage===1} onClick={()=>setTeacherPage(teacherPage-1)}>Previous Teachers</Button><Button variant="secondary" disabled={access.busy||!data.teachers.has_more} onClick={()=>setTeacherPage(teacherPage+1)}>Next Teachers</Button></nav></div>
 {teacher&&<section className="people-detail" aria-label="Teacher detail"><DetailHeading>{teacher.display_name}</DetailHeading><RecordStatus status={teacher.status}/><h4>Assigned ministries</h4><p>{names(teacher.ministry_ids)}</p>
 <div className="people-actions"><Button variant="secondary" onClick={back}>Back to Teachers</Button>{teacher.can_manage&&<><Button onClick={event=>open({action:'assign',teacher},event.currentTarget)}>Edit assignments</Button><Button variant="danger" onClick={event=>open({action:'revoke',teacher},event.currentTarget)}>Revoke Teacher</Button></>}</div>
 {teacher.can_manage&&<section className="people-transfer" aria-label="Ownership transfer"><h4>Ownership transfer</h4><p>Separate protected process. It changes the church Owner and requires your current password and a fresh MFA code. The server enforces exactly one active Owner.</p><Button variant="secondary" onClick={event=>open({action:'transfer',teacher},event.currentTarget)}>Transfer ownership</Button></section>}</section>}
 {inviting&&<section className="people-detail"><DetailHeading>Invite a Teacher</DetailHeading><form className="people-form" aria-label="Invite a Teacher" onSubmit={event=>{event.preventDefault();const fields=new FormData(event.currentTarget);dialogTrigger.current=event.currentTarget.querySelector('button[type=submit]');setConfirm({action:'invite',email:String(fields.get('email')).trim().toLowerCase(),ministry_ids:fields.getAll('ministry_ids').map(String)})}}><Field label="Invitation email" error={access.fieldErrors.includes("email")?"Check this field.":undefined} name="email" type="email" maxLength={254} required autoComplete="email" disabled={access.busy}/><Choices ministries={data.ministries} disabled={access.busy}/><p>Select at least one active ministry. Invitations expire after seven days. Only the invited identity may accept; creating an invitation does not create an accepted membership.</p><div className="people-actions"><Button type="submit" disabled={access.busy||!data.ministries.length}>Review invitation</Button><Button variant="secondary" disabled={access.busy} onClick={back}>Cancel</Button></div></form></section>}
 </div>
 {!teacher&&!inviting&&<section><h3>Invitations</h3><p>Invitation status is separate from Teacher membership. Page {invitationPage}.</p>{!data.invitations.data.length&&<p>No invitations on this page.</p>}
 <ul className="application-list">{data.invitations.data.map(invitation=><li key={invitation.id}><p>{invitation.email} · {invitation.status}</p><p>{invitation.expires_at?'Expires: '+new Date(invitation.expires_at).toLocaleString():'Expiration unavailable'}</p>{invitation.status==='pending'&&<Button variant="danger" onClick={event=>open({action:'invitation',invitation},event.currentTarget)}>Revoke invitation for {invitation.email}</Button>}</li>)}</ul>
 <nav className="people-actions" aria-label="Invitation pages"><Button variant="secondary" disabled={access.busy||invitationPage===1} onClick={()=>setInvitationPage(invitationPage-1)}>Previous invitations</Button><Button variant="secondary" disabled={access.busy||!data.invitations.has_more} onClick={()=>setInvitationPage(invitationPage+1)}>Next invitations</Button></nav></section>}
 <Dialog open={!!confirm} title={title} initialFocus={cancel} returnFocus={dialogTrigger} onClose={()=>{if(!access.busy)setConfirm(null)}}>{confirm&&<form className="people-form" onSubmit={event=>void submit(event)}>{access.error&&<p role="alert">{access.error}</p>}
 {confirm.action==='assign'&&<><p>Saving replaces the ministry assignments for {target}. Removed assignments end access to those rosters. Confirm the selected ministries.</p><Choices ministries={data.ministries} selected={confirm.teacher.ministry_ids} disabled={access.busy}/></>}
 {confirm.action==='revoke'&&<p>This ends {target}&apos;s server sessions, assignments, push access and offline authorization. Audit history is retained.</p>}
 {confirm.action==='invitation'&&<p>This prevents {target} from accepting this invitation. Existing audit history is retained.</p>}
 {confirm.action==='invite'&&<p>Invite {target} to {names(confirm.ministry_ids)}. The invitation is bound to this email and expires after seven days.</p>}
 {confirm.action==='transfer'&&<><p>You will become a Teacher and lose Owner permissions. Both accounts must sign in again. Your existing ministry assignments remain. This transfers ownership to {target}.</p><Field label="Current password" error={access.fieldErrors.includes("password")?"Check this field.":undefined} name="password" type="password" autoComplete="current-password" required disabled={access.busy}/><Field label="Fresh authenticator code" error={access.fieldErrors.includes("code")?"Check this field.":undefined} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required disabled={access.busy}/><p>Use a new code that has not already been used to sign in. Assurance is checked by the server.</p><label className="people-choice"><input type="checkbox" required disabled={access.busy}/>I understand that ownership will transfer to {target}.</label></>}
 <div className="people-actions"><Button ref={cancel} variant="secondary" disabled={access.busy} onClick={()=>setConfirm(null)}>Cancel</Button><Button type="submit" variant={confirm.action==='revoke'||confirm.action==='invitation'?'danger':'primary'} disabled={confirm.action==='invite'&&!confirm.ministry_ids.length} busy={access.busy}>{confirm.action==='assign'?'Save assignments':confirm.action==='revoke'?'Confirm revocation':confirm.action==='transfer'?'Confirm transfer':confirm.action==='invite'?'Invite Teacher':'Confirm invitation revocation'}</Button></div></form>}</Dialog>
 </div>
}
function Choices({ministries,selected=[],disabled=false}:{ministries:Ministry[];selected?:string[];disabled?:boolean}){return <fieldset disabled={disabled}><legend>Ministries</legend>{!ministries.length&&<p>No active ministries are available for assignment.</p>}{ministries.map(row=><label className="people-choice" key={row.id}><input type="checkbox" name="ministry_ids" value={row.id} defaultChecked={selected.includes(row.id)}/>{row.name}</label>)}</fieldset>}
