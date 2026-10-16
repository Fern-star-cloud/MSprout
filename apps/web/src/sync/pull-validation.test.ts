import { describe, expect, it } from 'vitest'
import { validatePullPage, SyncDownloadError } from './pull-validation'
import { ids, profile, testNow, validPage } from './__tests__/pull-fixtures'

describe('whole synchronization page validation', () => {
  it('accepts the current producer, optional nulls, metadata and filtered sequence gaps', () => {
    const page = validPage()
    Object.assign(page.changes[0].payload, { diagnostic_metadata: { future: true } })
    expect(validatePullPage(page, '1', profile, testNow)).toBe(page)
  })

  const invalid: Array<[string, (page: ReturnType<typeof validPage>) => void]> = [
    ['future late', page => { page.changes[0].payload.records[0].state = 'late' }],
    ['unknown record state', page => { page.changes[0].payload.records[0].state = 'excused' }],
    ['unknown entity', page => { page.changes[0].entity_type = 'future_entity' }],
    ['unsupported action pair', page => { page.changes[0].action = 'tombstone' }],
    ['invalid entity UUID', page => { page.changes[0].entity_id = 'wrong' }],
    ['invalid version', page => { page.changes[0].version = 1.5 }],
    ['unsafe version', page => { page.changes[0].version = Number.MAX_SAFE_INTEGER + 1 }],
    ['null ministry', page => { Object.assign(page.changes[0], { ministry_id: null }) }],
    ['mismatched payload id', page => { page.changes[0].payload.id = ids.guest }],
    ['mismatched payload version', page => { page.changes[0].payload.version = 3 }],
    ['mismatched ministry', page => { page.changes[0].payload.ministry_id = ids.guest }],
    ['invalid date', page => { page.changes[0].payload.attendance_date = '2026-02-30' }],
    ['unknown session status', page => { page.changes[0].payload.status = 'future_status' }],
    ['coerced session status', page => { Object.assign(page.changes[0].payload, { status: ['draft'] }) }],
    ['invalid record id', page => { page.changes[0].payload.records[0].id = '' }],
    ['invalid student id', page => { page.changes[0].payload.records[0].student_id = 'wrong' }],
    ['invalid record version', page => { page.changes[0].payload.records[0].version = 0 }],
    ['duplicate record', page => { page.changes[0].payload.records.push(page.changes[0].payload.records[0]) }],
    ['unknown guest state', page => { page.changes[0].payload.guests[0].state = 'late' }],
    ['unknown guest status', page => { page.changes[0].payload.guests[0].status = 'future_status' }],
    ['unknown gender', page => { page.changes[0].payload.guests[0].gender = 'future_gender' }],
    ['empty guest name', page => { page.changes[0].payload.guests[0].display_name = '' }],
    ['invalid optional guest identity', page => { Object.assign(page.changes[0].payload.guests[0], { resolved_student_id: 4 }) }],
    ['duplicate guest', page => { page.changes[0].payload.guests.push(page.changes[0].payload.guests[0]) }],
    ['malformed record', page => { Object.assign(page.changes[0].payload, { records: [null] }) }],
    ['malformed guests', page => { Object.assign(page.changes[0].payload, { guests: {} }) }],
    ['missing guest collection', page => { Reflect.deleteProperty(page.changes[0].payload, 'guests') }],
    ['invalid nullable timestamp', page => { Object.assign(page.changes[0].payload, { finalized_at: 1 }) }],
    ['unsupported deleted session', page => { Object.assign(page.changes[0].payload, { deleted_at: '2026-10-16T00:00:00Z' }) }],
    ['unsupported deleted record', page => { Object.assign(page.changes[0].payload.records[0], { deleted_at: '2026-10-16T00:00:00Z' }) }],
    ['numeric sequence', page => { Object.assign(page.changes[0], { sequence: 3 }) }],
    ['decreasing cursor', page => { page.page.next_cursor = '0' }],
    ['cursor before change', page => { page.page.next_cursor = '2' }],
    ['duplicate sequence', page => { page.changes.push(page.changes[0]) }],
    ['invalid membership', page => { page.lease.membership_id = 'wrong' }],
    ['wrong actor', page => { page.lease.actor_id = '12' }],
    ['wrong device', page => { page.lease.device_id = ids.guest }],
    ['wrong church', page => { page.lease.church_id = ids.guest }],
    ['invalid signature', page => { page.lease.signature = 'wrong' }],
    ['invalid issued date', page => { page.lease.issued_at = 'not-a-date' }],
    ['expired replacement lease', page => { page.lease.expires_at = '2026-10-15T00:00:00Z' }],
  ]
  it.each(invalid)('refuses %s without exposing response values', (_label, mutate) => {
    const page = validPage(); mutate(page)
    expect(() => validatePullPage(page, '1', profile, testNow)).toThrow(SyncDownloadError)
    try { validatePullPage(page, '1', profile, testNow) } catch (error) { expect(String(error)).not.toMatch(/Synthetic guest|00000000|future_status|excused/) }
  })
  it.each([null, [], {}, { changes: null }])('refuses malformed envelopes %j', page => {
    expect(() => validatePullPage(page, '1', profile, testNow)).toThrow(SyncDownloadError)
  })
  it.each(['draft', 'finalized_pending', 'finalized', 'needs_review', 'revised'])('accepts the existing contract status %s', status => {
    const page = validPage(); page.changes[0].payload.status = status
    expect(validatePullPage(page, '1', profile, testNow)).toBe(page)
  })
})
