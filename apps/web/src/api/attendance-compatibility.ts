import { ApiError } from './client'

const feedback = {
  attendance_compatibility_required: 'This attendance request cannot be processed safely. Keep this profile and browser storage; saved local attendance must be preserved. Synchronization is incomplete.',
  full_bootstrap_required: 'Device recovery is required before downloads can continue. Keep this profile, browser storage and saved local attendance. Synchronization is incomplete.',
  invalid_attendance_reader: 'The attendance reader declaration is invalid. Keep saved local attendance and use a supported app.',
  unsupported_attendance_reader: 'This attendance reader is not supported. Keep saved local attendance and use a supported app.',
} as const

export function attendanceMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || !Object.hasOwn(feedback, error.code)) return null
  const code = error.code as keyof typeof feedback
  return error.status === (code === 'invalid_attendance_reader' || code === 'unsupported_attendance_reader' ? 400 : 409) ? feedback[code] : null
}

export function attendanceError(payload: unknown, status: number): ApiError | null {
  if (!payload || typeof payload !== 'object' || !('code' in payload) || typeof payload.code !== 'string') return null
  const correlation = 'correlation_id' in payload && typeof payload.correlation_id === 'string'
    && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(payload.correlation_id) ? payload.correlation_id : ''
  const error = new ApiError(payload.code, '', correlation, status)
  const message = attendanceMessage(error)
  if (!message) return null
  error.message = message
  return error
}

export function attendanceReaderHeaders(path: string): Record<string, string> {
  const pathname = path.split('?')[0]
  return /^\/api\/(?:sync\/(?:push|pull)|sync-conflicts(?:\/[a-f\d-]+(?:\/resolve)?)?|attendance-reports(?:\/export)?|attendance-sessions\/[a-f\d-]+\/records\/[a-f\d-]+\/corrections|attendance-guests\/[a-f\d-]+\/(?:promote|link|merge))$/i.test(pathname)
    ? { 'X-MSprout-Attendance-Reader': 'three-state-v1' } : {}
}
