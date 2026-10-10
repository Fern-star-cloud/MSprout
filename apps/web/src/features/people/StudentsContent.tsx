import { useCallback, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { useWorkspaceChurchId } from '../../app/workspace-context'
import { Button, Dialog, Field } from '../../components/ui/Foundations'
import { authRequest } from '../auth/transport'
import { backToList, usePeopleAccess } from './usePeopleAccess'
import { PeopleFrame, PeopleHeading, PeopleState, RecordStatus, DetailHeading } from './PeopleUi'
import { avatarForGender } from '../students/avatar'
type Student=components['schemas']['Student']
type Ministry=components['schemas']['Ministry']
type Data={students:Student[];ministries:Ministry[]}
type Access=ReturnType<typeof usePeopleAccess<Data>>
export function StudentsScreen(){
 const church=useWorkspaceChurchId(new URLSearchParams(location.search).get('church')??'')
 const hint=new URLSearchParams(location.search).get('ministry')??''
 return <ScopedStudents key={church+':'+hint} church={church}/>
}
function ScopedStudents({church}:{church:string}){
 const [status,setStatus]=useState('active'),[ministry,setMinistry]=useState(new URLSearchParams(location.search).get('ministry')??''),[search,setSearch]=useState('')
 const load=useCallback(async(role:'owner'|'teacher')=>{
  const choices=await authRequest<{data:Ministry[]}>('/api/ministries'+(role==='owner'?'?include_archived=true':''),'GET',undefined,church)
  if(ministry&&!choices.data.some(item=>item.id===ministry))throw{status:403}
  const query=new URLSearchParams()
  if(role==='owner'&&status!=='active')query.set('include_archived','true')
  if(ministry)query.set('ministry_id',ministry)
  const rows=await authRequest<{data:Student[]}>('/api/students'+(query.size?'?'+query:''),'GET',undefined,church)
  return{students:rows.data,ministries:choices.data}
 },[church,ministry,status])
 const access=usePeopleAccess(church,load)
 return <PeopleFrame><PeopleHeading title="Students" church={church} owner={access.role==='owner'}/><PeopleState {...access}/>
 {access.phase==='ready'&&access.data&&<StudentViews key={access.epoch} access={access} data={access.data} search={search} setSearch={setSearch} status={status} setStatus={value=>{access.refresh();setStatus(value)}} ministry={ministry} setMinistry={value=>{access.refresh();setMinistry(value)}}/>}</PeopleFrame>
}
function StudentViews({access,data,search,setSearch,status,setStatus,ministry,setMinistry}:{access:Access;data:Data;search:string;setSearch:(value:string)=>void;status:string;setStatus:(value:string)=>void;ministry:string;setMinistry:(value:string)=>void}){
 const owner=access.role==='owner',trigger=useRef<HTMLElement|null>(null),cancel=useRef<HTMLButtonElement>(null),dialogTrigger=useRef<HTMLElement|null>(null)
 const [student,setStudent]=useState<Student|null>(null),[mode,setMode]=useState<'list'|'detail'|'add'|'edit'>('list'),[checking,setChecking]=useState(false)
 const [confirmation,setConfirmation]=useState<'archive'|'restore'|'enrollments'|null>(null),selection=useRef(0)
 const rows=data.students.filter(row=>(!owner||status==='all'||row.status===status)&&row.display_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
 const names=(ids:string[])=>ids.map(id=>data.ministries.find(item=>item.id===id)?.name??'Unavailable ministry').join(', ')||'No ministry'
 const back=()=>backToList(()=>{selection.current++;setChecking(false);setStudent(null);setMode('list')},trigger)
 async function view(row:Student,button:HTMLElement){
  const token=++selection.current;trigger.current=button;setChecking(true);setStudent(null)
  const found=await access.read<Student>('/api/students/'+row.id)
  if(token===selection.current){setChecking(false);if(found){setStudent(found);setMode('detail')}}
 }
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const fields=new FormData(event.currentTarget),body:Record<string,unknown>={}
  for(const key of ['first_name','middle_name','last_name','preferred_name','suffix','date_of_birth','gender','external_reference'])body[key]=String(fields.get(key)||'')||null
  if(mode==='add')body.ministry_ids=fields.getAll('ministry_ids').map(String)
  await access.mutate('/api/students'+(mode==='edit'&&student?'/'+student.id:''),mode==='edit'?'PUT':'POST',body)
 }
 return <div className={mode!=='list'?'has-detail':''}>
 {checking&&<p role="status">Checking student access…</p>}
 {owner&&mode==='list'&&<div className="people-actions"><Button disabled={access.busy||checking} onClick={event=>{trigger.current=event.currentTarget;setMode('add')}}>Add student</Button><a href={`/account/imports?church=${encodeURIComponent(access.church)}`}>Import students</a></div>}
 <div className="people-master-detail"><div className="people-list" hidden={mode==='add'||mode==='edit'}>
 <div className="people-filters"><Field label="Search loaded students" value={search} onChange={event=>setSearch(event.target.value)}/>
 <label>Ministry filter<select value={ministry} disabled={access.busy||checking} onChange={event=>setMinistry(event.target.value)}><option value="">{owner?'All authorized ministries':'All assigned ministries'}</option>{data.ministries.map(item=><option key={item.id} value={item.id}>{item.name}{item.status==='archived'?' · Archived':''}</option>)}</select></label>
 {owner&&<label>Status filter<select value={status} disabled={access.busy||checking} onChange={event=>setStatus(event.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">Active and archived</option></select></label>}</div>
 <p>Search applies only to loaded authorized students. {owner?'':'Read-only assigned roster. '}Showing {rows.length} of {data.students.length} loaded records.</p>
 {!data.students.length?<p>{owner?'No students in this selection.':!data.ministries.length?'No ministry assigned. Check with your church Owner.':'No students in your assigned roster.'}</p>:!rows.length?<p>No matching students in the loaded records.</p>:<table className="people-table"><caption>Authorized students</caption><thead><tr><th scope="col">Student</th><th scope="col">Ministries</th><th scope="col">Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><Button variant="secondary" disabled={access.busy||checking} onClick={event=>void view(row,event.currentTarget)}>View {row.display_name}</Button></td><td data-label="Ministries">{names(row.ministry_ids)}</td><td data-label="Status"><RecordStatus status={row.status}/></td></tr>)}</tbody></table>}
 </div>
 {mode==='detail'&&student&&<section className="people-detail" aria-label="Student detail"><DetailHeading>{student.display_name}</DetailHeading><img className="student-avatar" src={avatarForGender(student.gender)} alt=""/><RecordStatus status={student.status}/>
 <dl><dt>Ministries</dt><dd>{names(student.ministry_ids)}</dd><dt>Gender</dt><dd>{student.gender}</dd><dt>Birthday</dt><dd>{owner?student.date_of_birth??'Not provided':student.birth_month_day??'Not provided'}</dd>{owner&&<><dt>External reference</dt><dd>{student.external_reference??'Not provided'}</dd></>}</dl>
 <div className="people-actions"><Button variant="secondary" onClick={back}>Back to students</Button>{owner&&<><Button onClick={()=>setMode('edit')}>Edit student</Button><Button variant="secondary" onClick={event=>{dialogTrigger.current=event.currentTarget;setConfirmation('enrollments')}}>Edit enrollments</Button><Button variant={student.status==='active'?'danger':'secondary'} onClick={event=>{dialogTrigger.current=event.currentTarget;setConfirmation(student.status==='active'?'archive':'restore')}}>{student.status==='active'?'Archive student':'Restore student'}</Button></>}</div></section>}
 {(mode==='add'||mode==='edit')&&owner&&<section className="people-detail"><DetailHeading>{mode==='add'?'Add student':'Edit '+student?.display_name}</DetailHeading><form className="people-form" aria-label={mode==='add'?'Add student':'Edit student'} onSubmit={event=>void save(event)}>
 <fieldset disabled={access.busy}><legend>Supported student details</legend>
 {(['first_name','middle_name','last_name','preferred_name','suffix'] as const).map(key=><Field key={key} label={{first_name:'First name',middle_name:'Middle name',last_name:'Last name',preferred_name:'Preferred name',suffix:'Suffix'}[key]} error={access.fieldErrors.includes(key)?"Check this field.":undefined} name={key} maxLength={key==='suffix'?40:120} required={key==='first_name'||key==='last_name'} defaultValue={mode==='edit'?student?.[key]??'':''}/>)}
 <Field label="Birthdate" error={access.fieldErrors.includes("date_of_birth")?"Check this field.":undefined} name="date_of_birth" type="date" max={new Date().toISOString().slice(0,10)} defaultValue={mode==='edit'?student?.date_of_birth??'':''}/>
 <label>Gender<select name="gender" defaultValue={mode==='edit'?student?.gender:'unspecified'}><option value="unspecified">Unspecified</option><option value="female">Female</option><option value="male">Male</option></select></label><Field label="External reference" error={access.fieldErrors.includes("external_reference")?"Check this field.":undefined} name="external_reference" maxLength={120} defaultValue={mode==='edit'?student?.external_reference??'':''}/>
 {mode==='add'&&<EnrollmentChoices ministries={data.ministries}/>}</fieldset>
 <div className="people-actions"><Button type="submit" busy={access.busy}>Save student</Button><Button variant="secondary" disabled={access.busy} onClick={mode==='add'?back:()=>setMode('detail')}>Cancel</Button></div></form></section>}
 </div>
 <Dialog open={!!confirmation} title={confirmation==='enrollments'?`Update enrollments for ${student?.display_name}?`:`${confirmation==='archive'?'Archive':'Restore'} ${student?.display_name}?`} initialFocus={cancel} returnFocus={dialogTrigger} onClose={()=>{if(!access.busy)setConfirmation(null)}}>
 {student&&<form className="people-form" onSubmit={event=>{event.preventDefault();const fields=new FormData(event.currentTarget);void access.mutate('/api/students/'+student.id+(confirmation==='enrollments'?'/enrollments':'/'+confirmation),confirmation==='enrollments'?'PUT':'POST',confirmation==='enrollments'?{ministry_ids:fields.getAll('ministry_ids').map(String)}:undefined)}}>
 {access.error&&<p role="alert">{access.error}</p>}<p>{confirmation==='archive'?'This archives the student; attendance and audit history are retained.':confirmation==='restore'?'This restores the existing student. Ministry enrollment remains subject to current server validation.':'Saving replaces all current enrollment links. Archived ministries cannot be selected; their existing links are removed only by this deliberate replacement.'}</p>
 {confirmation==='enrollments'&&<EnrollmentChoices ministries={data.ministries} selected={student.ministry_ids} disabled={access.busy}/>}
 <div className="people-actions"><Button ref={cancel} variant="secondary" disabled={access.busy} onClick={()=>setConfirmation(null)}>Cancel</Button><Button type="submit" variant={confirmation==='archive'?'danger':'primary'} busy={access.busy}>{confirmation==='enrollments'?'Save enrollments':confirmation==='archive'?'Confirm archive':'Confirm restore'}</Button></div></form>}
 </Dialog></div>
}
function EnrollmentChoices({ministries,selected=[],disabled=false}:{ministries:Ministry[];selected?:string[];disabled?:boolean}){
 return <fieldset disabled={disabled}><legend>Enroll in active ministries</legend>{ministries.filter(item=>item.status==='active').map(item=><label className="people-choice" key={item.id}><input type="checkbox" name="ministry_ids" value={item.id} defaultChecked={selected.includes(item.id)}/>{item.name}</label>)}{!ministries.some(item=>item.status==='active')&&<p>No active ministries are available.</p>}</fieldset>
}
