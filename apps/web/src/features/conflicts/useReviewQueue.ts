import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { ChurchWorkspaceContext } from '../../app/workspace-context'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { attendanceValue, list, sameConflict, uuid, validConflict, validGuest, validGuestResult, validResolution, validStudent, type Conflict, type Guest, type GuestAction, type GuestResult, type Student, type Target } from './review-model'

type Role = 'owner' | 'teacher'
type State = { phase:'loading'|'ready'|'error'; actor:number; role:Role|null; conflicts:Conflict[]; guests:Guest[]; students:Student[]; teacherNotice:boolean; error:string; notice:string; fields:string[]; resolved:{name:string;result:GuestResult}[]; pending:Target|null; reset:number }
const empty = ():State => ({phase:'loading',actor:0,role:null,conflicts:[],guests:[],students:[],teacherNotice:false,error:'',notice:'',fields:[],resolved:[],pending:null,reset:0})
const status = (failure:unknown) => typeof failure==='object'&&failure!==null&&'status' in failure?Number(failure.status):0
const denied = (failure:unknown) => [401,403,419].includes(status(failure))

export function useReviewQueue(church:string) {
  const workspace=useContext(ChurchWorkspaceContext),[state,setState]=useState<State>(empty),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
  const generation=useRef(0),alive=useRef(false),operating=useRef(false),identity=useRef(0),uncertain=useRef<Target|null>(null)
  const clear=useCallback((message:string)=>{generation.current++;identity.current=0;uncertain.current=null;setState({...empty(),phase:'error',error:message})},[])
  const access=useCallback(async()=>{
    if(!uuid(church)||!navigator.onLine)throw Error('Online workspace required')
    const me=await authRequest<components['schemas']['ChurchAccount']>('/api/me','GET',undefined,church)
    const membership=me.memberships?.find(row=>row.church_id===church&&row.status==='active')
    if(!Number.isSafeInteger(me.id)||me.id<=0||me.email_verified!==true||!membership||!['owner','teacher'].includes(membership.role)
      ||workspace&&workspace.role!==membership.role||membership.role==='owner'&&me.active_session?.mfa_confirmed!==true)throw{status:403}
    if(identity.current&&identity.current!==me.id)throw{status:403}
    return {actor:me.id,role:membership.role as Role}
  },[church,workspace])
  const readQueues=useCallback(async(role:Role)=>{
    const response=await authRequest<unknown>('/api/sync-conflicts','GET',undefined,church)
    if(role==='teacher'){
      if(typeof response!=='object'||response===null||!('needs_owner_review' in response)||typeof response.needs_owner_review!=='boolean')throw Error('Invalid restricted response')
      return{conflicts:[],guests:[],students:[],teacherNotice:response.needs_owner_review}
    }
    const conflicts=list(response,validConflict);if(conflicts.some(row=>row.status!=='open'))throw Error('Invalid open queue')
    const [guests,students]=await Promise.all([authRequest<unknown>('/api/attendance-guests','GET',undefined,church),authRequest<unknown>('/api/students','GET',undefined,church)])
    return {conflicts,guests:list(guests,validGuest),students:list(students,validStudent),teacherNotice:false}
  },[church])
  const refresh=useCallback(()=>{generation.current++;setState(value=>({...empty(),resolved:value.resolved,pending:uncertain.current}));setRevision(value=>value+1)},[])
  useEffect(()=>{alive.current=true;const stop=()=>{alive.current=false;generation.current++};return stop},[])
  useEffect(()=>{
    const token=++generation.current,current=()=>alive.current&&token===generation.current
    void(async()=>{try{
      const verified=await access();if(!current())return
      const rows=await readQueues(verified.role);if(!current())return
      identity.current=verified.actor
      setState(value=>({...value,...verified,...rows,guests:rows.guests.filter(row=>!value.resolved.some(done=>done.result.id===row.id)),phase:'ready',error:'',pending:uncertain.current}))
    }catch(failure){if(current())clear(navigator.onLine?safeAuthMessage(failure):'Connect to the internet to view attendance review.')}})()
    const stop=()=>{if(token===generation.current)generation.current++};return stop
  },[access,readQueues,revision,clear])
  useEffect(()=>{
    const invalidate=(event:Event)=>{const detail=(event as CustomEvent<{status:number;churchId?:string}>).detail;if(detail?.status===403&&detail.churchId&&detail.churchId!==church)return;clear('Your church access changed or expired. Check your account before continuing.')}
    const offline=()=>clear('Connect to the internet to view attendance review.')
    const focus=()=>{if(!workspace&&!operating.current&&document.visibilityState==='visible')refresh()}
    window.addEventListener('church-workspace-invalidated',invalidate);window.addEventListener('offline',offline);window.addEventListener('online',refresh);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
    return()=>{window.removeEventListener('church-workspace-invalidated',invalidate);window.removeEventListener('offline',offline);window.removeEventListener('online',refresh);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
  },[church,clear,refresh,workspace])
  async function operate<R>(work:(current:()=>boolean)=>Promise<R>):Promise<R|undefined>{
    if(operating.current||state.phase!=='ready'||state.role!=='owner'||!navigator.onLine)return
    operating.current=true;setBusy(true);const token=generation.current,current=()=>alive.current&&token===generation.current
    try{const verified=await access();if(!current())return;if(verified.role!=='owner'||verified.actor!==state.actor){clear('Your church access changed. Check your account.');return}return await work(current)}
    catch(failure){if(current()){if(denied(failure))clear(safeAuthMessage(failure));else setState(value=>({...value,error:safeAuthMessage(failure)}))}return}
    finally{operating.current=false;if(alive.current)setBusy(false)}
  }
  async function inspect(item:Conflict){return operate(async current=>{const found=await authRequest<unknown>(`/api/sync-conflicts/${item.id}`,'GET',undefined,church);if(!current())return;if(!validConflict(found)||found.id!==item.id)throw Error('Invalid conflict');if(found.status==='resolved'){setState(value=>({...value,conflicts:value.conflicts.filter(row=>row.id!==item.id),notice:'This conflict is already resolved. The original attendance and revision history are preserved.'}));return}return found})}
  async function reconcile(target:Target,current:()=>boolean,validation?:unknown):Promise<'edit'|'closed'|'unknown'|'changed'>{
    try{
      if(target.kind==='conflict'){
        const found=await authRequest<unknown>(`/api/sync-conflicts/${target.item.id}`,'GET',undefined,church)
        if(!current())return'unknown';if(!validConflict(found)||found.id!==target.item.id)throw Error('Invalid conflict')
        if(found.status==='resolved'){uncertain.current=null;setState(value=>({...value,pending:null,conflicts:value.conflicts.filter(row=>row.id!==found.id),notice:'This conflict is already resolved. The original attendance and revision history are preserved.',error:''}));return'closed'}
        uncertain.current=null
        if(!sameConflict(target.item,found)){
          setState(value=>({...value,pending:null,conflicts:value.conflicts.map(row=>row.id===found.id?found:row),reset:value.reset+1,error:'',fields:[],notice:'This case changed. Review the current evidence and make a new choice.'}));return'changed'
        }
        setState(value=>({...value,pending:null,conflicts:value.conflicts.map(row=>row.id===found.id?found:row),reset:validation?value.reset:value.reset+1,
          error:validation?'Check the decision fields.':'',notice:validation?'':'This conflict is still open. Review the current values before another deliberate decision.'}))
      }else{
        const rows=list(await authRequest<unknown>('/api/attendance-guests','GET',undefined,church),validGuest);if(!current())return'unknown'
        if(!rows.some(row=>row.id===target.item.id)){
          // The bounded pending list is not a disposition/detail contract. Absence
          // cannot establish promoted/linked/merged, and never permits another write.
          setState(value=>({...value,guests:rows,pending:target,error:'Outcome not confirmed. This guest is not in the current pending list; its disposition is unavailable. Do not repeat the action.'}));return'unknown'
        }
        uncertain.current=null;setState(value=>({...value,guests:rows,pending:null,reset:validation?value.reset:value.reset+1,error:validation?'Check the guest action fields.':'',notice:validation?'':'This guest is still pending. Review the current target before another deliberate action.'}))
      }
      if(validation&&typeof validation==='object'&&validation!==null&&'fieldErrors' in validation&&typeof validation.fieldErrors==='object'&&validation.fieldErrors){
        const allowed=target.kind==='conflict'?['choice','reason']:['first_name','last_name','gender','student_id','guest_id']
        setState(value=>({...value,fields:Object.keys(validation.fieldErrors as object).filter(field=>allowed.includes(field))}))
      }
      return validation?'edit':'closed'
    }catch(failure){if(current()){if(denied(failure))clear(safeAuthMessage(failure));else setState(value=>({...value,pending:target,error:'Outcome not confirmed. Check current outcome before another submission.'}))}return'unknown'}
  }
  async function checkOutcome(){const target=uncertain.current;if(target)await operate(current=>reconcile(target,current))}
  async function submit(target:Target,body:Record<string,unknown>,action?:GuestAction){
    if(uncertain.current||target.kind==='guest'&&state.resolved.some(row=>row.result.id===target.item.id))return
    return operate(async current=>{
      setState(value=>({...value,error:'',notice:'',fields:[]}))
      if(target.kind==='conflict'){
        const found=await authRequest<unknown>(`/api/sync-conflicts/${target.item.id}`,'GET',undefined,church);if(!current())return
        if(!validConflict(found)||found.id!==target.item.id)throw Error('Invalid conflict')
        if(found.status==='resolved'){uncertain.current=null;setState(value=>({...value,pending:null,conflicts:value.conflicts.filter(row=>row.id!==found.id),notice:'This conflict is already resolved. The original attendance and revision history are preserved.',error:''}));return'closed'}
        if(!sameConflict(found,target.item)){setState(value=>({...value,conflicts:value.conflicts.map(row=>row.id===found.id?found:row),reset:value.reset+1,notice:'This case changed. Review the current evidence and make a new choice.'}));return'changed'}
      }else{
        const rows=list(await authRequest<unknown>('/api/attendance-guests','GET',undefined,church),validGuest);if(!current())return
        const found=rows.find(row=>row.id===target.item.id)
        if(!found){uncertain.current=target;setState(value=>({...value,guests:rows,pending:target,error:'This guest is not in the current pending list; its disposition is unavailable. Do not repeat the action.'}));return'closed'}
        if(JSON.stringify(found)!==JSON.stringify(target.item)){setState(value=>({...value,guests:rows,reset:value.reset+1,notice:'This case changed. Review the current guest before deciding.'}));return'changed'}
        if(action==='merge'&&!rows.some(row=>row.id===body.guest_id&&row.id!==found.id&&row.session_id===found.session_id))throw Error('Merge target changed')
        if(action==='link'){
          const students=list(await authRequest<unknown>('/api/students','GET',undefined,church),validStudent);if(!current())return
          if(!students.some(row=>row.id===body.student_id))throw Error('Student target changed')
        }
      }
      if(!current())return
      const path=target.kind==='conflict'?`/api/sync-conflicts/${target.item.id}/resolve`:`/api/attendance-guests/${target.item.id}/${action}`
      uncertain.current=target
      try{
        const result=await authRequest<unknown>(path,'POST',body,church);if(!current())return
        if(target.kind==='conflict'){
          if(!validResolution(result,target.item.id))throw Error('Unconfirmed resolution')
          uncertain.current=null;setState(value=>({...value,pending:null,conflicts:value.conflicts.filter(row=>row.id!==target.item.id),notice:`Resolved. The server accepted ${attendanceValue((result as components['schemas']['ConflictResolutionResult']).effective_state)} in an append-only revision.`,error:''}))
        }else{
          if(!action||!validGuestResult(result,target.item.id,action))throw Error('Unconfirmed guest disposition')
          uncertain.current=null;setState(value=>({...value,pending:null,guests:value.guests.filter(row=>row.id!==target.item.id),resolved:[...value.resolved,{name:target.item.display_name,result}],notice:'Guest disposition confirmed by the server.',error:''}))
        }
        return'closed'
      }catch(failure){if(!current())return;if(denied(failure)){clear(safeAuthMessage(failure));return'closed'}return reconcile(target,current,status(failure)===422?failure:undefined)}
    })
  }
  return {...state,busy,workspace,refresh,inspect,submit,checkOutcome}
}
