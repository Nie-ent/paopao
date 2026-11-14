"use client"

/**
 * Building blocks of the dashboard home: a balance card with quick actions, compact chart tiles
 * that open a full view in a dialog, and the monthly analysis card. Everything important fits on
 * one screen; detail is one tap away.
 */
import Link from "next/link"
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowDownRight, ArrowUpRight, ChevronRight, Loader2, MessageCircle, Plus, Receipt, Sparkles, Target, UserPlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type Slice = { name: string; value: number; color: string }
export type Point = { name: string; income: number; expense: number }
type T = (key: string, vars?: Record<string, string | number>) => string

export const baht = (n: number) => `฿${n.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** "▲ 12%" vs the previous period; for spending, up is bad */
function Change({ now, before, upIsGood, t }: { now: number; before: number | null | undefined; upIsGood: boolean; t: T }) {
  if (before == null || before === 0) return null
  const d = (now - before) / before
  if (!Number.isFinite(d)) return null
  const good = d === 0 ? null : (d > 0) === upIsGood
  return (
    <span className={`text-[11px] font-medium ${good === null ? "text-white/70" : good ? "text-emerald-100" : "text-amber-100"}`} title={t("dash.vs_last_month")}>
      {d > 0 ? "▲" : d < 0 ? "▼" : ""} {Math.abs(Math.round(d * 100))}% <span className="font-normal text-white/60">{t("dash.vs_last_month")}</span>
    </span>
  )
}

export function BalanceCard({ label, balance, income, expense, previous, period, t }: {
  label: string; balance: number; income: number; expense: number
  previous: { totalIncome: number; totalExpense: number } | null
  period: React.ReactNode; t: T
}) {
  const actions = [
    { href: "/transactions", label: t("dash.actions.add"), icon: Plus },
    { href: "/bills", label: t("dash.actions.bills"), icon: Receipt },
    { href: "/goals", label: t("dash.actions.goals"), icon: Target },
    { href: "/chat", label: t("dash.actions.chat"), icon: MessageCircle },
    { href: "/invite", label: t("dash.actions.invite"), icon: UserPlus },
  ]
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#F28C6E] via-[#EC7656] to-[#D45E3E] p-5 text-white shadow-lg shadow-primary/20 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/80">{label}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-[2.6rem]">{baht(balance)}</p>
        </div>
        <div className="shrink-0">{period}</div>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
          <p className="flex items-center gap-1 text-xs text-white/80"><ArrowUpRight className="h-3.5 w-3.5" /> {t("common.income")}</p>
          <p className="text-lg font-semibold tabular-nums">{baht(income)}</p>
          <Change now={income} before={previous?.totalIncome} upIsGood t={t} />
        </div>
        <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
          <p className="flex items-center gap-1 text-xs text-white/80"><ArrowDownRight className="h-3.5 w-3.5" /> {t("common.expense")}</p>
          <p className="text-lg font-semibold tabular-nums">{baht(expense)}</p>
          <Change now={expense} before={previous?.totalExpense} upIsGood={false} t={t} />
        </div>
      </div>
      <nav className="relative mt-4 grid grid-cols-5 gap-1" aria-label="quick actions">
        {actions.map(a => (
          <Link key={a.href} href={a.href} className="group flex flex-col items-center gap-1.5 rounded-xl py-1.5 text-center text-[11px] leading-tight text-white/90 hover:bg-white/10 sm:text-xs">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#D45E3E] shadow-sm transition-transform group-hover:-translate-y-0.5"><a.icon className="h-5 w-5" /></span>
            {a.label}
          </Link>
        ))}
      </nav>
    </section>
  )
}

/** A compact tile that opens its full view; the whole tile is the button */
export function Tile({ title, onOpen, children, t }: { title: string; onOpen: () => void; children: React.ReactNode; t: T }) {
  return (
    <button onClick={onOpen} className="group flex min-w-[78%] snap-start flex-col rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:min-w-0">
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="flex items-center text-xs font-medium text-primary">{t("dash.view_all")}<ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
      </span>
      <span className="mt-2 flex flex-1 flex-col">{children}</span>
    </button>
  )
}

export function CashflowMini({ data, t }: { data: Point[]; t: T }) {
  const peak = data.reduce<Point | null>((best, p) => (p.expense > (best?.expense ?? 0) ? p : best), null)
  return (
    <>
      <span className="block h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="miniIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              <linearGradient id="miniOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
            </defs>
            <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#miniIn)" isAnimationActive={false} />
            <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#miniOut)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </span>
      <span className="mt-2 text-xs text-muted-foreground">{peak ? t("dash.tile.peak", { day: `${peak.name} · ${baht(peak.expense)}` }) : t("dash.tile.no_spending")}</span>
    </>
  )
}

/** Mini donut and the top three categories with their share */
export function CategoryMini({ data, empty, t }: { data: Slice[]; empty: string; t: T }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!data.length) return <span className="flex flex-1 items-center text-sm text-muted-foreground">{empty}</span>
  return (
    <span className="flex items-center gap-3">
      <span className="block h-20 w-20 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={24} outerRadius={38} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        {data.slice(0, 3).map(d => (
          <span key={d.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round((d.value / total) * 100)}%</span>
          </span>
        ))}
        {data.length > 3 && <span className="block text-[11px] text-muted-foreground">{t("dash.tile.more", { n: data.length - 3 })}</span>}
      </span>
    </span>
  )
}

export type Detail = { kind: "cashflow"; title: string; data: Point[] } | { kind: "categories"; title: string; data: Slice[]; empty: string }

/** The full view behind a tile */
export function DetailDialog({ detail, onClose, t }: { detail: Detail | null; onClose: () => void; t: T }) {
  return (
    <Dialog open={!!detail} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
        {detail?.kind === "cashflow" && (
          <div className="h-72 w-full [&_*:focus]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={detail.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fullIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="fullOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `฿${Number(v).toLocaleString()}`} width={64} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} formatter={v => baht(Number(v))} />
                <Area type="monotone" dataKey="income" name={t("common.income")} stroke="#10b981" strokeWidth={2} fill="url(#fullIn)" />
                <Area type="monotone" dataKey="expense" name={t("common.expense")} stroke="#ef4444" strokeWidth={2} fill="url(#fullOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {detail?.kind === "categories" && (detail.data.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{detail.empty}</p>
        ) : (
          <div className="space-y-4">
            <div className="h-52 w-full [&_*:focus]:outline-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={detail.data} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                    {detail.data.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={v => baht(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {(() => {
                const total = detail.data.reduce((s, d) => s + d.value, 0)
                return detail.data.map(d => (
                  <li key={d.name} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.color }} /><span className="truncate font-medium">{d.name}</span></span>
                    <span className="flex shrink-0 items-center gap-3"><span className="font-semibold tabular-nums">{baht(d.value)}</span><span className="w-12 text-right text-sm text-muted-foreground tabular-nums">{((d.value / total) * 100).toFixed(1)}%</span></span>
                  </li>
                ))
              })()}
            </ul>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  )
}

/**
 * The month's analysis: the saved headline, or a button to analyse (nothing runs on its own).
 * The link to the full report is always visible.
 */
export function InsightCard({ state, analysing, onAnalyse, locale, t }: {
  state: { status: string; headline?: string; generatedAt?: string; reason?: string } | null
  analysing: boolean; onAnalyse: () => void; locale: string; t: T
}) {
  const ready = state?.status === "ready"
  return (
    <section className="flex h-full flex-col rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-amber-50/60 p-5 shadow-sm dark:to-amber-950/10">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> {t("dash.insight.title")}</h3>
      <div className="mt-3 flex-1">
        {analysing ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("dash.insight.analysing")}</p>
        ) : ready ? (
          <>
            <p className="text-[15px] font-medium leading-relaxed text-foreground">{state!.headline}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t("dash.insight.as_of", { date: new Date(state!.generatedAt!).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }) })}</p>
          </>
        ) : state?.status === "error" ? (
          <p className="text-sm text-muted-foreground">{t(state.reason === "NO_DATA" ? "dashboard.insight.no_data" : state.reason === "QUOTA" ? "dashboard.insight.quota" : "dashboard.insight.error")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("dash.insight.cta_hint")}</p>
            <button onClick={onAnalyse} disabled={!state} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60">
              <Sparkles className="h-4 w-4" /> {t("dash.insight.cta")}
            </button>
          </>
        )}
      </div>
      <Link href="/ai-insights" className="mt-4 inline-flex items-center gap-1 self-start rounded-lg text-sm font-semibold text-primary hover:underline">
        {t("dash.insight.full")} <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  )
}
