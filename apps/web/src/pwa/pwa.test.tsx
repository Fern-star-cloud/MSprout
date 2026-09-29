/// <reference types="node" />
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from '../app/router'
import { ConnectivityStatus } from '../components/ConnectivityStatus'
import { createPwaUpdateController } from './update-controller'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

describe('installable application metadata', () => {
  it('describes MinistrySprout as a standalone app with install icons', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8')) as {
      name: string
      short_name: string
      start_url: string
      display: string
      icons: Array<{ src: string; sizes: string; purpose?: string }>
    }

    expect(manifest).toMatchObject({
      name: 'MinistrySprout',
      short_name: 'Sprout',
      start_url: '/',
      display: 'standalone',
    })
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ purpose: expect.stringContaining('maskable') }),
    ]))
  })

  it('keeps API requests network-only and provides an app-shell navigation fallback', () => {
    const source = readFileSync(resolve('src/pwa/service-worker.ts'), 'utf8')

    expect(source).toMatch(/pathname\.startsWith\(['"]\/api\/['"]\)/)
    expect(source).toContain('NetworkOnly')
    expect(source).toContain('createHandlerBoundToURL')
    expect(source).toContain('NavigationRoute')
  })

  it('shows only a generic birthday notification and opens the authenticated birthday route', () => {
    const source = readFileSync(resolve('src/pwa/service-worker.ts'), 'utf8')

    expect(source).toContain("showNotification('Birthday reminder'")
    expect(source).toContain("data: { url: '/account/birthdays' }")
    expect(source).toContain("new URL('/account/birthdays', self.location.origin)")
    expect(source).not.toContain('date_of_birth')
  })
})

describe('controlled service-worker updates', () => {
  it('exposes a waiting update but defers activation while local work is unsafe', async () => {
    const activate = vi.fn(async () => undefined)
    let announceUpdate: (() => void) | undefined
    let unsafe = true
    const register = vi.fn((options: { onNeedRefresh(): void }) => {
      announceUpdate = options.onNeedRefresh
      return activate
    })
    const controller = createPwaUpdateController({
      register,
      hasUnsafeLocalWork: () => unsafe,
    })

    vi.stubGlobal('navigator', { onLine: true, serviceWorker: {} })
    controller.start()
    announceUpdate?.()
    expect(controller.getSnapshot()).toMatchObject({ updateAvailable: true, updateBlocked: false })

    await expect(controller.applyUpdate()).resolves.toBe(false)
    expect(activate).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ updateAvailable: true, updateBlocked: true })

    unsafe = false
    await expect(controller.applyUpdate()).resolves.toBe(true)
    expect(activate).toHaveBeenCalledWith(true)
    expect(controller.getSnapshot()).toMatchObject({ updateAvailable: false, updateBlocked: false })
  })
})

describe('responsive and accessible shell', () => {
  it('provides phone bottom navigation and a wide persistent sidebar', () => {
    history.replaceState(null, '', '/account/students')
    render(<AppRouter />)

    expect(screen.getByRole('navigation', { name: 'Phone navigation' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Students/ })).toHaveLength(2)
  })

  it('uses words and icons for offline status', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<ConnectivityStatus />)

    expect(screen.getByRole('status').textContent).toContain('Offline')
    expect(screen.getByRole('status').querySelector('svg')).toBeTruthy()
  })

  it('defines a minimum 44-pixel interactive target and reduced-motion behavior', () => {
    const tokens = readFileSync(resolve('src/styles/tokens.css'), 'utf8')
    const globalStyles = readFileSync(resolve('src/styles/global.css'), 'utf8')

    expect(tokens).toMatch(/--touch-target:\s*44px/)
    expect(globalStyles).toContain('prefers-reduced-motion: reduce')
    expect(globalStyles).toContain('forced-colors: active')
  })
})
