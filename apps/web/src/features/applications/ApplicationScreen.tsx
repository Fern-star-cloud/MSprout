import { useEffect, useState } from 'react'
import type { components } from '../../api/generated'
import { ApiError } from '../../api/client'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { CaptchaChallenge } from './CaptchaChallenge'

type Application = components['schemas']['ChurchApplication']

export function ApplicationScreen() {
  const [application, setApplication] = useState<Application | null>(null)
  const [session, setSession] = useState<components['schemas']['AccountSession'] | null>(null)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [captcha, setCaptcha] = useState('')
  const [challenge, setChallenge] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); setApplication(null); setSession(null); setCaptcha(''); setChallenge((value) => value + 1) }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    let active = true
    if (online) void (async () => {
      try {
        const account = await authRequest<components['schemas']['AccountSession']>('/auth/session')
        const result = account.email_verified ? await authRequest<components['schemas']['CurrentChurchApplication']>('/api/church-applications/current') : { application: null }
        if (active) { setSession(account); setApplication(result.application); setError('') }
      } catch (failure) { if (active) { setError(safeAuthMessage(failure)); setApplication(null); setSession(null) } }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [online, revision])

  return <section className="auth-card" aria-labelledby="application-heading">
    <p className="eyebrow">Church application</p><h2 id="application-heading">Your church, ready to grow</h2>
    {!online ? <p role="alert">Connect to the internet to submit or view your application.</p> : <>
      {loading && <p role="status">Loading application…</p>}
      {error && <p role="alert">{error}</p>}
      {session && !session.email_verified && <><p>Verify your email before applying.</p><a href="/account/verify-email">Verify email</a></>}
      {application && <>
        <h3>{{ pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }[application.status]}</h3>
        <p>{application.church_name}</p>
        {application.status === 'pending' && <p>Your application is awaiting review. You will receive an email when a decision is made.</p>}
        {application.status === 'approved' && <><p>Your church workspace is approved. Owner access requires confirmed MFA.</p>
          {!session?.mfa_confirmed ? <a href="/account/mfa">Set up MFA</a> : <p>Your authenticator is confirmed.</p>}
          {session?.mfa_confirmed && application.church_id && <a href={'/account/teachers?church=' + encodeURIComponent(application.church_id)}>Manage Teachers</a>}</>}
        {application.status === 'rejected' && <><p>{application.reason}</p><p>Application details are removed after 30 days. You may submit a new application.</p>
          <button onClick={() => { setApplication(null); setCaptcha(''); setChallenge((value) => value + 1) }}>Apply again</button></>}
      </>}
      {!loading && session?.email_verified && !application && <form aria-label="Church application" onSubmit={async (event) => {
        event.preventDefault()
        if (!captcha || busy) return
        const fields = new FormData(event.currentTarget)
        const body: components['schemas']['SubmitChurchApplication'] = {
          church_name: String(fields.get('church_name')).trim().replace(/\s+/g, ' '), city: String(fields.get('city')).trim().replace(/\s+/g, ' '),
          address: String(fields.get('address')).trim() || null, timezone: String(fields.get('timezone')), captcha_token: captcha,
        }
        setBusy(true); setError(''); setInvalid([])
        try { setApplication(await authRequest<Application>('/api/church-applications', 'POST', body)) }
        catch (failure) { setError(safeAuthMessage(failure)); if (failure instanceof ApiError) setInvalid(Object.keys(failure.fieldErrors ?? {})) }
        finally { setBusy(false); setCaptcha(''); setChallenge((value) => value + 1) }
      }}>
        <p>Provide your church details for review. No files are needed.</p>
        {([{ name: 'church_name', label: 'Church name', max: 160 }, { name: 'city', label: 'City', max: 120 }, { name: 'address', label: 'Address (optional)', max: 240 }, { name: 'timezone', label: 'Timezone', max: 100 }] as const).map((field) => <div className="form-field" key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input id={field.name} name={field.name} maxLength={field.max} required={field.name !== 'address'} defaultValue={field.name === 'timezone' ? 'Asia/Manila' : ''} disabled={busy}
            aria-invalid={invalid.includes(field.name)} aria-describedby={invalid.includes(field.name) ? `${field.name}-error` : undefined} />
          {invalid.includes(field.name) && <span id={`${field.name}-error`}>Check this field.</span>}
        </div>)}
        <p>Use a timezone such as Asia/Manila, Europe/London, or America/New_York.</p>
        <CaptchaChallenge key={challenge} onToken={setCaptcha} />
        <button disabled={busy || !captcha} type="submit">{busy ? 'Submitting…' : 'Submit application'}</button>
      </form>}
      <button className="secondary" disabled={busy || loading} onClick={() => { setLoading(true); setRevision((value) => value + 1) }}>Refresh status</button>
    </>}
    <p><a href="/account/login">Sign in</a></p>
  </section>
}
