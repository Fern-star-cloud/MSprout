import { useEffect, useState } from 'react'
import type { components } from '../../api/generated'
import { authRequest, safeAuthMessage } from '../auth/transport'

type Teacher = components['schemas']['Teacher']
type Ministry = components['schemas']['AssignedMinistry']
type Invitation = components['schemas']['TeacherInvitation']
type Dialog = { action: 'assign' | 'revoke' | 'transfer'; teacher: Teacher } | null

export function TeacherManagementScreen() {
  const [church, setChurch] = useState(() => new URLSearchParams(location.search).get('church') ?? '')
  const [selectedChurch, setSelectedChurch] = useState(church)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [allowed, setAllowed] = useState(false)
  const [canInvite, setCanInvite] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [revision, setRevision] = useState(0)
  const [teacherPage, setTeacherPage] = useState(1)
  const [invitationPage, setInvitationPage] = useState(1)
  const [moreTeachers, setMoreTeachers] = useState(false)
  const [moreInvitations, setMoreInvitations] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine); setAllowed(false); setTeachers([]); setInvitations([]); setDialog(null)
      setRevision(value => value + 1)
    }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    let active = true
    if (online && church) void (async () => {
      try {
        const me = await authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, church)
        const owner = me.memberships.some(member => member.church_id === church && member.role === 'owner' && member.status === 'active') && me.active_session.mfa_confirmed
        if (!owner) { if (active) { setAllowed(false); setError('Owner access is required to manage Teachers.') }; return }
        const [list, pending, choices] = await Promise.all([
          authRequest<components['schemas']['TeacherList']>('/api/teachers?page=' + teacherPage, 'GET', undefined, church),
          authRequest<components['schemas']['TeacherInvitationList']>('/api/teacher-invitations?page=' + invitationPage, 'GET', undefined, church),
          authRequest<components['schemas']['AssignedMinistries']>('/api/assigned-ministries', 'GET', undefined, church),
        ])
        if (active) {
          setTeachers(list.data); setInvitations(pending.data); setMinistries(choices.data)
          setMoreTeachers(list.has_more); setMoreInvitations(pending.has_more); setCanInvite(list.can_invite)
          setAllowed(true); setError('')
        }
      } catch (failure) { if (active) { setAllowed(false); setError(safeAuthMessage(failure)) } }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [church, online, revision, teacherPage, invitationPage])

  async function mutate(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: Record<string, unknown>, transfer = false) {
    if (busy || !online || !allowed) return
    setBusy(true); setError(''); setNotice('')
    try {
      await authRequest(path, method, body, church)
      setDialog(null)
      if (transfer) {
        setAllowed(false); setTeachers([]); setInvitations([])
        setNotice('Ownership transferred. Sign in again. The new Owner must confirm MFA before accessing the workspace.')
      } else { setNotice('Changes saved.'); setLoading(true); setAllowed(false); setRevision(value => value + 1) }
    } catch (failure) { setError(safeAuthMessage(failure)); setAllowed(false); setDialog(null) }
    finally { setBusy(false) }
  }

  function choices(selected: string[] = []) {
    return <fieldset disabled={busy}><legend>Ministries</legend>
      {ministries.length === 0 && <p>No ministries are available for assignment yet.</p>}
      {ministries.map(ministry => <label className="teacher-choice" key={ministry.id}>
        <input type="checkbox" name="ministry_ids" value={ministry.id} defaultChecked={selected.includes(ministry.id)} />{ministry.name}
      </label>)}
    </fieldset>
  }

  return <section className="auth-card" aria-labelledby="teachers-heading">
    <p className="eyebrow">Church administration · Online only</p><h2 id="teachers-heading">Teachers</h2>
    {!church && <form onSubmit={event => { event.preventDefault(); setChurch(selectedChurch) }}>
      <label htmlFor="church-id">Church workspace ID</label><input id="church-id" required value={selectedChurch} onChange={event => setSelectedChurch(event.target.value)} />
      <button>Open workspace</button>
    </form>}
    {!online && <p role="alert">Connect to the internet to manage Teachers.</p>}
    {church && loading && online && <p role="status">Loading Teacher access…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {allowed && online && <>
      {!dialog && canInvite && <form aria-label="Invite a Teacher" onSubmit={event => {
        event.preventDefault()
        const form = event.currentTarget
        const fields = new FormData(form)
        void mutate('/api/teacher-invitations', 'POST', { email: String(fields.get('email')).trim().toLowerCase(), ministry_ids: fields.getAll('ministry_ids') })
        form.reset()
      }}>
        <h3>Invite a Teacher</h3>
        <label htmlFor="invitation-email">Invitation email</label><input id="invitation-email" name="email" type="email" maxLength={254} required disabled={busy} autoComplete="email" />
        {choices()}<p>Select at least one ministry. Invitations expire after seven days.</p>
        <button disabled={busy || ministries.length === 0}>Invite Teacher</button>
      </form>}
      <h3>Teacher memberships</h3>
      {teachers.length === 0 && <p>No Teachers on this page.</p>}
      <ul className="application-list">{teachers.map(teacher => <li key={teacher.id}>
        <strong>{teacher.display_name}</strong><p>Status: {teacher.status}</p>
        <p>{teacher.ministry_ids.map(id => ministries.find(ministry => ministry.id === id)?.name ?? 'Unavailable ministry').join(', ') || 'No assigned ministries'}</p>
        {teacher.can_manage && !dialog && <div className="application-actions">
          <button disabled={busy} onClick={() => setDialog({ action: 'assign', teacher })}>Edit assignments</button>
          <button disabled={busy} onClick={() => setDialog({ action: 'revoke', teacher })}>Revoke Teacher</button>
          <button disabled={busy} onClick={() => setDialog({ action: 'transfer', teacher })}>Transfer ownership</button>
        </div>}
      </li>)}</ul>
      <nav aria-label="Teacher pages" className="application-actions">
        <button disabled={busy || teacherPage === 1} onClick={() => { setAllowed(false); setTeacherPage(value => value - 1) }}>Previous Teachers</button>
        <button disabled={busy || !moreTeachers} onClick={() => { setAllowed(false); setTeacherPage(value => value + 1) }}>Next Teachers</button>
      </nav>
      {dialog && <section role="region" aria-label="Confirm Teacher change" className="teacher-confirmation">
        <h3>{dialog.action === 'assign' ? 'Edit assignments for' : dialog.action === 'revoke' ? 'Revoke access for' : 'Transfer ownership to'} {dialog.teacher.display_name}</h3>
        <form key={dialog.action + dialog.teacher.id} onSubmit={event => {
          event.preventDefault()
          const form = event.currentTarget
          const fields = new FormData(form)
          if (dialog.action === 'assign') void mutate('/api/teachers/' + dialog.teacher.id + '/assignments', 'PUT', { ministry_ids: fields.getAll('ministry_ids') })
          if (dialog.action === 'revoke') void mutate('/api/teachers/' + dialog.teacher.id, 'DELETE')
          if (dialog.action === 'transfer') {
            void mutate('/api/ownership-transfer', 'POST', { target_membership_id: dialog.teacher.id, password: String(fields.get('password')), code: String(fields.get('code')) }, true)
            form.reset()
          }
        }}>
          {dialog.action === 'assign' && choices(dialog.teacher.ministry_ids)}
          {dialog.action === 'revoke' && <p>This ends the Teacher&apos;s server sessions, assignments, push access and offline authorization. Audit history is retained.</p>}
          {dialog.action === 'transfer' && <>
            <p>You will become a Teacher and lose Owner permissions. Both accounts must sign in again. Your existing ministry assignments remain.</p>
            <label htmlFor="transfer-password">Current password</label><input id="transfer-password" name="password" type="password" autoComplete="current-password" required disabled={busy} />
            <label htmlFor="transfer-code">Fresh authenticator code</label><input id="transfer-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required disabled={busy} />
            <p>Use a new code that has not already been used to sign in.</p>
            <label className="teacher-choice"><input type="checkbox" required disabled={busy} />I understand that ownership will transfer to {dialog.teacher.display_name}.</label>
          </>}
          <button disabled={busy}>{dialog.action === 'assign' ? 'Save assignments' : dialog.action === 'revoke' ? 'Confirm revocation' : 'Confirm transfer'}</button>
          <button className="secondary" type="button" disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
        </form>
      </section>}
      <h3>Invitations</h3>
      <ul className="application-list">{invitations.map(invitation => <li key={invitation.id}>
        <p>{invitation.email} · {invitation.status}</p>
        <p>Expires: {new Date(invitation.expires_at).toLocaleDateString()}</p>
        {invitation.status === 'pending' && <button disabled={busy} onClick={() => void mutate('/api/teacher-invitations/' + invitation.id, 'DELETE')}>Revoke invitation</button>}
      </li>)}</ul>
      <nav aria-label="Invitation pages" className="application-actions">
        <button disabled={busy || invitationPage === 1} onClick={() => { setAllowed(false); setInvitationPage(value => value - 1) }}>Previous invitations</button>
        <button disabled={busy || !moreInvitations} onClick={() => { setAllowed(false); setInvitationPage(value => value + 1) }}>Next invitations</button>
      </nav>
    </>}
    <p><button className="secondary" disabled={busy || !church || !online} onClick={() => { setAllowed(false); setLoading(true); setRevision(value => value + 1) }}>Refresh access</button></p>
    <a href="/account/login">Sign in</a>
  </section>
}
