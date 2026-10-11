import type { components } from '../../api/generated'
import { csvCell } from './csv'

export type Preview = components['schemas']['ImportPreview']
export type ImportRow = components['schemas']['ImportRow']
export type Ministry = components['schemas']['Ministry']
export type CommitPlan = { commit_key: string; row_ids: string[]; ministry_mappings: Record<string, string> }
export type Recovery = { version: 1; actor: number; church: string; batch: string; key: string; submitted: boolean; rows: string[]; mappings: { row: string; index: number; ministry: string }[] }
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)
const storageKey = (church: string, actor: number) => `msprout:import-recovery:${church}:${actor}`

export function eligible(row: ImportRow, mappings: Record<string, string>, ministries: Ministry[]): boolean {
  const active = new Set(ministries.filter(item => item.status === 'active').map(item => item.id))
  return ['valid', 'needs_mapping'].includes(row.status) && row.ministry_ids.every(id => active.has(id))
    && row.unknown_ministries.every(name => Object.hasOwn(mappings, name) && active.has(mappings[name]))
}

export function makePlan(preview: Preview, selected: Set<string>, mappings: Record<string, string>, key: string): CommitPlan {
  const rows = preview.rows.filter(row => selected.has(row.id))
  return { commit_key: key, row_ids: rows.map(row => row.id), ministry_mappings: Object.fromEntries(rows.flatMap(row => row.unknown_ministries).map(name => [name, mappings[name]])) }
}

export function recoveryFor(actor: number, church: string, preview: Preview, plan: CommitPlan, submitted: boolean): Recovery {
  const seen = new Set<string>()
  const mappings = preview.rows.filter(row => plan.row_ids.includes(row.id)).flatMap(row => row.unknown_ministries.flatMap((name, index) => {
    if (seen.has(name)) return []
    seen.add(name)
    return [{ row: row.id, index, ministry: plan.ministry_mappings[name] }]
  }))
  return { version: 1, actor, church, batch: preview.id, key: plan.commit_key, submitted, rows: plan.row_ids, mappings }
}

// Same-tab recovery stores UUIDs and indexes only, never spreadsheet contents,
// child details, ministry names, credentials, or offline/profile data.
export function saveRecovery(receipt: Recovery): void {
  const key = storageKey(receipt.church, receipt.actor), text = JSON.stringify(receipt)
  sessionStorage.setItem(key, text)
  if (sessionStorage.getItem(key) !== text) throw Error('Import recovery unavailable')
}

export function readRecovery(church: string, actor: number): Recovery | null {
  const text = sessionStorage.getItem(storageKey(church, actor))
  if (!text) return null
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object') throw Error('Invalid import recovery')
  const item = value as Recovery
  if (item.version !== 1 || item.actor !== actor || item.church !== church || !uuid(item.batch) || !uuid(item.key)
    || typeof item.submitted !== 'boolean' || !Array.isArray(item.rows) || item.rows.length > 500 || !item.rows.every(uuid)
    || new Set(item.rows).size !== item.rows.length || !Array.isArray(item.mappings) || item.mappings.length > 125000
    || !item.mappings.every(pair => pair && uuid(pair.row) && item.rows.includes(pair.row) && uuid(pair.ministry) && Number.isInteger(pair.index) && pair.index >= 0 && pair.index < 500)) throw Error('Invalid import recovery')
  return item
}

export function recoverPlan(receipt: Recovery, preview: Preview): CommitPlan {
  if (receipt.batch !== preview.id || !receipt.rows.every(id => preview.rows.some(row => row.id === id))) throw Error('Batch recovery mismatch')
  const pairs = receipt.mappings.map(pair => {
    const row = preview.rows.find(row => row.id === pair.row), name = row?.unknown_ministries[pair.index]
    if (!name) throw Error('Batch mapping mismatch')
    return [name, pair.ministry] as const
  })
  const mappings = Object.fromEntries(pairs)
  if (pairs.some(([name, ministry]) => mappings[name] !== ministry)
    || preview.rows.filter(row => receipt.rows.includes(row.id)).some(row => row.unknown_ministries.some(name => !Object.hasOwn(mappings, name)))) throw Error('Incomplete batch recovery')
  return { commit_key: receipt.key, row_ids: [...receipt.rows], ministry_mappings: mappings }
}

export const headers = ['first_name', 'last_name', 'middle_name', 'preferred_name', 'suffix', 'birthdate', 'gender', 'ministries', 'external_reference'] as const
export function correctionsCsv(preview: Preview): string {
  const rows = preview.rows.filter(row => preview.state === 'completed' ? row.outcome !== 'committed' : row.status !== 'valid')
  return [headers.join(','), ...rows.map(row => headers.map(header => csvCell(row.source[header])).join(','))].join('\r\n') + '\r\n'
}

export function outcomeCounts(preview: Preview | null): { imported: number; skipped: number } | null {
  if (preview?.state !== 'completed' || preview.rows.some(row => !['committed', 'excluded', 'duplicate'].includes(row.outcome ?? ''))) return null
  return { imported: preview.rows.filter(row => row.outcome === 'committed').length, skipped: preview.rows.filter(row => ['excluded', 'duplicate'].includes(row.outcome ?? '')).length }
}
