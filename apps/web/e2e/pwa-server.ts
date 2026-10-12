import { createServer, type ServerResponse } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// Test-only origin: actual built assets, explicit synthetic reads, no live proxy.
export async function startPwaServer() {
  const root = fileURLToPath(new URL('../dist/', import.meta.url)).replace(/[\\/]$/, '')
  for (const asset of ['index.html', 'service-worker.js', 'manifest.webmanifest']) {
    if (!existsSync(resolve(root, asset))) throw new Error('Build the production PWA before browser qualification')
  }
  const church = '00000000-0000-4000-8000-000000000010', ministry = '00000000-0000-4000-8000-000000000020'
  const aliases = new Set(['api', 'platform', 'auth', 'sanctum', 'health'].flatMap(prefix => [
    `/%${prefix.charCodeAt(0).toString(16)}${prefix.slice(1)}`, `/${prefix}%2f__qa-probe`, `/safe/%252e%252e/${prefix}`,
  ]))
  let revision = 0, reachable = true
  const json = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(body))
  }
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1'), route = url.pathname
    if (request.method === 'POST' && route === '/__qa/network-down') { reachable = false; return json(response, 200, { reachable }) }
    if (request.method === 'POST' && route === '/__qa/network-up') { reachable = true; return json(response, 200, { reachable }) }
    if (!reachable) { response.destroy(); return }
    if (route === '/__qa/revision' && request.method === 'POST') { revision++; return json(response, 200, { revision }) }
    if (route === '/__qa/revision') return json(response, 200, { revision })
    if (route === '/auth/session') return json(response, 200, { id: 11, email_verified: true, mfa_confirmed: false, workspaces: [{ church_id: church, name: 'Synthetic PWA church', role: 'teacher' }] })
    if (route === '/api/me') return json(response, 200, { id: 11, email_verified: true, memberships: [{ church_id: church, role: 'teacher', status: 'active' }], assignments: { ministry_ids: [ministry] }, active_session: { mfa_confirmed: false } })
    if (route === '/api/ministries') return json(response, 200, { data: [{ id: ministry, name: 'Primary', status: 'active', version: 1 }] })
    if (route === '/api/offline/bootstrap') return json(response, 200, {
      actor: { id: '11' }, timezone: 'Asia/Manila', ministries: [{ id: ministry, name: 'Primary', version: 1 }],
      roster: [{ id: '00000000-0000-4000-8000-000000000031', display_name: 'Pilot Student A', gender: 'unspecified', version: 1, ministry_ids: [ministry], next_birthday_month_day: null, turning_age: null }],
      lease: { actor_id: '11', church_id: church, membership_id: '00000000-0000-4000-8000-000000000040', device_id: url.searchParams.get('device_id'), issued_at: '2026-09-30T00:00:00Z', expires_at: '2099-10-14T00:00:00Z', signature: 'a'.repeat(64) }, server_cursor: '0',
    })
    if (route === '/sanctum/csrf-cookie') { response.writeHead(204, { 'Set-Cookie': 'XSRF-TOKEN=synthetic; Path=/; SameSite=Lax' }); response.end(); return }
    if (/^\/(api|platform|auth|sanctum|health)(\/|$)/.test(route) || aliases.has(route.toLowerCase())) return json(response, 503, { code: 'synthetic-unavailable' })
    const file = resolve(root, '.' + route)
    if (file !== root && !file.startsWith(root + sep)) return json(response, 404, {})
    const target = existsSync(file) && statSync(file).isFile() ? file : !extname(route) ? resolve(root, 'index.html') : null
    if (!target) return json(response, 404, {})
    const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
    response.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
    const bytes = readFileSync(target)
    // Observe actual worker activation; do not replace its routing/cache logic.
    if (route === '/service-worker.js') response.end(Buffer.concat([bytes, Buffer.from(`\n// Synthetic revision ${revision}\nself.addEventListener('message',event=>{if(event.data==='UI15_VERSION')event.ports[0]?.postMessage(${revision})});\n`)]))
    else response.end(bytes)
  })
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Synthetic PWA origin could not be allocated')
  return {
    origin: `http://127.0.0.1:${address.port}`,
    stop: () => new Promise<void>((done, fail) => { server.close(error => error ? fail(error) : done()); server.closeAllConnections() }),
  }
}
