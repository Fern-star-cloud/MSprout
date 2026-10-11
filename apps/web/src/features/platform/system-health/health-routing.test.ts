import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import config from '../../../../vite.config'

const deployment = JSON.parse(readFileSync(new URL('../../../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string; destination: string }[] }
it('routes the existing public liveness read through the same API origin in deployment', () => {
  const platform = deployment.rewrites.find(route => route.source === '/platform/:path*')!
  const live = deployment.rewrites.find(route => route.source === '/health/live')
  expect(live).toBeDefined()
  expect(live?.destination).toBe(new URL('/health/live', platform.destination).href)
})
it('supports the existing same-origin local public liveness read', () => {
  const proxy = config.server?.proxy
  expect(proxy?.['/health/live']).toEqual(proxy?.['/platform'])
})
it('never bridges token-protected readiness or a broad health namespace into the ordinary workspace', () => {
  const sources = deployment.rewrites.map(route => route.source).filter(source => source.startsWith('/health'))
  expect(sources).toEqual(['/health/live'])
  expect(Object.keys(config.server?.proxy ?? {}).filter(source => source.startsWith('/health'))).toEqual(['/health/live'])
})
