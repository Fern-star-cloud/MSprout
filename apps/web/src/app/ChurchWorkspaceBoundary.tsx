import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { components } from '../api/generated'
import { authRequest } from '../features/auth/transport'
import { profileStore } from '../offline/profile-store'
import type { OfflineBootstrap } from '../offline/schema'
import { ChurchNavigationContext, ChurchWorkspaceContext, type ChurchWorkspace } from './workspace-context'

type State = { kind: 'loading' } | { kind: 'device' } | { kind: 'error'; message: string; signIn?: boolean; mfa?: boolean }
  | { kind: 'select'; workspaces: ChurchWorkspace[] }
  | { kind: 'ready'; workspace: ChurchWorkspace; workspaces: ChurchWorkspace[]; actorId: number; assignmentScope: string; source: 'online' | 'offline' }

function failureState(error: unknown): State {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : 0
  if (status === 401 || status === 419) return { kind: 'error', message: 'Please sign in again to open your church workspace.', signIn: true }
  if (status === 403) return { kind: 'error', message: 'This church workspace is unavailable. Check your membership and current-session MFA.', mfa: true }
  return { kind: 'error', message: 'The church workspace could not be loaded. Connect and try again.' }
}

export function ChurchWorkspaceBoundary({ children, allowOffline = false, independent = false, routeKey = '', renderShell }: { children: ReactNode; allowOffline?: boolean; independent?: boolean; routeKey?: string; renderShell?: (content: ReactNode) => ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const pending = useRef(false)
  const selection = useRef(new URLSearchParams(location.search).get('church'))
  const currentChurch = state.kind === 'ready' ? state.workspace.church_id : null

  useEffect(() => {
    let active = true
    const run = ++generation.current
    pending.current = true
    const apply = (value: State) => { if (active && run === generation.current) setState(value) }
    void (async () => {
      try {
        selection.current = new URLSearchParams(location.search).get('church')
        if (!navigator.onLine) {
          // Attendance remains authorized by its encrypted profile, regardless of the web account.
          if (independent) { apply({ kind: 'device' }); return }
          if (!allowOffline) throw new Error('Online workspace required')
          const profile = await profileStore.activeProfile()
          if (!profile?.churchId) throw new Error('Unlocked profile required')
          // This decrypting read enforces the encrypted actor/church/device binding and lease.
          const authorization = await profileStore.readEncryptedAuthorization<Pick<OfflineBootstrap, 'actor' | 'lease'>>(profile.id)
          if (authorization.lease.church_id !== profile.churchId || (selection.current && selection.current !== profile.churchId)) throw new Error('Profile workspace mismatch')
          apply({ kind: 'ready', actorId: Number(authorization.actor.id), assignmentScope: profile.id, source: 'offline', workspace: { church_id: profile.churchId, name: 'Church workspace', role: 'teacher' }, workspaces: [] })
          return
        }
        const session = await authRequest<components['schemas']['AccountSession']>('/auth/session')
        if (!active || run !== generation.current) return
        if (!session.email_verified) { apply({ kind: 'error', message: 'Verify your email before opening a church workspace.' }); return }
        const workspaces = session.workspaces
        if (!workspaces.length) { apply({ kind: 'error', message: 'No active church workspace is available for your account.' }); return }
        const workspace = selection.current
          ? workspaces.find(item => item.church_id === selection.current)
          : workspaces.length === 1 ? workspaces[0] : undefined
        if (!workspace) {
          apply(selection.current ? { kind: 'error', message: 'This church workspace is unavailable for your account.' } : { kind: 'select', workspaces })
          return
        }
        const account = await authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, workspace.church_id)
        if (account.id !== session.id || !account.memberships.some(item => item.church_id === workspace.church_id && item.status === 'active' && item.role === workspace.role)) {
          apply({ kind: 'error', message: 'Your church membership changed. Reload your workspace.' }); return
        }
        if (workspace.role === 'owner' && !account.active_session.mfa_confirmed) {
          apply(failureState({ status: 403 })); return
        }
        const assignmentScope = [...new Set(account.assignments?.ministry_ids ?? [])].sort().join(',')
        apply({ kind: 'ready', actorId: session.id, workspace, workspaces, assignmentScope, source: 'online' })
      } catch (error) { apply(failureState(error)) }
      finally { if (run === generation.current) pending.current = false }
    })()
    return () => { active = false }
  }, [allowOffline, independent, revision, routeKey])

  useEffect(() => {
    const refresh = (background: boolean) => {
      if (background && pending.current) return
      generation.current++
      pending.current = true
      // Retain only a previously validated view while activation checks run.
      // Explicit auth/connectivity changes still remove it immediately.
      if (!background) setState({ kind: 'loading' })
      setRevision(value => value + 1)
    }
    const visible = () => { if (document.visibilityState === 'visible') refresh(true) }
    const connectivity = () => refresh(false)
    const invalidate = (event: Event) => {
      const detail = (event as CustomEvent<{ status: number; churchId?: string }>).detail
      if (detail?.status === 403 && detail.churchId && detail.churchId !== currentChurch) return
      generation.current++
      pending.current = false
      if (detail?.status === 0) refresh(false)
      else setState(failureState(detail))
    }
    window.addEventListener('church-workspace-invalidated', invalidate)
    window.addEventListener('focus', visible)
    window.addEventListener('online', connectivity)
    window.addEventListener('offline', connectivity)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('church-workspace-invalidated', invalidate)
      window.removeEventListener('focus', visible)
      window.removeEventListener('online', connectivity)
      window.removeEventListener('offline', connectivity)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [currentChurch])

  function selectChurch(churchId: string) {
    selection.current = churchId || null
    const url = new URL(location.href)
    if (churchId) url.searchParams.set('church', churchId)
    else url.searchParams.delete('church')
    history.replaceState(null, '', url.pathname + url.search + url.hash)
    window.dispatchEvent(new PopStateEvent('popstate'))
    generation.current++
    setState({ kind: 'loading' }); setRevision(value => value + 1)
  }

  const requestedChurch = new URLSearchParams(location.search).get('church')
  const compatible = state.kind !== 'ready' || (requestedChurch
    ? requestedChurch === state.workspace.church_id
    : state.workspaces.length <= 1)
  const needsConnectionValidation = state.kind === 'ready' && (navigator.onLine ? state.source === 'offline' : state.source === 'online')
  const error = state.kind === 'error' && <section>
    <p role="alert">{state.message}</p>
    {state.signIn && <a href="/account/login">Sign in</a>}
    {state.mfa && <a href="/account/mfa">Check MFA</a>}
    <button onClick={() => { setState({ kind: 'loading' }); setRevision(value => value + 1) }}>Retry workspace</button>
  </section>
  const selector = (state.kind === 'ready' || state.kind === 'select') && state.workspaces.length > 1 && <label>Church workspace
    <select value={state.kind === 'ready' ? state.workspace.church_id : ''} onChange={event => selectChurch(event.target.value)}>
      <option value="">Choose a church</option>
      {state.workspaces.map(item => <option key={item.church_id} value={item.church_id}>{item.name}</option>)}
    </select>
  </label>
  const onlineReady = state.kind === 'ready' && state.source === 'online' && navigator.onLine && compatible
  const workspace = state.kind === 'ready' && compatible && !needsConnectionValidation ? state.workspace : null
  let content: ReactNode = null
  if (independent) content = children
  else if (!compatible || state.kind === 'loading' || needsConnectionValidation) content = <p role="status">Loading church workspace…</p>
  else if (state.kind === 'ready' && !navigator.onLine && !allowOffline) content = <p role="alert">The church workspace could not be loaded. Connect and try again.</p>
  else if (state.kind === 'error') content = error
  else if (state.kind === 'select') content = <section><p>Choose an authorized church workspace to continue.</p>{!renderShell && selector}</section>
  else if (state.kind === 'ready') content = <div key={`${state.actorId}:${state.workspace.church_id}:${state.workspace.role}:${state.assignmentScope}`}>{children}</div>
  return <ChurchNavigationContext.Provider value={{ workspace: onlineReady ? state.workspace : null, assignments: onlineReady ? state.assignmentScope.split(',').filter(Boolean) : [], selector: !independent && compatible ? selector : null }}>
    <ChurchWorkspaceContext.Provider value={workspace}>
      {renderShell ? renderShell(content) : <>{state.kind === 'ready' && selector}{content}</>}
    </ChurchWorkspaceContext.Provider>
  </ChurchNavigationContext.Provider>
}
