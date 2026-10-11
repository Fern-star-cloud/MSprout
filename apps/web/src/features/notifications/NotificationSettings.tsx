import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, StatusBanner } from '../../components/ui/Foundations'
import { disableBirthdayNotifications, enableBirthdayNotifications, notificationCapability, prepareBirthdayNotifications, pushRegistration, type NotificationCapability, type PreparedNotifications } from './notification-permission'

export function NotificationSettings(props:{churchId:string;available?:boolean}) {
  return <ScopedNotificationSettings key={props.churchId} {...props}/>
}

function ScopedNotificationSettings({churchId,available=true}:{churchId:string;available?:boolean}) {
  const [capability,setCapability]=useState<NotificationCapability>(notificationCapability),[browser,setBrowser]=useState('Checking'),[backend,setBackend]=useState('Not confirmed'),[working,setWorking]=useState(false),[deniedAccess,setDeniedAccess]=useState(false),[setupReady,setSetupReady]=useState(false),[failedAction,setFailedAction]=useState<'enable'|'disable'>('enable')
  const generation=useRef(0),alive=useRef(false),busy=useRef(false),blocked=useRef(!available),heading=useRef<HTMLHeadingElement>(null),prepared=useRef<PreparedNotifications|null>(null)
  useEffect(()=>{blocked.current=!available||deniedAccess;if(!available)generation.current++},[available,deniedAccess])
  const inspect=useCallback(async()=>{
    const next=notificationCapability()
    if(next.state==='denied'){generation.current++;prepared.current=null;setSetupReady(false);setBackend('Not confirmed');setCapability(next);setBrowser('Unknown');return}
    if(busy.current)return
    if(typeof Notification!=='undefined'&&Notification.permission!=='granted')setBackend('Not confirmed')
    const token=++generation.current;setCapability(next)
    if(['unsupported','ios-install-required'].includes(next.state)){setBrowser('Unavailable');setBackend('Not confirmed');return}
    try{const registration=await pushRegistration(),sub=await registration.pushManager.getSubscription();if(alive.current&&token===generation.current){setBrowser(sub?'Present':'Absent');if(!sub)setBackend('Not confirmed')}}catch{if(alive.current&&token===generation.current){setBrowser('Unavailable');setBackend('Not confirmed')}}
  },[])
  const setup=useCallback(async()=>{
    if(blocked.current||!navigator.onLine||notificationCapability().state!=='available'||busy.current)return
    const token=generation.current
    try{const value=await prepareBirthdayNotifications(churchId);if(alive.current&&token===generation.current&&!blocked.current){prepared.current=value;setSetupReady(true)}}
    catch{if(alive.current&&token===generation.current&&!blocked.current){prepared.current=null;setSetupReady(false);setCapability({state:'error',message:'Notification setup unavailable. Check your account and service configuration, then check browser status to retry.'})}}
  },[churchId])
  useEffect(()=>{alive.current=true;const timer=setTimeout(()=>void inspect(),0);const stop=()=>{alive.current=false;generation.current++;clearTimeout(timer)};return stop},[inspect])
  useEffect(()=>{const timer=setTimeout(()=>void setup(),0);return()=>{clearTimeout(timer);prepared.current=null}},[available,setup])
  useEffect(()=>{
    const invalidate=(event:Event)=>{const detail=(event as CustomEvent<{status:number;churchId?:string}>).detail;if(detail?.status===403&&detail.churchId&&detail.churchId!==churchId)return;setDeniedAccess(true);blocked.current=true;prepared.current=null;setSetupReady(false);generation.current++;setBackend('Not confirmed');setCapability({state:'error',message:'Check your account before changing notifications.'})}
    const focus=()=>void inspect(),offline=()=>{generation.current++;prepared.current=null;setSetupReady(false);setBackend('Not confirmed');setCapability({state:'error',message:'Connect and check your account before changing notifications.'})}
    window.addEventListener('church-workspace-invalidated',invalidate);window.addEventListener('focus',focus);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',focus)
    return()=>{window.removeEventListener('church-workspace-invalidated',invalidate);window.removeEventListener('focus',focus);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',focus)}
  },[churchId,inspect])
  async function act(action:'enable'|'disable') {
    if(busy.current||blocked.current||!navigator.onLine)return
    let consent:(PreparedNotifications&{permission:Promise<NotificationPermission>})|undefined
    if(action==='enable'&&typeof Notification!=='undefined'&&Notification.permission==='default'){
      const value=prepared.current;if(!value)return
      // Keep the permission request inside the explicit browser activation. Authenticated
      // setup has completed; current actor/assignment/assurance is checked again before writes.
      try{consent={...value,permission:Notification.requestPermission().catch(()=>'default' as const)}}catch{setCapability({state:'error',message:'Browser permission could not be requested. Check browser settings and retry deliberately.'});return}
    }
    busy.current=true;const token=++generation.current,current=()=>alive.current&&token===generation.current&&!blocked.current&&navigator.onLine
    setWorking(true);setFailedAction(action);setBackend('Not confirmed')
    const result=await(action==='enable'?enableBirthdayNotifications(churchId,current,consent):disableBirthdayNotifications(churchId,current))
    if(current()){setCapability(result);if(result.backendRegistration)setBackend(result.backendRegistration);if(result.browserSubscription)setBrowser(result.browserSubscription);if(result.state==='enabled'){setBackend('Confirmed');setBrowser('Present')}else if(action==='disable'&&result.state==='available'){setBackend('Revoked');setBrowser('Absent')}}
    busy.current=false;if(alive.current){setWorking(false);if(current())queueMicrotask(()=>{
      const target=heading.current;target?.focus()
      const reveal=()=>{if(!current()||!target?.isConnected||document.activeElement!==target)return;const rect=target.getBoundingClientRect(),navigation=document.querySelector('.phone-navigation')?.getBoundingClientRect();if(rect.top<4||rect.bottom>(navigation?.height?navigation.top:innerHeight)-4)target.scrollIntoView?.({block:'start',inline:'nearest'})}
      queueMicrotask(reveal);globalThis.requestAnimationFrame?.(reveal)
    })}
  }
  const permission=typeof Notification==='undefined'?'Unavailable':Notification.permission
  return <section className="notification-settings" aria-labelledby="notification-heading">
    <h2 id="notification-heading" ref={heading} tabIndex={-1}>Birthday notifications</h2>
    <p>Opt-in Web Push uses a count only. Children&apos;s names, ages, birthdates and rosters are never in the notification. Open the verified app for details.</p>
    <p>Browser permission: {permission}. Browser subscription: {browser}. Backend registration: {available&&!deniedAccess?backend:'Not confirmed'}.</p>
    <StatusBanner live tone={available&&!deniedAccess&&capability.state==='enabled'&&backend==='Confirmed'?'success':capability.state==='error'?'warning':'neutral'}>{!available||deniedAccess?'Check your account in a verified online workspace before changing notifications.':capability.message}</StatusBanner>
    {!available&&<p>Connect to a verified church workspace before changing notifications.</p>}
    <div className="notification-actions">
      {['available','error'].includes(capability.state)&&<Button busy={working} disabled={!available||!navigator.onLine||deniedAccess||failedAction==='enable'&&!setupReady} onClick={()=>void act(failedAction)}>{working?'Updating notifications…':capability.state==='error'?(failedAction==='enable'?'Retry registration':'Retry turning off'):'Enable Birthday Notifications'}</Button>}
      {(browser==='Present'||backend==='Confirmed'||capability.state==='denied')&&<Button variant="secondary" busy={working} disabled={!available||!navigator.onLine||deniedAccess} onClick={()=>void act('disable')}>Turn off notifications for this church</Button>}
      <Button variant="secondary" disabled={working} onClick={()=>{void inspect();void setup()}}>Check browser status</Button>
    </div>
    <p>A browser subscription alone does not confirm backend registration. No registration-status read API exists; confirmation follows a successful registration action. Turning off also removes this browser&apos;s subscription and may stop reminders from other workspaces using it.</p>
  </section>
}
