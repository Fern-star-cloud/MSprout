import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startCompatibilityServer, loadBuild } from './server.mjs'
import { readFileSync, mkdtempSync, cpSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { sha256, freezeLegacy } from './freeze-legacy.mjs'
import { get } from 'node:http'

test('requires an identified frozen build before opening a listener', async () => {
  await assert.rejects(startCompatibilityServer({ manifestPath: 'missing-compat-build.json' }), /ENOENT/)
})

const manifestPath = process.env.COMPAT_B1_MANIFEST
if (!manifestPath) throw Error('Set COMPAT_B1_MANIFEST to the actual frozen build')

test('freezer refuses output reuse and output outside ignored task resources', () => {
  assert.throws(() => freezeLegacy(dirname(manifestPath)), /new output directory/)
  assert.throws(() => freezeLegacy(join(dirname(manifestPath), '../../../unsafe-output')), /new output directory/)
})

test('serves exact pinned assets and rejects writes, unknown APIs and foreign hosts', async () => {
  const { manifest } = loadBuild(manifestPath)
  const server = await startCompatibilityServer({ manifestPath })
  try {
    const response = await fetch(server.origin + '/index.html')
    assert.equal(response.headers.get('x-b1-source-sha'), manifest.sourceSha)
    assert.equal(sha256(Buffer.from(await response.arrayBuffer())), manifest.assetHashes['index.html'])
    for (const path of ['/api/sync/push', '/api/sync/pull', '/api/unknown', '/health']) {
      assert.equal((await fetch(server.origin + path)).status, 503)
      assert.equal((await fetch(server.origin + path, { method: 'POST' })).status, 503)
    }
    const foreignHost = await new Promise((done, fail) => {
      get(server.origin + '/index.html', { headers: { Host: 'external.invalid' } }, response => { response.resume(); done(response.statusCode) }).on('error', fail)
    })
    assert.equal(foreignHost, 403)
    assert.equal((await fetch(server.origin + '/%61pi/sync/pull')).status, 404)
    assert.equal((await fetch(server.origin + '/logout', { method: 'POST' })).status, 419)
    assert.throws(() => server.substitute(manifestPath, manifest.sourceSha), /distinct/)
    server.setAuthorized(false)
    assert.equal((await fetch(server.origin + '/api/me')).status, 401)
    server.setReachable(false)
    await assert.rejects(fetch(server.origin + '/index.html'))
  } finally { await server.stop() }
})

test('rejects manifest identity and asset tampering before listening', async () => {
  const folder = mkdtempSync(join(dirname(manifestPath), '../integrity-probe-'))
  cpSync(dirname(manifestPath), folder, { recursive: true, filter: source => !source.includes('node_modules') && !source.includes('source') })
  const copied = join(folder, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  writeFileSync(copied, JSON.stringify({ ...manifest, sourceSha: 'invalid' }))
  assert.throws(() => loadBuild(copied), /identity/)
  writeFileSync(copied, JSON.stringify(manifest))
  writeFileSync(join(folder, 'assets/index.html'), 'tampered test-only copy')
  await assert.rejects(startCompatibilityServer({ manifestPath: copied }), /integrity/)
})
