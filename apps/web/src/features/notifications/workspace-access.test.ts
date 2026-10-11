import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { verifyNotificationWorkspace } from './workspace-access'
vi.mock('../auth/transport',()=>({authRequest:vi.fn()}))
afterEach(()=>vi.resetAllMocks())
const church='11111111-1111-4111-8111-111111111111'
it.each(['unverified','wrong church','inactive','unassured Owner','different role','invalid actor'])('denies %s before protected birthday/notification/activity work',async condition=>{const me={id:11,email_verified:true,memberships:[{church_id:church,status:'active',role:'teacher'}],active_session:{mfa_confirmed:false}};if(condition==='unverified')me.email_verified=false;if(condition==='wrong church')me.memberships[0].church_id='foreign';if(condition==='inactive')me.memberships[0].status='revoked';if(condition==='unassured Owner')me.memberships[0].role='owner';if(condition==='invalid actor')me.id=0;vi.mocked(authRequest).mockResolvedValue(me as never);await expect(verifyNotificationWorkspace(church,condition==='different role'?'owner':undefined)).rejects.toMatchObject({status:403})})
