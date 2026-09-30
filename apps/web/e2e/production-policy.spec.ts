import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('production CSP permits the required Turnstile script and frame while rejecting unrelated scripts', async ({ page }) => {
  const deployment = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
  }
  const policy = deployment.headers.find(entry => entry.source === '/(.*)')!
    .headers.find(header => header.key === 'Content-Security-Policy')!.value
  await page.route('https://challenges.cloudflare.com/**', route => route.fulfill({
    contentType: route.request().resourceType() === 'script' ? 'application/javascript' : 'text/html',
    body: route.request().resourceType() === 'script'
      ? "document.documentElement.dataset.turnstileLoaded = 'true'"
      : '<p>Required verification frame</p>',
  }))
  await page.route('https://unrelated.example.invalid/**', route => route.fulfill({
    contentType: 'application/javascript', body: "document.documentElement.dataset.unrelatedLoaded = 'true'",
  }))
  await page.route('**/qa-production-policy', route => route.fulfill({
    contentType: 'text/html', headers: { 'Content-Security-Policy': policy },
    body: '<!doctype html><title>CSP qualification</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script><script src="https://unrelated.example.invalid/probe.js"></script><iframe title="Verification" src="https://challenges.cloudflare.com/qa-frame"></iframe>',
  }))
  await page.goto('/qa-production-policy')
  await expect(page.locator('html')).toHaveAttribute('data-turnstile-loaded', 'true', { timeout: 5000 })
  await expect(page.frameLocator('iframe').getByText('Required verification frame')).toBeVisible()
  await expect(page.locator('html')).not.toHaveAttribute('data-unrelated-loaded')
  expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|\*/)
})

test('authenticated API reads identify the first-party origin without disclosing the page path or query', async ({ page }) => {
  let referer: string | undefined
  await page.route('**/auth/session', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ email_verified: true, mfa_confirmed: false }),
  }))
  await page.route('**/account/application?**', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'Referrer-Policy': 'no-referrer' } })
  })
  await page.route('**/api/church-applications/current', async route => {
    referer = route.request().headers().referer
    const firstParty = referer === 'http://127.0.0.1:4173/'
    await route.fulfill({
      status: firstParty ? 200 : 401, contentType: 'application/json',
      body: JSON.stringify(firstParty ? { application: null } : { code: 'unauthenticated' }),
    })
  })
  await page.goto('/account/application?private-test-marker=must-not-be-disclosed')
  await expect(page.getByLabel('Church name')).toBeVisible({ timeout: 5000 })
  expect(referer).toBe('http://127.0.0.1:4173/')
  expect(referer).not.toContain('private-test-marker')
})
