import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ChurchWorkspaceContext, useWorkspaceChurchId } from '../../app/workspace-context'
import { Button, ErrorSummary, LoadingState, StatusBanner } from '../../components/ui/Foundations'
import { profileStore } from '../../offline/profile-store'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { NotificationSettings } from '../notifications/NotificationSettings'
import { accessSignature, verifyNotificationWorkspace, type WorkspaceAccess } from '../notifications/workspace-access'
import { birthdayProjection, churchDate, type BirthdayProjection } from './birthday-model'
import { loadOfflineBirthdays } from './offline-birthdays'
import './birthdays.css'

type State={phase:'loading'|'ready'|'error';data:BirthdayProjection|null;source:'server'|'device';error:string}
const empty=(error=''):State=>({phase:error?'error':'loading',data:null,source:'server',error})
export function BirthdayScreen({initialChurchId=new URLSearchParams(globalThis.location?.search??'').get('church')??''}:{initialChurchId?:string}) {
  const church=useWorkspaceChurchId(initialChurchId),workspace=useContext(ChurchWorkspaceContext)
  return <ScopedBirthdays key={`${church}:${workspace?.role??''}`} church={church} role={workspace?.role}/>
}
function ScopedBirthdays({church,role}:{church:string;role?:'owner'|'teacher'}) {
  const [state,setState]=useState<State>(empty),generation=useRef(0),alive=useRef(false),reading=useRef<number|null>(null),identity=useRef<WorkspaceAccess|null>(null),dataRef=useRef<BirthdayProjection|null>(null),observedDay=useRef(''),error=useRef<HTMLDivElement>(null)
  const clear=useCallback((message:string)=>{generation.current++;reading.current=null;dataRef.current=null;setState(empty(message))},[])
  const load=useCallback(async()=>{
    if(reading.current!==null)return
    const token=++generation.current,current=()=>alive.current&&generation.current===token;reading.current=token;dataRef.current=null;setState(empty())
    try {
      if(!church)throw Error('Choose a verified church workspace')
      let data:BirthdayProjection,source:State['source']='server'
      if(!navigator.onLine){
        const offline=await loadOfflineBirthdays(church,undefined,undefined,identity.current?.actor)
        if(!current())return
        if(!offline)throw Error('No leased offline birthdays available')
        data=birthdayProjection(offline,'teacher');source='device'
      }else{
        const verified=await verifyNotificationWorkspace(church,role);if(!current())return
        if(identity.current&&accessSignature(identity.current)!==accessSignature(verified))throw {status:403}
        const response=await authRequest<{data:BirthdayProjection}>('/api/birthdays/today','GET',undefined,church);if(!current())return
        data=birthdayProjection(response.data,verified.role);identity.current=verified
      }
      dataRef.current=data;observedDay.current=churchDate(data.timezone);setState({phase:'ready',data,source,error:''})
    }catch(failure){if(current())clear(navigator.onLine?safeAuthMessage(failure):'Offline birthdays unavailable. Unlock the matching lease-valid device profile; reconnect to refresh authorized data.')}
    finally{if(reading.current===token)reading.current=null}
  },[church,clear,role])
  useEffect(()=>{alive.current=true;const timer=setTimeout(()=>void load(),0);const stop=()=>{alive.current=false;generation.current++;clearTimeout(timer)};return stop},[load])
  useEffect(()=>{
    const invalidate=(event:Event)=>{const detail=(event as CustomEvent<{status:number;churchId?:string}>).detail;if(detail?.status===403&&detail.churchId&&detail.churchId!==church)return;clear('Access changed or expired. Check your account before viewing birthdays.')}
    const connectivity=()=>{clear('Refreshing authorized birthday source…');void load()}
    const focus=()=>{if(!role&&document.visibilityState==='visible'){clear('Rechecking today’s birthdays…');void load()}}
    const unsubscribe=profileStore.onLock(()=>{if(!navigator.onLine)clear('Device locked. Unlock the matching profile to view cached birthdays.')})
    const timer=setInterval(()=>{const data=dataRef.current;if(data&&observedDay.current!==churchDate(data.timezone)){clear('The church-local date changed. Refreshing birthdays…');void load()}},30_000)
    window.addEventListener('church-workspace-invalidated',invalidate);window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
    return()=>{unsubscribe();clearInterval(timer);window.removeEventListener('church-workspace-invalidated',invalidate);window.removeEventListener('online',connectivity);window.removeEventListener('offline',connectivity);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
  },[church,clear,load,role])
  useEffect(()=>{if(state.phase==='error')error.current?.focus()},[state.phase,state.error])
  const data=state.data
  return <section className="birthday-screen" aria-labelledby="birthday-heading">
    <header><p className="eyebrow">Church workspace · Today only</p><h1 id="birthday-heading">Today&apos;s Birthdays</h1></header>
    <p>Today&apos;s authorized birthday list. Upcoming periods and a birthday calendar are not available.</p>
    {state.phase==='loading'&&<LoadingState label="Checking access and loading today’s birthdays…"/>}
    {state.error&&<ErrorSummary ref={error} message={state.error}/>}
    {state.phase!=='loading'&&<Button variant="secondary" onClick={()=>void load()}>{state.phase==='error'?'Retry birthdays':'Refresh birthdays'}</Button>}
    {data&&<>
      <p className="birthday-provenance"><time dateTime={data.local_date}>{data.local_date}</time> · Church timezone: {data.timezone} · Source: {state.source==='server'?'server':'encrypted device'}</p>
      {state.source==='device'?<StatusBanner>Offline, cached assignment-scoped roster. This is not a fresh server list; membership or assignments may have changed since preparation. A current encrypted lease is required.</StatusBanner>:<p>{data.role==='owner'?'Eligible children in this church.':'Only children in your currently assigned ministries.'}</p>}
      <p className="birthday-summary" role="status">{data.count===0?'No children are celebrating today.':`${data.count} ${data.count===1?'child is':'children are'} celebrating today.`}</p>
      <ul className="birthday-list">{data.birthdays.map(birthday=><li key={birthday.id}><span aria-hidden="true" className="birthday-mark">🎂</span><span><strong>{birthday.display_name}</strong><small>Turning {birthday.turning_age}{birthday.ministry_names.length?` · ${birthday.ministry_names.join(', ')}`:''}</small></span></li>)}</ul>
      <p className="privacy-note">Names are shown only inside your authorized church workspace. Push reminders contain a count only.</p>
    </>}
    <NotificationSettings key={`${church}:${state.source}:${state.phase}`} churchId={church} available={state.phase==='ready'&&state.source==='server'&&navigator.onLine}/>
    <section aria-labelledby="birthday-activity-heading"><h2 id="birthday-activity-heading">Activity history</h2><p>Online activity uses authorized audit history. It is separate from system health and attendance review queues; no additional activity feed is available.</p><a href={`/account/audit?church=${encodeURIComponent(church)}`}>Open authorized activity history</a></section>
  </section>
}
