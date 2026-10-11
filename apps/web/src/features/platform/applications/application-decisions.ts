// Only opaque application references; never persisted. Unknown submissions survive screen remounts.
const pending = new Map<string, 'inflight' | 'unknown'>()
export function decisionState(id: string) { return pending.get(id) }
export function beginDecision(id: string) {
  if (pending.has(id)) return false
  pending.set(id, 'inflight'); return true
}
export function unknownDecision(id: string) { pending.set(id, 'unknown') }
export function completeDecision(id: string) { pending.delete(id) }
