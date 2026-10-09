import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthForm } from '../auth/AuthForm'
import { codeField, newPasswordFields, passwordField } from '../auth/fields'
import type { components } from '../../api/generated'
import { authRequest, signedInvitation } from '../auth/transport'
import { Button, StatusBanner } from '../../components/ui/Foundations'
import { isUncertainSubmission } from '../auth/account-session'
import { readPlatformSession } from './platform-session'

type Enrollment = components['schemas']['PlatformEnrollment']

export function PlatformAuthScreen({ setup = false, fragment = '', onAuthenticated }: { setup?: boolean, fragment?: string, onAuthenticated?: () => void }) {
  const [step, setStep] = useState<'login' | 'challenge' | 'setup' | 'confirm' | 'account' | 'interrupted'>(setup ? 'setup' : 'login')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [handle, setHandle] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [online, setOnline] = useState(globalThis.navigator?.onLine !== false)
  const [uncertain, setUncertain] = useState(false)
  const generation = useRef(0), setupStarted = useRef(false)
  const cancelChecks = useCallback(() => { generation.current++ }, [])
  const invitation = signedInvitation(fragment, 'platform')
  useEffect(() => {
    if (fragment) history.replaceState(null, '', location.pathname + location.search)
    const clear = () => { generation.current++; setHandle(''); setEnrollment(null); setStep(setup && setupStarted.current ? 'interrupted' : setup ? 'setup' : 'login') }
    const update = (event: Event) => { clear(); setOnline(event.type === 'online') }
    const invalidate = () => { clear(); setUncertain(false) }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    window.addEventListener('platform-session-invalidated', invalidate)
    return () => { cancelChecks(); window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('platform-session-invalidated', invalidate) }
  }, [fragment, setup, cancelChecks])
  async function showAccount(run = generation.current) {
    const session = await readPlatformSession()
    if (run !== generation.current) return
    setHandle(session.handle); setEnrollment(null); setStep('account')
    setUncertain(false); onAuthenticated?.()
  }
  return <section className="auth-card" aria-labelledby="platform-heading">
    <p className="eyebrow">Platform administration</p>
    <h2 id="platform-heading">{setup ? 'Set up sage.dev' : 'Platform sign in'}</h2>
    <p>This account requires an internet connection and an authenticator.</p>
    {!online ? <StatusBanner tone="neutral" live>Connect to the internet to use platform administration.</StatusBanner> : <>
      {uncertain && <><StatusBanner tone="warning" live>The platform sign-in outcome is uncertain. Check the platform session before another attempt.</StatusBanner><AuthForm fields={[]} submitLabel="Check signed-in platform session" onSubmit={async () => { await showAccount() }} /></>}
      {step === 'login' && <AuthForm fields={[{ name: 'handle', label: 'Handle', autoComplete: 'username' }, passwordField]} disabled={uncertain} submitLabel="Sign in to platform" onSubmit={async (values) => {
        const run = generation.current
        try {
          const result = await authRequest<{two_factor:boolean}>('/platform/login', 'POST', values)
          if (result?.two_factor !== true) throw new Error('Unverified platform sign-in')
          if (run === generation.current) setStep('challenge')
        } catch (error) { if (run === generation.current && isUncertainSubmission(error)) setUncertain(true); throw error }
      }} />}
      {step === 'challenge' && <>
        <AuthForm fields={[recovery ? { name: 'recovery_code', label: 'Recovery code', autoComplete: 'off' } : codeField]} disabled={uncertain} submitLabel="Verify platform sign-in" onSubmit={async (values) => {
          const run = generation.current
          try { await authRequest('/platform/two-factor-challenge', 'POST', values); if (run === generation.current) await showAccount(run) }
          catch (error) { if (run === generation.current && isUncertainSubmission(error)) setUncertain(true); throw error }
        }} />
        <Button variant="secondary" onClick={() => setRecovery(!recovery)}>{recovery ? 'Use authenticator code' : 'Use a recovery code'}</Button>
      </>}
      {step === 'setup' && (invitation ? <>
        <p>Your private email invitation verifies access to your recovery address. Create a password to begin.</p>
        <AuthForm fields={newPasswordFields} submitLabel="Begin secure setup" onSubmit={async (values) => {
          const run = generation.current; setupStarted.current = true
          try {
            const result = await authRequest<Enrollment>(invitation, 'POST', values)
            if (!result || typeof result.secret !== 'string' || !Array.isArray(result.recovery_codes) || result.recovery_codes.some(code => typeof code !== 'string')) throw new Error('Unverified setup response')
            if (run === generation.current) { setEnrollment(result); setStep('confirm') }
          } catch (error) { if (run === generation.current && isUncertainSubmission(error)) setStep('interrupted'); throw error }
        }} />
      </> : <p role="alert">Open a valid setup link from your private email invitation.</p>)}
      {step === 'confirm' && enrollment && invitation && <>
        <p>Add this setup key to your authenticator:</p><code className="secret">{enrollment.secret}</code>
        <p>Save these single-use recovery codes in a safe place before continuing:</p>
        <ul>{enrollment.recovery_codes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
        <AuthForm fields={[codeField, { name: 'acknowledged', label: 'I saved my recovery codes', type: 'checkbox' }]} submitLabel="Activate platform account" onSubmit={async (values) => {
          const run = generation.current
          try {
            await authRequest(invitation.split('?')[0] + '/confirm', 'POST', { code: values.code, recovery_codes_acknowledged: values.acknowledged === 'on' })
            if (run !== generation.current) return
            setEnrollment(null); setStep('interrupted'); await showAccount(run)
          } catch (error) {
            if (run === generation.current && isUncertainSubmission(error)) { setEnrollment(null); setStep('interrupted') }
            throw error
          }
        }} />
      </>}
      {step === 'account' && <>
        {handle && <nav className="platform-links" aria-label="Platform administration"><a href="/account/platform-applications">Review church applications</a><a href="/account/platform-system-health">System health</a><a href="/account/platform-audit">Platform audit</a></nav>}
        {handle ? <p role="status">Signed in as {handle}</p> : <AuthForm fields={[]} submitLabel="Check platform session" onSubmit={async () => { await showAccount() }} />}
        <AuthForm fields={[]} submitLabel="Sign out of platform" onSubmit={async () => {
          await authRequest('/platform/logout', 'POST'); setHandle(''); setEnrollment(null); setStep('login')
        }} />
      </>}
      {step === 'interrupted' && <><StatusBanner tone="warning">Setup was interrupted or its outcome could not be verified. Check the platform session. If activation is incomplete and the setup key was lost, contact the operator responsible for your private setup invitation. Do not restart setup or clear storage.</StatusBanner><AuthForm fields={[]} submitLabel="Check platform session" onSubmit={async () => { await showAccount() }} /></>}
    </>}
    <a href="/account/login">Church account sign in</a>
  </section>
}
