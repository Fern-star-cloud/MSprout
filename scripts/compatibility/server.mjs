import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'
import { assetHashes, LEGACY_SHA, sha256 } from './freeze-legacy.mjs'

export function loadBuild(manifestPath, expectedSha = LEGACY_SHA) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.format !== 1 || manifest.sourceSha !== expectedSha || !/^[a-f0-9]{40}$/.test(expectedSha)) throw Error('Unexpected source identity')
  const root = resolve(dirname(manifestPath), manifest.assetsDirectory)
  if (root !== resolve(dirname(manifestPath), 'assets')) throw Error('Assets must belong to the isolated build')
  const actual = assetHashes(root)
  if (JSON.stringify(actual) !== JSON.stringify(manifest.assetHashes)) throw Error('Frozen asset integrity mismatch')
  for (const path of ['index.html', 'service-worker.js', 'manifest.webmanifest']) if (!actual[path]) throw Error('Incomplete frozen build')
  return { manifest, root }
}

export async function startCompatibilityServer({ manifestPath }) {
  let build = loadBuild(manifestPath)
  let reachable = true, waitingProbe = false, authorized = true
  const requests = []
  const church = '00000000-0000-4000-8000-000000000010', ministry = '00000000-0000-4000-8000-000000000020'
  const json = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' }); response.end(JSON.stringify(body)) }
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    requests.push({ method: request.method, path: url.pathname })
    // No proxy/fetch/upstream exists. Even unexpected write requests fail closed.
    if (!reachable) { response.destroy(); return }
    if (request.headers.host !== `127.0.0.1:${server.address().port}`) return json(response, 403, { code: 'fixture-host-denied' })
    if (request.method === 'POST' && url.pathname === '/logout') {
      if (request.headers['x-xsrf-token'] !== 'b1-synthetic') return json(response, 419, { code: 'fixture-csrf-denied' })
      authorized = false
      response.writeHead(204, { 'Cache-Control': 'no-store' }); response.end(); return
    }
    if (request.method !== 'GET') return json(response, 503, { code: 'fixture-write-denied' })
    const path = url.pathname
    if (/^\/(api|auth|sanctum|platform|health)(\/|$)/.test(path)) {
      if (!authorized) return json(response, 401, { code: 'synthetic-unauthenticated' })
      if (path === '/auth/session') return json(response, 200, { id: 11, email_verified: true, mfa_confirmed: false, workspaces: [{ church_id: church, name: 'B1 Synthetic Church', role: 'teacher' }] })
      if (path === '/api/me') return json(response, 200, { id: 11, email_verified: true, memberships: [{ church_id: church, role: 'teacher', status: 'active' }], assignments: { ministry_ids: [ministry] }, active_session: { mfa_confirmed: false } })
      if (path === '/api/ministries') return json(response, 200, { data: [{ id: ministry, name: 'B1 Primary', status: 'active', version: 1 }] })
      if (path === '/sanctum/csrf-cookie') { response.writeHead(204, { 'Cache-Control': 'no-store', 'Set-Cookie': 'XSRF-TOKEN=b1-synthetic; Path=/; SameSite=Lax' }); response.end(); return }
      if (path === '/api/offline/bootstrap') {
        const device = url.searchParams.get('device_id')
        if (!device || !/^[a-f0-9-]{36}$/i.test(device)) return json(response, 422, { code: 'fixture-invalid-device' })
        return json(response, 200, { actor: { id: '11' }, timezone: 'Asia/Manila', ministries: [{ id: ministry, name: 'B1 Primary', version: 1 }], roster: [0, 1].map(index => ({ id: `00000000-0000-4000-8000-00000000003${index + 1}`, display_name: `B1 Student ${index + 1}`, gender: 'unspecified', version: 1, ministry_ids: [ministry], next_birthday_month_day: null, turning_age: null })), lease: { actor_id: '11', church_id: church, membership_id: '00000000-0000-4000-8000-000000000040', device_id: device, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), signature: 'a'.repeat(64) }, server_cursor: '0' })
      }
      return json(response, 503, { code: 'fixture-unavailable' })
    }
    const file = resolve(build.root, '.' + path)
    if (file !== build.root && !file.startsWith(build.root + sep)) return json(response, 404, {})
    const name = path.slice(1)
    const appRoutes = ['/', '/profiles', '/account/prepare', '/account/attendance', '/account/sync']
    const selected = Object.hasOwn(build.manifest.assetHashes, name) ? name : appRoutes.includes(path) ? 'index.html' : null
    if (!selected) return json(response, 404, {})
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
    let bytes = readFileSync(resolve(build.root, selected))
    if (sha256(bytes) !== build.manifest.assetHashes[selected]) return json(response, 500, { code: 'fixture-asset-changed' })
    // Lifecycle-only stimulus; never represented as a different application build.
    if (selected === 'service-worker.js' && waitingProbe) bytes = Buffer.concat([bytes, Buffer.from('\n// B1 same-application waiting-worker probe\n')])
    response.writeHead(200, { 'Content-Type': mime[extname(selected)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-B1-Source-SHA': build.manifest.sourceSha, 'X-B1-Asset-SHA256': sha256(bytes) })
    response.end(bytes)
  })
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done) })
  return {
    origin: `http://127.0.0.1:${server.address().port}`, requests,
    setReachable(value) { reachable = value }, setAuthorized(value) { authorized = value },
    requestWaitingProbe() { waitingProbe = true },
    // Only a genuinely distinct, explicitly identified build can replace assets.
    substitute(manifestPath, expectedSha) {
      const next = loadBuild(manifestPath, expectedSha)
      const changedApplication = Object.entries(next.manifest.assetHashes).some(([path, hash]) => path.endsWith('.js') && path !== 'service-worker.js' && build.manifest.assetHashes[path] !== hash)
      if (next.manifest.sourceSha === build.manifest.sourceSha || !changedApplication) throw Error('Substitution requires distinct source and application assets')
      build = next; waitingProbe = false
    },
    stop: () => new Promise((done, fail) => { server.close(error => error ? fail(error) : done()); server.closeAllConnections() }),
  }
}
