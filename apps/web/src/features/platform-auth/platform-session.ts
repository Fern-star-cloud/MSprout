import type { components } from '../../api/generated'
import { authRequest } from '../auth/transport'

export type PlatformSession = components['schemas']['PlatformSession']
export async function readPlatformSession(): Promise<PlatformSession> {
  const session = await authRequest<PlatformSession>('/platform/me')
  // This endpoint verifies active enrollment, recovery acknowledgement and session MFA.
  // Review routes additionally restrict the administrator to the supported sage.dev identity.
  if (session?.handle !== 'sage.dev' || session.online_only !== true) throw { status: 403 }
  return { handle: session.handle, online_only: true }
}
