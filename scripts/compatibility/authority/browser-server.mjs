import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { readFileSync, realpathSync } from 'node:fs'
import { resolve, join, sep, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// No credentials or raw HTTP/SMTP are persisted; loopback/disposable C resources only.
/**
 * @param {string} assets
 * @param {string} container
 * @returns {Promise<{origin: string, fixture: {email: string, password: string, church: string}, revoke: () => Promise<{revoked: boolean}>, close: () => Promise<void>}>}
 */
export async function startAuthorityBrowserServer(assets, container) {
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.git/msprout-compat-b4-p2-1b-c-20261017'))
  const environment = JSON.parse(readFileSync(join(root, 'environment.json')))
  if (container !== environment.api || !/^msprout-b4-p2-1b-c-[a-f0-9]{10}-php$/.test(container)) throw Error('Foreign API target')
  const directory = realpathSync(assets)
  if (!directory.startsWith(root + sep)) throw Error('Use identified disposable C assets')
  const child = spawn('docker', ['exec', '-i', '-w', '/work', container, 'php', 'tests/Support/AuthorityBrowserProbe.php'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let pending
  const lines = createInterface({ input: child.stdout })
  const receive = () => new Promise((resolve, reject) => { if (pending) throw Error('Serialize C browser IPC'); pending = { resolve, reject } })
  lines.on('line', line => { const current = pending; pending = undefined; if (!current) return; try { const result = JSON.parse(line); if (result.probe_error) current.reject(Error(result.probe_error + '@' + result.location)); else current.resolve(result) } catch { current.reject(Error('Invalid isolated browser response')) } })
  child.stderr.resume()
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.on('exit', () => { pending?.reject(Error('Isolated browser probe exited')); pending = undefined })
  const ready = await receive()
  if (!ready.ready) throw Error('Missing guarded browser readiness')
  const call = async command => { const value = receive(); child.stdin.write(JSON.stringify(command) + '\n'); return value }
  let queue = Promise.resolve()
  const serialized = command => { const result = queue.then(() => call(command)); queue = result.catch(() => {}); return result }
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname
      if (/^\/(api|auth|sanctum|login|logout|user|email|two-factor-challenge|forgot-password|reset-password)(\/|$)/.test(pathname)) {
        const chunks = []; for await (const chunk of request) { chunks.push(chunk); if (Buffer.concat(chunks).length > 1_000_000) throw Error('Oversized probe request') }
        const cookies = Object.fromEntries((request.headers.cookie ?? '').split(';').filter(Boolean).map(item => { const index = item.indexOf('='); return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index+1))] }))
        const result = await serialized({ command: 'request', method: request.method, path: request.url, headers: request.headers, cookies, body: Buffer.concat(chunks).toString() })
        response.writeHead(result.status, { ...result.headers, ...(result.cookies.length ? { 'Set-Cookie': result.cookies } : {}) }); response.end(result.body); return
      }
      const file = pathname.startsWith('/assets/') || /\.(svg|png|webmanifest|js)$/.test(pathname) ? resolve(directory, '.' + decodeURIComponent(pathname)) : join(directory, 'index.html')
      if (!file.startsWith(directory + sep)) throw Error('Static traversal refused')
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(readFileSync(file))
    } catch { response.writeHead(500, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ code: 'isolated_probe_failure' })) }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  const fixture = await serialized({ command: 'initialize', origin })
  return { origin, fixture, revoke: () => serialized({ command: 'revoke' }), close: async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
    await queue
    child.stdin.end(JSON.stringify({ command: 'close' }) + '\n')
    await exited
    lines.close()
  } }
}
