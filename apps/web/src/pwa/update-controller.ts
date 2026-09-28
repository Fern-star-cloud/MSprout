import { useSyncExternalStore } from 'react'

export interface PwaUpdateSnapshot {
  updateAvailable: boolean
  updateBlocked: boolean
}

interface RegisterOptions {
  immediate?: boolean
  onNeedRefresh(): void
  onRegisteredSW?(scriptUrl: string, registration: ServiceWorkerRegistration | undefined): void
  onRegisterError?(error: unknown): void
}

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>
export type RegisterServiceWorker = (options: RegisterOptions) => UpdateServiceWorker

interface ControllerOptions {
  register?: RegisterServiceWorker
  hasUnsafeLocalWork?: () => boolean | Promise<boolean>
}

const availableSnapshot: PwaUpdateSnapshot = { updateAvailable: true, updateBlocked: false }
const blockedSnapshot: PwaUpdateSnapshot = { updateAvailable: true, updateBlocked: true }
const idleSnapshot: PwaUpdateSnapshot = { updateAvailable: false, updateBlocked: false }

export function createPwaUpdateController(options: ControllerOptions = {}) {
  let register = options.register
  let hasUnsafeLocalWork = options.hasUnsafeLocalWork ?? (() => false)
  let updateServiceWorker: UpdateServiceWorker | undefined
  let snapshot = idleSnapshot
  let started = false
  const listeners = new Set<() => void>()

  const publish = (next: PwaUpdateSnapshot) => {
    if (snapshot === next) return
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  return {
    start(registrar?: RegisterServiceWorker) {
      if (started) return
      register = registrar ?? register
      if (!register || !('serviceWorker' in navigator)) return
      started = true
      updateServiceWorker = register({
        immediate: true,
        onNeedRefresh: () => publish(availableSnapshot),
        onRegisteredSW: (_scriptUrl, registration) => {
          if (registration?.waiting) publish(availableSnapshot)
        },
        onRegisterError: () => {
          // Registration failure leaves the online application usable.
        },
      })
    },
    setUnsafeLocalWorkChecker(checker: () => boolean | Promise<boolean>) {
      hasUnsafeLocalWork = checker
    },
    async applyUpdate() {
      if (!snapshot.updateAvailable || !updateServiceWorker) return false
      if (await hasUnsafeLocalWork()) {
        publish(blockedSnapshot)
        return false
      }
      await updateServiceWorker(true)
      publish(idleSnapshot)
      return true
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => idleSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const pwaUpdateController = createPwaUpdateController()

export function usePwaUpdate() {
  return useSyncExternalStore(
    pwaUpdateController.subscribe,
    pwaUpdateController.getSnapshot,
    pwaUpdateController.getServerSnapshot,
  )
}
