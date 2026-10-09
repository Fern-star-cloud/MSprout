import { describe, expect, it } from 'vitest'
import { resolveRoute } from './routes'
import { navigationFor } from './navigation'

describe('explicit presentation routes', () => {
  it.each(['students', 'ministries', 'imports', 'attendance', 'conflicts', 'reports', 'birthdays', 'teachers', 'audit'])('retains canonical and short %s URLs', page => {
    expect(resolveRoute(`/account/${page}`)?.id).toBe(page)
    expect(resolveRoute(`/${page}`)?.id).toBe(page)
    expect(resolveRoute(`/account/${page}/`)?.id).toBe(page)
  })
  it('retains device entry, Home alias and explicit account/device destinations', () => {
    expect(resolveRoute('/')?.id).toBe('profiles')
    expect(resolveRoute('/profiles')?.id).toBe('profiles')
    expect(resolveRoute('/account/dashboard')?.id).toBe('home')
    for (const name of ['home', 'sync', 'prepare', 'people', 'more']) expect(resolveRoute(`/account/${name}`)?.id).toBe(name)
    expect(resolveRoute('/account')?.id).toBe('account')
  })
  it.each(['login', 'verify-email', 'forgot-password', 'reset-password', 'mfa', 'teacher-invitation', 'application', 'platform-login', 'platform-setup', 'platform-applications', 'platform-audit', 'platform-system-health'])('keeps exact %s entry without interpreting fragments', page => {
    expect(resolveRoute(`/account/${page}`)?.id).toBe(page)
  })
  it.each(['/anything/students', '/account/not-real', '/unknown/login', '/account/students/extra', '//students'])('rejects unknown or misleading route %s', path => {
    expect(resolveRoute(path)).toBeNull()
  })
})

describe('navigation capabilities', () => {
  it('uses the approved phone bars and a persistent Owner Sync destination', () => {
    expect(navigationFor('owner').phone.map(item => item.label)).toEqual(['Home', 'Attendance', 'Review', 'People', 'More'])
    expect(navigationFor('teacher').phone.map(item => item.label)).toEqual(['Home', 'Attendance', 'Sync', 'More'])
    for (const role of ['owner', 'teacher'] as const) {
      const nav = navigationFor(role)
      expect(nav.main.some(item => item.id === 'sync')).toBe(true)
      expect(nav.more.some(item => item.id === 'account')).toBe(true)
    }
  })
  it('excludes management destinations for Teachers and unverified device contexts', () => {
    for (const role of ['teacher', null] as const) {
      const nav = navigationFor(role)
      expect([...nav.main, ...nav.phone, ...nav.more].some(item => ['people', 'teachers', 'imports', 'conflicts'].includes(item.id))).toBe(false)
    }
    expect(navigationFor(null).main.some(item => item.label.includes('Owner'))).toBe(false)
  })
})
