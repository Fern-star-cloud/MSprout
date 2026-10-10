import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { ChurchWorkspaceContext } from '../../app/workspace-context'

type Role='owner'|'teacher'
type State<T>={phase:'loading'|'ready'|'error';data:T|null;role:Role|null;error:string;notice:string;epoch:number}
export const failureStatus=(error:unknown)=>typeof error==='object'&&error!==null&&'status' in error?Number(error.status):0
export function backToList(set:()=>void,trigger:React.RefObject<HTMLElement|null>){set();queueMicrotask(()=>{if(trigger.current?.isConnected)trigger.current.focus()})}

// All projections are online, scoped, ephemeral and generation-bound. The server
// remains authoritative; a local device profile grants no People access.
export function usePeopleAccess<T>(church:string,load:(role:Role)=>Promise<T>,ownerOnly=false){
 const [state,setState]=useState<State<T>>({phase:'loading',data:null,role:null,error:'',notice:'',epoch:0})
 const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false)
 const [fieldErrors,setFieldErrors]=useState<string[]>([]),workspaceRole=useContext(ChurchWorkspaceContext)?.role
 const generation=useRef(0),operating=useRef(false),alive=useRef(true)
 const clear=useCallback((message='')=>{generation.current++;setFieldErrors([]);setState({phase:message?'error':'loading',data:null,role:null,error:message,notice:'',epoch:generation.current})},[])
 const refresh=useCallback(()=>{clear();setRevision(value=>value+1)},[clear])
 useEffect(()=>{alive.current=true;const stop=()=>{alive.current=false;generation.current++};return stop},[])
 useEffect(()=>{
  const token=++generation.current
  const current=()=>alive.current&&generation.current===token
  void(async()=>{
   try{
    if(!church)throw Error('Workspace required')
    if(!navigator.onLine)throw Error('Online workspace required')
    const me=await authRequest<components['schemas']['ChurchAccount']>('/api/me','GET',undefined,church)
    if(!current())return
    const member=me.memberships.find(item=>item.church_id===church&&item.status==='active')
    if(!member||!['owner','teacher'].includes(member.role)||(workspaceRole&&workspaceRole!==member.role)||(member.role==='owner'&&!me.active_session?.mfa_confirmed)||ownerOnly&&member.role!=='owner'){
     clear(ownerOnly?'Owner access is required to manage Teachers.':'Your church access changed. Check your account before continuing.');return
    }
    const role=member.role as Role,data=await load(role)
    if(current())setState(previous=>({phase:'ready',data,role,error:'',notice:previous.notice,epoch:token}))
   }catch(error){if(current())clear(!navigator.onLine?'Connect to the internet to view People.':safeAuthMessage(error))}
  })()
  const stop=()=>{if(generation.current===token)generation.current++};return stop
 },[church,load,ownerOnly,revision,clear,workspaceRole])
 useEffect(()=>{
  const invalidate=(event:Event)=>{
   const detail=(event as CustomEvent<{status:number;churchId?:string}>).detail
   if(detail?.status===403&&detail.churchId&&detail.churchId!==church)return
   if(detail?.status===0)refresh();else clear('Your access changed or expired. Check your account before continuing.')
  }
  // Verified workspace activation belongs to the existing boundary, which
  // coalesces background checks and remounts changed actor/role/assignment scope.
  // Direct standalone use still rechecks its ephemeral presentation on focus.
  const focus=()=>{if(!workspaceRole&&document.visibilityState==='visible'&&!operating.current)refresh()}
  const connect=()=>{if(navigator.onLine)refresh();else clear('Connect to the internet to view People.')}
  window.addEventListener('church-workspace-invalidated',invalidate);window.addEventListener('focus',focus)
  window.addEventListener('online',connect);window.addEventListener('offline',connect);document.addEventListener('visibilitychange',focus)
  return()=>{window.removeEventListener('church-workspace-invalidated',invalidate);window.removeEventListener('focus',focus);window.removeEventListener('online',connect);window.removeEventListener('offline',connect);document.removeEventListener('visibilitychange',focus)}
 },[church,clear,refresh,workspaceRole])
 async function read<R>(path:string):Promise<R|undefined>{
  if(state.phase!=='ready'||!navigator.onLine)return
  const token=generation.current
  try{const data=await authRequest<R>(path,'GET',undefined,church);return alive.current&&token===generation.current?data:undefined}
  catch(error){if(alive.current&&token===generation.current)clear(failureStatus(error)===404?'This record is no longer available in your authorized scope.':safeAuthMessage(error));return}
 }
 async function mutate(path:string,method:'POST'|'PUT'|'DELETE',body?:Record<string,unknown>,transfer=false){
  if(operating.current||state.phase!=='ready'||state.role!=='owner'||!navigator.onLine)return false
  const token=generation.current;operating.current=true;setBusy(true);setFieldErrors([]);setState(value=>({...value,error:'',notice:''}))
  try{
   await authRequest(path,method,body,church)
   if(!alive.current||token!==generation.current)return false
   if(transfer){clear();setState({phase:'error',data:null,role:null,error:'',notice:'Ownership transferred. Sign in again. The new Owner must confirm MFA before accessing the workspace.',epoch:generation.current})}
   else {refresh();setState(value=>({...value,notice:'Changes saved. Records are being refreshed.'}))}
   return true
  }catch(error){
   if(alive.current&&token===generation.current){
    const status=failureStatus(error)
    if([422,429].includes(status)){
     if(status===422&&typeof error==='object'&&error!==null&&'fieldErrors' in error&&typeof error.fieldErrors==='object'&&error.fieldErrors){
      const allowed=['first_name','middle_name','last_name','preferred_name','suffix','date_of_birth','gender','external_reference','ministry_ids','name','email','password','code']
      setFieldErrors(Object.keys(error.fieldErrors).map(key=>key.split('.')[0]).filter(key=>allowed.includes(key)))
     }
     setState(value=>({...value,error:safeAuthMessage(error)}))
    }
    else clear([401,403,404,419].includes(status)?'Your access changed or expired. Check your account before continuing.':'The outcome could not be confirmed. Refresh records and check the current state before trying again.')
   }
   return false
  }finally{operating.current=false;if(alive.current)setBusy(false)}
 }
 return{...state,church,busy,fieldErrors,refresh,read,mutate}
}
