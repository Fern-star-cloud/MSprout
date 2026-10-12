// Probe Docker's actual ignore handling with synthetic files only. Never copy a
// working API directory, database, upload, credential or configuration cache.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

// This is local qualification authority, never a remote Docker operation.
let endpoint = process.env.DOCKER_CONTEXT ? undefined : process.env.DOCKER_HOST
if (!endpoint) {
  const inspection = spawnSync('docker', ['context', 'inspect', ...(process.env.DOCKER_CONTEXT ? [process.env.DOCKER_CONTEXT] : [])], { encoding: 'utf8' })
  if (inspection.status !== 0) throw Error('Local Docker context could not be verified')
  endpoint = JSON.parse(inspection.stdout)[0]?.Endpoints?.docker?.Host
}
if (typeof endpoint !== 'string' || !/^(?:npipe:\/{4}\.\/pipe\/[^/?#]+|unix:\/{3}[^?#]+)$/.test(endpoint)) {
  throw Error('A local Docker pipe or socket is required; remote endpoints are refused')
}

const repository = fs.realpathSync(new URL('..', import.meta.url))
const evidence = path.join(repository, '.git', 'msprout-ui16-20261012')
const probeId = crypto.randomUUID()
const context = path.join(evidence, `api-context-${probeId}`)
const tag = `ministrysprout-context-probe:${probeId}`
const excluded = [
  '.env', '.env.production',
  'database/database.sqlite', 'database/database.sqlite-wal', 'database/database.sqlite-shm',
  'database/offline.sqlite3', 'database/legacy.db',
  'storage/app/private/import.csv', 'storage/app/public/avatar.png',
  'storage/framework/cache/data/probe.php', 'storage/framework/sessions/probe',
  'storage/framework/views/probe.php', 'storage/logs/laravel.log',
  'bootstrap/cache/config.php', 'bootstrap/cache/routes-v7.php',
  'tests/probe.php', 'vendor/autoload.php',
]
const retained = ['artisan', 'config/app.php', 'bootstrap/app.php', 'database/migrations/probe.php']
fs.mkdirSync(context, { recursive: true })
for (const file of [...excluded, ...retained]) {
  const target = path.join(context, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, 'Synthetic qualification fixture.\n', { flag: 'wx' })
}
const ignore = fs.readFileSync(path.join(repository, 'apps/api/.dockerignore'))
fs.writeFileSync(path.join(context, '.dockerignore'), ignore, { flag: 'wx' })
const checks = [
  ...retained.map(file => `test -f /probe/${file} || { echo MISSING_SOURCE:${file}; failed=1; }`),
  ...excluded.map(file => `test ! -e /probe/${file} || { echo INCLUDED_RUNTIME:${file}; failed=1; }`),
]
fs.writeFileSync(path.join(context, 'Dockerfile'), [
  'FROM alpine:latest', 'COPY . /probe',
  `RUN failed=0; ${checks.join('; ')}; test "$failed" -eq 0 && echo SYNTHETIC_CONTEXT_BOUNDARY_PASS`, '',
].join('\n'), { flag: 'wx' })
const build = spawnSync('docker', ['build', '--pull=false', '--network=none', '--progress=plain',
  '--label', `org.ministrysprout.qualification.probe=${probeId}`, '--tag', tag, context],
{ encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
fs.writeFileSync(path.join(context, 'build.log'), (build.stdout ?? '') + (build.stderr ?? ''))
let imageRemoved = false
if (build.status === 0) {
  const inspection = spawnSync('docker', ['image', 'inspect', tag], { encoding: 'utf8' })
  if (inspection.status !== 0) throw Error('Probe image ownership could not be verified')
  const [image] = JSON.parse(inspection.stdout)
  if (image.Config.Labels?.['org.ministrysprout.qualification.probe'] !== probeId
    || !/^sha256:[a-f0-9]{64}$/.test(image.Id)) throw Error('Unexpected probe image ownership')
  const removal = spawnSync('docker', ['image', 'rm', '--no-prune', image.Id], { encoding: 'utf8' })
  if (removal.status !== 0) throw Error('Owned probe image cleanup did not complete')
  imageRemoved = true
}
const result = { status: build.status === 0 ? 'PASS' : 'FAIL', dockerExit: build.status,
  ignoreSha256: crypto.createHash('sha256').update(ignore).digest('hex'),
  excluded, retained, probeId, imageRemoved, context, date: new Date().toISOString() }
fs.writeFileSync(path.join(context, 'result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
process.exitCode = build.status === 0 ? 0 : 1
