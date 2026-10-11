import { ChurchActivity } from './ChurchActivity'
import { PlatformAuditScreen } from './PlatformAuditScreen'

export function AuditScreen({ platform = false }: { platform?: boolean }) {
  return platform ? <PlatformAuditScreen /> : <ChurchActivity />
}
