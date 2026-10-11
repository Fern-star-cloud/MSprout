import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { ChurchWorkspaceContext } from '../../app/workspace-context'
import { profileStore } from '../../offline/profile-store'
import { authDownload, authRequest, safeAuthMessage } from '../auth/transport'
import { ministries, reportPath, uuid, validReport, type AttendanceReport, type Filters, type MinistryOption } from './report-model'

export type PendingCount=(church:string,actor:number)=>Promise<number|null>
type Access={actor:number;role:'owner'|'teacher';assignments:string[]}
type State={phase:'loading'|'ready'|'error'|'offline';report:AttendanceReport|null;options:MinistryOption[];local:number|null;error:string;fields:string[];exportNotice:string}
const empty=(phase:State['phase']='loading',error=''):State=>({phase,report:null,options:[],local:null,error,fields:[],exportNotice:''})
const status=(value:unknown)=>typeof value==='object'&&value!==null&&'status'in value?Number(value.status):0
const denied=(value:unknown)=>[401,403,419].includes(status(value))
const signature=(value:Access)=>JSON.stringify(value)

export function useAttendanceReport(church:string,initial:Filters,pendingCount:PendingCount){
  const workspace=useContext(ChurchWorkspaceContext),[state,setState]=useState<State>(empty),[applied,setApplied]=useState(initial),[downloading,setDownloading]=useState(false)
  const alive=useRef(false),generation=useRef(0),localGeneration=useRef(0),reading=useRef<number|null>(null),exporting=useRef<number|null>(null),identity=useRef<Access|null>(null),selection=useRef(initial),lastOptions=useRef<MinistryOption[]>([])
  const clear=useCallback((failure:unknown,offline=false)=>{generation.current++;localGeneration.current++;identity.current=null;lastOptions.current=[];reading.current=null;exporting.current=null;setDownloading(false);setState(empty(offline?'offline':'error',offline?'Connect to the internet to view attendance reports.':safeAuthMessage(failure)))},[])
  const invalidatePending=useCallback(()=>{generation.current++;localGeneration.current++;reading.current=null;exporting.current=null},[])
  const access=useCallback(async():Promise<Access>=>{
    if(!uuid(church)||!navigator.onLine)throw Error('Online verified workspace required')
    const me=await authRequest<components['schemas']['ChurchAccount']>('/api/me','GET',undefined,church)
    const member=me.memberships?.find(row=>row.church_id===church&&row.status==='active')
    if(!Number.isSafeInteger(me.id)||me.id<=0||me.email_verified!==true||!member||!['owner','teacher'].includes(member.role)||workspace&&workspace.role!==member.role||member.role==='owner'&&me.active_session?.mfa_confirmed!==true)throw{status:403}
    const assignments=[...new Set(me.assignments?.ministry_ids??[])].sort();if(!assignments.every(uuid))throw{status:403}
    const verified={actor:me.id,role:member.role,assignments}
    if(identity.current&&signature(identity.current)!==signature(verified))throw{status:403}
    return verified
  },[church,workspace])
  const load=useCallback(async(filters:Filters)=>{
    if(reading.current!==null||exporting.current!==null)return
    const token=++generation.current,current=()=>alive.current&&token===generation.current;reading.current=token
    selection.current=filters;setApplied(filters);setDownloading(false);setState(empty());const localToken=++localGeneration.current
    let verifiedAccess=false
    try{
      const verified=await access();if(!current())return
      verifiedAccess=true
      const [response,options]=await Promise.all([authRequest<{data:unknown}>(reportPath(false,filters),'GET',undefined,church),authRequest<unknown>('/api/ministries','GET',undefined,church)])
      if(!current())return
      const list=ministries(options)
      if(verified.role==='teacher'&&list.some(row=>!verified.assignments.includes(row.id)))throw{status:403}
      if(!validReport(response?.data,filters,verified.role,verified.assignments))throw Error('Report response unavailable')
      identity.current=verified;lastOptions.current=list;setState({...empty('ready'),report:response.data,options:list})
      // A missing/locked device or failed local count never makes online totals unavailable.
      void pendingCount(church,verified.actor).then(value=>{if(current()&&localToken===localGeneration.current)setState(old=>({...old,local:Number.isSafeInteger(value)&&Number(value)>=0?value:null}))}).catch(()=>undefined)
    }catch(failure){if(current()){if(denied(failure)||!navigator.onLine)clear(failure,!navigator.onLine);else setState({...empty('error',safeAuthMessage(failure)),options:verifiedAccess?lastOptions.current:[],fields:status(failure)===422&&typeof failure==='object'&&failure!==null&&'fieldErrors'in failure&&failure.fieldErrors?Object.keys(failure.fieldErrors).filter(key=>['date_from','date_to','ministry_id'].includes(key)):[]})}}
    finally{if(reading.current===token)reading.current=null}
  },[access,church,clear,pendingCount])
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;invalidatePending()}},[invalidatePending])
  useEffect(()=>{const timer=setTimeout(()=>void load(selection.current),0);return()=>{clearTimeout(timer);invalidatePending()}},[load,invalidatePending])
  useEffect(()=>{
    const invalidate=(event:Event)=>{const detail=(event as CustomEvent<{status:number;churchId?:string}>).detail;if(detail?.status===403&&detail.churchId&&detail.churchId!==church)return;clear({status:detail?.status})}
    const offline=()=>clear({},true),online=()=>void load(selection.current),focus=()=>{if(!workspace&&document.visibilityState==='visible')void load(selection.current)}
    const unsubscribe=profileStore.onLock(()=>{localGeneration.current++;setState(value=>({...value,local:null}))})
    window.addEventListener('church-workspace-invalidated',invalidate);window.addEventListener('offline',offline);window.addEventListener('online',online);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
    return()=>{unsubscribe();window.removeEventListener('church-workspace-invalidated',invalidate);window.removeEventListener('offline',offline);window.removeEventListener('online',online);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
  },[church,clear,load,workspace])
  async function download(){
    if(exporting.current!==null||reading.current!==null||state.phase!=='ready'||!state.report?.can_export||identity.current?.role!=='owner'||!navigator.onLine)return
    const token=generation.current,current=()=>alive.current&&token===generation.current;exporting.current=token;setDownloading(true);setState(value=>({...value,exportNotice:'Preparing the server CSV…',error:''}))
    try{
      await access();if(!current())return
      const blob=await authDownload(reportPath(true,applied),church);if(!current())return
      if(blob.type&&!/^text\/csv(?:;|$)/i.test(blob.type))throw Error('Invalid export response')
      const url=URL.createObjectURL(blob),anchor=document.createElement('a')
      try{anchor.href=url;anchor.download=`attendance-${applied.from}-to-${applied.to}.csv`;document.body.append(anchor);anchor.click()}finally{anchor.remove();URL.revokeObjectURL(url)}
      setState(value=>({...value,exportNotice:'CSV download handed to your browser. Check its downloads for completion.'}))
    }catch(failure){if(current()){if(denied(failure))clear(failure);else setState(value=>({...value,error:safeAuthMessage(failure),exportNotice:'CSV download unavailable. No substitute export was generated.'}))}}
    finally{if(exporting.current===token){exporting.current=null;if(alive.current)setDownloading(false)}}
  }
  return{...state,applied,downloading,load,download}
}
