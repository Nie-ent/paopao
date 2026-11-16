"use client"

import React, { useEffect, useState } from "react"
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck, X } from "lucide-react"
import type { SecurityFilter, SecurityLog, SecurityRange } from "@/features/admin/security"
import { CATEGORY_LABEL, SEVERITY_LABEL, eventDef, type SecurityCategory, type Severity } from "@/lib/security-events"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

const SEV_STYLE: Record<Severity, { badge: string; icon: React.ElementType; tile: string }> = {
  critical: { badge: "bg-red-100 text-red-700 border-red-200", icon: AlertOctagon, tile: "border-red-200 bg-red-50 text-red-700" },
  warning: { badge: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertTriangle, tile: "border-amber-200 bg-amber-50 text-amber-800" },
  info: { badge: "bg-slate-100 text-slate-600 border-slate-200", icon: Info, tile: "border-slate-200 bg-white text-slate-700" },
}
const RANGE_LABEL: Record<SecurityRange, string> = { "24h": "24 ชม.", "7d": "7 วัน", "30d": "30 วัน", "90d": "90 วัน" }
// The 7-day counts worth a glance, in the order a reviewer would scan them
const WEEK_KEYS = ["admin_login_blocked", "webhook_bad_signature", "admin_login_failed", "admin_probe", "line_login_failed", "login_state_mismatch", "cron_unauthorized", "admin_action"] as const

const fmtTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (m < 1) return "เมื่อสักครู่"
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} ชม.ที่แล้ว` : `${Math.round(h / 24)} วันที่แล้ว`
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEV_STYLE[(severity as Severity)] ?? SEV_STYLE.info
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.badge}`}>
      <s.icon className="h-3.5 w-3.5" /> {SEVERITY_LABEL[severity as Severity] ?? severity}
    </span>
  )
}

/**
 * Security log for admins: whether anything dangerous happened lately, the IPs to watch, and every
 * recorded event (failed sign-ins, blocked requests, admin changes) with filters.
 */
