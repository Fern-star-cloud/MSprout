import { expect, test } from '@playwright/test'

test('the application shell installs and reloads while offline', async ({ page, context }) => {
  await page.goto('/account/students')

  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: /navigation/i }).first()).toBeVisible()

  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifest).toBe('/manifest.webmanifest')

  await expect.poll(async () => page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    await navigator.serviceWorker.ready
    return Boolean(navigator.serviceWorker.controller)
  })).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
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
