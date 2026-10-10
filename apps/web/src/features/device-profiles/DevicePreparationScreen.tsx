import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, ErrorSummary, Field, LoadingState, StatusBadge, StatusBanner } from '../../components/ui/Foundations'
import { ProfilePinError, profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'
import type { ChurchWorkspace } from '../../app/workspace-context'
import { accountEntry } from '../auth/account-session'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { readPreparationAccess, validatePreparationBootstrap, type PreparationAccess } from './preparation-access'
import '../../styles/preparation.css'

type PreparationStore = Pick<LocalProfileStore, 'listProfiles' | 'createProfile' | 'unlockProfile' | 'saveBootstrap' | 'isUnlocked' | 'isLeaseValid' | 'lockProfile' | 'onLock'>
const interrupted = (profile: ProfileRecord) => profile.leaseExpiresAt === null && profile.leaseSignature === null && profile.requiresReauthentication === true

export function DevicePreparationScreen({ store = profileStore, onAttendance }: { store?: PreparationStore; onAttendance?: () => void }) {
  const [stage, setStage] = useState<1 | 2 | 3>(1)
  const [access, setAccess] = useState<PreparationAccess | null>(null)
  const [workspaces, setWorkspaces] = useState<ChurchWorkspace[]>([])
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [selection, setSelection] = useState('')
  const [pin, setPin] = useState(''), [confirmation, setConfirmation] = useState('')
  const [pinError, setPinError] = useState(''), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false)
  const [retryUntil, setRetryUntil] = useState(0), [clock, setClock] = useState(Date.now)
  const mounted = useRef(false), generation = useRef(0), operating = useRef(false)
  const target = useRef<ProfileRecord | null>(null)
  const uncertainDevice = useRef<string | null>(null)
  const selectedChurch = useRef(new URLSearchParams(location.search).get('church') ?? undefined)
  const stageHeading = useRef<HTMLHeadingElement>(null)
  const remaining = Math.max(0, Math.ceil((retryUntil - clock) / 1000))
  const continuations = access ? profiles.filter(item => interrupted(item) && item.actorId === access.actorId && item.churchId === access.workspace.church_id) : []

  const verify = useCallback(async (church?: string) => {
    if (operating.current) return
    const run = ++generation.current
    setBusy(true); setError(''); setAccess(null); setWorkspaces([]); setReady(false); setStage(1); setPin(''); setConfirmation('')
    try {
      const result = await readPreparationAccess(church)
      const values = await store.listProfiles()
      if (!mounted.current || run !== generation.current) return
      setWorkspaces(result.workspaces); setProfiles(values)
      if ('actorId' in result) {
        setAccess(result); selectedChurch.current = result.workspace.church_id
        if (uncertainDevice.current) {
          const found = values.find(item => item.deviceId === uncertainDevice.current && item.actorId === result.actorId && item.churchId === result.workspace.church_id)
          if (found) { target.current = found; setSelection(found.id); uncertainDevice.current = null }
        }
        const existing = target.current
        if (existing && (existing.actorId !== result.actorId || existing.churchId !== result.workspace.church_id)) {
          store.lockProfile(existing.id); target.current = null; setSelection('')
        }
      }
    } catch (cause) {
      if (mounted.current && run === generation.current) setError(cause instanceof Error && !(cause instanceof ProfilePinError) && !('status' in cause)
        ? 'Access could not be verified. Check your verified church membership, email, current-session MFA and connection in Account, then try again.' : safeAuthMessage(cause))
    } finally { if (mounted.current && run === generation.current) setBusy(false) }
  }, [store])

  useEffect(() => {
    mounted.current = true
    void verify(selectedChurch.current)
    const cancel = () => { generation.current++ }
    const invalidate = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: number; churchId?: string }>).detail
      if (detail?.status === 403 && detail.churchId && detail.churchId !== selectedChurch.current) return
      cancel(); setAccess(null); setWorkspaces([]); setReady(false); setStage(1); setPin(''); setConfirmation('')
      if (!operating.current) setBusy(false)
      setError('Access or device state changed. Keep this profile and its existing PIN. Connect and verify access again; do not clear browser storage.')
      if (target.current) store.lockProfile(target.current.id)
    }
    const unsubscribe = store.onLock(id => { if (id === target.current?.id) invalidate(new Event('lock')) })
    const visibility = () => { if (document.visibilityState === 'hidden') invalidate(new Event('background')) }
    window.addEventListener('church-workspace-invalidated', invalidate)
    window.addEventListener('offline', invalidate)
    window.addEventListener('popstate', invalidate)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      mounted.current = false; cancel()
      unsubscribe(); window.removeEventListener('church-workspace-invalidated', invalidate); window.removeEventListener('offline', invalidate); window.removeEventListener('popstate', invalidate)
      document.removeEventListener('visibilitychange', visibility)
      if (operating.current && target.current) store.lockProfile(target.current.id)
    }
  }, [store, verify])
  useEffect(() => { stageHeading.current?.focus() }, [stage, ready])
  useEffect(() => {
    if (!remaining) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [remaining])

  async function prepare() {
    if (operating.current || !access || !access.ministries.length || remaining) return
    if (uncertainDevice.current && !target.current) { setError('The previous creation could not be reconciled. Keep browser storage and check Device profiles before preparing another profile.'); return }
    if (!/^\d{6,12}$/.test(pin) || (!selection && pin !== confirmation)) {
      setPinError(!/^\d{6,12}$/.test(pin) ? 'Enter 6–12 digits. Leading zeros are kept.' : 'The PINs must match. Enter them again.'); setError('Check the local PIN fields before continuing.'); return
    }
    operating.current = true; setBusy(true); setError(''); setPinError(''); setReady(false); setStage(3)
    const run = generation.current, expected = access
    const current = () => mounted.current && run === generation.current && navigator.onLine && document.visibilityState !== 'hidden'
    const assertCurrent = () => { if (!current()) throw new Error('Preparation interrupted') }
    const verifyCurrent = async () => {
      const value = await readPreparationAccess(expected.workspace.church_id)
      assertCurrent()
      if (!('scope' in value) || value.scope !== expected.scope) throw new Error('Verified scope changed')
    }
    let deviceId: string | undefined
    try {
      await verifyCurrent()
      let profile = target.current ?? profiles.find(item => item.id === selection)
      if (profile && (!interrupted(profile) || profile.actorId !== expected.actorId || profile.churchId !== expected.workspace.church_id)) throw new Error('Profile access changed')
      if (!profile) {
        deviceId = crypto.randomUUID()
        profile = await store.createProfile({ actorId: expected.actorId, churchId: expected.workspace.church_id, pin, deviceId })
        target.current = profile
        // Creation may complete after cancellation; preserve the partial profile, never unlock it late.
        assertCurrent()
        const created = profile
        setSelection(created.id); setProfiles(values => [...values.filter(item => item.id !== created.id), created])
      } else target.current = profile
      assertCurrent()
      await store.unlockProfile(profile.id, pin)
      assertCurrent()
      if (!store.isUnlocked(profile.id)) throw new Error('Profile locked')
      const bootstrap = await authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${profile.deviceId}`, 'GET', undefined, expected.workspace.church_id)
      assertCurrent(); validatePreparationBootstrap(expected, bootstrap)
      await verifyCurrent()
      if (!store.isUnlocked(profile.id)) throw new Error('Profile locked')
      await store.saveBootstrap(profile.id, bootstrap, { preserveCursor: true, preparationOnly: true })
      assertCurrent()
      await verifyCurrent()
      const valid = await store.isLeaseValid(profile.id)
      assertCurrent()
      if (!valid || !store.isUnlocked(profile.id)) throw new Error('Readiness could not be verified')
      setReady(true)
    } catch (cause) {
      if (target.current) store.lockProfile(target.current.id)
      if (!mounted.current) return
      // Reconcile an uncertain create before another attempt; never automatically recreate it.
      if (!target.current && deviceId) {
        uncertainDevice.current = deviceId
        const values = await store.listProfiles().catch(() => null)
        if (values) { setProfiles(values); target.current = values.find(item => item.deviceId === deviceId && item.actorId === expected.actorId && item.churchId === expected.workspace.church_id) ?? null }
        // Even an empty reconciliation is not permission to repeat an uncertain create here.
        if (target.current) uncertainDevice.current = null
      }
      if (target.current) setSelection(target.current.id)
      setAccess(null); setWorkspaces([]); setStage(1)
      if (cause instanceof ProfilePinError) {
        setRetryUntil(Date.parse(cause.retryAfter)); setClock(Date.now()); setPinError('The existing local PIN could not be accepted. Wait for the retry delay before trying again.')
      }
      setError(cause instanceof ProfilePinError
        ? 'The existing local PIN was not accepted. Wait for the enforced retry delay, then verify access and continue the same profile. Encrypted work is unchanged.'
        : 'Preparation is incomplete. Keep this profile and its existing PIN. Verify access again and continue the same profile. If it already has authorization, open Device profiles to check it. Do not remove, recreate or clear browser storage.')
    } finally {
      operating.current = false
      if (mounted.current) { setBusy(false); setPin(''); setConfirmation('') }
    }
  }

  return <section className="auth-card device-preparation" aria-busy={busy}>
    <p className="eyebrow">Encrypted device preparation</p><h1>Prepare this device</h1>
    <p>Verify church access, protect this profile with a local PIN, then save the authorized roster securely.</p>
    <ol className="preparation-steps" aria-label="Preparation stages">{['Verified access', 'Local PIN', 'Encrypted readiness'].map((label, index) => <li key={label} aria-current={stage === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
    <h2 ref={stageHeading} tabIndex={-1}>{ready ? 'Ready for offline attendance' : stage === 1 ? '1. Verify your church access' : stage === 2 ? '2. Protect this device profile' : '3. Save encrypted data'}</h2>
    {busy && <LoadingState label={stage === 3 ? 'Verifying access and saving encrypted data…' : 'Checking verified access…'} />}
    {error && <ErrorSummary message={error} />}
    {remaining > 0 && !busy && !ready && <StatusBanner live tone="warning">Try again in {remaining} seconds.</StatusBanner>}
    {!access && !busy && <><p>Online church sign-in is required. The local PIN does not sign you in to your church account.</p><p><a href={accountEntry('/account/login', '/account/prepare')}>Check church Account</a></p></>}
    {stage === 1 && !busy && <>
      {workspaces.length > 0 && <div className="form-field ui-field"><label htmlFor="preparation-workspace">Verified church workspace</label><select id="preparation-workspace" value={access?.workspace.church_id ?? ''} onChange={event => { target.current = null; setSelection(''); void verify(event.target.value || undefined) }}><option value="">Choose a verified workspace</option>{workspaces.map(item => <option value={item.church_id} key={item.church_id}>{item.name}</option>)}</select></div>}
      {access && <><StatusBadge tone="info">Verified {access.workspace.role === 'owner' ? 'Owner' : 'Teacher'} access</StatusBadge><p>{access.workspace.role === 'teacher' ? 'Only your active assigned ministries will be downloaded.' : 'Active ministries in this church will be downloaded under your verified Owner access.'}</p>
        {access.ministries.length ? <ul>{access.ministries.map(item => <li key={item.id}>{item.name}</li>)}</ul> : <StatusBanner tone="warning">No authorized active ministries are available. Ask your church Owner to check assignments, or manage active ministries with Owner access. No profile will be created.</StatusBanner>}
        {continuations.length > 0 && <fieldset><legend>Continue interrupted preparation</legend>{continuations.map(item => <label className="teacher-choice" key={item.id}><input type="radio" name="preparation-profile" checked={selection === item.id} onChange={() => { setSelection(item.id); target.current = item; setRetryUntil(Date.parse(item.retryAfter ?? '') || 0) }} />Continue Profile {profiles.findIndex(value => value.id === item.id) + 1}</label>)}<p>Use its existing PIN. Its encryption key and device binding will be kept.</p></fieldset>}
        {!selection && <p>A new encrypted profile will be created. Existing profiles and local work will be kept.</p>}
        <Button disabled={!access.ministries.length} onClick={() => { setStage(2); setError('') }}>Continue to local PIN</Button></>}
    </>}
    {stage === 2 && access && !busy && <form noValidate onSubmit={event => { event.preventDefault(); void prepare() }}>
      <p>This PIN unlocks only the encrypted local profile. It is separate from your church-account password. There is no PIN-reset shortcut.</p>
      <Field label={selection ? 'Existing local PIN' : 'Choose a 6–12 digit local PIN'} inputMode="numeric" type="password" autoComplete={selection ? 'off' : 'new-password'} value={pin} onChange={event => setPin(event.target.value)} error={pinError} hint="Use 6–12 digits; leading zeros are preserved." required />
      {!selection && <Field label="Confirm local PIN" type="password" inputMode="numeric" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required />}
      <Button type="submit" disabled={remaining > 0}>{selection ? 'Continue encrypted preparation' : 'Prepare encrypted profile'}</Button>
    </form>}
    {ready && access && <><StatusBanner tone="success" live>Authorized data has been saved durably with encryption. No attendance draft or upload event was created by preparation.</StatusBanner><p>Opening Attendance is a separate action.</p><Button onClick={onAttendance}>Open Attendance</Button><Button variant="secondary" onClick={() => { if (target.current) store.lockProfile(target.current.id) }}>Lock profile</Button></>}
    {!busy && !ready && <Button variant="secondary" onClick={() => void verify(selectedChurch.current)}>Verify access again</Button>}
    <p><a href="/profiles">Device profiles and safe recovery</a></p>
  </section>
}
