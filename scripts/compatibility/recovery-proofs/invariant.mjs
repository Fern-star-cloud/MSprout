// Intentionally failing baseline assertions. Explicit invocation only, outside CI discovery.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const [id, file] = process.argv.slice(2)
const data = JSON.parse(readFileSync(file, 'utf8'))
switch (id) {
  case 'B4-01':
    assert.equal(data.after.state, data.remote.state, 'Completion requires authoritative attendance reconstruction')
    break
  case 'B4-02':
    assert.ok(data.pruned.remaining > 0, 'An active device must not lose an unapplied served page')
    break
  case 'B4-03':
    assert.ok(!['accepted', 'conflict', 'rejected'].includes(data.lostOriginalAfterExpiry.results[0].status), 'Expired receipt uncertainty must not be freshly settled')
    break
  case 'B4-04':
    assert.ok(!data.lateRowStillExists || data.secondChanges > 0, 'A committed earlier sequence must not be skipped')
    break
  case 'B4-05':
    assert.equal(data.overwritten.state, data.edited.state, 'Prepared download must not overwrite a newer local edit')
    break
  default: throw Error('Unknown safety invariant')
}
