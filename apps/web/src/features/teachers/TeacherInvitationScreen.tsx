import { useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { isUncertainSubmission } from '../auth/account-session'
import { ApiError } from '../../api/client'
import { Button, ErrorSummary, Field, StatusBanner } from '../../components/ui/Foundations'

type Proof = Pick<components['schemas']['AcceptTeacherInvitation'], 'church_id' | 'invitation_id' | 'token' | 'signature' | 'expires'>

function parseProof(fragment: string): Proof | null {
  try {
    const proof = JSON.parse(decodeURIComponent(fragment)) as Proof
    const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
    if (!uuid.test(proof.church_id) || !uuid.test(proof.invitation_id) || !/^[a-f\d]{64}$/i.test(proof.token) || !/^[a-f\d]{64}$/i.test(proof.signature) || !Number.isSafeInteger(proof.expires)) return null
    return { church_id: proof.church_id, invitation_id: proof.invitation_id, token: proof.token, signature: proof.signature, expires: proof.expires }
  } catch { return null }
}

export function TeacherInvitationScreen({ fragment }: { fragment: string }) {
  const [proof, setProof] = useState(() => parseProof(fragment))
  const [newAccount, setNewAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [invalid, setInvalid] = useState<string[]>([])
  const submitting = useRef(false)
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error && !busy) summary.current?.focus() }, [error, busy])
  useEffect(() => { history.replaceState(null, '', location.pathname + location.search) }, [])
  return <section className="auth-card" aria-labelledby="teacher-invitation-heading">
    <h2 id="teacher-invitation-heading">Teacher invitation</h2>
    {error && <ErrorSummary ref={summary} message={error} errors={[{name:'email',id:'invited-email',label:'Invited email'},{name:'name',id:'teacher-name',label:'Display name'},{name:'password',id:'teacher-password',label:'New password'}].filter(field=>invalid.includes(field.name)).map(field=>({target:field.id,message:`${field.label}: Check this field.`}))} />}
    {uncertain && <StatusBanner tone="warning" live>The invitation outcome is uncertain. Check Account and ask your church Owner to verify membership and invitation status before another attempt. Do not resubmit this form or create another account.</StatusBanner>}
    {accepted ? <p role="status">Invitation accepted. Sign in to access your assigned ministries.</p> : !proof ? <p role="alert">Open the complete invitation link from your email.</p> : <form onSubmit={async event => {
      event.preventDefault()
      if (submitting.current || uncertain) return
      submitting.current = true
      const form = event.currentTarget
      const fields = new FormData(form)
      const body: components['schemas']['AcceptTeacherInvitation'] = { ...proof, email: String(fields.get('email')).trim().toLowerCase() }
      if (newAccount) { body.name = String(fields.get('name')).trim(); body.password = String(fields.get('password')) }
      setBusy(true); setError(''); setInvalid([])
      try {
        await authRequest('/api/teacher-invitations/accept', 'POST', body)
        setProof(null); setAccepted(true)
      } catch (failure) {
        if (failure instanceof ApiError) setInvalid(Object.keys(failure.fieldErrors ?? {}))
        if (isUncertainSubmission(failure)) setUncertain(true)
        const status = typeof failure === 'object' && failure !== null && 'status' in failure ? failure.status : 0
        setError(status === 403
          ? 'Use the invited account to accept this invitation. For a new account, reopen the original email link in a separate signed-out browser profile. For an existing account, sign in with the invited email and verify it, then reopen the link.'
          : safeAuthMessage(failure))
      }
      finally { form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input=>{input.value=''}); setBusy(false); submitting.current=false }
    }}>
      <p>Use the invited email address. To create an account, open the original email link in a separate signed-out browser profile. If you already have an account, sign in with the invited email and verify it, then reopen this invitation.</p>
      <Field id="invited-email" label="Invited email" name="email" type="email" maxLength={254} autoComplete="email" required disabled={busy||uncertain} error={invalid.includes('email')?'Check this field.':undefined} />
      <label className="teacher-choice"><input type="checkbox" checked={newAccount} disabled={busy||uncertain} onChange={event => setNewAccount(event.target.checked)} />Create my invited account</label>
      {newAccount && <>
        <Field id="teacher-name" label="Display name" name="name" maxLength={120} autoComplete="name" required disabled={busy||uncertain} error={invalid.includes('name')?'Check this field.':undefined} />
        <Field id="teacher-password" label="New password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy||uncertain} error={invalid.includes('password')?'Check this field.':undefined} />
        <p>Use at least 12 characters, with uppercase and lowercase letters, a number and a symbol. This emailed invitation verifies your address.</p>
      </>}
      <Button type="submit" disabled={busy||uncertain}>Accept invitation</Button>
    </form>}
    <a href="/account/login">Sign in</a>
    <p><a href="/account">Check Account</a></p>
  </section>
}
