import { useEffect, useRef, useState } from 'react'
import { useWorkspaceChurchId } from '../../app/workspace-context'
import { ErrorSummary, StepIndicator } from '../../components/ui/Foundations'
import { correctionsCsv, eligible, headers, outcomeCounts, type ImportRow } from './import-model'
import { saveBlob, useImportWizard, type Stage } from './useImportWizard'
import './import-wizard.css'

const stages: Stage[] = ['Upload', 'Review and map', 'Confirm selected', 'Results']
const studentName = (row: ImportRow) => [row.data.first_name ?? row.source.first_name, row.data.last_name ?? row.source.last_name].filter(Boolean).join(' ') || 'Needs correction'

export function ImportScreen() {
  const church = useWorkspaceChurchId(new URLSearchParams(location.search).get('church') ?? '')
  const wizard = useImportWizard(church), heading = useRef<HTMLHeadingElement>(null), error = useRef<HTMLDivElement>(null), pointer = useRef(false)
  const [mobile, setMobile] = useState(() => innerWidth <= 600)
  useEffect(() => { const resize = () => setMobile(innerWidth <= 600); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [])
  useEffect(() => {
    // Keyboard entry may start outside this section after a native touch action.
    const keyboard = () => { pointer.current = false }
    window.addEventListener('keydown', keyboard, true)
    return () => window.removeEventListener('keydown', keyboard, true)
  }, [])
  const { preview, selected, mappings, ministries, stage, busy } = wizard
  const counts = outcomeCounts(wizard.verified ? preview : null)
  const unknown = [...new Set(preview?.rows.flatMap(row => row.unknown_ministries) ?? [])]
  const readyRows = preview?.rows.filter(row => eligible(row, mappings, ministries)) ?? []
  const retryAllowed = wizard.verified && !wizard.accepted && preview?.state === 'previewed'
  useEffect(() => { heading.current?.focus() }, [stage])
  useEffect(() => { if (wizard.error) error.current?.focus() }, [wizard.error])
  function downloadCorrections() {
    if (preview && !busy && (stage !== 'Results' || counts)) saveBlob(new Blob([correctionsCsv(preview)], { type: 'text/csv;charset=utf-8' }), 'ministrysprout-import-corrections.csv')
  }

  return <section className="dashboard-card import-wizard" aria-labelledby="imports-heading"
    onPointerDownCapture={() => { pointer.current = true }} onPointerUpCapture={() => { pointer.current = false }} onPointerCancelCapture={() => { pointer.current = false }} onKeyDownCapture={() => { pointer.current = false }}
    onFocusCapture={event => {
      const target = event.target
      if (pointer.current) return
      const ensureVisible = () => {
        if (!target.isConnected || document.activeElement !== target) return
        const rect = target.getBoundingClientRect(), navigation = document.querySelector('.phone-navigation')?.getBoundingClientRect()
        if (rect.top < 4 || rect.bottom > (navigation?.height ? navigation.top : innerHeight) - 4) target.scrollIntoView?.({ block: 'start', inline: 'nearest' })
      }
      queueMicrotask(ensureVisible)
      // Check layout again after the browser's focus processing.
      globalThis.requestAnimationFrame?.(ensureVisible)
    }}>
    <p className="eyebrow">People · Owner · Online only</p><h2 id="imports-heading">Import students</h2>
    {wizard.workspace && <p>{wizard.workspace.name} · Verified church workspace</p>}
    {wizard.error && <div id="import-error"><ErrorSummary ref={error} message={wizard.error} errors={wizard.authorization === 'authorized' && stage === 'Upload' ? [{ target: 'student-spreadsheet', message: 'Check the student spreadsheet.' }] : []} /></div>}
    {wizard.authorization === 'loading' && <p role="status">Checking import authorization…</p>}
    {wizard.authorization === 'forbidden' && <p role="status">Student imports are available only to the church Owner with confirmed MFA.</p>}
    {wizard.authorization === 'error' && <button type="button" className="secondary" disabled={busy || !navigator.onLine} onClick={wizard.refresh}>Check account access</button>}
    {wizard.authorization === 'authorized' && <>
      <nav aria-label="Import stages"><StepIndicator className="import-steps" label="Import stages" steps={stages.map(name => ({ id: name, label: name }))} current={stage} /></nav>
      <h3 ref={heading} tabIndex={-1}>{stage}</h3>
      {busy && <p role="status">{stage === 'Upload' ? 'Checking access and inspecting spreadsheet…' : 'Checking access and the same import batch…'}</p>}
      {stage === 'Upload' && <>
        <p>Create new students from a reviewed spreadsheet. Import does not merge or update existing students.</p>
        <button className="secondary" type="button" disabled={busy} onClick={() => void wizard.template()}>Download CSV template</button>
        <form className="wizard-upload" onSubmit={event => { event.preventDefault(); const file = (event.currentTarget.elements.namedItem('file') as HTMLInputElement)?.files?.[0]; if (file) void wizard.upload(file) }}>
          <label htmlFor="student-spreadsheet">Student spreadsheet</label>
          <input id="student-spreadsheet" name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={busy} aria-describedby={`import-file-help${wizard.error ? ' import-error' : ''}`} aria-invalid={wizard.error ? true : undefined} />
          <small id="import-file-help">CSV or XLSX only · 5 MiB · 500 data rows. Preview never creates students. The server validates the file.</small>
          <button type="submit" disabled={busy}>Preview import</button>
        </form>
      </>}
      {stage === 'Review and map' && preview && <>
        <p>Review every selected row. Invalid rows and possible duplicates cannot be imported. Mapping a ministry makes a row eligible; select it deliberately.</p>
        <div className="wizard-counts" aria-label="Import row counts"><strong>{preview.rows.length} total</strong>{(['valid', 'invalid', 'duplicate', 'needs_mapping'] as const).map(kind => <strong key={kind}>{preview.counts[kind] ?? 'Unknown'} {kind.replace('_', ' ')}</strong>)}<strong>{readyRows.length} eligible</strong><strong>{selected.size} selected</strong></div>
        <p>Batch expires: <time dateTime={preview.expires_at}>{preview.expires_at}</time>. The server checks expiration at submission.</p>
        <div className="wizard-mappings">{unknown.map(name => <label key={name}>Map {name}<select value={Object.hasOwn(mappings, name) ? mappings[name] : ''} disabled={busy} onChange={event => wizard.map(name, event.target.value)}><option value="">Choose an existing ministry</option>{ministries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}</div>
        <div className="wizard-table-wrap" role="region" aria-label="Import preview rows" tabIndex={mobile ? -1 : 0}><table className="wizard-table"><caption>Authorized rows in this batch. Only selected eligible rows will be submitted.</caption><thead><tr><th scope="col">Select</th><th scope="col">Student and row</th><th scope="col">Eligibility</th><th scope="col">Inspect</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.id}>
          <td><label className="wizard-row-choice"><input type="checkbox" aria-label={`Approve row ${row.row_number}`} aria-describedby={`row-${row.id}`} checked={selected.has(row.id)} disabled={busy || !eligible(row, mappings, ministries)} onChange={event => wizard.select(row.id, event.target.checked)} /></label></td>
          <th scope="row" id={`row-${row.id}`}>{studentName(row)}<small>Row {row.row_number}</small></th>
          <td><span className={`wizard-status ${row.status}`}>{row.status.replace('_', ' ')}</span><small>{eligible(row, mappings, ministries) ? 'Eligible' : 'Not eligible'}</small></td>
          <td><RowInspection row={row} /></td>
        </tr>)}</tbody></table></div>
        <div className="wizard-actions"><button type="button" disabled={busy || selected.size === 0} onClick={wizard.review}>Review selected</button><button className="secondary" type="button" disabled={busy} onClick={downloadCorrections}>Download corrections CSV</button>{wizard.canChooseFile && <button className="secondary" type="button" disabled={busy} onClick={wizard.startAnother}>Choose another file</button>}</div>
      </>}
      {stage === 'Confirm selected' && preview && wizard.plan && <>
        <p><strong>{wizard.plan.row_ids.length} selected rows</strong> will create new student records in {wizard.workspace?.name ?? 'this verified church workspace'}. Unselected, invalid and duplicate rows will be skipped. Existing students will not be merged or updated.</p>
        <ul className="wizard-confirm-rows">{preview.rows.filter(row => wizard.plan!.row_ids.includes(row.id)).map(row => <li key={row.id}>{studentName(row)} · Row {row.row_number}<small>{row.ministry_names.length ? row.ministry_names.map(name => `${name}${Object.hasOwn(wizard.plan!.ministry_mappings, name) ? ` → ${ministries.find(item => item.id === wizard.plan!.ministry_mappings[name])?.name ?? 'Unavailable ministry'}` : ''}`).join(', ') : 'No ministry enrollment requested'}</small></li>)}</ul>
        <label className="wizard-ack"><input type="checkbox" checked={wizard.confirmed} disabled={busy} onChange={event => wizard.acknowledge(event.target.checked)} />I understand that this creates new student records for the selected rows and does not merge existing students.</label>
        <div className="wizard-actions"><button type="button" disabled={busy || !wizard.confirmed} onClick={() => void wizard.commit()}>Import {wizard.plan.row_ids.length} students</button><button className="secondary" type="button" disabled={busy} onClick={wizard.back}>Back to review</button></div>
      </>}
      {stage === 'Results' && <>
        {counts ? <><p role="status">{counts.imported} students imported.</p><p>{counts.skipped} rows skipped.</p><p>Failed row count is unavailable. Skipped rows are identified below.</p><ul className="wizard-result-rows">{preview!.rows.map(row => <li key={row.id}>{studentName(row)} · Row {row.row_number} · <strong>{row.outcome === 'committed' ? 'Imported' : row.outcome === 'duplicate' ? 'Skipped · Duplicate' : 'Skipped · Excluded'}</strong><RowInspection row={row} /></li>)}</ul><button className="secondary" type="button" disabled={busy} onClick={downloadCorrections}>Download corrections CSV</button></>
          : <p role="status">{wizard.verified && preview?.state === 'expired' ? 'This batch expired. No retry is available for this batch.' : wizard.verified && preview?.state === 'failed' ? 'This batch failed. No student import completion was reported.' : retryAllowed ? 'The same batch is still awaiting submission. Review before a deliberate retry.' : wizard.accepted ? 'The server accepted this batch. Row outcomes are not yet available; check the same batch.' : 'Imported, skipped and failed counts are unknown until the same batch reports its outcomes.'}</p>}
        <div className="wizard-actions">{!counts && <button className="secondary" type="button" disabled={busy} onClick={() => void wizard.check()}>Check same batch</button>}{retryAllowed && wizard.plan?.row_ids.length ? <button type="button" disabled={busy} onClick={wizard.retry}>Retry same selected rows</button> : null}{retryAllowed && <button className="secondary" type="button" disabled={busy} onClick={wizard.back}>Back to review</button>}{wizard.verified && (counts || ['expired', 'failed'].includes(preview?.state ?? '')) && <button className="secondary" type="button" disabled={busy} onClick={wizard.startAnother}>Upload another file</button>}</div>
      </>}
    </>}
    <a className="wizard-back" href={`/account/students${church ? `?church=${encodeURIComponent(church)}` : ''}`}>Back to students</a>
  </section>
}

function RowInspection({ row }: { row: ImportRow }) {
  return <details><summary>Inspect row {row.row_number}</summary><div><p>{row.errors.join(' ') || (row.outcome ? 'These are the original reviewed row details.' : row.unknown_ministries.length ? 'Map the unknown ministries before selecting this row.' : 'Validated student details.')}</p><dl>{headers.filter(name => Object.hasOwn(row.source, name)).map(name => <div key={name}><dt>{name.replaceAll('_', ' ')}</dt><dd>{row.source[name] || 'Not provided'}</dd></div>)}</dl>{row.ministry_names.length > 0 && <p>Requested ministries: {row.ministry_names.join(', ')}</p>}</div></details>
}
