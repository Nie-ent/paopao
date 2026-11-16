import { describe, expect, it } from "vitest"
import { SECURITY_EVENTS, bucketKey, eventDef, fillTimeline, topSources, typesOf } from "./security-events"

describe("security events", () => {
  it("every event has a label, a hint and a valid severity", () => {
    for (const [type, d] of Object.entries(SECURITY_EVENTS)) {
      expect(d.label, type).toBeTruthy()
      expect(d.hint, type).toBeTruthy()
      expect(["info", "warning", "critical"]).toContain(d.severity)
    }
  })

  it("events anyone can trigger are throttled; admin changes and password attempts are not", () => {
    expect(eventDef("webhook_bad_signature")?.throttle).toBe(true)
    expect(eventDef("admin_probe")?.throttle).toBe(true)
    expect(eventDef("admin_action")?.throttle).toBeUndefined()
    expect(eventDef("admin_login_failed")?.throttle).toBeUndefined()
    expect(eventDef("nope")).toBeNull()
  })

  it("filters types by severity and category", () => {
    expect(typesOf({ severity: "critical" }).sort()).toEqual(["admin_login_blocked", "webhook_bad_signature"])
    expect(typesOf({ category: "api" }).sort()).toEqual(["cron_unauthorized", "webhook_bad_signature"])
    expect(typesOf({}).length).toBe(Object.keys(SECURITY_EVENTS).length)
  })

  it("ranks IPs by critical events, then by count, ignoring info and unknown IPs", () => {
    const at = (m: number) => new Date(Date.UTC(2026, 10, 16, 10, m))
    const rows = [
      { ip: "1.1.1.1", severity: "warning", createdAt: at(1) },
      { ip: "1.1.1.1", severity: "warning", createdAt: at(2) },
      { ip: "1.1.1.1", severity: "warning", createdAt: at(3) },
      { ip: "2.2.2.2", severity: "critical", createdAt: at(4) },
      { ip: "3.3.3.3", severity: "info", createdAt: at(5) },
      { ip: "unknown", severity: "critical", createdAt: at(6) },
      { ip: null, severity: "critical", createdAt: at(7) },
    ]
    const top = topSources(rows)
    expect(top.map(s => s.ip)).toEqual(["2.2.2.2", "1.1.1.1"])
    expect(top[1]).toMatchObject({ count: 3, critical: 0, last: at(3) })
  })
})

describe("timeline", () => {
  it("fills every Bangkok day in the range and adds the counts", () => {
    const since = new Date("2026-11-13T20:00:00Z") // 14 Nov 03:00 Bangkok
    const now = new Date("2026-11-16T05:00:00Z") // 16 Nov 12:00 Bangkok
    const t = fillTimeline([{ key: "2026-11-15", severity: "critical", n: 2 }, { key: "2026-11-15", severity: "info", n: 1 }, { key: "2026-11-01", severity: "warning", n: 9 }], since, now, "day")
    expect(t.map(p => p.key)).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"])
    expect(t[1]).toEqual({ key: "2026-11-15", critical: 2, warning: 0, info: 1 })
  })

  it("buckets by Bangkok hour", () => {
    expect(bucketKey(new Date("2026-11-16T17:30:00Z"), "hour")).toBe("2026-11-17T00")
    const t = fillTimeline([], new Date("2026-11-16T00:00:00Z"), new Date("2026-11-16T23:59:00Z"), "hour")
    expect(t.length).toBe(24)
  })
})
