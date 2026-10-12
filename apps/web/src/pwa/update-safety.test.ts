// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createPwaUpdateController } from './update-controller'

afterEach(() => vi.unstubAllGlobals())
function fixture(check: () => boolean | Promise<boolean>, activate = vi.fn(async (): Promise<void> => undefined)) {
  let announce!: () => void
  vi.stubGlobal('navigator', { serviceWorker: {} })
  const controller = createPwaUpdateController({ hasUnsafeLocalWork: check, register: options => { announce = options.onNeedRefresh; return activate } })
  controller.start(); announce()
  return { controller, activate }
}
it('fails closed with truthful feedback when preservation checks cannot be read', async () => {
  const { controller, activate } = fixture(async () => { throw new Error('PRIVATE_SENTINEL') })
  await expect(controller.applyUpdate()).resolves.toBe(false)
  expect(activate).not.toHaveBeenCalled()
  expect(controller.getSnapshot()).toMatchObject({ updateAvailable: true, updateBlocked: true, updating: false, error: 'preservation' })
  expect(JSON.stringify(controller.getSnapshot())).not.toContain('PRIVATE_SENTINEL')
})
it('coalesces repeated update actions while a local-work check is pending', async () => {
  let resolve!: (value: boolean) => void
  const { controller, activate } = fixture(() => new Promise(done => { resolve = done }))
  const first = controller.applyUpdate()
  expect(controller.getSnapshot()).toMatchObject({ updating: true })
  await expect(controller.applyUpdate()).resolves.toBe(false)
  resolve(false); await expect(first).resolves.toBe(true)
  expect(activate).toHaveBeenCalledTimes(1)
})
it('retains the waiting update and offers a deliberate retry after activation fails', async () => {
  const activate = vi.fn(async (): Promise<void> => { throw new Error('PRIVATE_SENTINEL') })
  const { controller } = fixture(() => false, activate)
  await expect(controller.applyUpdate()).resolves.toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ updateAvailable: true, updating: false, error: 'activation' })
  activate.mockResolvedValueOnce(undefined)
  await expect(controller.applyUpdate()).resolves.toBe(true)
  expect(activate).toHaveBeenCalledTimes(2)
})
it('does not activate until a fresh checker confirms local work is safe', async () => {
  let unsafe = true
  const check = vi.fn(() => unsafe)
  const { controller, activate } = fixture(check)
  await expect(controller.applyUpdate()).resolves.toBe(false)
  expect(activate).not.toHaveBeenCalled()
  unsafe = false; await expect(controller.applyUpdate()).resolves.toBe(true)
  expect(check).toHaveBeenCalledTimes(2)
})
