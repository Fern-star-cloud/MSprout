import { useEffect, useState } from 'react'
import { AuthForm } from './AuthForm'
import { codeField, emailField, newPasswordFields, passwordField } from './fields'
import type { components } from '../../api/generated'
import { authRequest, signedInvitation } from './transport'

export type AuthPage = 'login' | 'challenge' | 'verify-email' | 'forgot-password' | 'reset-password' | 'mfa' | 'account'

export function AuthScreen({ initialPage, fragment = '' }: { initialPage: AuthPage, fragment?: string }) {
  const [page, setPage] = useState(initialPage)
  const [message, setMessage] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [secret, setSecret] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [verified, setVerified] = useState(false)
  const [mfaConfirmed, setMfaConfirmed] = useState(false)
  useEffect(() => { if (fragment) history.replaceState(null, '', location.pathname) }, [fragment])

  async function loadAccount() {
    if (invitation) await authRequest(invitation)
    const session = await authRequest<components['schemas']['AccountSession']>('/auth/session')
    setVerified(session.email_verified); setMfaConfirmed(session.mfa_confirmed)
    setPage(session.email_verified ? 'account' : 'verify-email')
  }
  const reset = new URLSearchParams(fragment)
  const invitation = signedInvitation(fragment, 'church')
  return <section className="auth-card" aria-labelledby="auth-heading">
    <p className="eyebrow">Church account</p>
    <h2 id="auth-heading">{{ login: 'Welcome back', challenge: 'Verify your sign-in', 'verify-email': 'Verify your email', 'forgot-password': 'Reset your password', 'reset-password': 'Choose a new password', mfa: 'Protect your account', account: 'Your account' }[page]}</h2>
    {message && <p role="status">{message}</p>}
    {page === 'login' && <>
      <p>Sign in to your MinistrySprout account.</p>
      <AuthForm fields={[emailField, passwordField]} submitLabel="Sign in" onSubmit={async (values) => {
        const result = await authRequest<components['schemas']['LoginResult']>('/login', 'POST', values)
        if (result.two_factor) setPage('challenge'); else await loadAccount()
      }} />
      <a href="/account/forgot-password">Forgot your password?</a>
      <p><a href="/account/application">Church application</a></p>
      <AuthForm fields={[]} submitLabel="Continue signed-in session" onSubmit={loadAccount} />
    </>}
    {page === 'challenge' && <>
      <AuthForm fields={[recovery ? { name: 'recovery_code', label: 'Recovery code', autoComplete: 'off' } : codeField]} submitLabel="Verify sign-in" onSubmit={async (values) => {
        await authRequest('/two-factor-challenge', 'POST', values); await loadAccount()
      }} />
      <button type="button" className="secondary" onClick={() => setRecovery(!recovery)}>{recovery ? 'Use authenticator code' : 'Use a recovery code'}</button>
    </>}
    {page === 'forgot-password' && <AuthForm fields={[emailField]} submitLabel="Send reset link" onSubmit={async (values) => {
      await authRequest('/forgot-password', 'POST', values)
      setMessage('If an account matches that email, a reset link will arrive shortly.')
    }} />}
    {page === 'reset-password' && (reset.get('token') && reset.get('email') ? <AuthForm fields={newPasswordFields} submitLabel="Save new password" onSubmit={async (values) => {
      await authRequest('/reset-password', 'POST', { ...values, token: reset.get('token'), email: reset.get('email') })
      setMessage('Your password has been reset. Sign in with your new password.'); setPage('login')
    }} /> : <p role="alert">Open the reset link from your email, or request a new link.</p>)}
    {page === 'verify-email' && <>
      <p>Open the verification link in your email to continue. Church access requires a verified account.</p>
      {invitation && <a href={`/account/login#${encodeURIComponent(location.origin + invitation)}`}>Sign in to verify</a>}
      {invitation && <AuthForm fields={[]} submitLabel="Verify email" onSubmit={async () => {
        await loadAccount(); setMessage('Your email is verified.')
      }} />}
      <AuthForm fields={[]} submitLabel="Resend verification email" onSubmit={async () => {
        await authRequest('/email/verification-notification', 'POST'); setMessage('Check your inbox for the verification link.')
      }} />
      <AuthForm fields={[]} submitLabel="Check verification" onSubmit={loadAccount} />
    </>}
    {page === 'mfa' && <>
      <p>Church Owners must confirm an authenticator before entering a workspace. Teachers may choose to enable this protection.</p>
      {!secret && codes.length === 0 && <AuthForm fields={[{ ...passwordField, label: 'Current password' }]} submitLabel="Set up authenticator" onSubmit={async (values) => {
        await authRequest('/user/confirm-password', 'POST', values)
        await authRequest('/user/two-factor-authentication', 'POST')
        const result = await authRequest<components['schemas']['SecretKey']>('/user/two-factor-secret-key')
        setSecret(result.secretKey)
      }} />}
      {secret && <>
        <p>Enter this setup key in your authenticator, then enter its six-digit code.</p><code className="secret">{secret}</code>
        <AuthForm fields={[codeField]} submitLabel="Confirm authenticator" onSubmit={async (values) => {
          await authRequest('/user/confirmed-two-factor-authentication', 'POST', values)
          setCodes(await authRequest<string[]>('/user/two-factor-recovery-codes')); setSecret(''); setMfaConfirmed(true)
        }} />
      </>}
      {codes.length > 0 && <><p>Save these recovery codes in a safe place. Each can be used once.</p><ul>{codes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
        <button onClick={() => { setCodes([]); setPage('account') }}>I saved my recovery codes</button></>}
    </>}
    {page === 'account' && <>
      <p>Email: {verified ? 'Verified' : 'Verification needed'}</p>
      <p><a href="/account/application">View church application</a></p>
      <p>Authenticator: {mfaConfirmed ? 'Confirmed' : 'Not yet enabled'}</p>
      {!mfaConfirmed && <button onClick={() => setPage('mfa')}>Set up MFA</button>}
      <AuthForm fields={[]} submitLabel="Sign out" onSubmit={async () => {
        await authRequest('/logout', 'POST'); setSecret(''); setCodes([]); setPage('login'); setMessage('You are signed out.')
      }} />
    </>}
    {page !== 'login' && <a href="/account/login">Back to sign in</a>}
    <p className="privacy-note">Authentication requires an internet connection.</p>
  </section>
}
