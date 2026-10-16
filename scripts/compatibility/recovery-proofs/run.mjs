// Explicit P1 runner. Never invoked by ordinary CI or application bootstrap.
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'node:http'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const proof = join(root, 'scripts/compatibility/recovery-proofs')
const sha = value => createHash('sha256').update(value).digest('hex')
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim()
if (git('rev-parse', 'HEAD') !== '7ace0096d3a8baceaeb698ea47b398a2bbc4ea8f' || git('branch', '--show-current') !== 'feat/mvp-foundation' || git('diff', '--cached', '--name-only')) throw Error('Unexpected checkpoint or staging')
if (git('diff', '--name-only', '--', 'apps', 'contracts', '.github', 'AGENTS.md') || git('ls-files', '--others', '--exclude-standard', '--', 'apps', 'contracts', '.github')) throw Error('P1 cannot run against unexpected application inputs')
const nonce = randomBytes(5).toString('hex')
const name = `msprout-b4-p1-${nonce}`
const output = join(root, '.git', 'msprout-compat-b4-p1-20261016', nonce)
if (existsSync(output)) throw Error('Preserve existing evidence')
mkdirSync(output, { recursive: true })
const docker = (...args) => {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (result.status !== 0) throw Error(`Docker operation failed (${args[0]}): ${result.stderr.replaceAll(password, '[disposable secret]')}`)
  return result.stdout.trim()
}
const password = randomBytes(32).toString('hex')
const admin = `p1_setup_${nonce}`, db = `p1_${nonce}_test`, runtime = `p1_runtime_${nonce}`
const volume = `${name}-data`, network = `${name}-net`, pg = `${name}-postgres`, api = `${name}-php`
const source = join(output, 'api-source'), dependencies = join(output, 'vendor.tar')
mkdirSync(source)
const sourceHashes = {}
for (const path of git('ls-files', 'apps/api').split('\n')) {
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
docker('network', 'create', '--internal', '--label', 'msprout.task=B4-P1', network)
docker('volume', 'create', '--label', 'msprout.task=B4-P1', volume)
docker('run', '-d', '--name', pg, '--network', network, '--label', 'msprout.task=B4-P1', '--mount', `type=volume,source=${volume},target=/var/lib/postgresql`, '-e', `POSTGRES_USER=${admin}`, '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=p1_setup', '--health-cmd', `pg_isready -h 127.0.0.1 -U ${admin} -d p1_setup`, '--health-interval', '1s', '--health-retries', '30', 'postgres:18-alpine')
const deadline = Date.now() + 45_000
while (docker('inspect', pg, '--format', '{{.State.Health.Status}}') !== 'healthy') {
  if (Date.now() > deadline) throw Error('Fresh PostgreSQL readiness unavailable')
  await new Promise(resolve => setTimeout(resolve, 250))
}
const pgInfo = JSON.parse(docker('inspect', pg))[0]
const systemId = docker('exec', pg, 'psql', '-U', admin, '-d', 'p1_setup', '-Atc', 'SELECT system_identifier FROM pg_control_system()')
const protectedSystemId = docker('exec', 'msprout-postgres-1', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT system_identifier FROM pg_control_system()"')
if (pgInfo.Id === protectedContainer.Id || systemId === protectedSystemId || protectedVolumes.includes(volume) || pgInfo.Mounts.some(m => protectedContainer.Mounts.some(p => p.Source === m.Source)) || Object.keys(pgInfo.HostConfig.PortBindings ?? {}).length) throw Error('PostgreSQL isolation failed')
const dependencyArchive = spawnSync('docker', ['exec', 'msprout-compat-b3-native', 'tar', '-C', '/work', '-cf', '-', 'vendor'], { maxBuffer: 512 * 1024 * 1024 })
if (dependencyArchive.status !== 0) throw Error('Read-only dependency archive unavailable')
writeFileSync(dependencies, dependencyArchive.stdout)
const env = {
  P1_ISOLATED: 'yes', P1_SYSTEM_ID: systemId, P1_DATABASE: db, P1_RUNTIME: runtime, P1_SETUP: admin,
  APP_ENV: 'testing', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, APP_URL: 'http://localhost',
  DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_URL: '', DATABASE_URL: '', DB_DATABASE: 'p1_unused', DB_USERNAME: admin,
  DB_PASSWORD: password, DB_RUNTIME_USERNAME: 'p1_unused_runtime', DB_TEST_DATABASE: db, DB_TEST_RUNTIME_USERNAME: runtime,
  DB_MIGRATION_DATABASE: 'p1_setup', DB_MIGRATION_USERNAME: admin, DB_MIGRATION_PASSWORD: password,
  CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', BCRYPT_ROUNDS: '4',
  APP_CONFIG_CACHE: '/work/bootstrap/cache/p1-config.php',
}
docker('run', '-d', '--name', api, '--network', `container:${pg}`, '--user', 'root', '--label', 'msprout.task=B4-P1', '--tmpfs', '/work:rw,exec,size=1g', '--mount', `type=bind,source=${source},target=/source,readonly`, '--mount', `type=bind,source=${dependencies},target=/dependencies.tar,readonly`, '--mount', `type=bind,source=${proof},target=/proofs,readonly`, '--mount', `type=bind,source=${output},target=/evidence`, ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), '--entrypoint', 'sh', 'msprout-api:task18', '-c', 'cp -R /source/. /work/ && tar -C /work -xf /dependencies.tar && mkdir -p /work/storage/framework/cache/data /work/storage/framework/sessions /work/storage/framework/views /work/storage/logs /work/bootstrap/cache && touch /work/p1-ready && exec tail -f /dev/null')
while (spawnSync('docker', ['exec', api, 'test', '-f', '/work/p1-ready']).status !== 0) {
  if (Date.now() > deadline + 60_000) throw Error('Fresh PHP environment unavailable')
  await new Promise(resolve => setTimeout(resolve, 250))
}
const apiInfo = JSON.parse(docker('inspect', api))[0]
if (apiInfo.HostConfig.NetworkMode !== `container:${pgInfo.Id}` && apiInfo.HostConfig.NetworkMode !== `container:${pg}`) throw Error('Unexpected PHP network namespace')
if (apiInfo.Mounts.some(m => /\.env|msprout_postgres-data|manual-qa/i.test(m.Source))) throw Error('Protected mount refused')
writeFileSync(join(output, 'isolation.json'), JSON.stringify({ pg, api, volume, network, containerId: pgInfo.Id, systemId, protectedSystemIdDifferent: systemId !== protectedSystemId, database: db, setupRole: admin, runtimeRole: runtime, noPublishedDatabasePorts: true, mounts: apiInfo.Mounts.map(m => ({ source: m.Source, target: m.Destination, writable: m.RW })), sourceFiles: Object.keys(sourceHashes).length }, null, 2))
console.log(`Verified separate PostgreSQL18 cluster, fresh volume, isolated namespace and ${Object.keys(sourceHashes).length} source inputs. Evidence: ${output}`)
const bridge = spawn('docker', ['exec', '-i', '-w', '/work', api, 'php', '/proofs/server.php'], { stdio: ['pipe', 'pipe', 'pipe'] })
let pending = [], buffer = '', stderr = ''
bridge.stderr.on('data', b => { stderr += b.toString() })
bridge.stdout.on('data', b => {
  buffer += b.toString(); let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index); buffer = buffer.slice(index + 1)
    const item = pending.shift(); if (item) { try { item.resolve(JSON.parse(line)) } catch { item.reject(Error('Unexpected proof protocol output')) } }
  }
})
bridge.on('exit', code => { for (const p of pending.splice(0)) p.reject(Error(`Proof bridge exited ${code}; sanitized diagnostics retained`)); writeFileSync(join(output, 'server-stderr.log'), stderr) })
const ask = command => new Promise((resolve, reject) => { pending.push({ resolve, reject }); bridge.stdin.write(JSON.stringify(command) + '\n') })
const ready = await ask({ command: 'ready' })
if (!ready.ready) throw Error(JSON.stringify(ready))
writeFileSync(join(output, 'runtime-isolation.json'), JSON.stringify(ready, null, 2))
const serverProofs = await ask({ command: 'server-proofs' })
writeFileSync(join(output, 'server-proofs.json'), JSON.stringify(serverProofs, null, 2))
if (serverProofs.error) throw Error(JSON.stringify(serverProofs))
const requireWeb = createRequire(join(root, 'apps/web/package.json'))
const { build } = await import(pathToFileURL(requireWeb.resolve('vite')).href)
for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key]
await build({ configFile: false, envFile: false, envDir: false, root: join(root, 'apps/web'), logLevel: 'warn', plugins: [{ name: 'p1-environment-isolation', configResolved(config) { if (config.envDir !== false) throw Error('Environment file loading must be disabled') } }], build: { outDir: join(output, 'browser'), emptyOutDir: false, lib: { entry: join(proof, 'browser.ts'), formats: ['es'], fileName: 'proof' }, minify: false } })
writeFileSync(join(output, 'browser-environment.json'), JSON.stringify({ envFile: false, envDir: false, inheritedViteKeysRemoved: true, privateEnvironmentLoaded: false }))
const host = createServer((req, res) => {
  if (req.url === '/proof.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(join(output, 'browser/proof.js'))) }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="en"><title>B4-P1 isolated proofs</title><body><h1>Disposable recovery proof</h1><output id="status">Running</output><script type="module" src="/proof.js"></script></body></html>') }
})
await new Promise(resolve => host.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${host.address().port}`
const { chromium, webkit } = requireWeb('@playwright/test')
const browserResults = []
try {
  for (const engine of ['chrome', 'webkit']) {
    const browser = engine === 'chrome' ? await chromium.launch({ channel: 'chrome' }) : await webkit.launch(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {})
    const context = await browser.newContext({ viewport: { width: 390, height: 740 } })
    await context.exposeBinding('p1Server', async (_source, command) => ask(command))
    const page = await context.newPage()
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto(origin); await page.waitForFunction(() => Boolean(window.p1), { timeout: 30_000 })
    const results = await page.evaluate(async () => window.p1.run())
    await page.screenshot({ path: join(output, `${engine}-proofs.png`), fullPage: true })
    browserResults.push({ engine, version: browser.version(), errors, results })
    writeFileSync(join(output, `${engine}-proofs.json`), JSON.stringify(browserResults.at(-1), null, 2))
    await browser.close()
  }
} finally { host.close(); bridge.stdin.end() }
const assertions = []
for (const [engine, results] of [['server', serverProofs], ...browserResults.map(x => [x.engine, x.results])]) {
  for (const [id, value] of Object.entries(results).filter(([id]) => /^B4-0[1-5]$/.test(id))) {
    const witness = join(output, `${engine}-${id}.json`)
    writeFileSync(witness, JSON.stringify(value, null, 2))
    const result = spawnSync(process.execPath, [join(proof, 'invariant.mjs'), id, witness], { encoding: 'utf8' })
    writeFileSync(join(output, `${engine}-${id}-failing-before.log`), result.stderr)
    if (result.status !== 1 || !result.stderr.includes('AssertionError')) throw Error(`Invalid failing-before proof: ${engine} ${id}`)
    assertions.push({ engine, id, actualExitStatus: result.status, verdict: 'REPRODUCED' })
  }
}
for (const [file, hash] of Object.entries(proofHashes)) if (sha(readFileSync(join(proof, file))) !== hash) throw Error('Fixture changed during qualification')
writeFileSync(join(output, 'results.json'), JSON.stringify({ serverProofs, browserResults, assertions, candidateRecovery: 'NOT IMPLEMENTED', installedTransition: 'NOT TESTED' }, null, 2))
console.log(JSON.stringify({ evidence: output, server: serverProofs.verdicts, browser: browserResults.map(x => ({ engine: x.engine, results: x.results, errors: x.errors })) }, null, 2))
