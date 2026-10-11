import { authRequest } from '../auth/transport'
import { accessSignature, verifyNotificationWorkspace, type WorkspaceAccess } from './workspace-access'

export type NotificationState='available'|'enabled'|'denied'|'unsupported'|'ios-install-required'|'error'
export interface NotificationCapability { state:NotificationState; message:string; backendRegistration?:'Revoked'; browserSubscription?:'Unknown' }
export type PreparedNotifications={access:WorkspaceAccess;config:{vapid_public_key:string;configured:boolean}}
export async function prepareBirthdayNotifications(churchId:string):Promise<PreparedNotifications> {
  const access=await verifyNotificationWorkspace(churchId)
  const config=await authRequest<PreparedNotifications['config']>('/api/push-subscriptions/config','GET',undefined,churchId)
  if(!config.configured||!config.vapid_public_key)throw Error('Notification configuration unavailable')
  return {access,config}
}
const denialKey='msprout:birthday-notifications-denied',deviceKey='msprout:push-device-id'
export function notificationCapability():NotificationCapability {
  if(!('Notification' in globalThis)||!globalThis.navigator?.serviceWorker||!('PushManager' in globalThis))return /iPad|iPhone|iPod/i.test(navigator.userAgent)?{state:'ios-install-required',message:'On iPhone or iPad, add MinistrySprout to your Home Screen before enabling notifications.'}:{state:'unsupported',message:'Birthday notifications are not supported in this browser.'}
  let declined=false;try{declined=localStorage.getItem(denialKey)==='true'}catch{/* Storage may be unavailable. Browser permission remains authoritative. */}
  if(Notification.permission==='denied'||Notification.permission==='default'&&declined)return {state:'denied',message:'Notifications are blocked. You can change this in your browser settings.'}
  return {state:'available',message:'Opt in to a count-only birthday reminder. The server schedules eligible reminders at 8:00 AM in the church timezone; delivery is not guaranteed.'}
}
export async function pushRegistration():Promise<ServiceWorkerRegistration> {
  const found=await navigator.serviceWorker.getRegistration?.()
  if(found)return found
  // A page without an active service worker must report unavailable rather than wait forever.
  return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Service worker unavailable')),5000);void navigator.serviceWorker.ready.then(reg=>{clearTimeout(timer);resolve(reg)},failure=>{clearTimeout(timer);reject(failure)})})
}
function applicationServerKey(value:string):Uint8Array<ArrayBuffer> {
  const padded=`${value}${'='.repeat((4-value.length%4)%4)}`.replace(/-/g,'+').replace(/_/g,'/')
  return new Uint8Array(Uint8Array.from(atob(padded),character=>character.charCodeAt(0)).buffer)
}
function deviceId():string {
  const existing=localStorage.getItem(deviceKey)
  if(existing&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(existing))return existing
  const created=crypto.randomUUID();localStorage.setItem(deviceKey,created);return created
}
let operating=false
export async function enableBirthdayNotifications(churchId:string,current=()=>true,consent?:PreparedNotifications&{permission:Promise<NotificationPermission>}):Promise<NotificationCapability> {
  if(operating)return {state:'error',message:'Another notification action is still pending. Wait before retrying.'}
  const capability=notificationCapability();if(capability.state!=='available'&&!consent)return capability
  operating=true
  try {
    const access=await verifyNotificationWorkspace(churchId)
    if(!current())throw Error('Changed context')
    if(consent&&accessSignature(consent.access)!==accessSignature(access))throw Error('Changed context')
    const config=consent?.config??await authRequest<{vapid_public_key:string;configured:boolean}>('/api/push-subscriptions/config','GET',undefined,churchId)
    if(!current())throw Error('Changed context')
    if(!config.configured||!config.vapid_public_key)return {state:'error',message:'Notifications are not configured yet.'}
    const permission=consent?await consent.permission:Notification.permission==='granted'?'granted':await Notification.requestPermission()
    if(!current())throw Error('Changed context')
    if(permission!=='granted'){try{localStorage.setItem(denialKey,'true')}catch{/* No storage write is required to enforce browser denial. */}return {state:'denied',message:'Notifications were not enabled. MinistrySprout will not ask again.'}}
    const registration=await pushRegistration();if(!current())throw Error('Changed context')
    let subscription=await registration.pushManager.getSubscription();if(!current())throw Error('Changed context')
    if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationServerKey(config.vapid_public_key)});if(!current())throw Error('Changed context')}
    const json=subscription.toJSON(),id=deviceId()
    if(!json.endpoint||!json.keys?.p256dh||!json.keys.auth)throw Error('Incomplete subscription')
    const fresh=await verifyNotificationWorkspace(churchId)
    if(!current()||Notification.permission!=='granted'||accessSignature(fresh)!==accessSignature(access))throw Error('Changed context')
    const result=await authRequest<{device_id:string;permission:string}>('/api/push-subscriptions','POST',{device_id:id,permission:'granted',subscription:{endpoint:json.endpoint,expirationTime:json.expirationTime??null,keys:{p256dh:json.keys.p256dh,auth:json.keys.auth}}},churchId)
    if(!current()||Notification.permission!=='granted'||result?.device_id!==id||result.permission!=='granted')throw Error('Unconfirmed registration')
    try{localStorage.removeItem(denialKey)}catch{/* Confirmed receipt and granted permission do not depend on this preference write. */}
    return {state:'enabled',message:'Backend registration confirmed for this church and browser. Reminder delivery is not guaranteed.'}
  }catch{return {state:'error',message:'Notification registration could not be confirmed. Retry registration with the same browser subscription and device; no new subscription is created when one exists.'}}
  finally{operating=false}
}
export async function disableBirthdayNotifications(churchId:string,current=()=>true):Promise<NotificationCapability> {
  if(operating)return {state:'error',message:'Another notification action is still pending. Wait before retrying.'}
  operating=true
  let revoked=false
  try {
    const access=await verifyNotificationWorkspace(churchId);if(!current())throw Error('Changed context')
    const registration=await pushRegistration();if(!current())throw Error('Changed context')
    const subscription=await registration.pushManager.getSubscription(),id=localStorage.getItem(deviceKey)
    if(!current()||!id||!/^[a-f\d-]{36}$/i.test(id))throw Error('Device registration unavailable')
    const fresh=await verifyNotificationWorkspace(churchId)
    if(!current()||accessSignature(fresh)!==accessSignature(access))throw Error('Changed context')
    await authRequest(`/api/push-subscriptions/${id}`,'DELETE',undefined,churchId)
    revoked=true
    if(!current())throw Error('Changed context')
    if(subscription&&!await subscription.unsubscribe())throw Error('Browser unsubscribe unconfirmed')
    if(!current())throw Error('Changed context')
    return {state:'available',message:'Backend registration revoked for this church; the browser subscription is off. Browser permission is unchanged.'}
  }catch{return {state:'error',...(revoked?{backendRegistration:'Revoked' as const,browserSubscription:'Unknown' as const}:{}),message:revoked?'Turning off notifications could not be fully confirmed. Backend revocation was confirmed; browser unsubscribe is unconfirmed. Retry turning off for this church.':'Turning off notifications could not be fully confirmed. Retry turning off for this church; browser and backend may have different states.'}}
  finally{operating=false}
}
