/**
 * What the admin security log records (SecurityEvent rows, written by src/lib/security-log.ts).
 * Pure: shared by the logger and the admin page. Only events that matter for security are kept,
 * not every sign-in, so the log stays readable and holds as little personal data as possible.
 */
export type Severity = "info" | "warning" | "critical"
export type SecurityCategory = "admin" | "auth" | "api"

type EventDef = {
  severity: Severity
  category: SecurityCategory
  label: string
  /** What it means and what to do about it, for the admin page */
  hint: string
  /**
   * Requests anyone can send (bots, scanners): at most one row per IP per throttle window, so a
   * flood can't fill the table. Admin actions and password attempts are always recorded.
   */
  throttle?: boolean
}

export const SECURITY_EVENTS = {
  admin_login_ok: { severity: "info", category: "admin", label: "แอดมินเข้าสู่ระบบ", hint: "ใส่รหัสผ่านแอดมินถูกต้อง ถ้าไม่ใช่คุณ ให้เปลี่ยน ADMIN_PASSWORD ทันที" },
  admin_login_failed: { severity: "warning", category: "admin", label: "รหัสผ่านแอดมินผิด", hint: "ใส่รหัสผ่านแอดมินผิด ผิด 5 ครั้งใน 15 นาที IP นั้นจะถูกบล็อก" },
  admin_login_blocked: { severity: "critical", category: "admin", label: "บล็อกการเดารหัสแอดมิน", hint: "IP นี้ใส่รหัสผิดเกินกำหนดและถูกบล็อก 15 นาที อาจมีคนพยายามเดารหัส", throttle: true },
  admin_logout: { severity: "info", category: "admin", label: "แอดมินออกจากระบบ", hint: "ออกจากระบบแอดมิน" },
  admin_probe: { severity: "warning", category: "admin", label: "มีคนพยายามเข้าหน้าแอดมิน", hint: "บัญชีที่ไม่ใช่แอดมิน (หรือยังไม่ล็อกอิน) เปิด /admin และได้หน้า 404", throttle: true },
  admin_action: { severity: "info", category: "admin", label: "แอดมินแก้ไขข้อมูล", hint: "การเปลี่ยนแปลงที่แอดมินทำ เช่น แพ็กเกจ แต้ม ของรางวัล และภารกิจ" },
  line_login_failed: { severity: "warning", category: "auth", label: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ", hint: "LINE ยืนยันตัวตนไม่ผ่าน ถ้าเกิดถี่จาก IP เดียว อาจเป็นการปลอม token", throttle: true },
  login_state_mismatch: { severity: "warning", category: "auth", label: "state ของการล็อกอินไม่ตรง", hint: "ค่า state จาก LINE ไม่ตรงกับที่ออกให้เบราว์เซอร์นี้ อาจเป็น CSRF หรือแค่หน้าล็อกอินหมดอายุ", throttle: true },
  webhook_bad_signature: { severity: "critical", category: "api", label: "LINE webhook ลายเซ็นไม่ถูกต้อง", hint: "มีคำขอเข้า /api/line โดยไม่มีลายเซ็นของ LINE ถูกปฏิเสธแล้ว ถ้าเกิดต่อเนื่อง อาจมีคนยิงปลอมเข้ามา", throttle: true },
  cron_unauthorized: { severity: "warning", category: "api", label: "เรียก cron โดยไม่มีสิทธิ์", hint: "มีคำขอเข้า /api/cron โดยไม่มี CRON_SECRET ที่ถูกต้อง ถูกปฏิเสธแล้ว", throttle: true },
} satisfies Record<string, EventDef>

export type SecurityEventType = keyof typeof SECURITY_EVENTS

export const SEVERITY_LABEL: Record<Severity, string> = { info: "ปกติ", warning: "น่าสงสัย", critical: "อันตราย" }
export const CATEGORY_LABEL: Record<SecurityCategory, string> = { admin: "แอดมิน", auth: "การล็อกอิน", api: "API" }

/** One row per IP per type within this window for throttled events */
export const THROTTLE_MS = 10 * 60 * 1000

export function eventDef(type: string): EventDef | null {
  return (SECURITY_EVENTS as Record<string, EventDef>)[type] ?? null
}

export function typesOf(filter: { severity?: Severity | null; category?: SecurityCategory | null }) {
  return (Object.keys(SECURITY_EVENTS) as SecurityEventType[]).filter(t => {
    const d: EventDef = SECURITY_EVENTS[t]
    return (!filter.severity || d.severity === filter.severity) && (!filter.category || d.category === filter.category)
  })
}

/** The IPs behind the most warning/critical events, for the "watch these" list */
export function topSources(rows: { ip: string | null; severity: string; createdAt: Date }[], limit = 5) {
  const by = new Map<string, { ip: string; count: number; critical: number; last: Date }>()
  for (const r of rows) {
    if (!r.ip || r.ip === "unknown" || r.severity === "info") continue
    const s = by.get(r.ip) ?? { ip: r.ip, count: 0, critical: 0, last: r.createdAt }
    s.count++
    if (r.severity === "critical") s.critical++
    if (r.createdAt > s.last) s.last = r.createdAt
    by.set(r.ip, s)
  }
  return [...by.values()].sort((a, b) => b.critical - a.critical || b.count - a.count || b.last.getTime() - a.last.getTime()).slice(0, limit)
}

export type TimelineUnit = "hour" | "day"
export type TimelinePoint = { key: string; critical: number; warning: number; info: number }

/** Bangkok bucket key of a moment: "YYYY-MM-DD" by day, "YYYY-MM-DDTHH" by hour */
export function bucketKey(at: Date, unit: TimelineUnit) {
  return new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, unit === "hour" ? 13 : 10)
}

/**
 * Every hour or day from `since` to `now` (Bangkok), with the counts per severity that the database
 * returned for it and zero for the rest, so quiet periods show as gaps rather than disappearing.
 */
export function fillTimeline(rows: { key: string; severity: string; n: number }[], since: Date, now: Date, unit: TimelineUnit): TimelinePoint[] {
  const step = unit === "hour" ? 3600_000 : 86_400_000
  const points = new Map<string, TimelinePoint>()
  for (let t = since.getTime(); t <= now.getTime(); t += step) {
    const key = bucketKey(new Date(t), unit)
    if (!points.has(key)) points.set(key, { key, critical: 0, warning: 0, info: 0 })
  }
  const last = bucketKey(now, unit)
  if (!points.has(last)) points.set(last, { key: last, critical: 0, warning: 0, info: 0 })
  for (const r of rows) {
    const p = points.get(r.key)
    if (p && (r.severity === "critical" || r.severity === "warning" || r.severity === "info")) p[r.severity] += r.n
  }
  return [...points.values()]
}
