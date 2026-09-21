import definition from '../../../../../contracts/openapi.yaml?raw'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const contract = parse(definition)
it('documents all Teacher endpoints with safe errors, tenant headers and closed inputs', () => {
  for (const [path, methods] of Object.entries({
    '/teachers': ['get'], '/teachers/{id}': ['delete'], '/teachers/{id}/assignments': ['put'],
    '/teacher-invitations': ['get', 'post'], '/teacher-invitations/{id}': ['delete'],
    '/teacher-invitations/accept': ['post'], '/ownership-transfer': ['post'],
    '/assigned-ministries': ['get'], '/assigned-ministries/{id}': ['get'],
  })) {
    expect(contract.paths[path], path).toBeDefined()
    for (const method of methods) expect(contract.paths[path][method].responses.default).toBeDefined()
    if (!path.endsWith('/accept')) expect(contract.paths[path].parameters.some((p: { name: string }) => p.name === 'X-Church-Id')).toBe(true)
  }
  for (const name of ['InviteTeacher', 'TeacherAssignments', 'AcceptTeacherInvitation', 'TransferOwnership']) expect(contract.components.schemas[name].additionalProperties).toBe(false)
  expect(contract.components.schemas.InviteTeacher.properties.role).toBeUndefined()
  expect(contract.components.schemas.TeacherInvitation.properties.token).toBeUndefined()
})
