import { useEffect, useMemo, useState } from 'react'
import type { components } from '../../api/generated'
import { authDownload, authRequest, authUpload, safeAuthMessage } from '../auth/transport'
import { csvCell } from './csv'

type Preview = components['schemas']['ImportPreview']
type Ministry = components['schemas']['Ministry']
type CommitResult = components['schemas']['ImportCommitResult']

const headers = ['first_name', 'last_name', 'middle_name', 'preferred_name', 'suffix', 'birthdate', 'gender', 'ministries', 'external_reference'] as const

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  URL.revokeObjectURL(url)
}

export function ImportScreen() {
  const [church, setChurch] = useState(() => new URLSearchParams(location.search).get('church') ?? '')
  const [selectedChurch, setSelectedChurch] = useState(church)
  const [owner, setOwner] = useState(false)
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [commitKey, setCommitKey] = useState('')
  const [completed, setCompleted] = useState<CommitResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!church) return
    let active = true
    void Promise.all([
      authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, church),
      authRequest<{ data: Ministry[] }>('/api/ministries', 'GET', undefined, church),
    ]).then(([me, list]) => {
      if (!active) return
      setOwner(me.memberships.some(item => item.church_id === church && item.status === 'active' && item.role === 'owner') && me.active_session.mfa_confirmed)
      setMinistries(list.data); setError('')
    }).catch(failure => { if (active) setError(safeAuthMessage(failure)) })
    return () => { active = false }
  }, [church])

  const unknown = useMemo(() => [...new Set(preview?.rows.flatMap(row => row.unknown_ministries) ?? [])], [preview])
  const selectedCount = selected.size

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('file') as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file) return
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      setError('Choose a CSV or XLSX file no larger than 5 MiB.'); return
    }
    setBusy(true); setCompleted(null)
    try {
      const result = await authUpload<Preview>('/api/imports/students/preview', file, church)
      setPreview(result)
      setSelected(new Set(result.rows.filter(row => row.status === 'valid').map(row => row.id)))
      setMappings({}); setCommitKey(crypto.randomUUID()); setError('')
    } catch (failure) { setError(safeAuthMessage(failure)) }
    finally { setBusy(false) }
  }

  function toggle(rowId: string, checked: boolean) {
    setSelected(current => {
      const next = new Set(current)
      if (checked) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }

  async function commit() {
    if (!preview || !commitKey || selectedCount === 0) return
    const selectedRows = preview.rows.filter(row => selected.has(row.id))
    if (selectedRows.some(row => row.unknown_ministries.some(name => !mappings[name]))) {
      setError('Map every unknown ministry before approving its row.'); return
    }
    const requiredMappings = Object.fromEntries(selectedRows.flatMap(row => row.unknown_ministries).map(name => [name, mappings[name]]))
    setBusy(true)
    try {
      const result = await authRequest<CommitResult>(`/api/imports/${preview.id}/commit`, 'POST', {
        commit_key: commitKey, row_ids: selectedRows.map(row => row.id), ministry_mappings: requiredMappings,
      }, church)
      setCompleted(result); setError('')
    } catch (failure) { setError(safeAuthMessage(failure)) }
    finally { setBusy(false) }
  }

  async function downloadTemplate() {
    try { saveBlob(await authDownload('/api/imports/template', church), 'ministrysprout-student-import.csv') }
    catch (failure) { setError(safeAuthMessage(failure)) }
  }

  function downloadErrors() {
    if (!preview) return
    const rows = preview.rows.filter(row => row.status !== 'valid')
    const text = [headers.join(','), ...rows.map(row => headers.map(header => csvCell(row.source[header])).join(','))].join('\r\n') + '\r\n'
    saveBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), 'ministrysprout-import-corrections.csv')
  }

  return <section className="auth-card import-card" aria-labelledby="imports-heading">
    <p className="eyebrow">Church workspace · Owner · Online only</p><h2 id="imports-heading">Import students</h2>
    {!church && <form onSubmit={event => { event.preventDefault(); setChurch(selectedChurch) }}><label htmlFor="import-church">Church workspace ID</label><input id="import-church" required value={selectedChurch} onChange={event => setSelectedChurch(event.target.value)} /><button>Open workspace</button></form>}
    {error && <p role="alert">{error}</p>}
    {church && owner && <>
      <div className="import-actions"><button className="secondary" type="button" onClick={() => void downloadTemplate()}>Download CSV template</button></div>
      <form className="import-upload" onSubmit={event => void upload(event)}>
        <label htmlFor="student-spreadsheet">Student spreadsheet</label>
        <input id="student-spreadsheet" name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        <small>CSV or XLSX only · 5 MiB · 500 data rows. Preview never creates students.</small>
        <button type="submit" disabled={busy}>{busy ? 'Inspecting…' : 'Preview import'}</button>
      </form>
    </>}
    {church && !owner && !error && <p role="status">Student imports are available only to the church Owner with confirmed MFA.</p>}
    {preview && <section aria-labelledby="preview-heading">
      <h3 id="preview-heading">Preview</h3>
      <div className="import-counts" aria-label="Import row counts">
        <strong>{preview.counts.valid} valid</strong><strong>{preview.counts.invalid} invalid</strong>
        <strong>{preview.counts.duplicate} duplicate</strong><strong>{preview.counts.needs_mapping} needs mapping</strong>
      </div>
      {unknown.map(name => <label key={name}>Map {name}<select value={mappings[name] ?? ''} onChange={event => setMappings(current => ({ ...current, [name]: event.target.value }))}>
        <option value="">Choose an existing ministry</option>{ministries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>)}
      <div className="import-table-wrap"><table className="import-table"><thead><tr><th>Approve</th><th>Row</th><th>Student</th><th>Status</th><th>Details</th></tr></thead><tbody>
        {preview.rows.map(row => {
          const selectable = row.status === 'valid' || (row.status === 'needs_mapping' && row.unknown_ministries.every(name => Boolean(mappings[name])))
          return <tr key={row.id}><td><input type="checkbox" aria-label={`Approve row ${row.row_number}`} checked={selected.has(row.id)} disabled={!selectable || completed !== null} onChange={event => toggle(row.id, event.target.checked)} /></td>
            <td>{row.row_number}</td><td>{[row.data.first_name ?? row.source.first_name, row.data.last_name ?? row.source.last_name].filter(Boolean).join(' ') || 'Needs correction'}</td>
            <td><span className={`import-status ${row.status}`}>{row.status.replace('_', ' ')}</span></td>
            <td>{row.errors.join(' ') || row.unknown_ministries.join(', ') || 'Ready'}</td></tr>
        })}
      </tbody></table></div>
      <div className="import-actions">
        {preview.rows.some(row => row.status !== 'valid') && <button className="secondary" type="button" onClick={downloadErrors}>Download corrections CSV</button>}
        <button type="button" disabled={busy || selectedCount === 0 || completed !== null} onClick={() => void commit()}>Commit {selectedCount} students</button>
      </div>
    </section>}
    {completed?.state === 'completed' && <p role="status">{completed.counts.committed} students imported.</p>}
    <a href={`/students${church ? `?church=${encodeURIComponent(church)}` : ''}`}>Back to students</a>
  </section>
}
