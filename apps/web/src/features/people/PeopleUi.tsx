import { useEffect, useRef, type ReactNode } from 'react'
import { Button, ErrorSummary, LoadingState, StatusBadge } from '../../components/ui/Foundations'
import type { ChurchWorkspace } from '../../app/workspace-context'
import { useContext } from 'react'
import { ChurchWorkspaceContext } from '../../app/workspace-context'
import './people.css'

export function PeopleFrame({children}:{children:ReactNode}){
 const pointer=useRef(false)
 return <section className="dashboard-card people-page" onPointerDownCapture={()=>{pointer.current=true}} onPointerUpCapture={()=>{pointer.current=false}} onPointerCancelCapture={()=>{pointer.current=false}} onKeyDownCapture={()=>{pointer.current=false}} onFocusCapture={event=>{
  const target=event.target
  if(pointer.current||target.closest('dialog'))return
  queueMicrotask(()=>{
   if(!target.isConnected||document.activeElement!==target)return
   const rect=target.getBoundingClientRect(),navigation=document.querySelector('.phone-navigation')?.getBoundingClientRect()
   const bottom=navigation&&navigation.height?navigation.top:innerHeight
   if(rect.top<4||rect.bottom>bottom-4)target.scrollIntoView?.({block:'start',inline:'nearest'})
  })
 }}>{children}</section>
}

export function PeopleHeading({title,owner,church,children}:{title:string;owner?:boolean;church:string;children?:ReactNode}){
 const workspace=useContext(ChurchWorkspaceContext) as ChurchWorkspace|null
 return <><p className="eyebrow">{owner?'People · Owner management':'Church workspace'} · Online only</p><h2>{title}</h2>
 {workspace&&<p>{workspace.name} · {workspace.role==='owner'?'Owner':'Teacher'}</p>}
 {owner&&<nav className="people-sections" aria-label="People sections">{['Ministries','Students','Teachers'].map(name=><a key={name} aria-current={title===name?'page':undefined} href={`/account/${name.toLowerCase()}?church=${encodeURIComponent(church)}`}>{name}</a>)}</nav>}{children}</>
}
export function PeopleState({phase,error,notice,refresh,busy}:{phase:string;error:string;notice:string;refresh:()=>void;busy:boolean}){
 const alert=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(error)alert.current?.focus()},[error])
 return <>{phase==='loading'&&<LoadingState label="Checking church access and loading records…"/>}{error&&<ErrorSummary ref={alert} message={error}/>} {notice&&<p role="status">{notice}</p>}
 <Button variant="secondary" disabled={busy||!navigator.onLine} onClick={refresh}>Refresh records</Button></>
}
export function RecordStatus({status}:{status:string}){return <StatusBadge tone={status==='active'?'info':'neutral'}>{status==='active'?'Active':status==='archived'?'Archived':status}</StatusBadge>}
export function DetailHeading({children}:{children:ReactNode}){
 const heading=useRef<HTMLHeadingElement>(null)
 useEffect(()=>{heading.current?.focus()},[])
 return <h3 ref={heading} tabIndex={-1}>{children}</h3>
}
