import definition from '../../../../../contracts/openapi.yaml?raw'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const contract = parse(definition)
const endpoints = {
  '/login': ['post'], '/logout': ['post'], '/auth/session': ['get'], '/me': ['get'],
  '/forgot-password': ['post'], '/reset-password': ['post'],
  '/email/verification-notification': ['post'], '/email/verify/{id}/{hash}': ['get'],
  '/sanctum/csrf-cookie': ['get'], '/user/confirm-password': ['post'],
  '/user/confirmed-password-status': ['get'], '/two-factor-challenge': ['post'],
  '/user/two-factor-authentication': ['post', 'delete'], '/user/confirmed-two-factor-authentication': ['post'],
  '/user/two-factor-secret-key': ['get'], '/user/two-factor-qr-code': ['get'], '/user/two-factor-recovery-codes': ['get', 'post'],
  '/user/profile-information': ['put'], '/user/password': ['put'],
  '/platform/csrf-token': ['get'], '/platform/login': ['post'], '/platform/logout': ['post'],
  '/platform/me': ['get'], '/platform/two-factor-challenge': ['post'],
  '/platform/setup/{platformAdmin}': ['get', 'post'], '/platform/setup/{platformAdmin}/confirm': ['post'],
}

it('documents every Task 4 JSON endpoint with safe errors and the correct server prefix', () => {
  for (const [path, methods] of Object.entries(endpoints)) {
    expect(contract.paths, path).toHaveProperty(path)
    for (const method of methods) {
      const operation = contract.paths[path][method]
      expect(operation, `${method} ${path}`).toBeDefined()
      expect(operation.responses.default).toBeDefined()
    }
    if (path !== '/me') expect(contract.paths[path].servers).toEqual([{ url: '/' }])
  }
})

it('keeps tenant and platform projections closed and free of authentication secrets', () => {
  for (const name of ['ChurchAccount', 'AccountSession', 'PlatformSession']) {
    const schema = contract.components.schemas[name]
    expect(schema).toBeDefined()
    expect(schema.additionalProperties).toBe(false)
    expect(Object.keys(schema.properties).join(' ')).not.toMatch(/password|secret|recovery|token/)
  }
})
