import { expect, test, type Page, type Route } from '@playwright/test'
import { addProfile, bootstrap, churchId, expectNoSeriousAccessibilityIssues, json, mockCsrf, mockOwner, outboxCount } from './support'

test.use({serviceWorkers:'block'})
const session={handle:'sage.dev',online_only:true}
const application={id:'00000000-0000-4000-8000-000000000060',church_name:'Synthetic application',city:'Synthetic city',status:'pending'}
const health={status:'healthy',checked_at:'2026-10-10T00:00:00Z',api:{status:'ok'},database:{status:'ok',size_bytes:2048,growth_bytes_24h:0},queue:{status:'ok',pending_count:42,failed_24h:0,oldest_age_seconds:0},scheduler:{status:'ok',last_run_at:null},birthdays:{status:'ok',failed_24h:0,last_dispatch_at:null},synchronization:{events_24h:0,rejected_24h:0,open_conflicts:0,error_rate:0}}
test.beforeEach(async({context})=>{
 await mockCsrf(context)
 await context.route('**/api/**',route=>json(route,{},503))
 await context.route('**/platform/**',route=>json(route,{},503))
 await context.route('**/platform/csrf-token',route=>json(route,{csrf_token:'synthetic-platform-only'}))
 await context.route('**/platform/me',route=>json(route,session))
 await context.route('**/platform/applications?**',route=>json(route,{data:[application],page:1,has_more:false}))
 await context.route('**/platform/system-health',route=>json(route,health))
 await context.route('**/platform/audit-events?**',route=>json(route,{scope:'platform',data:[{id:'00000000-0000-4000-8000-000000000070',action:'platform.auth.login',result:'success',occurred_at:'2026-10-10T00:00:00Z',correlation_id:'00000000-0000-4000-8000-000000000080'}],page:1,has_more:false}))
})

test('verifies platform assurance before exposing navigation or requesting a protected direct link',async({page,context})=>{
 let held!:Route;let resources=0
 await context.route('**/platform/me',route=>{held=route})
 page.on('request',request=>{if(request.url().includes('/platform/system-health'))resources++})
 await page.goto('/account/platform-system-health')
 await expect(page.getByText('Checking platform session and MFA…')).toBeVisible()
 await expect(page.getByRole('link',{name:'Account',exact:true})).toHaveCount(0)
 expect(resources).toBe(0);expect(await page.locator('main').ariaSnapshot()).not.toContain('sage.dev')
 await expect.poll(()=>Boolean(held)).toBe(true);await json(held,session)
 await expect(page.getByText('42 pending · 0 failed')).toBeVisible()
 await expect(page.getByRole('button',{name:'Sign out of platform'})).toBeVisible()
 await expectNoSeriousAccessibilityIssues(page)
})

test('uses Applications as the preferred verified-authentication landing and keeps platform CSRF separate',async({page,context})=>{
 let signedIn=false,challengePosts=0
 await context.route('**/platform/me',route=>json(route,signedIn?session:{},signedIn?200:401))
 await context.route('**/platform/login',route=>{
  expect(route.request().headers()['x-csrf-token']).toBe('synthetic-platform-only')
  expect(route.request().headers()['x-xsrf-token']).toBeUndefined()
  return json(route,{two_factor:true})
 })
 await context.route('**/platform/two-factor-challenge',route=>{signedIn=true;challengePosts++;return route.abort('failed')})
 await page.goto('/account/platform-login?returnTo=%2Faccount%2Fstudents')
 await page.getByLabel('Handle').fill('sage.dev');await page.getByLabel('Password',{exact:true}).fill('Synthetic-password1!')
 await page.getByRole('button',{name:'Sign in to platform'}).click()
 await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify platform sign-in'}).click()
 await expect(page.getByRole('button',{name:'Verify platform sign-in'})).toBeDisabled()
 await page.getByRole('button',{name:'Check signed-in platform session'}).click()
 await expect(page).toHaveURL(/\/account\/platform-applications$/)
 await expect(page.getByText('Synthetic application',{exact:true})).toBeVisible();expect(challengePosts).toBe(1)
 await expectNoSeriousAccessibilityIssues(page)
})

test('Account reload and desktop, tablet and phone navigation remain discoverable and accessible',async({page})=>{
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('/account/platform-login')
  await expect(page.getByRole('heading',{name:'Platform Account'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Sign out of platform'})).toBeVisible()
  await expect(page.getByRole('link',{name:'Open Applications'})).toHaveAttribute('href','/account/platform-applications')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const name=width<768?'Platform phone navigation':width>=1024?'Platform navigation':null
  if(name){const nav=page.getByRole('navigation',{name,exact:true});await expect(nav).toBeVisible();await expect(nav.getByRole('link',{name:'Account',exact:true})).toHaveAttribute('aria-current','page')}
  else{
   const menu=page.getByRole('button',{name:'Menu',exact:true});await menu.click()
   const dialog=page.getByRole('dialog',{name:'Platform navigation'});await expect(dialog).toBeVisible()
   await expect(dialog.getByRole('button',{name:'Close navigation'})).toBeFocused()
   await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(menu).toBeFocused()
   await menu.click();await dialog.getByRole('link',{name:'System Health',exact:true}).click()
   await expect(page.getByRole('heading',{name:'System health',exact:true})).toBeVisible();await expect(dialog).not.toBeVisible()
   await expect(page.locator('main')).toBeFocused()
  }
  await expectNoSeriousAccessibilityIssues(page)
 }
 await page.setViewportSize({width:320,height:1000});await page.goto('/account/platform-login')
 await expect(page.getByRole('heading',{name:'Platform Account'})).toBeVisible()
 await page.addStyleTag({content:':root {font-size:200%}'});await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))).toBe(32)
 await page.screenshot({path:test.info().outputPath('platform-account-enlarged.png'),fullPage:true})
})

