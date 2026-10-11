import { useEffect, useRef, useState } from 'react'
import { useWorkspaceChurchId } from '../../app/workspace-context'
import { Button, Dialog, ErrorSummary, LoadingState, StatusBadge, StatusBanner, Tabs } from '../../components/ui/Foundations'
import { attendanceValue, normalizeReason, type Choice, type Conflict, type Guest, type GuestAction, type Target } from './review-model'
import { useReviewQueue } from './useReviewQueue'
import './review.css'

export function ConflictReviewScreen({ initialChurchId = new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? '' }: { initialChurchId?: string }) {
  const church = useWorkspaceChurchId(initialChurchId)
  return <ScopedReview key={church} church={church}/>
}
function ScopedReview({church}:{church:string}) {
  const queue=useReviewQueue(church)
  return <section className="dashboard-card owner-review" aria-labelledby="review-heading">
    <p className="eyebrow">Church workspace · Online only</p><h1 id="review-heading">Attendance review</h1>
    {queue.workspace&&<p>{queue.workspace.name} · {queue.workspace.role==='owner'?'Owner review':'Teacher'}</p>}
    <ReviewContent key={`${queue.actor}:${queue.phase}:${queue.role}`} church={church} queue={queue}/>
  </section>
}
function ReviewContent({church,queue}:{church:string;queue:ReturnType<typeof useReviewQueue>}) {
  const [selected,setSelected]=useState<Target|null>(null),[confirmation,setConfirmation]=useState<{target:Target;body:Record<string,unknown>;action?:GuestAction;summary:string}|null>(null)
  const [choice,setChoice]=useState<Choice|''>(''),[reason,setReason]=useState(''),[guestAction,setGuestAction]=useState<GuestAction|''>('')
  const [checking,setChecking]=useState(false),[localError,setLocalError]=useState('')
  const queues=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null),dialogTrigger=useRef<HTMLElement|null>(null),cancel=useRef<HTMLButtonElement>(null),heading=useRef<HTMLHeadingElement>(null),error=useRef<HTMLDivElement>(null),pointer=useRef(false),returnToQueue=useRef(false)
  const reset=()=>{setSelected(null);setConfirmation(null);setChoice('');setReason('');setGuestAction('');setLocalError('')}
  // Scope invalidation unmounts all protected details, including open dialogs.
  // A fresh queue never resurrects a prior decision or confirmation.
  const active=queue.phase==='ready'&&queue.role==='owner'
  useEffect(()=>{heading.current?.focus()},[selected?.item.id,queue.reset])
  useEffect(()=>{if(queue.error||localError)error.current?.focus()},[queue.error,localError])
  // Native dialog close restores focus during passive cleanup. Return only
  // after that cleanup, with the queue already exposed by the committed render.
  useEffect(()=>{
    if(!returnToQueue.current||selected&&!queue.pending||!queues.current||queues.current.hidden)return
    returnToQueue.current=false
    const target=trigger.current?.isConnected&&!trigger.current.matches(':disabled')?trigger.current:queues.current.querySelector<HTMLElement>('[role=tabpanel]:not([hidden]) h2')
    target?.focus()
  },[selected,queue.pending,queue.busy])
  const back=()=>{returnToQueue.current=true;reset()}
  async function selectConflict(item:Conflict,button:HTMLElement){trigger.current=button;setChecking(true);const found=await queue.inspect(item);setChecking(false);if(found){setChoice('');setReason('');setSelected({kind:'conflict',item:found})}}
  function selectGuest(item:Guest,button:HTMLElement){trigger.current=button;setGuestAction('');setSelected({kind:'guest',item})}
  function reviewDecision(button:HTMLElement){const normalized=normalizeReason(reason);if(!choice||!normalized||detail?.kind!=='conflict'){setLocalError('Choose a value and enter a resolution reason of 500 characters or fewer.');return}dialogTrigger.current=button;setLocalError('');setConfirmation({target:detail,body:{choice,reason:normalized},summary:`${choice==='existing'?'Existing':'Incoming'} value · ${attendanceValue(detail.item[choice].value.state)}`})}
  function reviewGuest(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!guestAction||selected?.kind!=='guest')return
    const fields=new FormData(event.currentTarget),body:Record<string,unknown>=guestAction==='promote'?{first_name:String(fields.get('first_name')??'').trim(),last_name:String(fields.get('last_name')??'').trim(),gender:String(fields.get('gender'))}:guestAction==='link'?{student_id:String(fields.get('student_id')??'')}:{guest_id:String(fields.get('guest_id')??'')}
    if(guestAction==='promote'&&['first_name','last_name'].some(field=>!body[field]||Array.from(String(body[field])).length>120)){setLocalError('Enter first and last names of 120 characters or fewer.');return}
    const targetName=guestAction==='link'?queue.students.find(row=>row.id===body.student_id)?.display_name:guestAction==='merge'?queue.guests.find(row=>row.id===body.guest_id)?.display_name:undefined
    if(guestAction!=='promote'&&!targetName){setLocalError('Choose an authorized target.');return}
    dialogTrigger.current=event.currentTarget.querySelector('button[type="submit"]');setLocalError('');setConfirmation({target:selected,body,action:guestAction,summary:guestAction==='promote'?`Create student: ${body.first_name} ${body.last_name}`:guestAction==='link'?`Link to ${targetName}`:`Merge into ${targetName}`})
  }
  async function confirm(){if(!selected||!confirmation)return;const result=await queue.submit(confirmation.target,confirmation.body,confirmation.action);setConfirmation(null);if(result==='edit')return;if(result==='changed'){setChoice('');setReason('');setGuestAction('');return}if(result==='closed'||result==='unknown')back()}
  const freshConflict=selected?.kind==='conflict'?queue.conflicts.find(row=>row.id===selected.item.id):undefined
  const detail=selected?.kind==='conflict'&&freshConflict?{kind:'conflict' as const,item:freshConflict}:selected
  const disabled=queue.busy||checking||Boolean(queue.pending)
  return <div className="review-content"
    onPointerDownCapture={()=>{pointer.current=true}} onPointerUpCapture={()=>{pointer.current=false}} onPointerCancelCapture={()=>{pointer.current=false}} onKeyDownCapture={()=>{pointer.current=false}}
    onFocusCapture={event=>{const target=event.target;if(pointer.current||target.closest('dialog'))return;queueMicrotask(()=>{if(!target.isConnected||document.activeElement!==target)return;const rect=target.getBoundingClientRect(),navigation=document.querySelector('.phone-navigation')?.getBoundingClientRect();if(rect.top<4||rect.bottom>(navigation?.height?navigation.top:innerHeight)-4)target.scrollIntoView?.({block:'start',inline:'nearest'})})}}>
    {(queue.error||localError)&&<ErrorSummary ref={error} message={localError||queue.error} errors={queue.fields.map(field=>({target:`review-${field}`,message:field==='reason'?'Check the resolution reason.':`Check ${field.replace('_',' ')}.`}))}/>}
    {queue.phase==='loading'&&<LoadingState label="Checking church access and review queues…"/>}
    {queue.phase==='error'&&<Button variant="secondary" onClick={()=>{reset();queue.refresh()}} disabled={queue.busy||!navigator.onLine}>Check account access</Button>}
    {queue.phase==='ready'&&queue.role==='teacher'&&<StatusBanner live tone={queue.teacherNotice?'warning':'neutral'}><strong>{queue.teacherNotice?'Needs Owner Review':'No assigned attendance conflicts need Owner review.'}</strong><p>An Owner reviews competing values. Other actors, devices and Owner decisions are not shown.</p></StatusBanner>}
    {active&&<>
      {queue.notice&&<StatusBanner live>{queue.notice}</StatusBanner>}
      {queue.pending&&<div className="review-uncertain"><p>Another submission is blocked until the current outcome is verified. No action is retried automatically.</p><Button variant="secondary" busy={queue.busy} onClick={()=>void queue.checkOutcome()}>Check current outcome</Button></div>}
      <p>Counts describe the records returned by the current authorized queues (up to 100 each), not complete church history.</p>
      <a href={`/account/reports?church=${encodeURIComponent(church)}`}>Reports and attendance history</a>
      <Button variant="secondary" disabled={disabled} onClick={queue.refresh}>Refresh review queues</Button>
      {<div ref={queues} hidden={Boolean(detail)&&!queue.pending}><Tabs label="Review queues" items={[
        {id:'conflicts',label:`Conflicts (${queue.conflicts.length} loaded)`,content:<><h2 tabIndex={-1}>Conflicts</h2>{queue.conflicts.length===0?<p>No attendance conflicts need review.</p>:<ul className="review-queue">{queue.conflicts.map(item=><li key={item.id}><h3>Attendance value conflict</h3><StatusBadge tone="warning">Needs Owner review</StatusBadge><p id={`case-${item.id}`}>Conflict {item.id} · Base version {item.base_version}</p><p>Two submitted values require a deliberate decision.</p><Button aria-describedby={`case-${item.id}`} disabled={disabled} onClick={event=>void selectConflict(item,event.currentTarget)}>Review attendance conflict</Button></li>)}</ul>}</>},
        {id:'guests',label:`Temporary guests (${queue.guests.length} loaded)`,content:<><h2 tabIndex={-1}>Pending temporary guests</h2><p>Select one supported action. Original guest provenance is retained.</p>{queue.guests.length===0?<p>No temporary guests are returned in the current pending queue.</p>:<ul className="review-queue">{queue.guests.map(item=><li key={item.id}><h3>{item.display_name}</h3><StatusBadge tone="warning">Pending review</StatusBadge><p id={`case-${item.id}`}>Guest {item.id} · Session {item.session_id}</p><Button aria-describedby={`case-${item.id}`} disabled={disabled} onClick={event=>selectGuest(item,event.currentTarget)}>Review {item.display_name}</Button></li>)}</ul>}<h2>Confirmed dispositions this visit</h2><p>The pending API does not provide a complete resolved-guest history.</p>{queue.resolved.map(row=><article className="review-result" key={row.result.id}><h3>{row.name}</h3><StatusBadge tone="success">{row.result.status==='promoted'?'Promoted':row.result.status==='linked'?'Linked':'Merged'}</StatusBadge><p>Server-confirmed. No repeat action is available.</p></article>)}</>}
      ]}/></div>}
      {detail&&!queue.pending&&<>
        <Button variant="secondary" disabled={queue.busy} onClick={back}>Back to queues</Button>
        <h2 ref={heading} tabIndex={-1}>{detail.kind==='conflict'?'Attendance value conflict':detail.item.display_name}</h2>
        {detail.kind==='conflict'?<>
          <p>Choose the actual existing or incoming value. Nothing is selected initially. Original attendance is immutable; resolution adds a revision.</p>
          <div className="conflict-comparison">{(['existing','incoming'] as const).map(side=><section key={side} className="conflict-side" aria-label={`${side==='existing'?'Existing':'Incoming'} value attendance value`}><h3>{side==='existing'?'Existing':'Incoming'} value · {attendanceValue(detail.item[side].value.state)}</h3><details><summary>Supported provenance</summary><dl>{(['actor_id','device_id','local_time','server_time','correlation_id'] as const).map(field=><div key={field}><dt>{({actor_id:'Actor',device_id:'Device',local_time:'Local time (UTC source)',server_time:'Server time (UTC source)',correlation_id:'Correlation reference'})[field]}</dt><dd>{detail.item[side][field]??'Unavailable'}</dd></div>)}</dl></details></section>)}</div>
          <details><summary>Attendance references</summary><p>Session {detail.item.session_id} · Record {detail.item.record_id} · Base version {detail.item.base_version}</p></details>
          <fieldset id="review-choice" tabIndex={-1} disabled={disabled} aria-invalid={queue.fields.includes('choice')||undefined}><legend>Choose the attendance value</legend>{(['existing','incoming'] as const).map(side=><label className="review-choice" key={side}><input type="radio" name="conflict-choice" checked={choice===side} onChange={()=>{setChoice(side);setConfirmation(null)}}/>{side==='existing'?'Existing':'Incoming'} value · {attendanceValue(detail.item[side].value.state)}</label>)}</fieldset>
          <label htmlFor="review-reason">Resolution reason</label><textarea id="review-reason" value={reason} disabled={disabled} aria-describedby="review-reason-help" aria-invalid={queue.fields.includes('reason')||undefined} onChange={event=>{setReason(event.target.value);setConfirmation(null)}}/>
          <p id="review-reason-help">Required · 1–500 characters after whitespace normalization.</p>
          <Button disabled={disabled||!choice||!normalizeReason(reason)} onClick={event=>reviewDecision(event.currentTarget)}>Review decision</Button>
        </>:<>
          <StatusBadge tone="warning">Pending review</StatusBadge>
          <details><summary>Supported guest provenance</summary><p>{detail.item.gender} · Actor {detail.item.actor_id} · Device {detail.item.device_id}</p><p>Local {detail.item.local_time} · Server {detail.item.server_time} (UTC source)</p></details>
          <label htmlFor="review-action">Guest action</label><select id="review-action" value={guestAction} disabled={disabled} onChange={event=>{setGuestAction(event.target.value as GuestAction|'');setConfirmation(null);setLocalError('')}}><option value="">Choose one action</option><option value="promote">Create/promote student</option><option value="link">Link existing student</option><option value="merge">Merge duplicate</option></select>
          {guestAction&&<form key={guestAction+queue.reset} aria-label={`${guestAction==='promote'?'Promote':guestAction==='link'?'Link':'Merge'} ${detail.item.display_name}`} onSubmit={reviewGuest}><fieldset disabled={disabled}>
            <legend>{guestAction==='promote'?'Create student':guestAction==='link'?'Link an existing student':'Merge into a canonical guest'}</legend>
            {guestAction==='promote'?<><label htmlFor="review-first_name">First name</label><input id="review-first_name" name="first_name" required maxLength={120}/><label htmlFor="review-last_name">Last name</label><input id="review-last_name" name="last_name" required maxLength={120}/><label htmlFor="review-gender">Gender</label><select id="review-gender" name="gender" defaultValue={detail.item.gender}><option value="unspecified">Unspecified</option><option value="female">Female</option><option value="male">Male</option></select></>:guestAction==='link'?<><label htmlFor="review-student_id">Student</label><select id="review-student_id" name="student_id" required defaultValue=""><option value="">Choose a loaded active student</option>{queue.students.map(row=><option key={row.id} value={row.id}>{row.display_name}</option>)}</select><p>Only active students returned by the authorized list are offered.</p></>:<><label htmlFor="review-guest_id">Canonical guest</label><select id="review-guest_id" name="guest_id" required defaultValue=""><option value="">Choose a pending guest from this session</option>{queue.guests.filter(row=>row.id!==detail.item.id&&row.session_id===detail.item.session_id).map(row=><option key={row.id} value={row.id}>{row.display_name}</option>)}</select><p>Merge retains both guest records. Other sessions are excluded.</p></>}
            <Button type="submit" disabled={disabled}>Review guest action</Button>
          </fieldset></form>}
        </>}
        <Dialog open={Boolean(confirmation)&&!queue.pending} title={detail.kind==='conflict'?'Confirm attendance decision':'Confirm guest action'} onClose={()=>{if(!queue.busy)setConfirmation(null)}} initialFocus={cancel} returnFocus={dialogTrigger}>
          <p>{queue.workspace?.name??'This verified church workspace'}</p><p>{confirmation?.summary}</p>
          {detail.kind==='conflict'?<><p>Attendance conflict {detail.item.id}</p><p>Reason: {String(confirmation?.body.reason??'')}</p><p>Original attendance stays unchanged. This adds an append-only revision and audit entry.</p></>:<><p>Guest: {detail.item.display_name} · {detail.item.id}</p><p>Selected target reference: {String(confirmation?.body.student_id??confirmation?.body.guest_id??"New student")}</p><p>{confirmation?.action==='promote'?'Creates a new student and ministry enrollment with Present attendance.':confirmation?.action==='link'?'Associates this guest’s Present attendance with the selected existing student.':'Retains both guest records and marks this one as a merged duplicate.'} Original actor and times remain attached.</p></>}
          <div className="review-actions"><Button variant="secondary" ref={cancel} disabled={queue.busy} onClick={()=>setConfirmation(null)}>Cancel</Button><Button busy={queue.busy} onClick={()=>void confirm()}>{detail.kind==='conflict'?'Confirm resolution':'Confirm guest action'}</Button></div>
        </Dialog>
      </>}
    </>}
  </div>
}
