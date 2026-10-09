import { expect, test } from '@playwright/test'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { expectNoSeriousAccessibilityIssues } from './support'

let fixtureHtml: string
test.beforeAll(async () => {
  const result = await build({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error', build: { write: false, minify: false, lib: { entry: path.resolve(import.meta.dirname, 'fixtures/ui-foundations.tsx'), formats: ['iife'], name: 'FoundationExamples' } } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(output => output.output)
  const script = outputs.filter(output => output.type === 'chunk').map(output => output.code).join('\n')
  const css = outputs.filter(output => output.type === 'asset' && output.fileName.endsWith('.css')).map(output => String(output.source)).join('\n')
  fixtureHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UI foundation test</title><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
})

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/__ui-foundations', route => route.fulfill({ contentType: 'text/html', body: fixtureHtml }))
  await page.goto('/__ui-foundations')
  expect(errors).toEqual([])
})

test('shared examples reflow at five widths with readable labels, targets and contrast', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'MinistrySprout foundations' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const button of await page.getByRole('button').all()) {
      const box = await button.boundingBox()
      if (box) { expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44) }
    }
    await expectNoSeriousAccessibilityIssues(page)
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.screenshot({ path: test.info().outputPath('foundations-320.png'), fullPage: true })
})

test('native dialog contains keyboard focus, cancels with Escape and returns to its trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Review example', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Review example action' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  }
  await expectNoSeriousAccessibilityIssues(page)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('button', { name: 'Confirm example' }).click()
  await expect(trigger).toBeFocused()
})

test('auth errors are safe, focused and linked while clearing the password', async ({ page }) => {
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Synthetic example secret')
  await page.getByRole('button', { name: 'Test sign in' }).click()
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('synthetic@example.test')
  await expect(page.getByRole('alert')).not.toContainText('Untrusted')
  await page.getByRole('link', { name: 'Email: Check this field.' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await expectNoSeriousAccessibilityIssues(page)
})

test('tabs and focus remain usable with enlarged text, reduced motion and forced colors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addStyleTag({ content: ':root { font-size: 200%; }' })
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe('32px')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const first = page.getByRole('tab', { name: 'First view' })
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Second view' })).toBeFocused()
  await expect(page.getByRole('tabpanel')).toHaveText('Second panel')
  expect(await first.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(.00001)
  await page.emulateMedia({ forcedColors: 'active' })
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  expect(await first.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')
  await page.screenshot({ path: test.info().outputPath('foundations-text-200.png'), fullPage: true })
})
