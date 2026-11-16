import prisma from "@/lib/db"
import { clientIp } from "@/lib/client-ip"
import { SECURITY_EVENTS, THROTTLE_MS, type SecurityEventType } from "@/lib/security-events"

/**
 * Records a security event for the admin security log. Never throws: logging must not break the
 * request it describes. The IP comes from the current request unless given. Throttled types (open
 * to anyone) keep at most one row per IP per window, so a flood of bad requests can't fill the table.
 */
export async function logSecurityEvent(type: SecurityEventType, opts: { ip?: string | null; userId?: string | null; detail?: string | null } = {}) {
  try {
    const def = SECURITY_EVENTS[type]
    const ip = opts.ip !== undefined ? opts.ip : await clientIp().catch(() => null)
    if ("throttle" in def && def.throttle && ip) {
      const recent = await prisma.securityEvent.findFirst({ where: { type, ip, createdAt: { gt: new Date(Date.now() - THROTTLE_MS) } }, select: { id: true } })
      if (recent) return
    }
    await prisma.securityEvent.create({
      data: { type, severity: def.severity, ip: ip?.slice(0, 64) ?? null, userId: opts.userId ?? null, detail: opts.detail?.slice(0, 300) ?? null },
    })
  } catch (e) {
    console.error("[security-log]", type, e)
  }
}
