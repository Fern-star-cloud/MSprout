import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { ApiError } from '../../api/client'
import { ChurchWorkspaceContext } from '../../app/workspace-context'
import { authDownload, authRequest, authUpload, safeAuthMessage } from '../auth/transport'
import { safeImportFileErrors } from './file-validation'
import { eligible, makePlan, outcomeCounts, readRecovery, recoverPlan, recoveryFor, saveRecovery, uuid, type CommitPlan, type Ministry, type Preview, type Recovery } from './import-model'

export type Stage = 'Upload' | 'Review and map' | 'Confirm selected' | 'Results'
type State = { church: string; authorization: 'loading' | 'authorized' | 'forbidden' | 'error'; actor: number; ministries: Ministry[]; preview: Preview | null; stage: Stage; selected: Set<string>; mappings: Record<string, string>; key: string; plan: CommitPlan | null; confirmed: boolean; verified: boolean; accepted: boolean; error: string }
const empty = (church: string): State => ({ church, authorization: 'loading', actor: 0, ministries: [], preview: null, stage: 'Upload', selected: new Set(), mappings: {}, key: '', plan: null, confirmed: false, verified: false, accepted: false, error: '' })
const denied = (failure: unknown) => typeof failure === 'object' && failure !== null && 'status' in failure && [401, 403, 419].includes(Number(failure.status))

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url)
}

