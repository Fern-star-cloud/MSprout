import { expect, test, type BrowserContext } from '@playwright/test'
import { churchId, otherChurchId, ministryId, studentIds, json, expectNoSeriousAccessibilityIssues } from './support'
const studentId=studentIds[0]
test.use({serviceWorkers:'block'})
type Role='owner'|'teacher'
async function fixture(context:BrowserContext,role:Role){
 const mutations:{path:string;body:Record<string,unknown>|null}[]=[]
 let denied=false,transferAttempt=0,student={id:studentId,first_name:'Pilot',last_name:'Student',display_name:'Pilot Student',gender:'unspecified',status:'active',version:1,ministry_ids:[ministryId],date_of_birth:'2018-01-02',birth_month_day:'01-02',external_reference:'Owner-only reference'}
 let ministry={id:ministryId,name:'Primary ministry with a long authorized name',status:'active',version:1}
 await context.route('**/auth/session',route=>json(route,{id:11,email_verified:true,workspaces:[{church_id:churchId,name:'Synthetic People church',role}]}))
 await context.route('**/sanctum/csrf-cookie',route=>route.fulfill({status:204,headers:{'Set-Cookie':'XSRF-TOKEN=synthetic; Path=/; SameSite=Lax'}}))
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method()
  if(path==='/api/health')return json(route,{status:'ok'})
  expect(route.request().headers()['x-church-id']).toBe(churchId)
  if(denied)return json(route,{message:'Do not reflect private data'},403)
  if(method!=='GET'){
   const body=route.request().postDataJSON() as Record<string,unknown>|null;mutations.push({path,body})
   if(path==='/api/ownership-transfer'){
    transferAttempt++;expect(body).toMatchObject({target_membership_id:'teacher-id',password:'synthetic-password',code:'123456'})
    if(transferAttempt===1)return json(route,{field_errors:{code:['unsafe detail']}},422)
    return json(route,{status:'transferred'})
   }
   if(path===`/api/students/${studentId}/archive`)student={...student,status:'archived'}
   if(path===`/api/students/${studentId}/restore`)student={...student,status:'active'}
   if(path===`/api/students/${studentId}/enrollments`)student={...student,ministry_ids:body?.ministry_ids as string[]}
   if(path==='/api/students')student={...student,...body,display_name:String(body?.first_name)+' '+String(body?.last_name)}
   if(path===`/api/students/${studentId}`){expect(body).not.toHaveProperty('ministry_ids');student={...student,...body,display_name:String(body?.first_name)+' '+String(body?.last_name)}}
   if(path===`/api/ministries/${ministryId}/archive`)ministry={...ministry,status:'archived'}
   if(path===`/api/ministries/${ministryId}/restore`)ministry={...ministry,status:'active'}
   if(path==='/api/ministries'||path===`/api/ministries/${ministryId}`)ministry={...ministry,...body}
   return json(route,path.startsWith('/api/students')?student:ministry)
  }
  if(path==='/api/me')return json(route,{id:11,memberships:[{church_id:churchId,status:'active',role}],assignments:{ministry_ids:[ministryId]},active_session:{mfa_confirmed:role==='owner'}})
  if(path===`/api/students/${studentId}`)return json(route,student)
  if(path==='/api/students')return json(route,{data:student.status==='active'||url.searchParams.get('include_archived')==='true'?[student]:[]})
  if(path==='/api/ministries'||path==='/api/assigned-ministries')return json(route,{data:[ministry]})
  if(path==='/api/teachers')return json(route,{data:[{id:'teacher-id',display_name:'Pilot Teacher',status:'active',ministry_ids:[ministryId],can_manage:true}],has_more:url.searchParams.get('page')==='1',can_invite:true})
  if(path==='/api/teacher-invitations')return json(route,{data:[{id:'pending-id',email:'invited@example.test',status:'pending',expires_at:'2030-01-01T00:00:00Z'},{id:'expired-id',email:'expired@example.test',status:'expired',expires_at:'2020-01-01T00:00:00Z'}],has_more:url.searchParams.get('page')==='1'})
  return json(route,{data:[]})
 })
 return{mutations,revoke:()=>{denied=true}}
}
test('Owner list/detail, student Add/Edit, enrollment and named lifecycle confirmations preserve supported operations',async({page,context})=>{
 const proof=await fixture(context,'owner');await page.goto('/account/students')
 await expect(page.getByRole('button',{name:'Add student',exact:true})).toBeVisible()
 await expect(page.getByRole('form',{name:'Add student',exact:true})).toHaveCount(0)
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await expect(page.getByRole('button',{name:'View Pilot Student'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  if(width===1440){const table=await page.getByRole('table').boundingBox(),card=await page.locator('.people-page').boundingBox();expect(table!.width).toBeGreaterThan(card!.width*.8)}
  await expectNoSeriousAccessibilityIssues(page);await page.screenshot({path:test.info().outputPath(`owner-list-${width}.png`),fullPage:true})
 }
 await page.setViewportSize({width:320,height:1000});await page.addStyleTag({content:':root{font-size:200%}'});await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 for(let i=0;i<9;i++){
  await page.keyboard.press('Tab')
  const visible=await page.evaluate(()=>{const target=document.activeElement;if(!(target instanceof HTMLElement)||!target.closest('.people-page'))return true;const rect=target.getBoundingClientRect(),nav=document.querySelector('.phone-navigation')?.getBoundingClientRect();return rect.top>=0&&rect.bottom<=(nav&&nav.height?nav.top:innerHeight)})
  expect(visible).toBe(true)
 }
 await page.getByRole('button',{name:'View Pilot Student'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Pilot Student',exact:true})).toBeFocused()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await expectNoSeriousAccessibilityIssues(page);await page.screenshot({path:test.info().outputPath('owner-detail-enlarged.png'),fullPage:true})
 await page.getByRole('button',{name:'Archive student',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Archive Pilot Student?'})
 await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused()
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true)}
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Archive student',exact:true})).toBeFocused();expect(proof.mutations).toHaveLength(0)
 await page.getByRole('button',{name:'Back to students'}).click();await expect(page.getByRole('button',{name:'View Pilot Student'})).toBeFocused()
 await page.goto('/account/students');await page.getByRole('button',{name:'Add student',exact:true}).click()
 await page.getByLabel('First name',{exact:true}).fill('Synthetic');await page.getByLabel('Last name',{exact:true}).fill('Example');await page.getByLabel('Primary ministry with a long authorized name',{exact:true}).check();await page.getByRole('button',{name:'Save student',exact:true}).click()
 await page.getByRole('button',{name:'View Synthetic Example'}).click();await page.getByRole('button',{name:'Edit student',exact:true}).click();await page.getByLabel('Preferred name',{exact:true}).fill('Pilot');await page.getByRole('button',{name:'Save student',exact:true}).click()
 await page.getByRole('button',{name:'View Synthetic Example'}).click();await page.getByRole('button',{name:'Edit enrollments'}).click();await page.getByLabel('Primary ministry with a long authorized name',{exact:true}).uncheck();await page.getByRole('button',{name:'Save enrollments'}).click()
 await page.getByRole('button',{name:'View Synthetic Example'}).click();await page.getByRole('button',{name:'Archive student',exact:true}).click();await page.getByRole('button',{name:'Confirm archive'}).click()
 await page.getByLabel('Status filter').selectOption('archived');await page.getByRole('button',{name:'View Synthetic Example'}).click();await page.getByRole('button',{name:'Restore student',exact:true}).click();await page.getByRole('button',{name:'Confirm restore'}).click()
 expect(proof.mutations.map(item=>item.path)).toEqual(['/api/students',`/api/students/${studentId}`,`/api/students/${studentId}/enrollments`,`/api/students/${studentId}/archive`,`/api/students/${studentId}/restore`])
 await expectNoSeriousAccessibilityIssues(page)
})
test('Owner Ministries and Teachers have distinct edits, invitation pages and separate protected transfer',async({page,context})=>{
 const proof=await fixture(context,'owner');await page.goto('/account/ministries');await page.getByRole('button',{name:'View Primary ministry with a long authorized name'}).click()
 await page.getByRole('button',{name:'Edit ministry'}).click();await page.getByLabel('Ministry name').fill('Renamed synthetic ministry');await page.getByRole('button',{name:'Save ministry'}).click()
 await page.getByRole('button',{name:'View Renamed synthetic ministry'}).click();await page.getByRole('button',{name:'Archive ministry'}).click();await page.getByRole('button',{name:'Confirm archive'}).click();await page.getByLabel('Status filter').selectOption('archived')
 await page.getByRole('button',{name:'View Renamed synthetic ministry'}).click();await page.getByRole('button',{name:'Restore ministry'}).click();await page.getByRole('button',{name:'Confirm restore'}).click()
 await page.goto('/account/teachers');await expect(page.getByText('expired@example.test · expired',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Revoke invitation for expired@example.test'})).toHaveCount(0)
 await page.getByRole('button',{name:'Next Teachers'}).click();await expect(page.getByText(/records on page 2/)).toBeVisible();await page.getByRole('button',{name:'Next invitations'}).click();await expect(page.getByText('Invitation status is separate from Teacher membership. Page 2.')).toBeVisible()
 await page.getByRole('button',{name:'Invite a Teacher',exact:true}).click();await page.getByLabel('Invitation email').fill('new-invite@example.test');await page.getByLabel('Renamed synthetic ministry',{exact:true}).check();await page.getByRole('button',{name:'Review invitation'}).click();await expect(page.getByRole('dialog',{name:'Invite new-invite@example.test?'})).toBeVisible();await page.getByRole('button',{name:'Invite Teacher',exact:true}).click()
 await page.getByRole('button',{name:'Revoke invitation for invited@example.test'}).click();await page.getByRole('button',{name:'Confirm invitation revocation'}).click()
 await page.getByRole('button',{name:'View Pilot Teacher'}).click();await page.getByRole('button',{name:'Edit assignments'}).click();await page.getByLabel('Renamed synthetic ministry',{exact:true}).uncheck();await page.getByRole('button',{name:'Save assignments'}).click()
 await page.getByRole('button',{name:'View Pilot Teacher'}).click();const separate=page.getByRole('region',{name:'Ownership transfer',exact:true});await expect(separate.getByRole('button',{name:'Transfer ownership'})).toBeVisible()
 await separate.getByRole('button',{name:'Transfer ownership'}).click();await page.getByLabel('Current password').fill('synthetic-password');await page.getByLabel('Fresh authenticator code').fill('123456');await page.getByLabel('I understand that ownership will transfer to Pilot Teacher.').check();await page.getByRole('button',{name:'Confirm transfer'}).click()
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Check the information');await expect(page.getByLabel('Current password')).toHaveValue('');await expect(page.getByLabel('Fresh authenticator code')).toHaveValue('');await expect(page.getByLabel('Fresh authenticator code')).toHaveAttribute('aria-invalid','true')
 await expectNoSeriousAccessibilityIssues(page);await page.screenshot({path:test.info().outputPath('protected-transfer-safe-error.png'),fullPage:true});await page.keyboard.press('Escape')
 await separate.getByRole('button',{name:'Transfer ownership'}).click();await page.getByLabel('Current password').fill('synthetic-password');await page.getByLabel('Fresh authenticator code').fill('123456');await page.getByLabel('I understand that ownership will transfer to Pilot Teacher.').check();await page.getByRole('button',{name:'Confirm transfer'}).click()
 await expect(page.getByRole('button',{name:'Transfer ownership'})).toHaveCount(0);expect(proof.mutations.filter(item=>item.path==='/api/ownership-transfer')).toHaveLength(2)
})
test('Teacher My ministries to assigned roster is read-only, wrong-church denied and revoked detail cannot return',async({page,context})=>{
 const proof=await fixture(context,'teacher');await page.goto('/account/ministries');await expect(page.getByRole('heading',{name:'My ministries',exact:true})).toBeVisible();await page.getByRole('button',{name:'View Primary ministry with a long authorized name'}).click();await page.getByRole('link',{name:'View assigned roster'}).click()
 await page.getByRole('button',{name:'View Pilot Student'}).click();await expect(page.getByRole('heading',{name:'Pilot Student',exact:true})).toBeVisible();await expect(page.getByText('2018-01-02',{exact:true})).toHaveCount(0);await expect(page.getByText('Owner-only reference',{exact:true})).toHaveCount(0)
 for(const name of ['Add student','Edit student','Archive student','Invite a Teacher','Transfer ownership'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0)
 await expect(page.getByRole('link',{name:'Import students',exact:true})).toHaveCount(0);await expectNoSeriousAccessibilityIssues(page)
 await page.screenshot({path:test.info().outputPath('teacher-readonly-detail.png'),fullPage:true})
 await page.goto(`/account/students?church=${otherChurchId}`);await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.getByRole('button',{name:'View Pilot Student'})).toHaveCount(0)
 await page.goto('/account/students');await page.getByRole('button',{name:'View Pilot Student'}).click();proof.revoke();await page.getByRole('button',{name:'Refresh records'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('heading',{name:'Pilot Student',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add student',exact:true})).toHaveCount(0)
 expect(proof.mutations).toHaveLength(0)
})
