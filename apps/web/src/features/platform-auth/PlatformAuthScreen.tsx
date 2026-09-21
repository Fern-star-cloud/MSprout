import { useEffect, useState } from 'react'
import { AuthForm } from '../auth/AuthForm'
import { codeField, newPasswordFields, passwordField } from '../auth/fields'
import type { components } from '../../api/generated'
import { authRequest, signedInvitation } from '../auth/transport'

type Enrollment = components['schemas']['PlatformEnrollment']

export function PlatformAuthScreen({ setup = false, fragment = '' }: { setup?: boolean, fragment?: string }) {
  const [step, setStep] = useState<'login' | 'challenge' | 'setup' | 'confirm' | 'account'>(setup ? 'setup' : 'login')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [handle, setHandle] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [online, setOnline] = useState(globalThis.navigator?.onLine !== false)
  const invitation = signedInvitation(fragment, 'platform')
  useEffect(() => {
    if (fragment) history.replaceState(null, '', location.pathname)
    const update = () => { setOnline(navigator.onLine); if (!navigator.onLine) setHandle('') }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [fragment])
  async function showAccount() {
    const session = await authRequest<components['schemas']['PlatformSession']>('/platform/me')
    setHandle(session.handle); setEnrollment(null); setStep('account')
  }
  return <section className="auth-card" aria-labelledby="platform-heading">
    <p className="eyebrow">Platform administration</p>
    <h2 id="platform-heading">{setup ? 'Set up sage.dev' : 'Platform sign in'}</h2>
    <p>This account requires an internet connection and an authenticator.</p>
    {!online ? <p role="alert">Connect to the internet to use platform administration.</p> : <>
      {step === 'login' && <AuthForm fields={[{ name: 'handle', label: 'Handle', autoComplete: 'username' }, passwordField]} submitLabel="Sign in to platform" onSubmit={async (values) => {
        await authRequest('/platform/login', 'POST', values); setStep('challenge')
      }} />}
      {step === 'challenge' && <>
        <AuthForm fields={[recovery ? { name: 'recovery_code', label: 'Recovery code', autoComplete: 'off' } : codeField]} submitLabel="Verify platform sign-in" onSubmit={async (values) => {
          await authRequest('/platform/two-factor-challenge', 'POST', values); await showAccount()
        }} />
        <button className="secondary" onClick={() => setRecovery(!recovery)}>{recovery ? 'Use authenticator code' : 'Use a recovery code'}</button>
      </>}
      {step === 'setup' && (invitation ? <>
        <p>Your private email invitation verifies access to your recovery address. Create a password to begin.</p>
        <AuthForm fields={newPasswordFields} submitLabel="Begin secure setup" onSubmit={async (values) => {
          setEnrollment(await authRequest<Enrollment>(invitation, 'POST', values)); setStep('confirm')
        }} />
      </> : <p role="alert">Open a valid setup link from your private email invitation.</p>)}
      {step === 'confirm' && enrollment && invitation && <>
        <p>Add this setup key to your authenticator:</p><code className="secret">{enrollment.secret}</code>
        <p>Save these single-use recovery codes in a safe place before continuing:</p>
        <ul>{enrollment.recovery_codes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
        <AuthForm fields={[codeField, { name: 'acknowledged', label: 'I saved my recovery codes', type: 'checkbox' }]} submitLabel="Activate platform account" onSubmit={async (values) => {
          await authRequest(invitation.split('?')[0] + '/confirm', 'POST', { code: values.code, recovery_codes_acknowledged: values.acknowledged === 'on' })
          await showAccount()
        }} />
      </>}
      {step === 'account' && <>
        {handle ? <p role="status">Signed in as {handle}</p> : <AuthForm fields={[]} submitLabel="Check platform session" onSubmit={showAccount} />}
        <AuthForm fields={[]} submitLabel="Sign out of platform" onSubmit={async () => {
          await authRequest('/platform/logout', 'POST'); setHandle(''); setEnrollment(null); setStep('login')
        }} />
      </>}
    </>}
    <a href="/account/login">Church account sign in</a>
  </section>
}