export function SecurityLogView({ fetchLog }: { fetchLog: (f: SecurityFilter) => Promise<SecurityLog | null> }) {
  const [filter, setFilter] = useState<SecurityFilter>({ range: "7d" })
  const [search, setSearch] = useState("")
  const [data, setData] = useState<SecurityLog | null>(null)
  const [events, setEvents] = useState<SecurityLog["events"]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // Loading while the filter on screen (or a refresh) hasn't come back yet
  const [reload, setReload] = useState(0)
  const key = `${JSON.stringify(filter)}#${reload}`
  const [loadedKey, setLoadedKey] = useState("")
  const loading = loadedKey !== key

  useEffect(() => {
    let live = true
    fetchLog({ ...filter, cursor: null }).then(res => {
      if (!live) return
      setData(res); setEvents(res?.events ?? []); setCursor(res?.nextCursor ?? null); setNow(Date.now())
    }).finally(() => { if (live) setLoadedKey(key) })
    return () => { live = false }
  }, [filter, key, fetchLog])
  // The search box filters after a short pause
  useEffect(() => {
    const id = setTimeout(() => setFilter(f => (f.q ?? "") === search.trim() ? f : { ...f, q: search.trim() }), 400)
    return () => clearTimeout(id)
  }, [search])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetchLog({ ...filter, cursor })
      if (res) { setEvents(e => [...e, ...res.events]); setCursor(res.nextCursor) }
    } finally { setLoadingMore(false) }
  }
  const byIp = (ip: string) => { setSearch(ip); setFilter(f => ({ ...f, q: ip })) }

  const s = data?.summary
  const critical = s?.day.critical ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">บันทึกความปลอดภัย</h2>
          <p className="text-slate-500">การล็อกอินที่ไม่สำเร็จ คำขอที่ถูกปฏิเสธ และทุกการแก้ไขของแอดมิน · เก็บ 90 วัน</p>
        </div>
        <button onClick={() => setReload(r => r + 1)} disabled={loading} className="flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 md:self-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรช
        </button>
      </div>

      {s && (
        critical > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">พบเหตุการณ์อันตราย {critical} ครั้งใน 24 ชม.</p><p className="text-sm">ดูรายการสีแดงด้านล่าง และ IP ที่ควรจับตา</p></div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <ShieldCheck className="h-5 w-5 shrink-0" /> <p className="font-semibold">ไม่พบเหตุการณ์อันตรายใน 24 ชม.</p>
          </div>
        )
      )}

      {s && (
        <div className="grid grid-cols-3 gap-3">
          {(["critical", "warning", "info"] as Severity[]).map(k => {
            const st = SEV_STYLE[k]
            return (
              <button key={k} onClick={() => setFilter(f => ({ ...f, range: "24h", severity: f.severity === k && f.range === "24h" ? null : k }))}
                className={`rounded-xl border p-3 text-left transition-shadow hover:shadow-md sm:p-4 ${st.tile} ${filter.severity === k ? "ring-2 ring-slate-900/20" : ""}`}>
                <span className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm"><st.icon className="h-4 w-4" /> {SEVERITY_LABEL[k]}</span>
                <span className="mt-1 block text-2xl font-bold tabular-nums sm:text-3xl">{s.day[k]}</span>
                <span className="text-xs opacity-70">ใน 24 ชม.</span>
              </button>
            )
          })}
        </div>
      )}

      {s && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h3 className="mb-3 font-semibold">7 วันที่ผ่านมา</h3>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {WEEK_KEYS.map(k => {
                const d = eventDef(k)!
                const n = s.week[k] ?? 0
                return (
                  <div key={k} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${d.severity === "critical" ? "bg-red-500" : d.severity === "warning" ? "bg-amber-500" : "bg-slate-300"}`} />
                      <span className="truncate">{d.label}</span>
                    </span>
                    <span className={`font-semibold tabular-nums ${n > 0 && d.severity !== "info" ? "text-slate-900" : "text-slate-400"}`}>{n}</span>
                  </div>
                )
              })}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-1 font-semibold">IP ที่ควรจับตา</h3>
            <p className="mb-3 text-xs text-slate-500">มีเหตุการณ์น่าสงสัยหรืออันตรายมากที่สุดใน 7 วัน</p>
            {s.topSources.length === 0 ? (
              <p className="flex items-center gap-2 py-4 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> ยังไม่มี</p>
            ) : (
              <ul className="space-y-2">
                {s.topSources.map(src => (
                  <li key={src.ip}>
                    <button onClick={() => byIp(src.ip)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs">{src.ip}</span>
                        <span className="text-xs text-slate-500">ล่าสุด {ago(src.last, now)}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums">{src.count} ครั้ง</span>
                        {src.critical > 0 && <span className="text-xs font-medium text-red-600">อันตราย {src.critical}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm" role="group" aria-label="ช่วงเวลา">
              {(Object.keys(RANGE_LABEL) as SecurityRange[]).map(r => (
                <button key={r} onClick={() => setFilter(f => ({ ...f, range: r }))} aria-pressed={filter.range === r}
                  className={`rounded-md px-2.5 py-1 ${filter.range === r ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}>{RANGE_LABEL[r]}</button>
              ))}
            </div>
            <Select aria-label="ระดับ" className="h-8 w-auto min-w-28" value={filter.severity ?? "all"}
              onValueChange={v => setFilter(f => ({ ...f, severity: v === "all" ? null : v as Severity }))}
              options={[{ value: "all", label: "ทุกระดับ" }, ...(["critical", "warning", "info"] as Severity[]).map(k => ({ value: k, label: SEVERITY_LABEL[k] }))]} />
            <Select aria-label="หมวด" className="h-8 w-auto min-w-28" value={filter.category ?? "all"}
              onValueChange={v => setFilter(f => ({ ...f, category: v === "all" ? null : v as SecurityCategory }))}
              options={[{ value: "all", label: "ทุกหมวด" }, ...(Object.keys(CATEGORY_LABEL) as SecurityCategory[]).map(k => ({ value: k, label: CATEGORY_LABEL[k] }))]} />
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="ค้นหา IP ชื่อ หรือรายละเอียด" className="h-9 bg-slate-50 pl-9 pr-8" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button aria-label="ล้างคำค้น" onClick={() => setSearch("")} className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลด…</div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-slate-500">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            <p className="font-medium text-slate-700">ไม่มีเหตุการณ์ในช่วงนี้</p>
            <p className="text-sm">ลองขยายช่วงเวลาหรือล้างตัวกรอง</p>
          </div>
        ) : (
          <ul className={`divide-y divide-slate-100 ${loading ? "opacity-60" : ""}`}>
            {events.map(e => {
              const d = eventDef(e.type)
              const expanded = open === e.id
              return (
                <li key={e.id}>
                  <button onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <SeverityBadge severity={e.severity} />
                      <span className="min-w-[10rem] flex-1 font-medium">{d?.label ?? e.type}</span>
                      <span className="shrink-0 text-xs text-slate-500" title={new Date(e.createdAt).toISOString()}>{fmtTime(e.createdAt)} · {ago(e.createdAt, now)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
                      {e.detail && <span className="min-w-0 break-words">{e.detail}</span>}
                      {e.user && <span>👤 {e.user.name ?? e.user.id.slice(0, 8)}</span>}
                      {e.ip && <span className="font-mono">IP {e.ip}</span>}
                    </div>
                  </button>
                  {expanded && (
                    <div className="space-y-2 bg-slate-50 px-4 pb-3 pt-1 text-sm text-slate-600">
                      {d && <p>{d.hint}</p>}
                      <div className="flex flex-wrap gap-2">
                        {e.ip && <button onClick={() => byIp(e.ip!)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100">ดูทุกเหตุการณ์จาก IP นี้</button>}
                        <span className="rounded-md bg-white px-2 py-1 font-mono text-xs text-slate-400">{e.type}</span>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {cursor && (
          <div className="border-t border-slate-100 p-3 text-center">
            <button onClick={loadMore} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60">
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} โหลดเพิ่ม
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
