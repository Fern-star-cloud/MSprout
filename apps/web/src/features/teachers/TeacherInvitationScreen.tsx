import { useEffect, useState } from 'react'
import type { components } from '../../api/generated'
import { authRequest, safeAuthMessage } from '../auth/transport'

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
  useEffect(() => { history.replaceState(null, '', location.pathname + location.search) }, [])
  return <section className="auth-card" aria-labelledby="teacher-invitation-heading">
    <h2 id="teacher-invitation-heading">Teacher invitation</h2>
    {error && <p role="alert">{error}</p>}
    {accepted ? <p role="status">Invitation accepted. Sign in to access your assigned ministries.</p> : !proof ? <p role="alert">Open the complete invitation link from your email.</p> : <form onSubmit={async event => {
      event.preventDefault()
      if (busy) return
      const form = event.currentTarget
      const fields = new FormData(form)
      const body: components['schemas']['AcceptTeacherInvitation'] = { ...proof, email: String(fields.get('email')).trim().toLowerCase() }
      if (newAccount) { body.name = String(fields.get('name')).trim(); body.password = String(fields.get('password')) }
      setBusy(true); setError('')
      try {
        await authRequest('/api/teacher-invitations/accept', 'POST', body)
        setProof(null); setAccepted(true)
      } catch (failure) { setError(safeAuthMessage(failure)) }
      finally { form.reset(); setBusy(false) }
    }}>
      <p>Use the invited email address. If you already have an account, sign in and verify your email, then reopen this invitation.</p>
      <label htmlFor="invited-email">Invited email</label><input id="invited-email" name="email" type="email" maxLength={254} autoComplete="email" required disabled={busy} />
      <label className="teacher-choice"><input type="checkbox" checked={newAccount} disabled={busy} onChange={event => setNewAccount(event.target.checked)} />Create my invited account</label>
      {newAccount && <>
        <label htmlFor="teacher-name">Display name</label><input id="teacher-name" name="name" maxLength={120} autoComplete="name" required disabled={busy} />
        <label htmlFor="teacher-password">New password</label><input id="teacher-password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy} />
        <p>Use at least 12 characters, with uppercase and lowercase letters, a number and a symbol. This emailed invitation verifies your address.</p>
      </>}
      <button disabled={busy}>Accept invitation</button>
    </form>}
    <a href="/account/login">Sign in</a>
  </section>
}
