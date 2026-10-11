import type { components } from '../../../api/generated'
export type Application = components['schemas']['ChurchApplication']
export type Status = Application['status']
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
export function applicationProjection(value: Application, id?: string): Application {
  if (!value || !uuid(value.id) || (id && value.id !== id) || !['pending', 'approved', 'rejected'].includes(value.status)
    || ![value.church_name, value.city, value.address, value.timezone, value.reason].every(field => field === null || typeof field === 'string')
    || !(value.church_id === null || uuid(value.church_id)) || !(value.category === null || ['duplicate', 'ineligible', 'incomplete', 'other'].includes(value.category))
    || !instant(value.submitted_at) || !(value.decided_at === null || instant(value.decided_at))) throw new Error('Unavailable application projection')
  return { id: value.id, status: value.status, church_name: value.church_name, city: value.city, address: value.address, timezone: value.timezone, church_id: value.church_id, category: value.category, reason: value.reason, submitted_at: value.submitted_at, decided_at: value.decided_at }
}
