import { getSecurityLog } from "@/features/admin/security"
import { SecurityLogView } from "@/components/admin/SecurityLogView"

/** /admin/security: the security log (src/lib/security-events.ts). The admin layout gates access; the action checks again. */
export default function AdminSecurityPage() {
  return <SecurityLogView fetchLog={getSecurityLog} />
}
