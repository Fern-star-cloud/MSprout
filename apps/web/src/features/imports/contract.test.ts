import definition from '../../../../../contracts/openapi.yaml?raw'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const contract = parse(definition)

it('documents the bounded Owner student import workflow', () => {
  for (const [path, method] of Object.entries({
    '/imports/students/preview': 'post', '/imports/{batch}/commit': 'post',
    '/imports/{batch}': 'get', '/imports/template': 'get',
  })) {
    const operation = contract.paths[path]?.[method]
    expect(operation, path).toBeDefined()
    expect(operation.parameters.some((parameter: { name: string }) => parameter.name === 'X-Church-Id')).toBe(true)
    expect(operation.responses.default).toBeDefined()
  }
  const upload = contract.paths['/imports/students/preview'].post.requestBody.content['multipart/form-data'].schema
  expect(upload.additionalProperties).toBe(false)
  expect(upload.properties.file.format).toBe('binary')
  expect(contract.components.schemas.ImportPreview.properties.rows.maxItems).toBe(500)
  expect(contract.components.schemas.ImportRow.properties.status.enum).toEqual(['valid', 'invalid', 'duplicate', 'needs_mapping'])
})

