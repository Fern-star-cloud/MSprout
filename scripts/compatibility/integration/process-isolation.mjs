// Separate-container credential proof. Only the positively identified disposable BDE cluster.
import { spawnSync } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

const root = resolve('.')
const base = join(root, '.git/msprout-compat-b4-p2-1b-bde-20261019')
const state = JSON.parse(readFileSync(join(base, 'environment.json'), 'utf8'))
const call = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (r.status !== 0) throw Error(`Isolated operation failed: ${cmd} ${args[0]}`)
  return r.stdout.trim()
}
const git = (...a) => call('git', a)
if (git('rev-parse', 'HEAD') !== 'c5e30e1f3b392a154ac5c64aa39b3ca96c6e6361' || git('branch', '--show-current') !== 'feat/mvp-foundation' || git('diff', '--cached', '--name-only')) throw Error('Checkpoint mismatch')
if (!/^msprout-b4-p2-1b-bde-[a-f0-9]{10}-php$/.test(state.api) || !state.output.startsWith(base + '\\') && !state.output.startsWith(base + '/')) throw Error('Unknown disposable fixture')
const pg = JSON.parse(call('docker', ['inspect', state.pg]))[0]
if (pg.Config.Labels['msprout.task'] !== 'B4-P2-1B-BDE' || pg.Mounts.length !== 1 || pg.Mounts[0].Name !== state.volume || Object.keys(pg.NetworkSettings.Networks).join() !== state.network || Object.keys(pg.HostConfig.PortBindings ?? {}).length) throw Error('Disposable physical isolation mismatch')
const guard = JSON.parse(call('docker', ['exec', state.api, 'php', '/proofs/bootstrap.php', '--probe']))
if (guard.systemId !== state.systemId) throw Error('Independent server identity mismatch')
const inputs = [...new Set([...git('ls-files', 'apps/api').split('\n'), ...git('ls-files', '--others', '--exclude-standard', 'apps/api').split('\n')])].filter(Boolean)
for (const p of inputs) {
  if (p.endsWith('/.env') || p.endsWith('.sqlite')) throw Error('Private source refused')
  const target = join(state.source, p.slice(9)); mkdirSync(dirname(target), { recursive: true }); copyFileSync(p, target)
}
call('docker', ['exec', state.api, 'sh', '-c', 'cp -R /source/. /work/'])
// The test driver may rotate only independently guarded disposable identities. Never print this result.
const secrets = JSON.parse(call('docker', ['exec', state.api, 'php', '-r', `$argv=['fixture'];ob_start();require '/proofs/bootstrap.php';ob_end_clean();echo json_encode(array_combine(['runtime','runtimePassword','maintenance','maintenancePassword','key','db'],array_map('getenv',['DB_USERNAME','DB_PASSWORD','DB_TEST_MAINTENANCE_USERNAME','DB_TEST_MAINTENANCE_PASSWORD','APP_KEY','DB_DATABASE'])));`]))
const output = join(state.output, 'process-isolation-' + randomBytes(5).toString('hex'))
mkdirSync(output)
const secretPath = join(output, 'maintenance-secret')
writeFileSync(secretPath, secrets.maintenancePassword, { mode: 0o600 })
const common = { APP_ENV: 'production', APP_DEBUG: 'false', APP_KEY: secrets.key, APP_URL: 'http://localhost', DB_CONNECTION: 'pgsql', DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_DATABASE: secrets.db, DB_RUNTIME_USERNAME: secrets.runtime, DB_MAINTENANCE_USERNAME: secrets.maintenance, CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'null', LOG_CHANNEL: 'stderr' }
const results = []
for (const mode of ['web', 'maintenance', 'web-secret-rejected', 'missing-secret-rejected']) {
  const worker = mode === 'maintenance' || mode === 'missing-secret-rejected'
  const mountSecret = mode === 'maintenance' || mode === 'web-secret-rejected'
  const env = { ...common, DB_USERNAME: worker ? secrets.maintenance : secrets.runtime, DB_PASSWORD: worker ? '' : secrets.runtimePassword }
  const envFile = join(output, mode + '.env')
  writeFileSync(envFile, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 })
  const name = 'msprout-bde-sec-' + mode + '-' + randomBytes(4).toString('hex')
  const args = ['create', '--name', name, '--label', 'msprout.task=BDE-SEC-01-isolation', '--network', `container:${state.pg}`, '--user', 'www-data', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--tmpfs', '/work:rw,exec,mode=1777,size=1g', '--env-file', envFile, '--mount', `type=bind,source=${state.source},target=/source,readonly`, '--mount', `type=bind,source=${join(state.output, 'vendor.tar')},target=/dependencies.tar,readonly`]
  if (mountSecret) args.push('--mount', `type=bind,source=${secretPath},target=/run/secrets/msprout-maintenance-password,readonly`)
  const init = 'cp -R /source/. /work/ && tar -C /work -xf /dependencies.tar && cd /work && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache && touch .env && '
  let command
  if (mode === 'web') command = 'php docker/process-boundary.php api && php tests/Support/maintenance-process-probe.php web'
  else if (mode === 'maintenance') command = 'sh docker/entrypoint.sh maintenance prune && DB_PASSWORD="$(cat /run/secrets/msprout-maintenance-password)" MSPROUT_MAINTENANCE_PROCESS=true php tests/Support/maintenance-process-probe.php maintenance'
  else command = 'php docker/process-boundary.php ' + (worker ? 'maintenance' : 'api')
  args.push('--entrypoint', 'sh', 'msprout-api:task18', '-c', init + command)
  call('docker', args)
  const inspected = JSON.parse(call('docker', ['inspect', name]))[0]
  if (inspected.HostConfig.Privileged || inspected.HostConfig.PidMode || inspected.Mounts.some(m => m.Destination.includes('docker.sock')) || inspected.Mounts.some(m => /\.env|manual-qa|postgres-data/i.test(m.Source))) throw Error('Unsafe process resources')
  if (mode === 'web' && (inspected.Config.Env.some(v => v.includes(secrets.maintenancePassword)) || inspected.Mounts.some(m => m.Destination === '/run/secrets/msprout-maintenance-password'))) throw Error('Maintenance secret exposed to web')
  const run = spawnSync('docker', ['start', '-a', name], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  const exit = Number(call('docker', ['inspect', name, '--format', '{{.State.ExitCode}}']))
  writeFileSync(join(output, mode + '.log'), (run.stdout ?? '') + (run.stderr ?? ''))
  const expected = mode.endsWith('rejected') ? 78 : 0
  if (exit !== expected) throw Error(`Process proof failed: ${mode}, exit ${exit}; inspect ignored receipt`)
  let proof = null
  if (expected === 0) {
    proof = JSON.parse(run.stdout.slice(run.stdout.lastIndexOf('{')))
    if (mode === 'maintenance' && proof.httpStatus !== 503) throw Error('Privileged HTTP permitted')
  }
  results.push({ mode, container: name, exit, expected, proof, privatePidNamespace: true, noSharedCredentialMount: mode === 'web' })
}
writeFileSync(join(output, 'result.json'), JSON.stringify({ systemId: state.systemId, database: secrets.db, inputs: Object.fromEntries(inputs.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')])), results }, null, 2))
console.log(`Separate-process proofs passed: ${results.length}/4. Private credentials excluded from receipts. Evidence: ${output}`)
