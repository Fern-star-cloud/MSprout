import definition from '../../../../../contracts/openapi.yaml?raw'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const contract = parse(definition)
it('defines bounded scoped audit pages without raw metadata', () => {
  for (const path of ['/audit-events', '/platform/audit-events']) {
    const endpoint = contract.paths[path]
    expect(endpoint).toBeDefined()
    expect(endpoint.get.responses.default).toBeDefined()
    expect(endpoint.get.responses['200'].headers['X-Correlation-Id']).toBeDefined()
    expect(endpoint.parameters.find((p: { name: string }) => p.name === 'per_page').schema.maximum).toBe(100)
  }
  expect(contract.components.schemas.AuditEvent.additionalProperties).toBe(false)
  expect(contract.components.schemas.AuditEvent.properties.metadata_json).toBeUndefined()
  expect(contract.components.schemas.AuditEvent.properties.metadata).toBeUndefined()
})

it('documents correlation on every operation response', () => {
  for (const item of Object.values(contract.paths) as Record<string, { responses?: Record<string, { headers?: unknown }> }>[]) {
    for (const operation of Object.values(item)) {
      for (const response of Object.values(operation.responses ?? {})) expect(response.headers).toHaveProperty('X-Correlation-Id')
    }
  }
})
