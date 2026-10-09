import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthForm } from './AuthForm'
import { codeField, emailField, newPasswordFields, passwordField } from './fields'
import type { components } from '../../api/generated'
import { authRequest, signedInvitation } from './transport'
import { safeAuthMessage } from './transport'
import { accountEntry, accountReturnDestination, isUncertainSubmission, readAccountSession, type AccountSession } from './account-session'
import { Button, ErrorSummary, LoadingState, StatusBanner } from '../../components/ui/Foundations'
import { ApiError } from '../../api/client'

export type AuthPage = 'login' | 'challenge' | 'verify-email' | 'forgot-password' | 'reset-password' | 'mfa' | 'account'

export function AuthScreen({ initialPage, fragment = '' }: { initialPage: AuthPage, fragment?: string }) {
  const [page, setPage] = useState(initialPage)
  const [message, setMessage] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [secret, setSecret] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [verified, setVerified] = useState(false)
  const [mfaConfirmed, setMfaConfirmed] = useState(false)
  const [session, setSession] = useState<AccountSession | null>(null)
  const [checking, setChecking] = useState(initialPage === 'account' || initialPage === 'mfa')
  const [accountError, setAccountError] = useState('')
  const [uncertainLogin, setUncertainLogin] = useState(false)
  const generation = useRef(0)
  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])
  const destination = accountReturnDestination(new URLSearchParams(location.search).get('returnTo'))
  const invitation = signedInvitation(fragment, 'church')
  const consumedInvitation = useRef(false)
  useEffect(() => { if (fragment) history.replaceState(null, '', location.pathname + location.search) }, [fragment])

  const loadAccount = useCallback(async (enrollment = false) => {
    const run = ++generation.current
    setChecking(true); setSession(null); setAccountError('')
    try {
      if (invitation && !consumedInvitation.current) { await authRequest(invitation); consumedInvitation.current = true }
      const current = await readAccountSession()
      if (run !== generation.current) return
      setSession(current); setVerified(current.email_verified); setMfaConfirmed(current.mfa_confirmed)
      setUncertainLogin(false)
      setPage(current.email_verified ? enrollment ? 'mfa' : 'account' : 'verify-email')
    } catch (error) {
      if (run === generation.current && typeof error === 'object' && error !== null && 'status' in error && [401, 419].includes(Number(error.status))) setUncertainLogin(false)
      throw error
    } finally { if (run === generation.current) setChecking(false) }
  }, [invitation])
  const cancelChecks = useCallback(() => { generation.current++ }, [])
  useEffect(() => {
    let active = true
    if (initialPage === 'account' || initialPage === 'mfa') void Promise.resolve().then(() => { if (active) return loadAccount(initialPage === 'mfa') }).catch(error => { if (active) setAccountError(safeAuthMessage(error)) })
    return () => { active = false; cancelChecks() }
  }, [initialPage, loadAccount, cancelChecks])
  useEffect(() => {
    const clear = () => {
      generation.current++; setSession(null); setVerified(false); setMfaConfirmed(false); setSecret(''); setCodes([]); setMessage(''); setChecking(false)
    }
    const invalidate = (event: Event) => {
      if ((event as CustomEvent<{status?:number}>).detail?.status === 0) return
      clear(); setAccountError('Check your signed-in session before continuing.');
      if ([401, 419].includes(Number((event as CustomEvent<{status?:number}>).detail?.status))) setUncertainLogin(false)
    }
    const offline = () => { clear(); setAccountError('Connect to the internet to check your account.'); }
    const refresh = () => {
      if (pageRef.current === 'account' && navigator.onLine) void loadAccount().catch(error => setAccountError(safeAuthMessage(error)))
    }
    window.addEventListener('church-workspace-invalidated', invalidate)
    window.addEventListener('offline', offline); window.addEventListener('online', refresh); window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('church-workspace-invalidated', invalidate)
      window.removeEventListener('offline', offline); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh)
    }
  }, [loadAccount])
  const reset = new URLSearchParams(fragment)
  return <section className="auth-card" aria-labelledby="auth-heading">
    <p className="eyebrow">Church account</p>
    <h2 id="auth-heading">{{ login: 'Welcome back', challenge: 'Verify your sign-in', 'verify-email': 'Verify your email', 'forgot-password': 'Reset your password', 'reset-password': 'Choose a new password', mfa: 'Protect your account', account: 'Your account' }[page]}</h2>
    {message && <StatusBanner live>{message}</StatusBanner>}
    {checking && <LoadingState label="Checking signed-in session…" />}
    {accountError && <ErrorSummary message={accountError} />}
    {page === 'login' && <>
      <p>Sign in to your MinistrySprout account.</p>
      <AuthForm fields={[emailField, passwordField]} disabled={uncertainLogin || checking} submitLabel="Sign in" onSubmit={async (values) => {
        const run = generation.current
        try {
          const result = await authRequest<components['schemas']['LoginResult']>('/login', 'POST', values)
          if (run !== generation.current) return
          if (result.two_factor) setPage('challenge'); else await loadAccount()
        } catch (error) {
          if (run === generation.current && isUncertainSubmission(error) && !(error instanceof ApiError && error.status === 409 && error.code === 'already_authenticated')) setUncertainLogin(true)
          throw error
        }
      }} />
      {uncertainLogin && <StatusBanner tone="warning">The sign-in outcome is uncertain. Check the signed-in session before submitting credentials again.</StatusBanner>}
      <a href="/account/forgot-password">Forgot your password?</a>
      <p><a href="/account/application">Church application</a></p>
      <AuthForm fields={[]} disabled={checking} submitLabel="Continue signed-in session" onSubmit={async()=>{await loadAccount()}} />
    </>}
    {page === 'challenge' && <>
      <AuthForm fields={[recovery ? { name: 'recovery_code', label: 'Recovery code', autoComplete: 'off' } : codeField]} disabled={uncertainLogin || checking} submitLabel="Verify sign-in" onSubmit={async (values) => {
        const run = generation.current
        try {
          await authRequest('/two-factor-challenge', 'POST', values)
          if (run === generation.current) await loadAccount()
        } catch (error) {
          if (run === generation.current && isUncertainSubmission(error)) setUncertainLogin(true)
          throw error
        }
      }} />
      {uncertainLogin && <><StatusBanner tone="warning">The verification outcome is uncertain. Check the signed-in session before another attempt.</StatusBanner><AuthForm fields={[]} disabled={checking} submitLabel="Continue signed-in session" onSubmit={async () => { await loadAccount() }} /></>}
      <Button variant="secondary" onClick={() => setRecovery(!recovery)}>{recovery ? 'Use authenticator code' : 'Use a recovery code'}</Button>
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
        await loadAccount(); setMessage('Verification checked. Follow the current account steps.')
      }} />}
      <AuthForm fields={[]} submitLabel="Resend verification email" onSubmit={async () => {
        await authRequest('/email/verification-notification', 'POST'); setMessage('Check your inbox for the verification link.')
      }} />
      <AuthForm fields={[]} submitLabel="Check verification" onSubmit={async()=>{await loadAccount()}} />
    </>}
    {page === 'mfa' && !checking && session?.email_verified && <>
      <p>Church Owners must confirm an authenticator before entering a workspace. Teachers may choose to enable this protection.</p>
      {mfaConfirmed && codes.length === 0 && <><p>Your authenticator is already confirmed. To renew current-session assurance, open Account, sign out deliberately, and sign in again using your authenticator.</p><a href={'/account' + (destination ? `?returnTo=${encodeURIComponent(destination)}` : '')}>Open Account</a><p><a href={destination ?? '/account/home'}>Continue to church Home</a></p></>}
      {!mfaConfirmed && !secret && codes.length === 0 && <AuthForm fields={[{ ...passwordField, label: 'Current password' }]} submitLabel="Set up authenticator" onSubmit={async (values) => {
        const run = generation.current
        await authRequest('/user/confirm-password', 'POST', values)
        if (run !== generation.current) return
        await authRequest('/user/two-factor-authentication', 'POST')
        if (run !== generation.current) return
        const result = await authRequest<components['schemas']['SecretKey']>('/user/two-factor-secret-key')
        if (run === generation.current) setSecret(result.secretKey)
      }} />}
      {secret && <>
        <p>Enter this setup key in your authenticator, then enter its six-digit code.</p><code className="secret">{secret}</code>
        <AuthForm fields={[codeField]} submitLabel="Confirm authenticator" onSubmit={async (values) => {
          const run = generation.current
          await authRequest('/user/confirmed-two-factor-authentication', 'POST', values)
          if (run !== generation.current) return
          const recoveryCodes = await authRequest<string[]>('/user/two-factor-recovery-codes')
          if (run === generation.current) { setCodes(recoveryCodes); setSecret(''); setMfaConfirmed(true) }
        }} />
      </>}
      {codes.length > 0 && <><p>Save these recovery codes in a safe place. Each can be used once.</p><ul>{codes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
      <AuthForm fields={[]} submitLabel="I saved my recovery codes" onSubmit={async () => { setCodes([]); await loadAccount() }} /></>}
    </>}
    {page === 'account' && !checking && session && <>
      <p>Email: {verified ? 'Verified' : 'Verification needed'}</p>
      <p><a href="/account/application">View church application</a></p>
      <p>Authenticator: {mfaConfirmed ? 'Confirmed' : 'Not yet enabled'}</p>
      {!mfaConfirmed && <p><a href={accountEntry('/account/mfa', destination ?? '/account/home')}>Set up MFA</a></p>}
      <p>Authenticator enrollment does not replace current-session assurance. Church Home verifies membership and required MFA again.</p>
      {(destination || session.workspaces.length > 0) && <>
        <p>Choose a deliberate continuation. Signing in does not automatically return to a protected action.</p>
        <a href={destination ?? '/account/home'}>{destination && !destination.startsWith('/account/home') ? 'Continue to requested destination' : 'Continue to church Home'}</a>
      </>}
      {session.workspaces.length === 0 && <p>No active church workspace is available. Check your church application or contact your church Owner.</p>}
      <AuthForm fields={[]} submitLabel="Sign out" onSubmit={async () => {
        await authRequest('/logout', 'POST'); generation.current++; setSession(null); setSecret(''); setCodes([]); setVerified(false); setMfaConfirmed(false); setPage('login'); setUncertainLogin(false); setAccountError(''); setMessage('You are signed out.')
      }} />
    </>}
    {(page === 'account' || page === 'mfa') && !checking && !session && <><AuthForm fields={[]} submitLabel="Check signed-in session" onSubmit={async()=>{await loadAccount(page==='mfa')}} /><p><a href={accountEntry('/account/login', destination ?? '/account/home')}>Sign in</a></p></>}
    {page !== 'login' && <a href="/account/login">Back to sign in</a>}
    <p className="privacy-note">Authentication requires an internet connection.</p>
  </section>
}
