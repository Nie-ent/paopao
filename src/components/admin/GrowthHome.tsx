"use client"

import Link from "next/link"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts"
import { ArrowRight, BarChart3, Package } from "lucide-react"
import type { AdminAnalytics } from "@/features/admin/analytics"
import { ChartCard, Funnel, Kpi, SERIES, GRID, axisProps, baht, change, legendProps, num, pct, shortDay, tooltipStyle } from "@/components/admin/AnalyticsDashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Sums daily new users into Monday-start weeks (the last 12), with the cumulative total at each week's end. */
function weekly(growth: AdminAnalytics["growth"]) {
  const weeks = new Map<string, { week: string; newUsers: number; totalUsers: number }>()
  for (const d of growth) {
    const date = new Date(`${d.day}T00:00:00Z`)
    const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10)
    const w = weeks.get(monday) ?? { week: monday, newUsers: 0, totalUsers: 0 }
    w.newUsers += d.newUsers
    w.totalUsers = d.totalUsers
    weeks.set(monday, w)
  }
  return [...weeks.values()].slice(-12)
}

/**
 * The admin home: is PaoPao growing? Headline numbers against the previous 30 days, weekly
 * signups, active users, the path from signup to paying, and what needs doing.
 */
export function GrowthHome({ data, pendingClaims }: { data: AdminAnalytics; pendingClaims: number }) {
  const k = data.kpis
  const prev = data.previous
  const weeks = weekly(data.growth)
  const thisWeek = weeks.at(-1)?.newUsers ?? 0
  const lastWeek = weeks.at(-2)?.newUsers ?? 0
  const top = data.features.rows.filter(r => !r.feature.startsWith("page:")).slice(0, 5)

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">การเติบโตของเป๋าเป๋า</h2>
          <p className="text-sm text-slate-500">30 วันล่าสุด เทียบกับ 30 วันก่อนหน้า · ไม่นับบัญชีเดโม · ข้อมูล ณ {new Date(data.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
        </div>
        <Link href="/admin/analytics" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"><BarChart3 className="h-4 w-4" /> สถิติเชิงลึก <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="ผู้ใช้ใหม่ (30 วัน)" value={num(k.new30d)} delta={change(k.new30d, prev.new30d)} good="up" hint={`ทั้งหมด ${num(k.totalUsers)} คน · สัปดาห์นี้ ${num(thisWeek)}`} />
        <Kpi label="ผู้ใช้ active (MAU)" value={num(k.mau)} delta={change(k.mau, prev.mau)} good="up" hint={`DAU ${num(k.dau)} · stickiness ${pct(k.stickiness)}`} />
        <Kpi label="Pro ตอนนี้" value={num(k.proNow)} hint={`จ่ายเงิน ${num(k.payingNow)} · ทดลองแล้วจ่าย ${pct(k.trialConversion.rate)}`} />
        <Kpi label="รายได้ (30 วัน)" value={baht(k.revenue30dThb)} delta={change(k.revenue30dThb, prev.revenue30dThb)} good="up" hint={`MRR ≈ ${baht(k.mrrThb)}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="ผู้ใช้ใหม่รายสัปดาห์" description={`สัปดาห์นี้ ${num(thisWeek)} คน · สัปดาห์ก่อน ${num(lastWeek)} คน (สัปดาห์เริ่มวันจันทร์)`}>
          <BarChart data={weeks} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="week" tickFormatter={w => shortDay(String(w))} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} labelFormatter={l => `สัปดาห์ของ ${shortDay(String(l))}`} formatter={v => [num(Number(v)), "ผู้ใช้ใหม่"]} />
            <Bar dataKey="newUsers" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="ผู้ใช้สะสม" description="จำนวนบัญชีทั้งหมดเมื่อจบแต่ละสัปดาห์">
          <LineChart data={weeks} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="week" tickFormatter={w => shortDay(String(w))} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={l => `สัปดาห์ของ ${shortDay(String(l))}`} formatter={v => [num(Number(v)), "ผู้ใช้"]} />
            <Line type="monotone" dataKey="totalUsers" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ChartCard>
      </div>

      <ChartCard title="ผู้ใช้ที่ active (90 วัน)" description="active = บันทึกรายการหรือใช้ AI ในวันนั้น" tall>
        <LineChart data={data.active} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tickFormatter={d => shortDay(String(d))} {...axisProps} minTickGap={24} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={l => shortDay(String(l))} />
          <Legend {...legendProps} />
          <Line name="MAU" type="monotone" dataKey="mau" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line name="WAU" type="monotone" dataKey="wau" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line name="DAU" type="monotone" dataKey="dau" stroke={SERIES[2]} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>จากสมัครถึงจ่ายเงิน</CardTitle>
            <CardDescription>ตลอดเวลา · % เทียบกับขั้นก่อนหน้า ขั้นที่หล่นเยอะคือจุดที่ควรแก้ก่อน</CardDescription>
          </CardHeader>
          <CardContent><Funnel rows={data.funnel} /></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>ฟีเจอร์ที่คนใช้มากที่สุด (30 วัน)</CardTitle>
            <CardDescription>จำนวนคนที่ใช้ · ดูทั้งหมดที่สถิติเชิงลึก แท็บฟีเจอร์</CardDescription>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีข้อมูล ระบบเพิ่งเริ่มเก็บ</p> : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis type="category" dataKey="label" width={140} {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={v => [num(Number(v)), "คน"]} />
                    <Bar dataKey="people" fill={SERIES[0]} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#52514e" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pendingClaims > 0 && (
        <Link href="/admin/claims" className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 hover:bg-orange-100">
          <span className="flex items-center gap-2"><Package className="h-4 w-4" /> มีของรางวัลรอส่ง {num(pendingClaims)} รายการ</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
