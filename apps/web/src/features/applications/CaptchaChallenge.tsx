import { useEffect, useRef, useState } from 'react'

type Turnstile = {
  render: (element: HTMLElement, options: { sitekey: string, action: string, callback: (token: string) => void, 'expired-callback': () => void, 'error-callback': () => void }) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }
let loading: Promise<Turnstile> | undefined
function loadWidget(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification unavailable'))
    script.onerror = () => { loading = undefined; script.remove(); reject(new Error('Verification unavailable')) }
    document.head.append(script)
  })
}

export function CaptchaChallenge({ onToken }: { onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  useEffect(() => {
    if (!sitekey) return
    let active = true
    let widget: string | undefined
    let api: Turnstile | undefined
    void loadWidget().then((turnstile) => {
      if (!active || !element.current) return
      api = turnstile
      widget = api.render(element.current, {
        sitekey, action: 'church_application', callback: (token) => { if (active) { onToken(token); setFailed(false) } },
        'expired-callback': () => { if (active) onToken('') },
        'error-callback': () => { if (active) { onToken(''); setFailed(true) } },
      })
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false; if (widget !== undefined) api?.remove(widget) }
  }, [onToken, sitekey])
  return <div><div ref={element} aria-label="Application verification" />
    {(!sitekey || failed) && <p role="alert">Verification is unavailable. Please try again later.</p>}
  </div>
}
