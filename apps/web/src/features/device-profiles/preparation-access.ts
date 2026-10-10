import type { components } from '../../api/generated'
import type { ChurchWorkspace } from '../../app/workspace-context'
import type { OfflineBootstrap } from '../../offline/schema'
import { readAccountSession } from '../auth/account-session'
import { authRequest } from '../auth/transport'

export interface PreparationAccess {
  actorId: string
  workspace: ChurchWorkspace
  workspaces: ChurchWorkspace[]
  ministries: components['schemas']['Ministry'][]
  scope: string
}
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i

export async function readPreparationAccess(churchId?: string): Promise<PreparationAccess | { workspaces: ChurchWorkspace[] }> {
  const session = await readAccountSession()
  if (!session.email_verified) throw new Error('Verify your church-account email before preparing this device.')
  const workspace = churchId ? session.workspaces.find(item => item.church_id === churchId)
    : session.workspaces.length === 1 ? session.workspaces[0] : undefined
  if (!workspace) {
    if (churchId || !session.workspaces.length) throw new Error('No verified church membership is available for this selection.')
    return { workspaces: session.workspaces }
  }
  const account = await authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, workspace.church_id)
  if (account?.id !== session.id || account.email_verified !== true || typeof account.active_session?.mfa_confirmed !== 'boolean' || !Array.isArray(account.memberships)
    || !account.memberships.some(item => item.church_id === workspace.church_id && item.status === 'active' && item.role === workspace.role)) {
    throw new Error('Your church access changed. Check Account and verify access again.')
  }
  if (workspace.role === 'owner' && account.active_session?.mfa_confirmed !== true) {
    throw new Error('Complete current-session MFA in Account before preparing this device.')
  }
  const assignments = account.assignments?.ministry_ids
  if (!Array.isArray(assignments) || assignments.some(id => !uuid.test(id))) throw new Error('Ministry assignments could not be verified.')
  const result = await authRequest<components['schemas']['MinistryList']>('/api/ministries', 'GET', undefined, workspace.church_id)
  if (!Array.isArray(result?.data) || result.data.some(item => !uuid.test(item.id) || typeof item.name !== 'string'
    || !['active', 'archived'].includes(item.status) || !Number.isSafeInteger(item.version) || item.version < 1)) {
    throw new Error('Authorized ministries could not be verified.')
  }
  const ministries = result.data.filter(item => item.status === 'active' && (workspace.role === 'owner' || assignments.includes(item.id)))
  const scope = [String(session.id), workspace.church_id, workspace.role, [...new Set(assignments)].sort().join(','), ministries.map(item => item.id).sort().join(',')].join(':')
  return { actorId: String(session.id), workspace, workspaces: session.workspaces, ministries, scope }
}

export function validatePreparationBootstrap(access: PreparationAccess, bootstrap: OfflineBootstrap): void {
  const expected = new Set(access.ministries.map(item => item.id))
  if (bootstrap?.actor?.id !== access.actorId || !Array.isArray(bootstrap.ministries) || !Array.isArray(bootstrap.roster)
    || bootstrap.ministries.length !== expected.size || bootstrap.ministries.some(item => !expected.has(item.id))
    || new Set(bootstrap.ministries.map(item => item.id)).size !== expected.size
    || bootstrap.roster.some(item => !Array.isArray(item.ministry_ids) || item.ministry_ids.length === 0
      || item.ministry_ids.some(id => typeof id !== 'string' || !expected.has(id)))
    || bootstrap.lease?.actor_id !== access.actorId || bootstrap.lease.church_id !== access.workspace.church_id
    || !Number.isFinite(Date.parse(bootstrap.lease.expires_at)) || Date.parse(bootstrap.lease.expires_at) <= Date.now()
    || typeof bootstrap.server_cursor !== 'string' || !/^\d+$/.test(bootstrap.server_cursor)) {
    throw new Error('Preparation data does not match the verified access. Keep this profile and verify access again.')
  }
}
