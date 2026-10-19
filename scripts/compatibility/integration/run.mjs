// Explicit P2-1B-BDE runner. Never invoked by ordinary CI or application bootstrap.
import { spawnSync } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
if (resolve(process.cwd()) !== root) throw Error('Run the publication harness from its repository root')
const proof = join(root, 'scripts/compatibility/integration')
const sha = value => createHash('sha256').update(value).digest('hex')
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim()
if (git('rev-parse', 'HEAD') !== 'c5e30e1f3b392a154ac5c64aa39b3ca96c6e6361' || git('branch', '--show-current') !== 'feat/mvp-foundation' || git('diff', '--cached', '--name-only')) throw Error('Unexpected checkpoint or staging')
if (git('diff', '--name-only', '--', 'contracts', '.github', 'AGENTS.md')) throw Error('Out-of-scope application inputs')
const webProofs = ['apps/web/e2e/compatibility/integration.spec.ts', 'apps/web/playwright.integration.config.ts']
const webChanges = [...git('diff', '--name-only', '--', 'apps/web').split('\n'), ...git('ls-files', '--others', '--exclude-standard', '--', 'apps/web').split('\n')].filter(Boolean)
if (webChanges.some(p => !webProofs.includes(p))) throw Error('Unexpected web source change')
const apiCandidates = [
  "tests/Support/maintenance-process-probe.php",
  "app/Domain/Sync/TrustedSystemCoordination.php",
  "config/maintenance.php",
  "database/migrations/2026_10_19_000002_isolate_maintenance_authority.php",
  "tests/bootstrap.php",
  "tests/Support/MaintenanceScenario.php",
  "tests/Compatibility/MaintenanceIsolationTest.php",
  "tests/Feature/Applications/ApplicationRetentionTest.php",
  "tests/Compatibility/TrustedSystemAuthorityTest.php",
  "routes/console.php",
  "docker/entrypoint.sh",
  "docker/process-boundary.php",
  "app/Http/Middleware/RejectMaintenanceHttp.php",
  "bootstrap/app.php",
  "app/Domain/Sync/CoordinatedChangePublisher.php",
  "app/Domain/Sync/ChurchCoordination.php",
  "app/Domain/Sync/PublicationMode.php",
  "app/Http/Controllers/SyncController.php",
  "app/Http/Controllers/OfflineBootstrapController.php",
  "app/Domain/Sync/MaintenanceCoordinator.php",
  "app/Domain/Attendance/PublishAttendanceChange.php",
  "app/Actions/Memberships/ManageTeachers.php",
  "app/Actions/Applications/ApproveChurchApplication.php",
  "app/Jobs/PruneOperationalData.php",
  "app/Jobs/PurgeRevokedDeviceData.php",
  "app/Jobs/DispatchBirthdayNotifications.php",
  "app/Jobs/SendBirthdayPush.php",
  "tests/Feature/Notifications/BirthdayDispatchTest.php",
  "app/Jobs/PurgeRejectedApplications.php",
  "config/synchronization.php",
  "database/migrations/2026_10_19_000001_integrate_coordinated_publication.php",
  "database/sql/coordinated-publication.sql",
  "database/sql/coordinated-maintenance.sql",
  "tests/Compatibility/IntegrationPublicationTest.php",
  "tests/Compatibility/IntegrationMaintenanceTest.php",
  "tests/Compatibility/IntegrationCutoverTest.php",
  "tests/Compatibility/IntegrationConcurrencyTest.php",
  "tests/Support/IntegrationScenario.php",
  "tests/Support/IntegrationBrowserProbe.php",
  "tests/Support/integration-worker.php",
  "tests/Feature/Operations/RetentionTest.php"
].map(p => 'apps/api/' + p)
const apiChanges = [...git('diff', '--name-only', '--', 'apps/api').split('\n'), ...git('ls-files', '--others', '--exclude-standard', '--', 'apps/api').split('\n')].filter(Boolean)
if (apiChanges.some(p => !apiCandidates.includes(p))) throw Error('Unexpected API source; preserve and investigate')
const mode = process.argv[2] ?? 'prepare'
const evidenceRoot = resolve('.git/msprout-compat-b4-p2-1b-bde-20261019')
if (mode !== 'prepare') {
 const state = JSON.parse(readFileSync(join(evidenceRoot, 'environment.json'), 'utf8'))
 if (!/^msprout-b4-p2-1b-bde-[a-f0-9]{10}-php$/.test(state.api)) throw Error('Unknown isolated runner')
 if (!state.output.startsWith(evidenceRoot + '/') && !state.output.startsWith(evidenceRoot + '\\')) throw Error('Foreign evidence path')
 if (state.source !== join(state.output, 'api-source')) throw Error('Foreign source path')
 const check = spawnSync('docker', ['exec', state.api, 'php', '/proofs/bootstrap.php', '--probe'], { encoding: 'utf8' })
 if (check.status !== 0) throw Error('Guard rejected target before test bootstrap')
 if (JSON.parse(check.stdout).systemId !== state.systemId) throw Error('Recorded system identity changed')
 if (mode === 'test') {
  if (process.argv.slice(3).some(a => /^(--parallel|--bootstrap|--configuration|--env|--extension|--runner|--test-directory|-p$|-c)/.test(a))) throw Error('Unsafe test runner override')
  const paths = [...new Set([...git('ls-files', 'apps/api').split('\n'), ...git('ls-files', '--others', '--exclude-standard', 'apps/api').split('\n')])].filter(Boolean)
  for (const p of paths) { if (p.endsWith('.sqlite') || p.endsWith('/.env')) throw Error('Private source refused'); const target=join(state.source,p.slice(9)); mkdirSync(dirname(target),{recursive:true}); copyFileSync(p,target) }
  const attempt = Date.now()
  writeFileSync(join(state.output, 'test-inputs-'+attempt+'.json'), JSON.stringify({head: git('rev-parse','HEAD'), api: Object.fromEntries(paths.map(p => [p, sha(readFileSync(p))])), harness: Object.fromEntries(readdirSync(proof).filter(p => /\.(mjs|php)$/.test(p)).map(p => [p,sha(readFileSync(join(proof,p)))]))}))
  const sync=spawnSync('docker',['exec',state.api,'sh','-c','cp -R /source/. /work/'],{encoding:'utf8'}); if(sync.status!==0)throw Error('Source copy failed')
  const r=spawnSync('docker',['exec','-e','PDE_ISOLATED=yes','-w','/work',state.api,'php','vendor/pestphp/pest/bin/pest','--bootstrap=/proofs/bootstrap.php',...process.argv.slice(3)],{encoding:'utf8',maxBuffer:32*1024*1024})
  const receipt=join(state.output,'test-'+attempt+'.log');writeFileSync(receipt,(r.stdout??'')+(r.stderr??''));writeFileSync(join(state.output,'result-'+attempt+'.json'),JSON.stringify({exitCode:r.status,args:process.argv.slice(3),inputs:'test-inputs-'+attempt+'.json',log:receipt}));process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');process.exit(r.status??1)
 }
 throw Error('Unknown mode')
}
const nonce = randomBytes(5).toString('hex')
const name = `msprout-b4-p2-1b-bde-${nonce}`
const output = join(root, '.git', 'msprout-compat-b4-p2-1b-bde-20261019', nonce)
if (existsSync(output)) throw Error('Preserve existing evidence')
mkdirSync(output, { recursive: true })
const docker = (...args) => {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (result.status !== 0) throw Error(`Docker operation failed (${args[0]}): ${result.stderr.replaceAll(password, '[disposable secret]')}`)
  return result.stdout.trim()
}
const password = randomBytes(32).toString('hex')
const admin = `pc_setup_${nonce}`, db = `pc_${nonce}_test`, runtime = `pc_runtime_${nonce}`
const volume = `${name}-data`, network = `${name}-net`, pg = `${name}-postgres`, api = `${name}-php`
const source = join(output, 'api-source'), dependencies = join(output, 'vendor.tar')
mkdirSync(source)
const sourceHashes = {}
for (const path of [...new Set([...git('ls-files', 'apps/api').split('\n'), ...git('ls-files', '--others', '--exclude-standard', 'apps/api').split('\n')])].filter(Boolean)) {
  const rel = path.slice('apps/api/'.length)
  if (rel === '.env' || rel.endsWith('.sqlite')) throw Error('Protected input excluded')
  const target = join(source, rel)
  mkdirSync(dirname(target), { recursive: true }); copyFileSync(join(root, path), target)
  sourceHashes[rel] = sha(readFileSync(target))
}
writeFileSync(join(output, 'source.json'), JSON.stringify({ head: git('rev-parse', 'HEAD'), hashes: sourceHashes }, null, 2))
const proofHashes = Object.fromEntries(readdirSync(proof).filter(f => /\.(php|mjs|ts)$/.test(f)).map(f => [f, sha(readFileSync(join(proof, f)))]))
writeFileSync(join(output, 'fixture-source.json'), JSON.stringify(proofHashes, null, 2))
const protectedContainer = JSON.parse(docker('inspect', 'msprout-postgres-1'))[0]
const protectedVolumes = JSON.parse(docker('volume', 'ls', '--format', '{{json .Name}}').split('\n').map(x => x).join(',').replace(/^/, '[').replace(/$/, ']'))
docker('network', 'create', '--internal', '--label', 'msprout.task=B4-P2-1B-BDE', network)
docker('volume', 'create', '--label', 'msprout.task=B4-P2-1B-BDE', volume)
docker('run', '-d', '--name', pg, '--network', network, '--label', 'msprout.task=B4-P2-1B-BDE', '--mount', `type=volume,source=${volume},target=/var/lib/postgresql`, '-e', `POSTGRES_USER=${admin}`, '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=pc_setup', '-e', 'POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=trust', '--health-cmd', `pg_isready -h 127.0.0.1 -U ${admin} -d pc_setup`, '--health-interval', '1s', '--health-retries', '30', 'postgres:18-alpine', 'postgres', '-c', 'max_prepared_transactions=10')
const deadline = Date.now() + 45_000
while (docker('inspect', pg, '--format', '{{.State.Health.Status}}') !== 'healthy') {
  if (Date.now() > deadline) throw Error('Fresh PostgreSQL readiness unavailable')
  await new Promise(resolve => setTimeout(resolve, 250))
}
const pgInfo = JSON.parse(docker('inspect', pg))[0]
const systemId = docker('exec', pg, 'psql', '-U', admin, '-d', 'pc_setup', '-Atc', 'SELECT system_identifier FROM pg_control_system()')
const protectedSystemId = docker('exec', 'msprout-postgres-1', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT system_identifier FROM pg_control_system()"')
if (pgInfo.Id === protectedContainer.Id || systemId === protectedSystemId || protectedVolumes.includes(volume) || pgInfo.Mounts.some(m => protectedContainer.Mounts.some(p => p.Source === m.Source)) || Object.keys(pgInfo.HostConfig.PortBindings ?? {}).length) throw Error('PostgreSQL isolation failed')
const hbaCommand = "sed -i -E 's/^(local[[:space:]]+all[[:space:]]+)all([[:space:]]+trust.*)$/\\1'+admin+'\\2/' \"$PGDATA/pg_hba.conf\"; printf '\\nlocal all all reject\\n' >> \"$PGDATA/pg_hba.conf\"".replace("'+admin+'", admin)
docker('exec', pg, 'sh', '-c', hbaCommand)
docker('exec', pg, 'psql', '-U', admin, '-d', 'pc_setup', '-Atc', 'SELECT pg_reload_conf()')
const archive = join(root, '.git/msprout-compat-b4-p2-1a-20261016/1aae137149/vendor.tar')
if (!existsSync(archive)) throw Error('Retained read-only dependencies unavailable')
copyFileSync(archive, dependencies)
const env = {
  PDE_ISOLATED: 'yes', PC_ISOLATED: 'yes', PC_SYSTEM_ID: systemId, PC_DATABASE: db, PC_RUNTIME: runtime, PC_SETUP: admin,
  APP_ENV: 'testing', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, APP_URL: 'http://localhost',
  DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_URL: '', DATABASE_URL: '', DB_DATABASE: 'pc_unused', DB_USERNAME: admin,
  DB_PASSWORD: password, DB_RUNTIME_USERNAME: 'pc_unused_runtime', DB_TEST_DATABASE: db, DB_TEST_RUNTIME_USERNAME: runtime,
  DB_MIGRATION_DATABASE: 'pc_setup', DB_MIGRATION_USERNAME: admin, DB_MIGRATION_PASSWORD: password,
  CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', BCRYPT_ROUNDS: '4',
  APP_CONFIG_CACHE: '/work/bootstrap/cache/pc-config.php',
}
docker('run', '-d', '--name', api, '--network', `container:${pg}`, '--user', 'root', '--label', 'msprout.task=B4-P2-1B-BDE', '--tmpfs', '/work:rw,exec,size=1g', '--mount', `type=bind,source=${source},target=/source,readonly`, '--mount', `type=bind,source=${dependencies},target=/dependencies.tar,readonly`, '--mount', `type=bind,source=${proof},target=/proofs,readonly`, '--mount', `type=bind,source=${output},target=/evidence`, ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), '--entrypoint', 'sh', 'msprout-api:task18', '-c', 'cp -R /source/. /work/ && tar -C /work -xf /dependencies.tar && mkdir -p /work/storage/framework/cache/data /work/storage/framework/sessions /work/storage/framework/views /work/storage/logs /work/bootstrap/cache && touch /work/pc-ready && exec tail -f /dev/null')
while (spawnSync('docker', ['exec', api, 'test', '-f', '/work/pc-ready']).status !== 0) {
  if (Date.now() > deadline + 60_000) throw Error('Fresh PHP environment unavailable')
  await new Promise(resolve => setTimeout(resolve, 250))
}
const apiInfo = JSON.parse(docker('inspect', api))[0]
if (apiInfo.HostConfig.NetworkMode !== `container:${pgInfo.Id}` && apiInfo.HostConfig.NetworkMode !== `container:${pg}`) throw Error('Unexpected PHP network namespace')
if (apiInfo.Mounts.some(m => /\.env|msprout_postgres-data|manual-qa/i.test(m.Source))) throw Error('Protected mount refused')
writeFileSync(join(output, 'isolation.json'), JSON.stringify({ pg, api, volume, network, containerId: pgInfo.Id, systemId, protectedSystemIdDifferent: systemId !== protectedSystemId, database: db, setupRole: admin, runtimeRole: runtime, noPublishedDatabasePorts: true, mounts: apiInfo.Mounts.map(m => ({ source: m.Source, target: m.Destination, writable: m.RW })), sourceFiles: Object.keys(sourceHashes).length }, null, 2))
console.log(`Verified separate PostgreSQL18 cluster, fresh volume, isolated namespace and ${Object.keys(sourceHashes).length} source inputs. Evidence: ${output}`)
const guard = spawnSync('docker',['exec',api,'php','/proofs/bootstrap.php','--probe'],{encoding:'utf8'})
if(guard.status!==0)throw Error('Pre-bootstrap isolation guard failed')
writeFileSync(join(output,'guard.json'),guard.stdout)
writeFileSync(join(evidenceRoot,'environment.json'),JSON.stringify({api,pg,source,output,systemId,volume,network}))
console.log(guard.stdout)
