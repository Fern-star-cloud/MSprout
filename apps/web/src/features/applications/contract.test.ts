import definition from '../../../../../contracts/openapi.yaml?raw'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

it('documents all application endpoints and closed projections', () => {
  const contract = parse(definition)
  for (const [path, method] of [
    ['/church-applications', 'post'], ['/church-applications/current', 'get'],
    ['/platform/applications', 'get'], ['/platform/applications/{id}', 'get'],
    ['/platform/applications/{id}/approve', 'post'], ['/platform/applications/{id}/reject', 'post'],
  ]) {
    expect(contract.paths[path]?.[method]?.responses.default, path).toBeDefined()
    if (path.startsWith('/platform')) expect(contract.paths[path].servers).toEqual([{ url: '/' }])
  }
  expect(contract.components.schemas.ChurchApplication.additionalProperties).toBe(false)
  expect(Object.keys(contract.components.schemas.ChurchApplication.properties).join(' ')).not.toMatch(/token|email|user_id/)
})
