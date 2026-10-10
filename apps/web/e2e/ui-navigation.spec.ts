import { expect, test, type BrowserContext } from '@playwright/test'
import { churchId, ministryId, otherChurchId, json, expectNoSeriousAccessibilityIssues } from './support'
import { openChurchDestination } from './navigation-support'

test.use({ serviceWorkers: 'block' })
async function workspace(context: BrowserContext, role: 'owner' | 'teacher') {
  await context.route('**/auth/session', route => json(route, {id:11,email_verified:true,workspaces:[{church_id:churchId,name:'Synthetic church with a long verified display name',role}]}))
  await context.route('**/api/me', route => json(route, {id:11,memberships:[{church_id:churchId,status:'active',role}],assignments:{ministry_ids:[ministryId]},active_session:{mfa_confirmed:true}}))
  await context.route('**/api/ministries**', route => json(route, {data:[{id:ministryId,name:'Assigned ministry',status:'active'}]}))
}

for (const role of ['owner','teacher'] as const) {
  test(`${role} Home and navigation remain scoped and accessible at five widths`, async ({page,context}) => {
    await workspace(context,role)
    const posts: string[]=[]
    page.on('request',request=>{if(request.method()==='POST')posts.push(new URL(request.url()).pathname)})
    for (const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({width,height:1000})
      await page.goto('/account/home')
      await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible()
      await expect(page.getByText('Synthetic church with a long verified display name')).toBeVisible()
      if(role==='teacher') {
        await expect(page.getByText('Assigned ministry',{exact:true})).toBeVisible()
        await expect(page.getByRole('link',{name:'Teachers',exact:true})).toHaveCount(0)
        await expect(page.getByRole('link',{name:'Import',exact:true})).toHaveCount(0)
      }
      const phone=page.getByRole('navigation',{name:'Phone navigation',exact:true})
      const desktop=page.getByRole('navigation',{name:'Main navigation',exact:true,hidden:true})
      if(width<768) {
        await expect(phone).toBeVisible()
        expect(await phone.getByRole('link').allTextContents()).toEqual(role==='owner'?['Home','Attendance','Review','People','More']:['Home','Attendance','Sync','More'])
        expect(await phone.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true)
        for(const caption of await phone.locator('a > span').all()) expect(await caption.evaluate(element=>element.getBoundingClientRect().height<=parseFloat(getComputedStyle(element).lineHeight)+1)).toBe(true)
      } else if(width<1024) {await expect(desktop).toBeHidden();await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeVisible()}
      else {await expect(desktop).toBeVisible();await expect(phone).toBeHidden()}
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await expectNoSeriousAccessibilityIssues(page)
      await page.screenshot({path:test.info().outputPath(`${role}-${width}.png`),fullPage:true})
    }
    await page.setViewportSize({width:320,height:1000})
    await page.addStyleTag({content:':root {font-size:200%;}'})
    await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.body).fontSize)).toBe('32px')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:test.info().outputPath(`${role}-text-200.png`),fullPage:true})
    await page.goto('/account/home')
    if(role==='owner')await page.getByRole('link',{name:'Sync & device',exact:true}).click()
    else await page.getByRole('navigation',{name:'Phone navigation'}).getByRole('link',{name:'Sync',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Sync & device',exact:true})).toBeVisible()
    await page.getByRole('navigation',{name:'Phone navigation'}).getByRole('link',{name:'More',exact:true}).click()
    await page.getByRole('navigation',{name:'More destinations'}).getByRole('link',{name:'Account',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible()
    expect(posts).toEqual([])
  })
}

test('tablet drawer contains keyboard focus, returns focus and closes on navigation or resizing', async ({page,context})=>{
  await workspace(context,'owner');await page.setViewportSize({width:800,height:1000});await page.goto('/account/home')
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible()
  const menu=page.getByRole('button',{name:'Menu',exact:true})
  await menu.focus();await page.keyboard.press('Enter')
  const dialog=page.getByRole('dialog',{name:'Navigation',exact:true})
  await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Close navigation'})).toBeFocused()
  for(let index=0;index<18;index++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true)}
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({path:test.info().outputPath('tablet-drawer.png'),fullPage:true})
  await page.keyboard.press('Escape');await expect(menu).toBeFocused()
  await menu.click();await dialog.getByRole('link',{name:'People',exact:true}).click()
  await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();await expect(dialog).toBeHidden();await expect(page.getByRole('main')).toBeFocused()
  await menu.click();await page.setViewportSize({width:1024,height:1000});await expect(dialog).toBeHidden()
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible()
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await expectNoSeriousAccessibilityIssues(page)
})

test('aliases, history, invalid scope and independent offline Attendance remain safe',async({page,context})=>{
  await workspace(context,'owner')
  await context.route('**/api/students**',route=>json(route,{data:[]}))
  await page.goto('/students');await expect(page.getByRole('heading',{name:'Students',exact:true})).toBeVisible()
  await openChurchDestination(page,'Home','owner');await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible()
  await page.goBack();await expect(page.getByRole('heading',{name:'Students',exact:true})).toBeVisible()
  await page.goForward();await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible()
  await page.goto(`/account/home?church=${otherChurchId}`);await expect(page.getByRole('alert')).toContainText('unavailable')
  await expect(page.getByRole('link',{name:'Teachers',exact:true})).toHaveCount(0)
  await page.goto('/unsupported/students');await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible()
  await page.goto('/attendance');await expect(page.getByRole('heading',{name:'Take attendance'})).toBeVisible()
  await context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')))
  await expect(page.getByRole('heading',{name:'Take attendance'})).toBeVisible()
  await expect(page.getByText('Synthetic church with a long verified display name')).toHaveCount(0)
  await expect(page.getByText('Owner',{exact:true})).toHaveCount(0)
})

test('removing a multi-church URL selection clears protected presentation before the next response',async({page,context})=>{
  await workspace(context,'owner')
  let hold=false
  let release!: () => void
  let requested!: () => void
  const pending=new Promise<void>(resolve=>{release=resolve})
  const recheck=new Promise<void>(resolve=>{requested=resolve})
  await context.route('**/auth/session',async route=>{
    if(hold){requested();await pending}
    await json(route,{id:11,email_verified:true,workspaces:[{church_id:churchId,name:'Selected synthetic church',role:'owner'},{church_id:otherChurchId,name:'Other synthetic church',role:'owner'}]})
  })
  await page.goto(`/account/home?church=${churchId}`)
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible()
  await expect(page.locator('.workspace-identity')).toContainText('Selected synthetic church')
  hold=true
  await page.evaluate(()=>{history.pushState(null,'','/account/home');window.dispatchEvent(new PopStateEvent('popstate'))})
  await recheck
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toHaveCount(0)
  await expect(page.locator('.workspace-identity')).not.toContainText('Selected synthetic church')
  await expect(page.getByRole('link',{name:'Teachers',exact:true})).toHaveCount(0)
  release()
  await expect(page.getByText('Choose an authorized church workspace to continue.')).toBeVisible()
})
