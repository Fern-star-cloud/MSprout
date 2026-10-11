import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { ChurchWorkspaceContext, useWorkspaceChurchId } from '../../app/workspace-context'
import { Button, ErrorSummary, LoadingState, StatusBanner } from '../../components/ui/Foundations'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { accessSignature, verifyNotificationWorkspace, type WorkspaceAccess } from '../notifications/workspace-access'
import '../birthdays/birthdays.css'

type AuditPage=components['schemas']['AuditPage']
type ActivityPage=Omit<AuditPage,'data'>&{data:Array<Pick<AuditPage['data'][number],'id'|'action'|'result'|'occurred_at'|'correlation_id'>>}
const ownActions=['submission.accepted','submission.rejected','sync.accepted','sync.rejected','sync.conflict']
const labels:Record<string,string>={'teacher.invited':'Teacher invited','invitation.accepted':'Invitation accepted','invitation.revoked':'Invitation revoked','teacher.assignments_changed':'Assignments changed','teacher.revoked':'Teacher access revoked','ownership.transferred':'Ownership transferred','sync.accepted':'Sync accepted','sync.rejected':'Sync rejected','sync.conflict':'Sync needs review','submission.accepted':'Submission accepted','submission.rejected':'Submission needs review','birthday.push.registered':'Birthday notification registration','birthday.push.revoked':'Birthday notification revocation','attendance.report.exported':'Attendance report exported'}
export function ChurchActivity(){
  const church=useWorkspaceChurchId(new URLSearchParams(location.search).get('church')??''),role=useContext(ChurchWorkspaceContext)?.role
  return <ScopedActivity key={`${church}:${role??''}`} church={church} role={role}/>
}
function ScopedActivity({church,role}:{church:string;role?:'owner'|'teacher'}){
  const [data,setData]=useState<ActivityPage|null>(null),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const generation=useRef(0),alive=useRef(false),reading=useRef<number|null>(null),identity=useRef<WorkspaceAccess|null>(null),selection=useRef(1),heading=useRef<HTMLHeadingElement>(null),errors=useRef<HTMLDivElement>(null)
  const clear=useCallback((message:string)=>{generation.current++;reading.current=null;setData(null);setLoading(false);setError(message)},[])
  const load=useCallback(async(next=selection.current)=>{
    if(reading.current!==null)return
    const token=++generation.current,current=()=>alive.current&&token===generation.current;reading.current=token;selection.current=next;setPage(next);setData(null);setError('');setLoading(true)
    try{
      if(!church||!navigator.onLine)throw Error('Online workspace required')
      const verified=await verifyNotificationWorkspace(church,role);if(!current())return
      if(identity.current&&accessSignature(identity.current)!==accessSignature(verified))throw {status:403}
      const response=await authRequest<AuditPage>(`/api/audit-events?page=${next}&per_page=25`,'GET',undefined,church);if(!current())return
      const scope=verified.role==='owner'?'church':'own'
      if(response.scope!==scope||response.page!==next||response.per_page!==25||typeof response.has_more!=='boolean'||!Array.isArray(response.data)||response.data.length>25)throw {status:403}
      const events=response.data.map(event=>{
        if(event.category!=='church'||!['success','failure','denied'].includes(event.result)||!Number.isFinite(Date.parse(event.occurred_at))||!/^[a-f\d-]{36}$/i.test(event.correlation_id)||typeof event.id!=='string'||typeof event.action!=='string'||scope==='own'&&(event.actor_type!=='user'||event.actor_id!==String(verified.actor)||!ownActions.includes(event.action)))throw {status:403}
        // Deliberately do not retain/render free-form metadata, actor or target identifiers.
        return {id:event.id,action:labels[event.action]??'Activity recorded',result:event.result,occurred_at:event.occurred_at,correlation_id:event.correlation_id}
      })
      identity.current=verified;setData({scope:response.scope,page:response.page,per_page:response.per_page,has_more:response.has_more,data:events});setLoading(false)
    }catch(failure){if(current())clear(!navigator.onLine?'Connect to the internet to view activity history.':safeAuthMessage(failure))}
    finally{if(reading.current===token)reading.current=null}
  },[church,role,clear])
  useEffect(()=>{alive.current=true;const timer=setTimeout(()=>void load(),0);const stop=()=>{alive.current=false;generation.current++;clearTimeout(timer)};return stop},[load])
  useEffect(()=>{
    const invalid=(event:Event)=>{const detail=(event as CustomEvent<{status:number;churchId?:string}>).detail;if(detail?.status===403&&detail.churchId&&detail.churchId!==church)return;clear('Access changed or expired. Check your account before viewing activity.')}
    const offline=()=>clear('Connect to the internet to view activity history.'),online=()=>void load(),focus=()=>{if(!role&&document.visibilityState==='visible'){clear('Rechecking activity…');void load()}}
    window.addEventListener('church-workspace-invalidated',invalid);window.addEventListener('offline',offline);window.addEventListener('online',online);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
    return()=>{window.removeEventListener('church-workspace-invalidated',invalid);window.removeEventListener('offline',offline);window.removeEventListener('online',online);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
  },[church,clear,load,role])
  useEffect(()=>{if(error)errors.current?.focus()},[error])
  function go(next:number){heading.current?.focus();void load(next)}
  return <section className="activity-screen" aria-labelledby="activity-heading"><header><p className="eyebrow">Activity history · Online only</p><h1 id="activity-heading" ref={heading} tabIndex={-1}>{data?.scope==='church'?'Church audit':data?.scope==='own'?'My activity':'Activity history'}</h1></header>
    <p>Authorized audit history, separate from system health and review queues. Original evidence is append-only. Broader activity feeds and event-detail reads are unavailable.</p>
    {loading&&<LoadingState label="Checking access and loading activity…"/>}{error&&<ErrorSummary ref={errors} message={error}/>}
    {!loading&&<Button variant="secondary" onClick={()=>void load()}>{error?'Retry activity':'Refresh activity'}</Button>}
    {data&&<><StatusBanner>{data.scope==='own'?'Only your supported submission and synchronization activity is shown.':'Only authorized church audit events are shown.'} Sensitive metadata, actor and target details are omitted.</StatusBanner>
      {data.data.length===0?<p>No activity to display.</p>:<ol className="audit-events">{data.data.map(event=><li key={event.id}><strong>{event.action}</strong><p>{event.result==='success'?'Completed':event.result==='denied'?'Denied':'Failed'} · <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</time></p><small>Reference: {event.correlation_id}</small></li>)}</ol>}
      <nav className="activity-actions" aria-label="History pages"><Button variant="secondary" disabled={page===1} onClick={()=>go(page-1)}>Previous</Button><span role="status">Page {page}</span><Button variant="secondary" disabled={!data.has_more||page>=10000} onClick={()=>go(page+1)}>Next</Button></nav></>}
  </section>
}
