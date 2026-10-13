import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { churchId, ministryId, studentIds, json, expectNoSeriousAccessibilityIssues } from './support'

test.use({ serviceWorkers: 'block' })
const names = ['Sample Community Church', 'Fellowship Church '.padEnd(50, 'A'), ('The Fellowship of Grace and Community ').repeat(4).slice(0,160), 'UnbrokenChurch'.repeat(12).slice(0,160)]
const ministry = 'Community Explorers '.repeat(6).slice(0,120).trim()
const student = 'Alexandria'.repeat(5) + ' ' + 'Montgomery'.repeat(5)
const teacher = 'Teacher '.repeat(15).trim()
const email = 'account'.repeat(8) + '@' + 'community'.repeat(6) + '.example.test'
async function fixture(context: BrowserContext, role: 'owner'|'teacher', name: string, multiple = false) {
  await context.route('**/auth/session', route => json(route, { id:11, email_verified:true, workspaces:[{church_id:churchId,name,role}, ...(multiple ? [{church_id:'00000000-0000-4000-8000-000000000099',name:'Other '+name,role}] : [])] }))
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path === '/api/me' ? {id:11, email, memberships:[{church_id:churchId,status:'active',role}], assignments:{ministry_ids:[ministryId]}, active_session:{mfa_confirmed:true}} : path === '/api/ministries' || path === '/api/assigned-ministries' ? {data:[{id:ministryId,name:ministry,status:'active',version:1}]} : path === '/api/students' ? {data:[{id:studentIds[0],first_name:'Alexandria'.repeat(5),last_name:'Montgomery'.repeat(5),display_name:student,status:'active',gender:'unspecified',version:1,ministry_ids:[ministryId],birth_month_day:null,date_of_birth:null}]} : path === '/api/teachers' ? {data:[{id:'teacher-id',display_name:teacher,status:'active',ministry_ids:[ministryId],can_manage:true}],can_invite:true,has_more:false} : {data:[]}
    return json(route,data)
  })
}
async function bounded(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('.workspace-header').evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(180)
  const summary = page.locator('.church-name-details summary')
  const status = page.locator('.workspace-identity > .ui-status-badge')
  const a = await summary.boundingBox(), b = await status.boundingBox()
  expect(a!.width).toBeGreaterThan(16)
  expect(a!.x+a!.width).toBeLessThanOrEqual(b!.x+1)
}
for (const [index,name] of names.entries()) test(`compact church fixture ${index}: full-value access and responsive bounds`, async ({ page,context }) => {
  await fixture(context,'teacher',name)
  await page.goto('/account/home')
  await expect(page.getByRole('heading',{name:ministry,exact:true})).toBeVisible()
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900})
    await bounded(page)
    const label = await page.locator('.compact-text').evaluate(el => el.querySelector('[aria-hidden=true]')?.textContent ?? el.textContent)
    expect(Array.from(label ?? '').length).toBeLessThanOrEqual(50)
    const summary = page.locator('.church-name-details summary')
    await summary.focus(); await page.keyboard.press('Enter')
    await expect(page.locator('.church-name-expanded')).toHaveText(name)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({path:test.info().outputPath(`church-${index}-${width}-expanded.png`),fullPage:true})
    await page.keyboard.press('Enter')
    await expect(page.getByRole('link',{name:'Take attendance',exact:true})).toBeVisible()
    await expectNoSeriousAccessibilityIssues(page)
    await page.screenshot({path:test.info().outputPath(`church-${index}-${width}.png`),fullPage:true})
  }
})
test('long person/email/ministry text, forms, dialogs and enlarged Home retain actions and data', async ({page,context}) => {
  await fixture(context,'owner',names[3],true)
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000})
    await page.goto(`/account/students?church=${churchId}`)
    const view = page.getByRole('button',{name:`View ${student}`,exact:true})
    await expect(view).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('.workspace-selector select')).toHaveValue(churchId)
    await expect(page.locator('.workspace-selector select')).toHaveAttribute('title',names[3])
    await expectNoSeriousAccessibilityIssues(page)
    await page.screenshot({path:test.info().outputPath(`long-student-${width}.png`),fullPage:true})
    await page.goto(`/account/teachers?church=${churchId}`)
    await expect(page.getByRole('button',{name:`View ${teacher}`,exact:true})).toBeVisible()
    await expect(page.getByText(email,{exact:true})).toHaveCount(0) // No invented student/teacher email disclosure.
    await page.getByRole('button',{name:'Invite a Teacher',exact:true}).click()
    await page.getByLabel('Invitation email').fill(email)
    await expect(page.getByLabel('Invitation email')).toHaveValue(email)
    await page.getByLabel(ministry,{exact:true}).check()
    await page.getByRole('button',{name:'Review invitation',exact:true}).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(email)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({path:test.info().outputPath(`long-teacher-email-${width}.png`),fullPage:true})
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  }
  await page.goto(`/account/home?church=${churchId}`)
  await page.setViewportSize({width:320,height:1000})
  await page.addStyleTag({content:':root{font-size:200%}'})
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.church-name-details summary').focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.church-name-expanded')).toHaveText(names[3])
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({path:test.info().outputPath('owner-320-text-200.png'),fullPage:true})
})
test('long invited account display name and email retain complete form values without mutation',async({page})=>{
  const proof={church_id:churchId,invitation_id:'00000000-0000-4000-8000-000000000070',token:'a'.repeat(64),signature:'b'.repeat(64),expires:2000000000}
  const name='AccountDisplay'.repeat(8).slice(0,100)
  await page.goto('/account/teacher-invitation#'+encodeURIComponent(JSON.stringify(proof)))
  await page.getByRole('checkbox',{name:'Create my invited account',exact:true}).check()
  await page.getByLabel('Display name').fill(name)
  await page.getByLabel('Invited email').fill(email)
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900})
    await expect(page.getByLabel('Display name')).toHaveValue(name)
    await expect(page.getByLabel('Invited email')).toHaveValue(email)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.getByLabel('Display name').focus(); await expect(page.getByLabel('Display name')).toBeFocused()
    await expectNoSeriousAccessibilityIssues(page)
    await page.screenshot({path:test.info().outputPath(`long-account-${width}.png`),fullPage:true})
  }
})
test('public church/platform authentication use the approved shared identity at narrow widths',async({page})=>{
  for(const route of ['/account/login','/account/platform-login']){
    await page.goto(route)
    await page.setViewportSize({width:320,height:900})
    await expect(page.locator('.brand-wordmark')).toHaveText('MSprout')
    await expect(page.locator('.brand-symbol')).toHaveAttribute('src','/brand/msprout-symbol.svg')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await expectNoSeriousAccessibilityIssues(page)
    await page.screenshot({path:test.info().outputPath(route.includes('platform')?'platform-login.png':'church-login.png'),fullPage:true})
  }
})
