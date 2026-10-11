import type { components } from '../../api/generated'
import { authRequest } from '../auth/transport'

export type WorkspaceAccess = { actor:number; role:'owner'|'teacher'; assignments:string[] }
export const accessSignature=(access:WorkspaceAccess)=>JSON.stringify(access)
export async function verifyNotificationWorkspace(church:string,role?:'owner'|'teacher'):Promise<WorkspaceAccess> {
  const me=await authRequest<components['schemas']['ChurchAccount']>('/api/me','GET',undefined,church)
  const membership=me.memberships?.find(row=>row.church_id===church&&row.status==='active')
  if(!Number.isSafeInteger(me.id)||me.id<=0||me.email_verified!==true||!membership||!['owner','teacher'].includes(membership.role)||role&&role!==membership.role||membership.role==='owner'&&me.active_session?.mfa_confirmed!==true)throw {status:403}
  return {actor:me.id,role:membership.role,assignments:[...new Set(me.assignments?.ministry_ids??[])].sort()}
}
