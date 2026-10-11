import { expect, it, vi } from 'vitest'
import { birthdayMonthDayMatches, loadOfflineBirthdays } from './offline-birthdays'

it('maps February 29 to February 28 only in a non-leap church-local year', () => {
  expect(birthdayMonthDayMatches('02-29', '02-28', 2026)).toBe(true)
  expect(birthdayMonthDayMatches('02-29', '02-28', 2028)).toBe(false)
  expect(birthdayMonthDayMatches('02-29', '02-29', 2028)).toBe(true)
})

it('rejects a different actor and a lock between encrypted reads and presentation',async()=>{
  const read=vi.fn(async<T,>()=>[] as T),assertCurrent=vi.fn(async()=>{throw Error('Synthetic concurrent lock')})
  const church='11111111-1111-4111-8111-111111111111'
  const store={activeProfile:async()=>({id:'synthetic',churchId:church}),captureSyncAuthorization:()=>({assertCurrent}),readEncryptedAuthorization:async<T,>()=>({timezone:'UTC',actor:{id:'11'},lease:{church_id:church}}) as T,readEncryptedRoster:<T,>()=>read() as Promise<T>,readEncryptedMinistries:<T,>()=>read() as Promise<T>}
  expect(await loadOfflineBirthdays(church,store,undefined,22)).toBeNull();expect(read).not.toHaveBeenCalled()
  await expect(loadOfflineBirthdays(church,store,undefined,11)).rejects.toThrow('Synthetic concurrent lock');expect(assertCurrent).toHaveBeenCalledOnce()
})

it('does not invent a turning age when encrypted birthday metadata is incomplete',async()=>{
  const church='11111111-1111-4111-8111-111111111111'
  const store={activeProfile:async()=>({id:'synthetic',churchId:church}),captureSyncAuthorization:()=>({assertCurrent:async()=>undefined}),readEncryptedAuthorization:async<T,>()=>({timezone:'UTC',actor:{id:'11'},lease:{church_id:church}}) as T,readEncryptedRoster:async<T,>()=>[{id:'synthetic',display_name:'Synthetic',next_birthday_month_day:'09-30',turning_age:null,ministry_ids:[]}] as T,readEncryptedMinistries:async<T,>()=>[] as T}
  await expect(loadOfflineBirthdays(church,store,new Date('2026-09-30T00:00:00Z'))).rejects.toThrow('Birthday metadata unavailable')
})

it('reads only the unlocked matching profile encrypted projection for offline fallback', async () => {
  const store = {
    activeProfile: async () => ({ id: 'profile-a', churchId: '11111111-1111-4111-8111-111111111111' }),
    captureSyncAuthorization: () => ({ assertCurrent: async () => undefined }),
    readEncryptedAuthorization: async <T,>() => ({ timezone: 'Asia/Manila', actor: { id: '11' }, lease: { church_id: '11111111-1111-4111-8111-111111111111' } }) as T,
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
