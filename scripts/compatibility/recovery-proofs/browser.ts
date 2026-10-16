import { createOfflineDatabase, type OfflineDatabase } from '../../../apps/web/src/offline/db'
import { LocalProfileStore } from '../../../apps/web/src/offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../../apps/web/src/offline/schema'
import { SyncClient, type SyncProfileAccess } from '../../../apps/web/src/sync/sync-client'
import { AttendanceRepository } from '../../../apps/web/src/features/attendance/attendance-repository'
import { readSyncStatus, syncHeadline } from '../../../apps/web/src/features/synchronization/sync-status'

type Command = Record<string, unknown>
type Json = Record<string, unknown>
declare global { interface Window { p1Server(command: Command): Promise<unknown>; p1: { run(): Promise<unknown> } } }
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const must = (value: unknown, message: string) => { if (!value) throw Error(message) }
const server = async <T>(command: Command): Promise<T> => {
  const value = await window.p1Server(command)
  if (value && typeof value === 'object' && 'error' in value) throw Error(JSON.stringify(value))
  return value as T
}
function barrier() {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}
const retained: Array<{ db: OfflineDatabase; store: LocalProfileStore }> = []
async function setup() {
  await server({ command: 'seed' })
  const name = `p1-disposable-${crypto.randomUUID()}`
  const db = createOfflineDatabase(name)
  const store = new LocalProfileStore(db)
  retained.push({ db, store })
  const profile = await store.createProfile({ actorId: '11', churchId: uuid(10), pin: '731946', deviceId: crypto.randomUUID() })
  await store.unlockProfile(profile.id, '731946')
  const boot = await server<OfflineBootstrap>({ command: 'bootstrap', device: profile.deviceId })
  await store.saveBootstrap(profile.id, boot, { preparationOnly: true })
  const codec: SyncProfileAccess = {
    isUnlocked: id => store.isUnlocked(id),
    encrypt: (id, purpose, value) => store.encryptLocalPayload(id, purpose, value),
    decrypt: (id, purpose, value) => store.decryptLocalPayload(id, purpose, value),
  }
  const fetcher: typeof fetch = async (url, init) => {
    // Laravel kernel is in testing mode; this transport fixture is not a real CSRF qualification.
    if (String(url).includes('/sanctum/csrf-cookie')) return new Response(null, { status: 204 })
    if (String(url).includes('/push')) return Response.json((await server<{ body: unknown }>({ command: 'push', body: JSON.parse(String(init?.body)) })).body)
    const cursor = new URL(String(url), location.origin).searchParams.get('cursor')
    return Response.json((await server<{ body: unknown }>({ command: 'pull', cursor, device: profile.deviceId })).body)
  }
  const client = new SyncClient(db, codec, { fetcher, maxAttempts: 1 })
  const repo = new AttendanceRepository(db, codec)
  const draft = await repo.createDraft({ profileId: profile.id, churchId: uuid(10), ministryId: uuid(20), ministryName: 'P1 synthetic ministry', attendanceDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date()), students: [{ id: uuid(31), displayName: 'P1 synthetic', gender: 'unspecified' }] })
  await client.syncProfile(profile.id)
  must(await repo.countPending(profile.id) === 0, 'Initial real receipt did not settle creation')
  return { db, store, codec, client, repo, draft, profile, fetcher, name }
}
async function markServer(profile: ProfileRecord, session: string) {
  const result = await server<{ body: { results: Array<{ status: string }> } }>({ command: 'push', body: { device_id: profile.deviceId, batch_id: crypto.randomUUID(), events: [{ client_event_id: crypto.randomUUID(), entity_id: session, action: 'attendance.student_marked', base_version: 1, occurred_at: new Date().toISOString(), payload: { student_id: uuid(31), state: 'present' } }] } })
  must(result.body.results[0].status === 'accepted', 'Real server marking control failed')
}
async function state(db: OfflineDatabase, repo: AttendanceRepository, profile: ProfileRecord, draft: { attendanceDate: string }) {
  const saved = await repo.findDraft(profile.id, uuid(20), draft.attendanceDate)
  return { cursor: await db.serverCursors.get(profile.id), state: saved?.entries[0].state, version: saved?.version, events: await repo.listEvents(profile.id) }
}
async function missingHistory() {
  const x = await setup()
  const before = await state(x.db, x.repo, x.profile, x.draft)
  await markServer(x.profile, x.draft.id)
  const pruned = await server<Json>({ command: 'age-prune', expire: true })
  must(pruned.remaining === 0 && pruned.flag === false, 'Pruning-before-cleanup witness failed')
  const boot = await server<OfflineBootstrap>({ command: 'bootstrap', device: x.profile.deviceId })
  must(!('attendance' in boot) && boot.server_cursor === '0', 'Bootstrap attendance/head witness changed')
  await x.store.saveBootstrap(x.profile.id, boot, { preserveCursor: true })
  const summary = await x.client.syncProfile(x.profile.id)
  const after = await state(x.db, x.repo, x.profile, x.draft)
  const remote = await server<{ state: string }>({ command: 'state' })
  const status = await readSyncStatus(x.profile.id, x.db, x.store)
  const headline = syncHeadline(status)
  must(before.state === 'unmarked' && after.state === 'unmarked' && remote.state === 'present' && headline === 'Synchronization complete', 'False-completion witness not reproduced')
  return { verdict: 'REPRODUCED', before, after, remote, pruned, summary, status, headline, safetyAssertion: { expected: 'authoritative present state or incomplete recovery', actual: 'stale unmarked state and complete status', expectedExitStatus: 1 } }
}
async function servedNotApplied() {
  const x = await setup(); await markServer(x.profile, x.draft.id)
  const before = await state(x.db, x.repo, x.profile, x.draft)
  const encryptedBefore = JSON.stringify(await x.db.encryptedBlobs.toArray())
  const served = await server<{ body: { page: { next_cursor: string } } }>({ command: 'pull', device: x.profile.deviceId, cursor: before.cursor?.cursor })
  const pruned = await server<{ remaining: number }>({ command: 'age-prune', expire: false })
  const after = await state(x.db, x.repo, x.profile, x.draft)
  must(JSON.stringify(before) === JSON.stringify(after) && encryptedBefore === JSON.stringify(await x.db.encryptedBlobs.toArray()) && pruned.remaining === 0 && served.body.page.next_cursor !== after.cursor?.cursor, 'Unapplied response witness changed')
  const control = await setup(); await markServer(control.profile, control.draft.id)
  const protectedRows = await server<{ remaining: number }>({ command: 'age-prune', expire: false })
  must(protectedRows.remaining === 1, 'Unadvanced active floor did not protect the unseen page')
  return { verdict: 'REPRODUCED', before, after, servedCursor: served.body.page.next_cursor, encryptedAuthorizationUnchanged: true, pruned, unappliedFloorControl: protectedRows, cursorStorage: 'Existing serverCursors row is plaintext metadata; bound attendance/authorization use real AES-GCM', safetyAssertion: { expected: 'unapplied page retained', actual: 'served page pruned', expectedExitStatus: 1 } }
}
async function staleDownload() {
  const x = await setup(); await markServer(x.profile, x.draft.id)
  const entered = barrier(), resume = barrier(); let paused = false
  const pausedCodec: SyncProfileAccess = { ...x.codec, encrypt: async (id, purpose, value) => {
    if (purpose.startsWith('attendance-draft:') && !paused) { paused = true; entered.release(); await resume.promise }
    return x.codec.encrypt(id, purpose, value)
  } }
  const stale = new SyncClient(x.db, pausedCodec, { fetcher: x.fetcher, maxAttempts: 1 }).syncProfile(x.profile.id)
  await entered.promise
  const second = createOfflineDatabase(x.name)
  const concurrent = new AttendanceRepository(second, x.codec)
  await concurrent.markStudent(x.profile.id, x.draft.id, uuid(31), 'absent')
  const edited = await state(second, concurrent, x.profile, x.draft)
  must(edited.state === 'absent' && edited.events.length === 1, 'Concurrent legitimate edit did not commit')
  resume.release(); await stale
  const overwritten = await state(x.db, x.repo, x.profile, x.draft)
  must(overwritten.state === 'present' && JSON.stringify(overwritten.events) === JSON.stringify(edited.events), 'Stale-download witness not reproduced')
  // Existing CAS positive control: stale ordinary edit must be rejected.
  const y = await setup(), gate = barrier(), release = barrier(); let once = false
  const ordinaryCodec: SyncProfileAccess = { ...y.codec, encrypt: async (id, purpose, value) => {
    if (purpose.startsWith('attendance-draft:') && !once) { once = true; gate.release(); await release.promise }
    return y.codec.encrypt(id, purpose, value)
  } }
  const ordinary = new AttendanceRepository(y.db, ordinaryCodec).markStudent(y.profile.id, y.draft.id, uuid(31), 'present').then(() => 'incorrectly accepted', error => String(error.message))
  await gate.promise
  const otherDb = createOfflineDatabase(y.name)
  await new AttendanceRepository(otherDb, y.codec).markStudent(y.profile.id, y.draft.id, uuid(31), 'absent')
  release.release(); const outcome = await ordinary
  must(outcome.includes('changed on this device'), 'Existing ordinary CAS protection failed')
  second.close(); otherDb.close()
  return { verdict: 'REPRODUCED', separateIndexedDbConnections: true, edited, overwritten, originalPendingEventsUnchanged: true, ordinaryEditControl: outcome, scope: 'actual SyncClient download preparation, not an implemented recovery generation or physical multi-window upgrade', safetyAssertion: { expected: 'stale preparation refused', actual: 'download overwrites draft but original pending event remains', expectedExitStatus: 1 } }
}
async function workload() {
  const x = await setup(); const samples = []
  for (const sessions of [100, 1000, 10000]) {
    const start = performance.now(); let bytes = 0, pages = 0
    for (let offset = 0; offset < sessions; offset += 100) {
      const values = Array.from({ length: Math.min(100, sessions - offset) }, (_, i) => ({ id: uuid(100000 + offset + i), ministry_id: uuid(20), version: 1, status: 'finalized', records: Array.from({ length: 30 }, (_, j) => ({ id: uuid(200000 + j), student_id: uuid(300000 + j), state: 'present', version: 1 })) }))
      bytes += new TextEncoder().encode(JSON.stringify(values)).length
      const encrypted = await x.codec.encrypt(x.profile.id, `p1-workload:${sessions}:${pages}`, values)
      await x.db.encryptedBlobs.put({ profileId: x.profile.id, key: `p1-workload:${sessions}:${pages}`, encrypted, updatedAt: new Date().toISOString() }); pages++
    }
    samples.push({ sessions, recordsPerSession: 30, pages, plaintextBytes: bytes, serializationEncryptionAndStageMs: performance.now() - start, modeledTransferSeconds: { '64kbit': bytes / 8000, '256kbit': bytes / 32000, '1Mbit': bytes / 125000 } })
  }
  return { measured: 'real browser JSON, AES-GCM and IndexedDB staging only', notMeasured: 'future snapshot SQL capture, mobile device speed or real network throughput', samples }
}
window.p1 = { run: async () => {
  const results: Record<string, unknown> = {}
  results['B4-01'] = await missingHistory()
  results['B4-02'] = await servedNotApplied()
  results['B4-05'] = await staleDownload()
  try { results.workload = await workload() } catch (error) { results.workload = { status: 'BLOCKED', reason: String(error) } }
  const status = document.getElementById('status')!
  status.textContent = JSON.stringify(results, null, 2); status.style.whiteSpace = 'pre-wrap'
  for (const x of retained) { x.store.dispose(); x.db.close() }
  return results
} }
