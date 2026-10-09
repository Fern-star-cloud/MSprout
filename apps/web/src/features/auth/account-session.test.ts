// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { accountReturnDestination, isUncertainSubmission } from './account-session'
it.each(['https://outside.example/','//outside.example/','/\\outside.example','/platform/applications','/account/platform-applications','/api/me','/account/login','/account/home#secret','/account/home?church=bad','/account/home?returnTo=//outside.example','/account/home?church=00000000-0000-4000-8000-000000000010&church=00000000-0000-4000-8000-000000000011'])('rejects unsafe return destination %s', value=>expect(accountReturnDestination(value)).toBeNull())
it('canonicalizes supported internal destinations',()=>expect(accountReturnDestination('/reports')).toBe('/account/reports'))
it.each([new TypeError('lost response'),{status:500},{status:409}])('requires reconciliation for uncertain submission',error=>expect(isUncertainSubmission(error)).toBe(true))
it.each([401,403,410,419,422,429])('recognizes an authoritative HTTP %s denial',status=>expect(isUncertainSubmission({status})).toBe(false))