export function useImportWizard(church: string) {
  const workspace = useContext(ChurchWorkspaceContext)
  const [state, setState] = useState<State>(() => empty(church)), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const generation = useRef(0), alive = useRef(false), operating = useRef(false), receipt = useRef<Recovery | null>(null)
  const visible = state.church === church ? state : empty(church)
  const clear = useCallback((message: string, forbiddenAccess = false) => {
    generation.current++; receipt.current = null
    setState({ ...empty(church), authorization: forbiddenAccess ? 'forbidden' : 'error', error: forbiddenAccess ? '' : message })
  }, [church])
  const refresh = useCallback(() => { generation.current++; setState(empty(church)); setRevision(value => value + 1) }, [church])
  useEffect(() => { alive.current = true; const stop = () => { alive.current = false; generation.current++ }; return stop }, [])

  const ownerAccess = useCallback(async () => {
    if (!uuid(church) || !navigator.onLine) throw Error('Online workspace required')
    const me = await authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, church)
    if (!Number.isSafeInteger(me.id) || me.id <= 0 || !me.active_session?.mfa_confirmed || workspace?.role === 'teacher'
      || !me.memberships.some(member => member.church_id === church && member.status === 'active' && member.role === 'owner')) throw new ApiError('import_access', '', '', 403)
    return me.id
  }, [church, workspace?.role])

  useEffect(() => {
    const token = ++generation.current, current = () => alive.current && generation.current === token
    void (async () => {
      try {
        const actor = await ownerAccess()
        if (!current()) return
        const list = await authRequest<{ data: Ministry[] }>('/api/ministries', 'GET', undefined, church)
        if (!current()) return
        let stored: Recovery | null
        try { stored = readRecovery(church, actor) }
        catch { clear('The saved import reference could not be read. Check browser recovery storage before continuing.'); return }
        receipt.current = stored
        const next = { ...empty(church), actor, authorization: 'authorized' as const, ministries: list.data.filter(item => item.status === 'active') }
        if (!stored) { setState(next); return }
        // Recovery is a read of the original batch, never a preview upload or commit.
        setState({ ...next, stage: 'Results', key: stored.key, error: 'Checking the saved batch…' })
        try {
          const preview = await authRequest<Preview>(`/api/imports/${stored.batch}`, 'GET', undefined, church)
          if (!current()) return
          if (preview.id !== stored.batch) throw Error('Batch mismatch')
          const plan = recoverPlan(stored, preview)
          setState({ ...next, preview, key: stored.key, plan: stored.submitted ? plan : null, verified: true,
            stage: preview.state === 'previewed' && !stored.submitted ? 'Review and map' : 'Results',
            selected: new Set(stored.submitted ? plan.row_ids : preview.rows.filter(row => eligible(row, {}, next.ministries)).map(row => row.id)),
            mappings: plan.ministry_mappings })
        } catch (failure) {
          if (current()) {
            if (denied(failure)) clear(safeAuthMessage(failure))
            else setState(value => ({ ...value, error: 'Import result not confirmed. Check the same batch before trying again.' }))
          }
        }
      } catch (failure) {
        if (current()) clear(navigator.onLine ? safeAuthMessage(failure) : 'Connect to the internet to use student imports.', failure instanceof ApiError && failure.code === 'import_access')
      }
    })()
    const stop = () => { if (generation.current === token) generation.current++ }
    return stop
    // The boundary owns background activation. Explicit local refresh rereads
    // the current actor, ministries and retained opaque recovery pointer.
  }, [church, revision, ownerAccess, clear])

  useEffect(() => {
    const invalidate = (event: Event) => {
      const detail = (event as CustomEvent<{ status: number; churchId?: string }>).detail
      if (detail?.status === 403 && detail.churchId && detail.churchId !== church) return
      if (detail?.status === 0) refresh()
      else clear('Your access changed or expired. Check your account before continuing.')
    }
    const connect = () => navigator.onLine ? refresh() : clear('Connect to the internet to use student imports.')
    const focus = (event: Event) => {
      // A native file picker returns focus to its file input. Keep that explicit
      // choice; upload and commit each reverify authorization before writing.
      if (event.type === 'focus' && event.target !== window) return
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'file') return
      if (!workspace && document.visibilityState === 'visible' && !operating.current) refresh()
    }
    window.addEventListener('church-workspace-invalidated', invalidate); window.addEventListener('offline', connect); window.addEventListener('online', connect)
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus)
    return () => {
      window.removeEventListener('church-workspace-invalidated', invalidate); window.removeEventListener('offline', connect); window.removeEventListener('online', connect)
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus)
    }
  }, [church, workspace, clear, refresh])

  async function operate(work: (current: () => boolean) => Promise<void>) {
    if (operating.current || visible.authorization !== 'authorized' || !navigator.onLine) return
    operating.current = true; setBusy(true)
    const token = generation.current, current = () => alive.current && token === generation.current
    try { await work(current) }
    catch (failure) { if (current()) { if (denied(failure)) clear(safeAuthMessage(failure)); else setState(value => ({ ...value, error: safeAuthMessage(failure) })) } }
    finally { operating.current = false; if (alive.current) setBusy(false) }
  }

  async function reverify(current: () => boolean): Promise<Ministry[] | null> {
    const actor = await ownerAccess()
    if (!current()) return null
    if (actor !== visible.actor) { clear('The signed-in account changed. Check your account before continuing.'); return null }
    const list = await authRequest<{ data: Ministry[] }>('/api/ministries', 'GET', undefined, church)
    return current() ? list.data.filter(item => item.status === 'active') : null
  }

  async function upload(file: File) {
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      setState(value => ({ ...value, error: 'Choose a CSV or XLSX file no larger than 5 MiB.' })); return
    }
    if (visible.stage !== 'Upload') return
    await operate(async current => {
      const ministries = await reverify(current)
      if (!ministries) return
      try {
        const preview = await authUpload<Preview>('/api/imports/students/preview', file, church)
        if (!current()) return
        if (!uuid(preview.id) || preview.state !== 'previewed' || preview.rows.length > 500) throw Error('Invalid preview')
        const key = crypto.randomUUID(), stored = recoveryFor(visible.actor, church, preview, { commit_key: key, row_ids: [], ministry_mappings: {} }, false)
        try { saveRecovery(stored) } catch { setState(value => ({ ...value, authorization: 'error', preview: null, error: 'Browser recovery storage is unavailable. Enable it before importing students.' })); return }
        receipt.current = stored
        setState(value => ({ ...value, preview, ministries, key, stage: 'Review and map', selected: new Set(preview.rows.filter(row => eligible(row, {}, ministries)).map(row => row.id)), mappings: {}, confirmed: false, plan: null, verified: true, accepted: false, error: '' }))
      } catch (failure) {
        if (!current()) return
        if (denied(failure)) { clear(safeAuthMessage(failure)); return }
        const messages = failure instanceof ApiError ? safeImportFileErrors(failure.fieldErrors?.file) : []
        setState(value => ({ ...value, error: messages.length ? messages.join(' ') : safeAuthMessage(failure) }))
      }
    })
  }

  async function reconcile(current: () => boolean) {
    const stored = receipt.current
    if (!stored) throw Error('No retained batch')
    setState(value => ({ ...value, stage: 'Results', verified: false, confirmed: false, error: '' }))
    try {
      const preview = await authRequest<Preview>(`/api/imports/${stored.batch}`, 'GET', undefined, church)
      if (!current()) return
      if (preview.id !== stored.batch) throw Error('Batch mismatch')
      const plan = recoverPlan(stored, preview)
      setState(value => ({ ...value, preview, plan, selected: new Set(plan.row_ids), mappings: plan.ministry_mappings, verified: true, error: '' }))
    } catch (failure) {
      if (current()) { if (denied(failure)) clear(safeAuthMessage(failure)); else setState(value => ({ ...value, error: 'Import result not confirmed. Check the same batch before trying again.' })) }
    }
  }

  async function commit() {
    if (visible.stage !== 'Confirm selected' || !visible.confirmed || !visible.preview || !visible.plan?.row_ids.length) return
    await operate(async current => {
      const ministries = await reverify(current), preview = visible.preview!, plan = visible.plan!
      if (!ministries) return
      if (preview.state !== 'previewed' || preview.rows.filter(row => plan.row_ids.includes(row.id)).some(row => !eligible(row, plan.ministry_mappings, ministries))) {
        setState(value => ({ ...value, ministries, stage: 'Review and map', confirmed: false, plan: null, selected: new Set([...value.selected].filter(id => preview.rows.some(row => row.id === id && eligible(row, value.mappings, ministries)))), error: 'Ministry availability changed. Review the selected rows and confirm again.' })); return
      }
      const stored = recoveryFor(visible.actor, church, preview, plan, true)
      try { saveRecovery(stored) } catch { setState(value => ({ ...value, confirmed: false, error: 'Browser recovery storage is unavailable. No import was submitted.' })); return }
      receipt.current = stored
      setState(value => ({ ...value, error: '', confirmed: false }))
      try {
        const result = await authRequest<components['schemas']['ImportCommitResult']>(`/api/imports/${preview.id}/commit`, 'POST', plan, church)
        if (!current()) return
        if (result.id === preview.id && result.state === 'completed') setState(value => ({ ...value, accepted: true }))
      } catch (failure) {
        if (!current()) return
        if (denied(failure)) { clear(safeAuthMessage(failure)); return }
        // Even a timeout may follow a committed transaction. Read this same
        // batch first; never rotate its key or submit a replacement automatically.
      }
      await reconcile(current)
    })
  }

  function select(id: string, checked: boolean) {
    if (busy || visible.stage !== 'Review and map' || !visible.preview?.rows.some(row => row.id === id && eligible(row, visible.mappings, visible.ministries))) return
    setState(value => { const selected = new Set(value.selected); if (checked) selected.add(id); else selected.delete(id); return { ...value, selected, confirmed: false, plan: null, error: '' } })
  }
  function map(name: string, id: string) {
    if (busy || visible.stage !== 'Review and map' || (id && !visible.ministries.some(item => item.id === id))) return
    setState(value => { const mappings = { ...value.mappings, [name]: id }; return { ...value, mappings, selected: new Set([...value.selected].filter(id => value.preview?.rows.some(row => row.id === id && eligible(row, mappings, value.ministries)))), confirmed: false, plan: null, error: '' } })
  }
  function review() {
    if (busy || visible.stage !== 'Review and map' || !visible.preview || !visible.selected.size) return
    setState(value => ({ ...value, stage: 'Confirm selected', confirmed: false, plan: makePlan(value.preview!, value.selected, value.mappings, value.key), error: '' }))
  }
  function back() {
    if (busy || !visible.preview || visible.preview.state !== 'previewed' || (visible.stage === 'Results' && (!visible.verified || visible.accepted))) return
    setState(value => ({ ...value, stage: 'Review and map', confirmed: false, plan: null, error: '' }))
  }
  function retry() {
    if (busy || visible.stage !== 'Results' || !visible.verified || visible.accepted || visible.preview?.state !== 'previewed' || !visible.plan?.row_ids.length) return
    setState(value => ({ ...value, stage: 'Confirm selected', selected: new Set(value.plan!.row_ids), mappings: value.plan!.ministry_mappings, confirmed: false, error: '' }))
  }
  function startAnother() {
    if (busy || (visible.stage === 'Results' && (!visible.verified || !['completed', 'expired', 'failed'].includes(visible.preview?.state ?? '')))) return
    // Deliberate new upload only after a known terminal batch, or before submission.
    if (receipt.current?.submitted && visible.stage !== 'Results') return
    if (visible.stage === 'Results' && visible.preview?.state === 'completed' && !outcomeCounts(visible.preview)) return
    setState(value => ({ ...value, stage: 'Upload', error: '', confirmed: false }))
  }
  const check = () => operate(async current => { if (await reverify(current)) await reconcile(current) })
  const template = () => operate(async current => { if (!await reverify(current)) return; const blob = await authDownload('/api/imports/template', church); if (current()) saveBlob(blob, 'ministrysprout-student-import.csv') })
  return { ...visible, busy, workspace, canChooseFile: !receipt.current?.submitted, refresh, upload, commit, select, map, review, back, retry, startAnother, check, template,
    acknowledge: (confirmed: boolean) => { if (!busy) setState(value => ({ ...value, confirmed })) } }
}
