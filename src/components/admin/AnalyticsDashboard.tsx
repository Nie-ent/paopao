"use client"

import { useState } from "react"
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AdminAnalytics } from "@/features/admin/analytics"
import { ENTRY_SOURCE_LABELS } from "@/features/admin/analytics-core"
import { AI_FEATURE_LABELS } from "@/lib/ai-features"

// Categorical slots in fixed order (validated for colour-blind separation on a light surface)
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
const GRID = "#e1e0d9"
const AXIS = "#898781"
const FREE_GRAY = "#b4b2aa"
// One colour per Pro source, the same in every chart that shows sources
const SOURCE_COLORS: Record<string, string> = { paid: SERIES[0], trial: SERIES[1], invite_trial: SERIES[2], referral_reward: SERIES[3], other: SERIES[6] }
// Sequential blue for the retention heatmap, lightest = near zero
const BLUE_RAMP = ["#f3f8fe", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"]

const baht = (n: number, digits = 0) => `฿${n.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
const num = (n: number) => n.toLocaleString("th-TH")
const pct = (n: number | null) => (n == null ? "–" : `${Math.round(n * 100)}%`)
const shortDay = (day: string) => `${Number(day.slice(8, 10))}/${Number(day.slice(5, 7))}`
const tooltipStyle = { borderRadius: 8, border: "1px solid rgba(11,11,11,0.10)", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)" }
// Legend text stays in neutral ink (the swatch carries the colour), in the order the series are drawn
const legendProps = { wrapperStyle: { fontSize: 12 }, itemSorter: null, formatter: (value: unknown) => <span style={{ color: "#52514e" }}>{String(value)}</span> } as const
const axisProps = { fontSize: 11, tickLine: false, axisLine: false, stroke: AXIS } as const

type Range = 30 | 90

export function AnalyticsDashboard({ data }: { data: AdminAnalytics }) {
  const [range, setRange] = useState<Range>(30)
  const k = data.kpis
  const slice = <T,>(rows: T[]) => rows.slice(-range)
  const aiFeatures = [...Object.keys(AI_FEATURE_LABELS), "other"]

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">สถิติการใช้งาน</h2>
          <p className="text-sm text-slate-500">
            ไม่นับบัญชีเดโม · วันตามเวลาไทย · ข้อมูล ณ {new Date(data.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-white p-1 text-sm" role="group" aria-label="ช่วงเวลาของกราฟ">
          {([30, 90] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={range === r}
              className={`rounded-md px-3 py-1 ${range === r ? "bg-slate-900 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {r} วัน
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ── */}
      <Section title="ผู้ใช้">
        <Kpi label="ผู้ใช้ทั้งหมด" value={num(k.totalUsers)} hint={`ใหม่ 7 วัน ${num(k.new7d)} · 30 วัน ${num(k.new30d)}`} />
        <Kpi label="Active วันนี้ (DAU)" value={num(k.dau)} hint={`WAU ${num(k.wau)} · MAU ${num(k.mau)}`} />
        <Kpi label="Stickiness (DAU/MAU)" value={pct(k.stickiness)} hint="ยิ่งสูง ยิ่งกลับมาใช้ทุกวัน" />
        <Kpi label="รายการต่อ active user (30 วัน)" value={k.entriesPerActiveUser == null ? "–" : k.entriesPerActiveUser.toFixed(1)} hint={`รวม ${num(k.entries30d)} รายการ`} />
      </Section>
      <Section title="แพ็กเกจและรายได้">
        <Kpi label="Pro ตอนนี้" value={num(k.proNow)} hint={`จ่ายเงินอยู่ ${num(k.payingNow)} คน`} />
        <Kpi label="MRR โดยประมาณ" value={baht(k.mrrThb)} hint="รายเดือนเต็ม + รายปี ÷ 12 ที่ยังอยู่ในรอบ" />
        <Kpi label="รายได้รวมทั้งหมด" value={baht(k.revenueTotalThb)} hint={`ผู้เคยจ่าย ${num(k.payingUsersEver)} คน`} />
        <Kpi label="ทดลองแล้วจ่าย (รวมทุกแบบ)" value={pct(k.trialConversion.rate)} hint={`${num(k.trialConversion.paid)} จาก ${num(k.trialConversion.ended)} คนที่ทดลองจบแล้ว`} />
      </Section>
      <Section title="Pro ตอนนี้ แยกตามที่มา">
        <Kpi label={segmentLabel(data, "paid")} value={num(segmentUsers(data, "paid"))} hint={`ผู้เคยจ่ายทั้งหมด ${num(k.payingUsersEver)} คน`} />
        <Kpi label={segmentLabel(data, "trial")} value={num(segmentUsers(data, "trial"))}
          hint={`ทดลองจบแล้วจ่าย ${pct(k.trialConversion14.rate)} (${num(k.trialConversion14.paid)}/${num(k.trialConversion14.ended)})`} />
        <Kpi label={segmentLabel(data, "invite_trial")} value={num(segmentUsers(data, "invite_trial"))}
          hint={`ทดลองจบแล้วจ่าย ${pct(k.trialConversionInvite.rate)} (${num(k.trialConversionInvite.paid)}/${num(k.trialConversionInvite.ended)})`} />
        <Kpi label={segmentLabel(data, "referral_reward")} value={num(segmentUsers(data, "referral_reward"))} hint={`แจกรางวัลไปแล้ว ${num(data.referrals.rewarded)} ครั้ง`} />
      </Section>
      <Section title="ต้นทุน AI (30 วัน)">
        <Kpi label="ค่า AI รวม" value={data.ai.available ? baht(k.aiCost30dThb, 2) : "–"} hint={data.ai.available ? "ราคาตาม docs/costs.md" : "ยังไม่ได้รัน migration AiUsage"} />
        <Kpi label="ค่า AI ต่อ active user" value={k.aiCostPerMauThb == null ? "–" : baht(k.aiCostPerMauThb, 2)} hint="ค่า AI ÷ MAU" />
        <Kpi label="นำเข้า statement" value={num(k.statementImports30d)} hint="ครั้ง" />
        <Kpi label="ตรวจสลิปชำระเงิน" value={num(k.slipVerifications30d)} hint="ครั้ง (EasySlip)" />
      </Section>

      {/* ── Growth and activity ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="ผู้ใช้สะสม" description="จำนวนบัญชีทั้งหมด ณ สิ้นวัน">
          <LineChart data={slice(data.growth)} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} {...axisProps} minTickGap={24} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={l => shortDay(String(l))} formatter={v => [num(Number(v)), "ผู้ใช้"]} />
            <Line type="monotone" dataKey="totalUsers" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartCard>
        <ChartCard title="ผู้ใช้ใหม่รายวัน" description="บัญชีที่สร้างในแต่ละวัน">
          <BarChart data={slice(data.growth)} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} {...axisProps} minTickGap={24} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} labelFormatter={l => shortDay(String(l))} formatter={v => [num(Number(v)), "ผู้ใช้ใหม่"]} />
            <Bar dataKey="newUsers" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard title="ผู้ใช้ที่ active" description="active = บันทึกรายการหรือใช้ AI ในวันนั้น · WAU/MAU นับย้อนหลัง 7/30 วันจากแต่ละวัน" tall>
        <LineChart data={slice(data.active)} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} {...axisProps} minTickGap={24} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={l => shortDay(String(l))} />
          <Legend {...legendProps} />
          <Line name="MAU" type="monotone" dataKey="mau" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line name="WAU" type="monotone" dataKey="wau" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line name="DAU" type="monotone" dataKey="dau" stroke={SERIES[2]} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartCard>

      {/* ── Retention and engagement ── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Retention รายสัปดาห์ตามรุ่นที่สมัคร</CardTitle>
          <CardDescription>% ของผู้ใช้แต่ละรุ่นที่กลับมา active ในสัปดาห์ที่ N หลังสมัคร (สัปดาห์เริ่มวันจันทร์)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <RetentionTable rows={data.retention} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="ความต่อเนื่อง: จำนวนวันที่ใช้ใน 30 วัน" description="ผู้ใช้ active แบ่งตามจำนวนวันที่กลับมาใช้">
          <BarChart data={data.activeDays} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={v => [num(Number(v)), "ผู้ใช้"]} />
            <Bar dataKey="users" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Funnel การใช้งาน (ตลอดเวลา)</CardTitle>
            <CardDescription>% เทียบกับขั้นก่อนหน้า</CardDescription>
          </CardHeader>
          <CardContent><Funnel rows={data.funnel} /></CardContent>
        </Card>
      </div>

      <ChartCard title="รายการที่บันทึก แยกตามช่องทาง" description="นับตามวันที่บันทึกเข้าระบบ · statement ที่ไม่มีเลขอ้างอิงจะนับเป็น “พิมพ์ / เพิ่มเอง”" tall>
        <BarChart data={slice(data.entriesBySource)} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} {...axisProps} minTickGap={24} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} labelFormatter={l => shortDay(String(l))} />
          <Legend {...legendProps} />
          {(["typed", "slip", "statement", "bill"] as const).map((key, i) => (
            <Bar key={key} name={ENTRY_SOURCE_LABELS[key]} dataKey={key} stackId="src" fill={SERIES[i]} stroke="#fff" strokeWidth={1} />
          ))}
        </BarChart>
      </ChartCard>

      {/* ── Plans and revenue ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="ผู้ใช้แยกตามแพ็กเกจและที่มา" description="จำนวนคนตอนนี้ · ถ้ามีหลายอย่างซ้อนกัน นับการจ่ายเงินที่ยังอยู่ในรอบก่อน แล้วจึงนับอันล่าสุด">
          <BarChart data={data.planMix} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="label" width={170} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={v => [num(Number(v)), "ผู้ใช้"]} />
            <Bar dataKey="users" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#52514e" }}
              shape={(props: unknown) => {
                const p = props as { x: number; y: number; width: number; height: number; payload: { segment: string } }
                const fill = SOURCE_COLORS[p.payload.segment] ?? FREE_GRAY
                return <rect x={p.x} y={p.y} width={Math.max(0, p.width)} height={p.height} rx={4} fill={fill} />
              }} />
          </BarChart>
        </ChartCard>
        <ChartCard title="รายได้รายเดือน (12 เดือน)" description="ยอดจากสลิป PromptPay ที่ตรวจแล้ว แยกแผนรายเดือน/รายปี">
          <BarChart data={data.revenue} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={m => `${Number(String(m).slice(5))}/${String(m).slice(2, 4)}`} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={v => `฿${num(Number(v))}`} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={v => baht(Number(v))} />
            <Legend {...legendProps} />
            <Bar name="รายเดือน ฿59" dataKey="MONTHLY" stackId="rev" fill={SERIES[0]} stroke="#fff" strokeWidth={1} />
            <Bar name="รายปี ฿590" dataKey="YEARLY" stackId="rev" fill={SERIES[1]} stroke="#fff" strokeWidth={1} />
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard title="Pro ใหม่รายสัปดาห์ แยกตามที่มา (12 สัปดาห์)" description="นับตอนเริ่ม: จ่ายเงิน, เริ่มทดลอง 14 วัน, เพื่อนที่ถูกชวนเริ่มทดลอง, ผู้ชวนได้รางวัล · สัปดาห์เริ่มวันจันทร์" tall>
        <BarChart data={data.proGrants} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="week" tickFormatter={w => shortDay(String(w))} {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} labelFormatter={l => `สัปดาห์ของ ${shortDay(String(l))}`} />
          <Legend {...legendProps} />
          {(["paid", "trial", "invite_trial", "referral_reward"] as const).map(key => (
            <Bar key={key} name={segmentLabel(data, key)} dataKey={key} stackId="grants" fill={SOURCE_COLORS[key]} stroke="#fff" strokeWidth={1} />
          ))}
        </BarChart>
      </ChartCard>

      <Section title="ชวนเพื่อน">
        <Kpi label="ถูกชวนทั้งหมด" value={num(data.referrals.total)} hint={`รอผล ${num(data.referrals.pending)}`} />
        <Kpi label="ผ่านเงื่อนไข" value={num(data.referrals.qualified)} hint="บันทึกครบตามกำหนด" />
        <Kpi label="หมดเวลา" value={num(data.referrals.expired)} hint="ไม่ผ่านใน 14 วัน" />
        <Kpi label="ผู้ชวนได้รางวัล" value={num(data.referrals.rewarded)} hint="ครั้ง (Pro 30 วัน)" />
      </Section>

      {/* ── AI ── */}
      {data.ai.available ? (
        <>
          <ChartCard title="ค่า AI รายวัน แยกตามฟีเจอร์ (บาท)"
            description={`คำนวณจาก token จริง × ราคา Gemini · เริ่มเก็บ ${data.ai.since ? new Date(data.ai.since).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : "–"}`} tall>
            <BarChart data={slice(data.ai.byDay)} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tickFormatter={d => shortDay(String(d))} {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} tickFormatter={v => `฿${Number(v).toFixed(Number(v) < 10 ? 1 : 0)}`} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} labelFormatter={l => shortDay(String(l))} formatter={v => baht(Number(v), 2)} />
              <Legend {...legendProps} />
              {aiFeatures.map((f, i) => (
                <Bar key={f} name={AI_FEATURE_LABELS[f as keyof typeof AI_FEATURE_LABELS] ?? "อื่นๆ"} dataKey={f} stackId="ai" fill={SERIES[i % SERIES.length]} stroke="#fff" strokeWidth={1} />
              ))}
            </BarChart>
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TableCard title="AI แยกตามฟีเจอร์ (30 วัน)"
              head={["ฟีเจอร์", "ครั้ง", "token เข้า", "token ออก", "฿ รวม", "฿/ครั้ง"]}
              rows={data.ai.byFeature.map(f => [f.label, num(f.calls), num(f.inputTokens), num(f.outputTokens), baht(f.costThb, 2), baht(f.calls ? f.costThb / f.calls : 0, 3)])} />
            <TableCard title="AI แยกตามแพ็กเกจ (30 วัน)"
              head={["แพ็กเกจ", "ผู้ใช้", "฿ รวม", "฿/คน"]}
              rows={data.ai.byPlan.map(p => [p.label, num(p.users), baht(p.costThb, 2), p.perUserThb == null ? "–" : baht(p.perUserThb, 2)])} />
          </div>
          <TableCard title="ผู้ใช้ที่ใช้ AI มากที่สุด (30 วัน)"
            head={["ผู้ใช้", "แพ็กเกจ", "ครั้ง", "token", "฿"]}
            rows={data.ai.topUsers.map(u => [u.name, u.plan, num(u.calls), num(u.tokens), baht(u.costThb, 2)])} />
        </>
      ) : (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="text-sm text-amber-800">
            ยังไม่มีข้อมูล token ของ AI: ต้องรัน migration <code>20261111120000_ai_usage</code> ก่อน แล้วระบบจะเริ่มเก็บตั้งแต่การเรียก AI ครั้งถัดไป
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const segmentLabel = (data: AdminAnalytics, segment: string) => data.planMix.find(p => p.segment === segment)?.label ?? segment
const segmentUsers = (data: AdminAnalytics, segment: string) => data.planMix.find(p => p.segment === segment)?.users ?? 0

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-500">{title}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

function ChartCard({ title, description, tall, children }: { title: string; description?: string; tall?: boolean; children: React.ReactElement }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={tall ? "h-80" : "h-64"}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function TableCard({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</p> : (
          <table className="w-full text-sm tabular-nums">
            <thead className="border-b text-left text-xs text-slate-500">
              <tr>{head.map((h, i) => <th key={h} className={`py-2 pr-3 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={`py-2 pr-3 ${j > 0 ? "text-right text-slate-600" : "font-medium text-slate-900"}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function RetentionTable({ rows }: { rows: AdminAnalytics["retention"] }) {
  const weeks = rows[0]?.rates.length ?? 0
  const cell = (rate: number | null) => {
    if (rate == null) return { background: "transparent", color: "transparent" }
    const step = Math.min(BLUE_RAMP.length - 1, Math.round(rate * (BLUE_RAMP.length - 1)))
    return { background: BLUE_RAMP[step], color: step >= 4 ? "#fff" : "#0b0b0b" }
  }
  return (
    <table className="w-full min-w-[560px] border-separate border-spacing-0.5 text-xs tabular-nums">
      <thead className="text-slate-500">
        <tr>
          <th className="py-1 pr-2 text-left font-medium">รุ่น (สัปดาห์ที่สมัคร)</th>
          <th className="py-1 pr-2 text-right font-medium">คน</th>
          {Array.from({ length: weeks }, (_, n) => <th key={n} className="py-1 text-center font-medium">W{n}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.cohort}>
            <td className="py-1 pr-2 text-slate-700">{shortDay(r.cohort)}</td>
            <td className="py-1 pr-2 text-right text-slate-500">{r.size}</td>
            {r.rates.map((rate, n) => (
              <td key={n} className="rounded py-1.5 text-center" style={cell(rate)} title={rate == null ? undefined : `W${n}: ${pct(rate)}`}>
                {rate == null ? "" : pct(rate)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Funnel({ rows }: { rows: AdminAnalytics["funnel"] }) {
  const top = rows[0]?.users || 1
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].users : null
        return (
          <div key={r.stage}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-slate-700">{r.stage}</span>
              <span className="tabular-nums text-slate-500">
                {num(r.users)}{prev != null && <> · {prev ? pct(r.users / prev) : "–"}</>}
              </span>
            </div>
            <div className="h-3 rounded bg-slate-100">
              <div className="h-3 rounded" style={{ width: `${(r.users / top) * 100}%`, background: SERIES[0] }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
