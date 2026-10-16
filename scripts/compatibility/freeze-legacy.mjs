import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const LEGACY_SHA = '9c30def911bb59ae02ecfd3fa291607f141b8c68'
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export function assetHashes(root) {
  const result = {}
  function visit(folder) {
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name)
      if (statSync(path).isDirectory()) visit(path)
      else result[relative(root, path).split(sep).join('/')] = sha256(readFileSync(path))
    }
  }
  visit(root)
  return result
}

// Only tracked bytes from this commit enter the archive. No .env, database,
// browser profile, Git history, or mutable working-tree application source.
export function freezeLegacy(output) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  const gitDir = realpathSync(resolve(repo, git('rev-parse', '--git-dir')))
  const outputRoot = resolve(gitDir, 'msprout-compat-b1-20261016')
  const target = resolve(output)
  const within = relative(outputRoot, target)
  if (!within || within.startsWith('..') || isAbsolute(within) || dirname(target) !== outputRoot || existsSync(target)
    || (existsSync(outputRoot) && realpathSync(outputRoot) !== outputRoot)) throw Error('Use a new output directory inside the B1 ignored task directory')
  if (git('rev-parse', `${LEGACY_SHA}^{commit}`) !== LEGACY_SHA) throw Error('Pinned commit unavailable')
  for (const name of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'apps/web/package.json']) {
    if (git('rev-parse', `${LEGACY_SHA}:${name}`) !== git('hash-object', '--path', name, name)) throw Error(`Dependency input differs: ${name}`)
  }
  mkdirSync(target, { recursive: true })
  const source = join(target, 'source'), assets = join(target, 'assets')
  mkdirSync(source)
  const archive = execFileSync('git', ['archive', '--format=tar', LEGACY_SHA, 'apps/web', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'], { cwd: repo, maxBuffer: 64 * 1024 * 1024 })
  const archivePath = join(target, 'source.tar')
  writeFileSync(archivePath, archive)
  execFileSync('tar', ['-xf', archivePath, '-C', source], { stdio: 'inherit' })
  const sourceHashes = assetHashes(source)
  // Existing lock-matched dependencies are shared read-only as build inputs.
  symlinkSync(join(repo, 'apps/web/node_modules'), join(source, 'apps/web/node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')))
  env.VITE_TURNSTILE_SITE_KEY = '1x00000000000000000000AA'
  env.NODE_ENV = 'production'
  execFileSync(process.execPath, [join(repo, 'apps/web/node_modules/vite/bin/vite.js'), 'build', '--outDir', assets], { cwd: join(source, 'apps/web'), env, stdio: 'inherit' })
  const versions = Object.fromEntries(['vite', 'vite-plugin-pwa', 'workbox-build'].map(name => [name, JSON.parse(readFileSync(join(repo, 'apps/web/node_modules', name, 'package.json'), 'utf8')).version]))
  const manifest = { format: 1, sourceSha: LEGACY_SHA, sourceTree: git('rev-parse', `${LEGACY_SHA}^{tree}`), archiveSha256: sha256(archive), node: process.version, dependencies: versions, buildCommand: 'vite build --outDir <isolated assets>', buildEnvironment: { VITE_TURNSTILE_SITE_KEY: env.VITE_TURNSTILE_SITE_KEY }, sourceHashes, assetHashes: assetHashes(assets), assetsDirectory: 'assets', capableReader: false }
  for (const required of ['index.html', 'service-worker.js', 'manifest.webmanifest']) if (!manifest.assetHashes[required]) throw Error(`Missing built asset: ${required}`)
  const manifestPath = join(target, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  return manifestPath
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error('Usage: node scripts/compatibility/freeze-legacy.mjs <new ignored output directory>')
  console.log(freezeLegacy(process.argv[2]))
}
