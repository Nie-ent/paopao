import { headers } from "next/headers"

/** The caller's IP. On Vercel the first X-Forwarded-For entry is set by the platform, not the client. */
export async function clientIp() {
  const h = await headers()
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown"
}

/** LoginAttempt rows for the admin password are stored under this prefix. */
export const ADMIN_ATTEMPT_PREFIX = "admin:"
