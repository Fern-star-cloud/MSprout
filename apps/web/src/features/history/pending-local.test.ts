import { beforeEach, expect, it, vi } from 'vitest'
import { offlineDatabase } from '../../offline/db'
import { profileStore } from '../../offline/profile-store'
import { pendingLocalAttendanceCount } from './pending-local'

vi.mock('../../offline/db',()=>({offlineDatabase:{outboxEvents:{where:vi.fn()}}}))
vi.mock('../../offline/profile-store',()=>({profileStore:{activeProfile:vi.fn(),captureSyncAuthorization:vi.fn(),readEncryptedAuthorization:vi.fn()}}))
const current=vi.fn(),count=vi.fn(),equals=vi.fn(),church='11111111-1111-4111-8111-111111111111'
beforeEach(()=>{vi.resetAllMocks();vi.mocked(profileStore.activeProfile).mockResolvedValue({id:'synthetic-profile',churchId:church});vi.mocked(profileStore.captureSyncAuthorization).mockReturnValue({assertCurrent:current,assertUnlocked:vi.fn()});vi.mocked(profileStore.readEncryptedAuthorization).mockResolvedValue({actor:{id:'11'},lease:{church_id:church}});current.mockResolvedValue(undefined);count.mockResolvedValue(3);equals.mockReturnValue({count});vi.mocked(offlineDatabase.outboxEvents.where).mockReturnValue({equals} as never)})
it('counts only the matching leased profile and rechecks authorization after the read',async()=>{expect(await pendingLocalAttendanceCount(church,11)).toBe(3);expect(equals).toHaveBeenCalledWith('synthetic-profile');expect(current).toHaveBeenCalledTimes(1)})
it.each(['locked','church','actor'])('keeps %s profile metadata unavailable without reading its outbox',async mode=>{if(mode==='locked')vi.mocked(profileStore.activeProfile).mockResolvedValue(null);if(mode==='church')vi.mocked(profileStore.activeProfile).mockResolvedValue({id:'foreign-profile',churchId:'foreign'});if(mode==='actor')vi.mocked(profileStore.readEncryptedAuthorization).mockResolvedValue({actor:{id:'22'},lease:{church_id:church}});expect(await pendingLocalAttendanceCount(church,11)).toBeNull();expect(count).not.toHaveBeenCalled()})
it('never returns a count after a concurrent lock or authorization change',async()=>{current.mockRejectedValue(Error('locked during read'));await expect(pendingLocalAttendanceCount(church,11)).rejects.toThrow('locked during read')})
