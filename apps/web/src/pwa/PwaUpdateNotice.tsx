import { useLayoutEffect, useRef } from 'react'
import { Button } from '../components/ui/Foundations'
import { pwaUpdateController, usePwaUpdate } from './update-controller'

export function PwaUpdateNotice() {
  const update = usePwaUpdate()
  const action = useRef<HTMLButtonElement>(null)
  const returnKeyboardFocus = useRef(false)
  useLayoutEffect(() => {
    if (update.updating || !returnKeyboardFocus.current) return
    returnKeyboardFocus.current = false
    if (update.updateAvailable && document.activeElement === document.body) action.current?.focus()
  }, [update])
  if (!update.updateAvailable) return null
  const message = update.error === 'preservation'
    ? 'Local work could not be checked. Keep this version open and try again when device storage is available.'
    : update.error === 'activation'
      ? 'The update could not be activated. Keep this version open and try again.'
      : update.updating
        ? 'Checking local work before updating…'
        : update.updateBlocked
          ? 'Safe updating is not available yet. Keep this version open and try again after checking your authorized device workspace.'
          : 'A new version of MinistrySprout is available. Local work will be checked before updating.'
  return <section className="update-notice" aria-label="Application update">
    <div role={update.error ? 'alert' : 'status'}><strong>Update available</strong><span>{message}</span></div>
    <Button ref={action} busy={update.updating} onClick={() => {
      returnKeyboardFocus.current = document.activeElement === action.current
      void pwaUpdateController.applyUpdate()
    }}>Update when safe</Button>
  </section>
}