test('expiry clears protected information and ignores a late operational response',async({page,context})=>{
 let held!:Route
 await context.route('**/platform/system-health',route=>{held=route})
 await page.goto('/account/platform-system-health');await expect(page.getByRole('button',{name:'Sign out of platform'})).toBeVisible()
 await expect.poll(()=>Boolean(held)).toBe(true)
 await context.route('**/platform/me',route=>json(route,{},401))
 await page.evaluate(()=>dispatchEvent(new Event('focus')))
 await expect(page.getByRole('alert')).toContainText('expired')
 await json(held,health);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())))
 await expect(page.getByText('42 pending · 0 failed')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Sign out of platform'})).toHaveCount(0)
 expect(await page.locator('main').ariaSnapshot()).not.toMatch(/sage\.dev|2048|Queue/)
 await expectNoSeriousAccessibilityIssues(page)
})

test('offline platform state stays generic and reconnects through renewed assurance',async({page,context})=>{
 await page.goto('/account/platform-applications');await expect(page.getByText('Synthetic application',{exact:true})).toBeVisible()
 await context.setOffline(true);await page.evaluate(()=>dispatchEvent(new Event('offline')))
 await expect(page.getByText(/Protected platform information is unavailable offline/)).toBeVisible()
 expect(await page.locator('body').ariaSnapshot()).not.toMatch(/sage\.dev|Synthetic application|Sign out of platform/)
 await context.setOffline(false);await page.evaluate(()=>dispatchEvent(new Event('online')))
 await expect(page.getByText('Synthetic application',{exact:true})).toBeVisible()
 await expectNoSeriousAccessibilityIssues(page)
})

test('church assurance does not grant platform access and platform invalidation does not revoke the church context',async({page,context})=>{
 await mockOwner(context);await context.route('**/api/ministries',route=>json(route,{data:[]}))
 await context.route('**/platform/me',route=>json(route,{message:'untrusted private account'},403))
 await page.goto('/account/platform-applications?church='+churchId)
 await expect(page.getByRole('alert')).toContainText('Platform access is unavailable')
 await expect(page.getByText('Synthetic application',{exact:true})).toHaveCount(0)
 await page.goto('/account/home?church='+churchId);await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible()
 await page.evaluate(()=>dispatchEvent(new CustomEvent('platform-session-invalidated',{detail:{status:401}})))
 await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible()
 await expectNoSeriousAccessibilityIssues(page)
})

async function fingerprint(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('ministry-sprout-offline');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
 try{
  const tables=Array.from(db.objectStoreNames).sort(),tx=db.transaction(tables)
  const records=await Promise.all(tables.map(table=>new Promise(resolve=>{const read=tx.objectStore(table).getAll();read.onsuccess=()=>resolve({table,rows:read.result})})))
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(records)))
  return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')
 }finally{db.close()}
})}

test('platform sign-out preserves church CSRF and every encrypted profile store with pending attendance',async({page,context})=>{
 await context.route('**/api/offline/bootstrap**',route=>json(route,bootstrap('11',undefined,new URL(route.request().url()).searchParams.get('device_id')!)))
 await context.route('**/logout',route=>route.fulfill({status:204}))
 await addProfile(page);await page.getByRole('button',{name:'Mark Pilot Student A present'}).click()
 await expect(page.getByRole('button',{name:'Mark Pilot Student A present'})).toHaveAttribute('aria-pressed','true')
 await expect(page.getByRole('button',{name:'Mark Pilot Student A present'})).toBeEnabled()
 await expect.poll(()=>outboxCount(page)).toBeGreaterThan(0)
 const before=await fingerprint(page),cookies=await context.cookies()
 let churchLogout=0
 await context.route('**/logout',route=>{churchLogout++;return route.fulfill({status:204})})
 await context.route('**/platform/logout',route=>{
  expect(route.request().headers()['x-csrf-token']).toBe('synthetic-platform-only')
  expect(route.request().headers()['x-xsrf-token']).toBeUndefined()
  return route.fulfill({status:204})
 })
 await page.goto('/account/platform-audit');await expect(page.getByText('Administrator sign-in started')).toBeVisible()
 await page.getByRole('button',{name:'Sign out of platform'}).click();await expect(page.getByText('You are signed out of platform.')).toBeVisible()
 expect(await fingerprint(page)).toBe(before);expect(churchLogout).toBe(0)
 expect((await context.cookies()).find(cookie=>cookie.name==='XSRF-TOKEN')?.value).toBe(cookies.find(cookie=>cookie.name==='XSRF-TOKEN')?.value)
 await expectNoSeriousAccessibilityIssues(page)
})

test('uncertain logout remains private across a route change until explicit session verification',async({page,context})=>{
 let held!:Route
 await context.route('**/platform/logout',route=>{held=route})
 await page.goto('/account/platform-applications');await expect(page.getByText('Synthetic application',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Sign out of platform'}).click();await expect.poll(()=>Boolean(held)).toBe(true)
 await page.evaluate(()=>{history.pushState(null,'','/account/platform-system-health');dispatchEvent(new PopStateEvent('popstate'))})
 await held.abort('failed')
 await expect(page.getByRole('alert')).toContainText('Sign-out could not be confirmed')
 await expect(page.getByText('42 pending · 0 failed')).toHaveCount(0)
 await page.getByRole('button',{name:'Check platform session'}).click()
 await expect(page.getByText('42 pending · 0 failed')).toBeVisible()
 await expectNoSeriousAccessibilityIssues(page)
})
