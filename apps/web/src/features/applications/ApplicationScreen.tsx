import { useCallback, useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { ApiError } from '../../api/client'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { accountEntry, isUncertainSubmission, readAccountSession, type AccountSession } from '../auth/account-session'
import { Button, ErrorSummary, Field, LoadingState, StatusBadge, StatusBanner } from '../../components/ui/Foundations'
import { CaptchaChallenge } from './CaptchaChallenge'

type Application = components['schemas']['ChurchApplication']
const initialFields = { church_name: '', city: '', address: '', timezone: 'Asia/Manila' }
const fields = [
  { name: 'church_name', label: 'Church name', max: 160 }, { name: 'city', label: 'City', max: 120 },
  { name: 'address', label: 'Address (optional)', max: 240 }, { name: 'timezone', label: 'Timezone', max: 100 },
] as const
function checkedApplication(value: Application | null): Application | null {
  if (value === null) return null
  if (!value || !['pending', 'approved', 'rejected'].includes(value.status) || typeof value.id !== 'string'
    || (value.church_name !== null && typeof value.church_name !== 'string')) throw new Error('Application state could not be verified')
  return value
}

export function ApplicationScreen() {
  const [application, setApplication] = useState<Application | null>(null)
  const [session, setSession] = useState<AccountSession | null>(null)
  const [values, setValues] = useState(initialFields)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<string[]>([])
  const [loading, setLoading] = useState(navigator.onLine)
  const [known, setKnown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [reapplying, setReapplying] = useState(false)
  const [captcha, setCaptcha] = useState('')
  const [challenge, setChallenge] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const generation = useRef(0)
  const operating = useRef(false)
  const actor = useRef<number | null>(null)
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error && !loading && !busy) summary.current?.focus() }, [error, loading, busy])

  const refresh = useCallback(async () => {
    const run = ++generation.current
    setLoading(true); setKnown(false); setError(''); setSession(null); setApplication(null); setCaptcha(''); setChallenge(value => value + 1)
    try {
      const current = await readAccountSession()
      if (run !== generation.current) return
      if (actor.current !== null && actor.current !== current.id) { setValues(initialFields); setUncertain(false); setReapplying(false); setInvalid([]) }
      actor.current = current.id
      const result = current.email_verified ? await authRequest<components['schemas']['CurrentChurchApplication']>('/api/church-applications/current') : { application: null }
      const checked = checkedApplication(result.application)
      if (run !== generation.current) return
      setSession(current); setApplication(checked); setKnown(true); setUncertain(false)
      if (checked?.status !== 'rejected') setReapplying(false)
    } catch (failure) { if (run === generation.current) { setError(safeAuthMessage(failure)); setKnown(false) } }
    finally { if (run === generation.current) setLoading(false) }
  }, [])
  const cancelChecks = useCallback(() => { generation.current++ }, [])

  useEffect(() => {
    let active = true
    if (online) void Promise.resolve().then(() => { if (active) return refresh() })
    return () => { active = false; cancelChecks() }
  }, [online, refresh, cancelChecks])
  useEffect(() => {
    const clear = () => { generation.current++; setSession(null); setApplication(null); setKnown(false); setCaptcha(''); setChallenge(value => value + 1); setLoading(false); setBusy(false) }
    const connectivity = (event: Event) => { clear(); setOnline(event.type === 'online') }
    const invalidate = (event: Event) => {
      if ((event as CustomEvent<{status?:number}>).detail?.status === 0) return
      clear(); setError('Your account access changed. Check your signed-in session and refresh status before continuing.')
    }
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity)
    window.addEventListener('church-workspace-invalidated', invalidate)
    return () => { window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); window.removeEventListener('church-workspace-invalidated', invalidate) }
  }, [])

  const home = application?.church_id && /^[a-f\d-]{36}$/i.test(application.church_id) ? `/account/home?church=${encodeURIComponent(application.church_id)}` : '/account/home'
  const canShowForm = session?.email_verified && (known || uncertain) && (!application || reapplying)
  return <section className="auth-card" aria-labelledby="application-heading">
    <p className="eyebrow">Church application</p><h2 id="application-heading">Your church, ready to grow</h2>
    {!online ? <StatusBanner tone="neutral" live>Connect to the internet to submit or view your application. Your entered details are kept in this view.</StatusBanner> : <>
      {loading && <LoadingState label="Loading application…" />}
      {error && <ErrorSummary ref={summary} message={error} errors={fields.filter(field => invalid.includes(field.name)).map(field => ({target:`application-${field.name}`, message:`${field.label}: Check this field.`}))} />}
      {uncertain && <StatusBanner tone="warning" live>The submission outcome is uncertain. Check the current application before another attempt. Do not submit again until that check succeeds.</StatusBanner>}
      {session && !session.email_verified && <><p>Verify your email before applying.</p><a href={accountEntry('/account/verify-email','/account/application')}>Verify email</a></>}
      {application && !reapplying && <>
        <h3>{{pending:'Pending review',approved:'Approved',rejected:'Rejected'}[application.status]}</h3>
        <StatusBadge tone={application.status==='approved'?'success':application.status==='pending'?'warning':'danger'}>{application.status}</StatusBadge>
        <p>{application.church_name}</p>
        {application.status==='pending' && <p>Your application is awaiting review. You will receive an email when a decision is made.</p>}
        {application.status==='approved' && <><p>Your church workspace is approved. Owner access requires confirmed MFA and current-session assurance. Home verifies your membership and access before opening church data.</p>
          {!session?.mfa_confirmed ? <a href={accountEntry('/account/mfa',home)}>Set up MFA</a> : <a href={home}>Continue to church Home</a>}</>}
        {application.status==='rejected' && <><p>{application.reason}</p><p>Application details are removed after 30 days. You may submit a new application.</p>
          <Button variant="secondary" onClick={()=>{setReapplying(true);setCaptcha('');setChallenge(value=>value+1)}}>Apply again</Button></>}
      </>}
      {canShowForm && <form aria-label="Church application" onSubmit={async event=>{
        event.preventDefault()
        if (!known || uncertain || !captcha || operating.current || !session) return
        operating.current=true; const run=generation.current
        setBusy(true);setError('');setInvalid([])
        const body:components['schemas']['SubmitChurchApplication']={church_name:values.church_name.trim().replace(/\s+/g,' '),city:values.city.trim().replace(/\s+/g,' '),address:values.address.trim()||null,timezone:values.timezone,captcha_token:captcha}
        try {
          const result=checkedApplication(await authRequest<Application>('/api/church-applications','POST',body))
          if (!result) throw new Error('Unverified submission response')
          if(run===generation.current){setApplication(result);setReapplying(false)}
        } catch(failure){
          if(run===generation.current){setError(safeAuthMessage(failure));if(failure instanceof ApiError)setInvalid(Object.keys(failure.fieldErrors??{}));if(isUncertainSubmission(failure)){setUncertain(true);setKnown(false)}}
        } finally {operating.current=false;if(run===generation.current){setBusy(false);setCaptcha('');setChallenge(value=>value+1)}}
      }}>
        <p>Provide your church details for review. No files are needed.</p>
        {fields.map(field=><Field key={field.name} id={`application-${field.name}`} name={field.name} label={field.label} maxLength={field.max} required={field.name!=='address'} value={values[field.name]} onChange={event=>setValues(current=>({...current,[field.name]:event.target.value}))} disabled={busy||uncertain} error={invalid.includes(field.name)?'Check this field.':undefined} />)}
        <p>Use a timezone such as Asia/Manila, Europe/London, or America/New_York. The server validates your details and verification proof.</p>
        <CaptchaChallenge key={challenge} onToken={setCaptcha}/>
        <Button disabled={busy||loading||!known||uncertain||!captcha} type="submit">{busy?'Submitting…':'Submit application'}</Button>
      </form>}
      <Button variant="secondary" disabled={busy||loading} onClick={()=>void refresh()}>{uncertain?'Check submission outcome':'Refresh status'}</Button>
    </>}
    <p><a href={accountEntry('/account/login','/account/application')}>Sign in</a> · <a href="/account">Account</a></p>
  </section>
}
