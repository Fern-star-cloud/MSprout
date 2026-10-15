import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { Button, ErrorSummary, Field, LoadingState, StatusBadge, StatusBanner, StepIndicator } from '../../components/ui/Foundations'
import { ProfilePinError, profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'
import type { ChurchWorkspace } from '../../app/workspace-context'
import { accountEntry } from '../auth/account-session'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { readPreparationAccess, validatePreparationBootstrap, type PreparationAccess } from './preparation-access'
import '../../styles/preparation.css'
import { HomeIcon } from '../../components/ui/HomeIcon'
import { ChurchName } from '../../components/ui/CompactText'

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
  const [pinErrorField, setPinErrorField] = useState<'pin' | 'confirmation'>('pin')
  const [showPin, setShowPin] = useState(false), [showConfirmation, setShowConfirmation] = useState(false)
  const [progress, setProgress] = useState('Checking verified access…')
  const [leaseDeadline, setLeaseDeadline] = useState<string | null>(null)
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
    setBusy(true); setError(''); setAccess(null); setWorkspaces([]); setReady(false); setStage(1); setPin(''); setConfirmation(''); setShowPin(false); setShowConfirmation(false); setLeaseDeadline(null)
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
      cancel(); setAccess(null); setWorkspaces([]); setReady(false); setStage(1); setPin(''); setConfirmation(''); setShowPin(false); setShowConfirmation(false); setLeaseDeadline(null)
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
      setPinErrorField(!/^\d{6,12}$/.test(pin) ? 'pin' : 'confirmation')
      setPinError(!/^\d{6,12}$/.test(pin) ? 'Enter 6–12 digits. Leading zeros are kept.' : 'The PINs must match. Enter them again.'); setError('Check the local PIN fields before continuing.'); return
    }
    operating.current = true; setBusy(true); setError(''); setPinError(''); setReady(false); setStage(3); setProgress('Checking verified access…'); setShowPin(false); setShowConfirmation(false)
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
      setProgress('Protecting the encrypted profile…')
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
      setProgress('Downloading the authorized roster…')
      const bootstrap = await authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${profile.deviceId}`, 'GET', undefined, expected.workspace.church_id)
      assertCurrent(); validatePreparationBootstrap(expected, bootstrap)
      await verifyCurrent()
      if (!store.isUnlocked(profile.id)) throw new Error('Profile locked')
      setProgress('Saving the encrypted roster…')
      await store.saveBootstrap(profile.id, bootstrap, { preserveCursor: true, preparationOnly: true })
      assertCurrent()
      setProgress('Confirming offline authorization…')
      await verifyCurrent()
      const valid = await store.isLeaseValid(profile.id)
      assertCurrent()
      if (!valid || !store.isUnlocked(profile.id)) throw new Error('Readiness could not be verified')
      setLeaseDeadline(bootstrap.lease.expires_at); setReady(true)
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
        setPinErrorField('pin')
        setRetryUntil(Date.parse(cause.retryAfter)); setClock(Date.now()); setPinError('The existing local PIN could not be accepted. Wait for the retry delay before trying again.')
      }
      setError(cause instanceof ProfilePinError
        ? 'The existing local PIN was not accepted. Wait for the enforced retry delay, then verify access and continue the same profile. Encrypted work is unchanged.'
        : 'Preparation is incomplete. Keep this profile and its existing PIN. Verify access again and continue the same profile. If it already has authorization, open Device profiles to check it. Do not remove, recreate or clear browser storage.')
    } finally {
      operating.current = false
      if (mounted.current) { setBusy(false); setPin(''); setConfirmation(''); setShowPin(false); setShowConfirmation(false) }
    }
  }

  const backToAccess = () => { setPin(''); setConfirmation(''); setPinError(''); setError(''); setShowPin(false); setShowConfirmation(false); setStage(1) }
  function keepPinControlVisible(event: FocusEvent<HTMLFormElement>) {
    if (innerWidth >= 768) return
    const control = event.target
    // Native focus scrolling in mobile WebKit can place the field behind the
    // fixed phone navigation. Recheck after native focus, without moving focus.
    requestAnimationFrame(() => {
      if (!control.isConnected || document.activeElement !== control) return
      const box = control.getBoundingClientRect(), top = visualViewport?.offsetTop ?? 0
      const bottom = Math.min(top + (visualViewport?.height ?? innerHeight), document.querySelector('.phone-navigation')?.getBoundingClientRect().top ?? innerHeight)
      if (box.top < top + 8 || box.bottom > bottom - 8) window.scrollBy({ top: box.top - top - (bottom - top - box.height) / 2, behavior: 'instant' })
    })
  }
  const workspaceLink = access ? `/account/home?church=${encodeURIComponent(access.workspace.church_id)}` : '/account/home'
  const verifiedContext = access && <div className="preparation-context">
    <div className="preparation-context-heading"><span className="preparation-context-icon"><HomeIcon id="verified" /></span><div><p className="preparation-caption">Current verified context</p><ChurchName value={access.workspace.name} /></div><StatusBadge tone="success">{access.workspace.role === 'owner' ? 'Owner' : 'Teacher'}</StatusBadge></div>
    <div className="preparation-assignments"><p>{access.workspace.role === 'teacher' ? 'Assigned ministry' : 'Authorized ministries'}</p>{access.ministries.length > 0 && <ul>{access.ministries.map(item => <li key={item.id}>{item.name}</li>)}</ul>}</div>
  </div>
  const pinNotice = <StatusBanner tone="info"><HomeIcon id="info" /><div><strong>Local PIN ≠ account password</strong><p>This PIN unlocks only this encrypted profile. Your church password does not unlock device data.</p></div></StatusBanner>
  const protectedNotice = <StatusBanner tone={ready ? 'success' : 'neutral'}><HomeIcon id="verified" /><div><strong>{ready ? 'Protected when locked' : 'Encryption on this device'}</strong><p>{ready ? 'The saved roster is encrypted and protected by your local PIN.' : 'The roster will be encrypted and protected by your local PIN. There is no PIN-reset shortcut.'}</p></div></StatusBanner>
  return <section className="device-preparation" aria-busy={busy}>
    <header className="preparation-heading"><h1>Prepare this device</h1><p>For attendance when you are offline</p></header>
    <StepIndicator className="preparation-steps" label="Preparation stages" steps={[{ id: '1', label: 'Confirm access' }, { id: '2', label: 'Local PIN' }, { id: '3', label: ready ? 'Ready' : 'Save securely' }]} current={String(stage)} />
    <div className="preparation-layout" data-stage={stage}>
      {stage !== 1 && <aside className="preparation-panel preparation-access-summary" aria-label="Verified access summary"><p className="preparation-panel-bar">Confirm access</p><div className="preparation-panel-body"><p className="preparation-caption">Verified for this preparation</p><h3>Church and access</h3>{verifiedContext}<p>{access?.workspace.role === 'owner' ? 'Current Owner verification and MFA are required.' : 'Only your active assigned ministries can be saved.'}</p></div></aside>}
      {stage === 3 && <aside className="preparation-panel preparation-pin-summary" aria-label="Local protection summary"><p className="preparation-panel-bar">Local PIN</p><div className="preparation-panel-body"><p className="preparation-caption">{ready ? 'Profile protected' : 'Preparation in progress'}</p><h3>Local profile protection</h3>{pinNotice}{protectedNotice}</div></aside>}
      <div className={`preparation-panel preparation-active preparation-stage-${stage}`}>
        {stage !== 1 && <p className="preparation-panel-bar">{stage === 2 ? 'Prepare profile' : 'MSprout · Device'}</p>}
        <div className="preparation-panel-body">
          <p className="preparation-stage-count">Step {stage} of 3</p>
          <h2 ref={stageHeading} tabIndex={-1}>{ready ? 'Ready for offline attendance' : stage === 1 ? '1. Confirm church and access' : stage === 2 ? '2. Protect this device profile' : '3. Save encrypted data'}</h2>
          <p className="preparation-introduction">{stage === 1 ? 'A verified online account is required for preparation.' : stage === 2 ? 'Use a PIN only for this device.' : ready ? 'Your authorized roster is ready on this device.' : 'Keep this page open while preparation completes.'}</p>
          {busy && <LoadingState label={stage === 3 ? progress : 'Checking verified access…'} />}
          {error && <ErrorSummary message={error} errors={stage === 2 && pinError ? [{ target: pinErrorField === 'confirmation' ? 'preparation-confirmation' : 'preparation-pin', message: pinError }] : []} />}
          {remaining > 0 && !busy && !ready && <StatusBanner live tone="warning">Try again in {remaining} seconds.</StatusBanner>}
          {!access && !busy && <><p>Online church sign-in is required. The local PIN does not sign you in to your church account.</p><a className="preparation-account-link" href={accountEntry('/account/login', '/account/prepare')}>Check church Account</a></>}
          {stage === 1 && !busy && <>
            {workspaces.length > 1 && <div className="form-field ui-field"><label htmlFor="preparation-workspace">Verified church workspace</label><select id="preparation-workspace" value={access?.workspace.church_id ?? ''} onChange={event => { target.current = null; setSelection(''); void verify(event.target.value || undefined) }}><option value="">Choose a verified workspace</option>{workspaces.map(item => <option value={item.church_id} key={item.church_id}>{item.name}</option>)}</select></div>}
            {access && <>{verifiedContext}
              {!access.ministries.length && <StatusBanner tone="warning"><div><strong>No ministry assigned</strong><p>No authorized active ministries are available. Ask your church Owner to check assignments, or manage active ministries with Owner access. No profile will be created.</p></div></StatusBanner>}
              <StatusBanner tone="info"><HomeIcon id="info" /><div><strong>No Church ID needed</strong><p>Your eligible membership and assignments are checked online.</p></div></StatusBanner>
              {continuations.length > 0 && <fieldset><legend>Continue interrupted preparation</legend>{continuations.map(item => <label className="teacher-choice" key={item.id}><input type="radio" name="preparation-profile" checked={selection === item.id} onChange={() => { setSelection(item.id); target.current = item; setRetryUntil(Date.parse(item.retryAfter ?? '') || 0) }} />Continue Profile {profiles.findIndex(value => value.id === item.id) + 1}</label>)}<p>Use its existing PIN. Its encryption key and device binding will be kept.</p></fieldset>}
              <div className="preparation-actions"><a className="ui-button ui-button-secondary" href={workspaceLink}>Back to workspace</a><Button disabled={!access.ministries.length} onClick={() => { setStage(2); setError('') }}>Continue to local PIN</Button></div>
              <p className="preparation-preservation">{selection ? 'Continue the same profile with its existing PIN.' : 'A new encrypted profile will be created. Existing profiles and local work will be kept.'}</p>
            </>}
          </>}
          {stage === 2 && access && !busy && <form noValidate onFocus={keepPinControlVisible} onSubmit={event => { event.preventDefault(); void prepare() }}>
            {pinNotice}
            <div className="preparation-pin-field"><Field id="preparation-pin" label={selection ? 'Existing local PIN' : 'Choose a 6–12 digit local PIN'} inputMode="numeric" type={showPin ? 'text' : 'password'} pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete={selection ? 'off' : 'new-password'} value={pin} onChange={event => setPin(event.target.value)} error={pinErrorField === 'pin' ? pinError : undefined} hint="6–12 digits, including leading zeros" required /><Button variant="secondary" className="preparation-pin-toggle" aria-controls="preparation-pin" aria-pressed={showPin} onClick={() => setShowPin(value => !value)} aria-label={showPin ? 'Hide local PIN' : 'Show local PIN'}>{showPin ? 'Hide' : 'Show'}</Button></div>
            {!selection && <div className="preparation-pin-field"><Field id="preparation-confirmation" label="Confirm local PIN" type={showConfirmation ? 'text' : 'password'} inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} error={pinErrorField === 'confirmation' ? pinError : undefined} hint="The two PIN entries must match." required /><Button variant="secondary" className="preparation-pin-toggle" aria-controls="preparation-confirmation" aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)} aria-label={showConfirmation ? 'Hide confirmation PIN' : 'Show confirmation PIN'}>{showConfirmation ? 'Hide' : 'Show'}</Button></div>}
            {protectedNotice}
            <div className="preparation-actions"><Button variant="secondary" className="preparation-back" onClick={backToAccess}>Back to access</Button><Button className="preparation-submit" type="submit" disabled={remaining > 0}>{selection ? 'Continue encrypted preparation' : 'Prepare encrypted profile'}</Button></div>
          </form>}
          {ready && access && <><StatusBanner tone="success" live><HomeIcon id="verified" /><div><strong>Saved securely on this device</strong><p>Authorized data has been saved durably with encryption.</p></div></StatusBanner><div className="preparation-ready-scope"><p className="preparation-caption">Profile scope</p>{verifiedContext}{leaseDeadline && <p className="preparation-deadline">Offline authorization until <time dateTime={leaseDeadline}>{new Date(leaseDeadline).toLocaleString()}</time></p>}</div><StatusBanner><HomeIcon id="info" /><div><strong>No attendance created</strong><p>No attendance draft or upload event was created by preparation. Opening Attendance is a separate action.</p></div></StatusBanner><div className="preparation-ready-actions"><Button onClick={onAttendance}>Open Attendance</Button><a className="ui-button ui-button-secondary" href={workspaceLink}>Back to workspace</a><Button variant="secondary" onClick={() => { if (target.current) store.lockProfile(target.current.id) }}>Lock profile</Button></div></>}
          {!busy && !ready && stage === 1 && <Button variant="secondary" className="preparation-retry" onClick={() => void verify(selectedChurch.current)}>Verify access again</Button>}
        </div>
      </div>
      {stage === 1 && <aside className="preparation-panel preparation-pin-guide" aria-label="Next: local PIN"><p className="preparation-panel-bar">Prepare profile</p><div className="preparation-panel-body"><p className="preparation-caption">Next · Step 2</p><h3>Protect this profile</h3><p>Choose and confirm a local PIN after verifying access.</p>{pinNotice}{protectedNotice}</div></aside>}
      {stage !== 3 && <aside className="preparation-panel preparation-ready-guide" aria-label="After secure save"><p className="preparation-panel-bar">MSprout · Device</p><div className="preparation-panel-body"><p className="preparation-caption">After secure save · Step 3</p><h3>Encrypted readiness</h3><p>Readiness is confirmed after your authorized roster has been saved securely on this device.</p><StatusBanner><HomeIcon id="info" /><div><strong>No attendance created</strong><p>Preparing a device does not start a class session.</p></div></StatusBanner><p>Offline use requires valid authorization. A PIN alone cannot renew an expired lease.</p></div></aside>}
    </div>
    <a className="preparation-recovery" href="/profiles">Device profiles and safe recovery</a>
  </section>
}
