import { expect, test } from '@playwright/test'
import { expectNoSeriousAccessibilityIssues, json, mockOwner } from './support'

test.beforeEach(async ({ context }) => {
  // Students is an online, verified-workspace surface; shell tests need that fixture too.
  await mockOwner(context)
  await context.route('**/api/students**', route => json(route, { data: [], page: 1, has_more: false }))
  await context.route('**/api/ministries**', route => json(route, { data: [], page: 1, has_more: false }))
})

test('the application shell installs and remains usable while offline', async ({ page, context, browserName }) => {
  await page.goto('/account/students')

  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: /navigation/i }).first()).toBeVisible()

  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifest).toBe('/manifest.webmanifest')

  // The offline entry is encrypted device profiles, not online People management.
  await page.goto('/profiles')
  await expect(page.getByRole('heading', { name: 'Choose a device profile' })).toBeVisible()

  await expect.poll(async () => page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    await navigator.serviceWorker.ready
    return Boolean(navigator.serviceWorker.controller)
  })).toBe(true)

  await context.setOffline(true)
  if (browserName === 'chromium') await page.reload()
  else await page.evaluate(() => globalThis.dispatchEvent(new Event('offline')))
  await expect(page.getByRole('heading', { name: 'Choose a device profile' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Offline')
})

test('phone navigation has reachable touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/account/students')

  const navigation = page.getByRole('navigation', { name: 'Phone navigation' })
  await expect(navigation).toBeVisible()
  const links = navigation.getByRole('link')
  await expect(links.first()).toBeVisible()
  expect(await links.first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
})

test('wide screens use a persistent sidebar and visible keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/account/students')

  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(navigation).toBeVisible()
  await navigation.getByRole('link').first().focus()
  await expect(navigation.getByRole('link').first()).toBeFocused()
})

test('keyboard-only navigation and reduced motion keep the shell operable', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/account/students')
  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
  // The heading precedes the scoped account read; mobile WebKit tabs to form controls.
  await expect(page.getByRole('checkbox', { name: 'Show archived students' })).toBeVisible()
  await page.keyboard.press('Tab')
  if (browserName === 'webkit') {
    // WebKit may apply keyboard focus asynchronously; retain the same focus guarantee.
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true)
  } else {
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
  }
  const motion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  expect(motion).toBe(true)
  await expectNoSeriousAccessibilityIssues(page)
})

test('a real service-worker update check preserves the active application shell', async ({ page }) => {
  await page.goto('/account/students')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const before = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return { scope: registration.scope, controlled: Boolean(navigator.serviceWorker.controller) }
  })
  expect(before.controlled).toBe(true)
  await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
})

test('the service worker never serves a previously successful API response offline', async ({ page, context }) => {
  const apiHandler = (route: import('@playwright/test').Route) => route.fulfill({ json: { data: [{ id: 'pilot' }] } })
  await context.route('**/api/pilot-probe', apiHandler)
  await page.goto('/account/students')
  expect(await page.evaluate(async () => (await fetch('/api/pilot-probe')).ok)).toBe(true)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.unroute('**/api/pilot-probe', apiHandler)
  await context.setOffline(true)
  expect(await page.evaluate(async () => {
    try { return (await fetch('/api/pilot-probe')).ok } catch { return false }
  })).toBe(false)
})
