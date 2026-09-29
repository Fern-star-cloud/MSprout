import { expect, it } from 'vitest'
import { birthdayMonthDayMatches, loadOfflineBirthdays } from './offline-birthdays'

it('maps February 29 to February 28 only in a non-leap church-local year', () => {
  expect(birthdayMonthDayMatches('02-29', '02-28', 2026)).toBe(true)
  expect(birthdayMonthDayMatches('02-29', '02-28', 2028)).toBe(false)
  expect(birthdayMonthDayMatches('02-29', '02-29', 2028)).toBe(true)
})

it('reads only the unlocked matching profile encrypted projection for offline fallback', async () => {
  const store = {
    activeProfile: async () => ({ id: 'profile-a', churchId: '11111111-1111-4111-8111-111111111111' }),
    readEncryptedAuthorization: async <T,>() => ({ timezone: 'Asia/Manila' }) as T,
    readEncryptedRoster: async <T,>() => ([{
      id: 'child-a', display_name: 'Assigned Child', next_birthday_month_day: '09-29',
      turning_age: 8, ministry_ids: ['ministry-a'],
    }] as T),
    readEncryptedMinistries: async <T,>() => ([{ id: 'ministry-a', name: 'Primary' }] as T),
  }

  await expect(loadOfflineBirthdays(
    '11111111-1111-4111-8111-111111111111', store, new Date('2026-09-29T00:30:00Z'),
  )).resolves.toMatchObject({ count: 1, birthdays: [{ display_name: 'Assigned Child', turning_age: 8 }] })
  await expect(loadOfflineBirthdays(
    '22222222-2222-4222-8222-222222222222', store, new Date('2026-09-29T00:30:00Z'),
  )).resolves.toBeNull()
})
