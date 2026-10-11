// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { correctionsCsv, eligible, makePlan, outcomeCounts, readRecovery, recoverPlan, recoveryFor, saveRecovery, type Preview } from './import-model'

const church = '11111111-1111-4111-8111-111111111111', batch = '22222222-2222-4222-8222-222222222222'
const ministry = '33333333-3333-4333-8333-333333333333', rowId = '44444444-4444-4444-8444-444444444444', key = '55555555-5555-4555-8555-555555555555'
const preview: Preview = { id: batch, state: 'previewed', expires_at: '2099-01-01T00:00:00Z', counts: { valid: 0, invalid: 0, duplicate: 0, needs_mapping: 1 }, rows: [{ id: rowId, row_number: 2, status: 'needs_mapping', source: { first_name: 'Synthetic', last_name: 'Mapped' }, data: { first_name: 'Synthetic', last_name: 'Mapped', gender: 'unspecified' }, ministry_names: ['Unknown Group'], ministry_ids: [], unknown_ministries: ['Unknown Group'], errors: [], outcome: null }] }
const ministries = [{ id: ministry, name: 'Primary', status: 'active' as const, version: 1 }]
afterEach(() => sessionStorage.clear())

it('requires active authorized ministry identifiers, including for previously valid rows', () => {
  const row = preview.rows[0]
  expect(eligible(row, { 'Unknown Group': ministry }, ministries)).toBe(true)
  expect(eligible(row, { 'Unknown Group': church }, ministries)).toBe(false)
  expect(eligible(row, { 'Unknown Group': ministry }, [{ ...ministries[0], status: 'archived' }])).toBe(false)
  expect(eligible({ ...row, status: 'valid', unknown_ministries: [], ministry_ids: [church] }, {}, ministries)).toBe(false)
  expect(eligible({ ...row, unknown_ministries: ['constructor'] }, {}, ministries)).toBe(false)
})

it('reconstructs exactly the original batch key, selected rows and mapping after restart without storing child data', () => {
  const plan = makePlan(preview, new Set([rowId]), { 'Unknown Group': ministry }, key)
  saveRecovery(recoveryFor(11, church, preview, plan, true))
  const stored = Object.values(sessionStorage).join('')
  expect(stored).not.toMatch(/Synthetic|Mapped|Unknown Group|first_name/)
  expect(recoverPlan(readRecovery(church, 11)!, preview)).toEqual(plan)
  expect(readRecovery(church, 12)).toBeNull()
  expect(readRecovery(ministry, 11)).toBeNull()
})

it('rejects changed batch identity or missing selected rows during recovery', () => {
  const receipt = recoveryFor(11, church, preview, makePlan(preview, new Set([rowId]), { 'Unknown Group': ministry }, key), true)
  expect(() => recoverPlan(receipt, { ...preview, id: church })).toThrow()
  expect(() => recoverPlan(receipt, { ...preview, rows: [] })).toThrow()
  expect(() => recoverPlan({ ...receipt, mappings: [] }, preview)).toThrow()
})

it('does not fabricate zero results when completed row outcomes are unavailable', () => {
  expect(outcomeCounts(preview)).toBeNull()
  expect(outcomeCounts({ ...preview, state: 'completed' })).toBeNull()
  expect(outcomeCounts({ ...preview, state: 'completed', rows: [{ ...preview.rows[0], outcome: 'committed' }] })).toEqual({ imported: 1, skipped: 0 })
})

it('excludes accepted mapped rows from correction CSV and escapes formulas, quotes, separators and line breaks', () => {
  const accepted = { ...preview.rows[0], outcome: 'committed' as const }
  const excluded = { ...accepted, id: church, status: 'invalid' as const, outcome: 'excluded' as const, source: { first_name: '  =SUM(1)', last_name: '"Quoted",\r\nSynthetic' } }
  const csv = correctionsCsv({ ...preview, state: 'completed', rows: [accepted, excluded] })
  expect(csv).not.toContain('Mapped')
  expect(csv).toContain("'  =SUM(1)")
  expect(csv).toContain('""Quoted"",\r\nSynthetic')
  expect(csv.split('\r\n')[0]).toBe('first_name,last_name,middle_name,preferred_name,suffix,birthdate,gender,ministries,external_reference')
})
