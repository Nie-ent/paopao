"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { BalanceCard, CashflowMini, CategoryMini, DetailDialog, InsightCard, Tile, type Detail, type Slice } from "@/components/dashboard/Overview"
import { getDashboardData } from "@/features/dashboard/actions"
import { getPaydaySetting, setPayday } from "@/features/settings/actions"
import { analyzeMonth, getMonthlyInsight, type MonthlyInsight } from "@/features/ai/insight"
import { claimDynamicQuest, getActiveQuests } from "@/features/quests/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { useSingleFlight } from "@/hooks/use-single-flight"
import { questText } from "@/lib/localized"
import { openQuests } from "@/lib/quests"
import { cacheKeys } from "@/lib/cache-keys"
import { invalidateAll, load as loadCached, peek } from "@/lib/data-cache"

type Timeframe = "ALL" | "YTD" | "MONTH"
const PAYDAY_HINT_KEY = "paopao_payday_hint_dismissed"
type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

/**
 * The home screen: the period's balance with quick actions, compact chart tiles that open in full,
 * and PaoPao's saved monthly analysis. Fits on one screen; details are a tap away.
 */
export default function DashboardOverview() {
  const { t, tc, language, locale, hydrated } = useLanguage()
  const [timeframe, setTimeframe] = useState<Timeframe>("MONTH")
  // 0 = the current pay cycle, worked out by the server from the user's payday (src/lib/pay-cycle.ts)
  const [selectedMonth, setSelectedMonth] = useState<number>(0)
  const [selectedYear, setSelectedYear] = useState<number>(0)
  // This month's numbers from the cache (an earlier visit or the app snapshot) show at once
  const [dbData, setDbData] = useState<DashboardData | null>(() => peek(cacheKeys.dashboard("MONTH", 0, 0, locale)) ?? null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [insight, setInsight] = useState<MonthlyInsight | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [questsOpen, setQuestsOpen] = useState(false)
  const [activeQuests, setActiveQuests] = useState<Awaited<ReturnType<typeof getActiveQuests>>>(() => peek<Awaited<ReturnType<typeof getActiveQuests>>>(cacheKeys.quests) ?? [])
  const { run: runClaim, pendingKey: claimingId } = useSingleFlight()
  const questsToShow = openQuests(activeQuests)

  const loadQuests = (force = false) => loadCached(cacheKeys.quests, getActiveQuests, { force }).then(setActiveQuests)
  useEffect(() => { loadQuests() }, [])

  useEffect(() => {
    // Wait for the saved language: before hydration ends it is always Thai
    if (!hydrated) return
    const key = cacheKeys.dashboard(timeframe, selectedMonth, selectedYear, locale)
    setDbData(peek(key) ?? null)
    loadCached(key, () => getDashboardData(timeframe, selectedMonth || undefined, selectedYear || undefined, locale))
      .then(setDbData)
      .catch(() => setDbData({ error: "Failed to load" } as DashboardData))
  }, [timeframe, selectedMonth, selectedYear, locale, hydrated])

  // Offer pay cycles to people whose salary arrives on the same day each month (once; "no" is remembered)
  const [paydayHint, setPaydayHint] = useState<number | null>(null)
  useEffect(() => {
    if (!hydrated) return
    let dismissed = false
    try { dismissed = localStorage.getItem(PAYDAY_HINT_KEY) === "1" } catch { /* private mode */ }
    if (dismissed) return
    getPaydaySetting().then(s => { if (s && !s.payday && s.suggested) setPaydayHint(s.suggested) }).catch(() => {})
  }, [hydrated])
  const answerPayday = async (use: boolean) => {
    const day = paydayHint
    setPaydayHint(null)
    try { localStorage.setItem(PAYDAY_HINT_KEY, "1") } catch { /* private mode */ }
    if (!use || !day) return
    const res = await setPayday(day)
    if (res?.success) {
      invalidateAll()
      setSelectedMonth(0); setSelectedYear(0)
      loadCached(cacheKeys.dashboard(timeframe, 0, 0, locale), () => getDashboardData(timeframe, undefined, undefined, locale), { force: true }).then(setDbData)
      toast.success(t("settings.payday_saved"))
    }
  }

  // The saved analysis only: opening the dashboard never runs the AI
  useEffect(() => {
    if (!hydrated) return
    getMonthlyInsight(language).then(setInsight).catch(() => setInsight({ status: "none", period: "" }))
  }, [language, hydrated])

  const analyse = async () => {
    if (analysing) return
    setAnalysing(true)
    try { setInsight(await analyzeMonth(language)) } finally { setAnalysing(false) }
  }

  const handleClaimDynamicQuest = (questId: string) => runClaim(async () => {
    const res = await claimDynamicQuest(questId)
    if (res.success) {
      toast.success(t("dashboard.quests.claim_success"))
      invalidateAll()
      loadQuests(true)
      loadCached(cacheKeys.dashboard(timeframe, selectedMonth, selectedYear, locale), () => getDashboardData(timeframe, selectedMonth || undefined, selectedYear || undefined, locale), { force: true }).then(setDbData)
      window.dispatchEvent(new Event("points_updated"))
    } else {
      toast.error(t(res.error || "common.something_wrong"))
    }
  }, questId)

  if (!dbData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-muted-foreground animate-in fade-in">
        <motion.img src="/favicon.png" alt="Loading..." className="mb-4 h-16 w-16 drop-shadow-md" animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }} />
        <p className="animate-pulse font-medium">{t("dashboard.syncing")}</p>
      </div>
    )
  }
  if ("error" in dbData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-destructive animate-in fade-in">
        <p className="mb-2 text-xl font-bold">{t("dashboard.error")}</p>
        <p>{dbData.error}</p>
      </div>
    )
  }

  const { chartData, stats } = dbData
  const named = (list: Slice[]) => list.map(c => ({ ...c, name: tc(c.name) }))
  const income = named(dbData.incomeByCategory)
  const expense = named(dbData.expenseByCategory)
  // With a payday, "this month" is a pay cycle: name it by its dates
  const fmtDay = (key: string) => new Date(`${key}T12:00:00+07:00`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })
  const cycleLabel = timeframe === "MONTH" && dbData.period?.payday && dbData.period.start ? `${fmtDay(dbData.period.start)} – ${fmtDay(dbData.period.end)}` : undefined
  const balanceLabel = t(timeframe === "MONTH" ? (dbData.period?.payday ? "dash.balance_cycle" : "dash.balance_month") : timeframe === "YTD" ? "dash.balance_year" : "dash.balance_all")
  // Money on hand: what was left before this cycle plus this cycle's income minus spending
  const onHand = Math.round(((dbData.carryOver ?? 0) + stats.totalIncome - stats.totalExpense) * 100) / 100
  const thisYear = new Date().getFullYear()
  // The cycle on screen (a payday of the 25th makes late-November "December")
  const shown = dbData.period ?? { year: thisYear, month: new Date().getMonth() + 1, start: "", end: "", payday: null, isCurrent: true }

  const period = (
    <div className="flex flex-col items-end gap-2">
      <div className="flex rounded-full bg-white/15 p-0.5 text-xs" role="group">
        {(["MONTH", "YTD", "ALL"] as Timeframe[]).map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)} aria-pressed={timeframe === tf}
            className={`rounded-full px-3 py-1 ${timeframe === tf ? "bg-white font-semibold text-[#D45E3E]" : "text-white/85 hover:text-white"}`}>
            {t(tf === "MONTH" ? "dashboard.time.month" : tf === "YTD" ? "dashboard.time.ytd" : "dashboard.time.all")}
          </button>
        ))}
      </div>
      {timeframe === "MONTH" && (
        <div className="flex gap-1.5">
          <Select variant="glass" aria-label="Month" value={String(selectedMonth || shown.month)} onValueChange={v => { setSelectedMonth(Number(v)); if (!selectedYear) setSelectedYear(shown.year) }}
            options={Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ value: String(m), label: new Date(0, m - 1).toLocaleString(locale, { month: "short" }) }))} />
          <Select variant="glass" aria-label="Year" value={String(selectedYear || shown.year)} onValueChange={v => { setSelectedYear(Number(v)); if (!selectedMonth) setSelectedMonth(shown.month) }}
            options={Array.from({ length: 5 }, (_, i) => Math.max(thisYear, shown.year) - i).map(y => ({ value: String(y), label: String(y + (language === "th" ? 543 : 0)) }))} />
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="fold-split grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="fold-span-1 lg:col-span-2">
          <BalanceCard label={balanceLabel} sublabel={cycleLabel}
            balance={timeframe === "MONTH" && dbData.carryOver != null ? onHand : stats.totalBalance}
            carryOver={timeframe === "MONTH" ? dbData.carryOver : null}
            income={stats.totalIncome} expense={stats.totalExpense}
            previous={timeframe === "MONTH" ? dbData.previous : null}
            allowance={timeframe === "MONTH" ? dbData.allowance : null} period={period} t={t} />
        </div>
        <InsightCard state={insight} analysing={analysing} onAnalyse={analyse} locale={locale} t={t} />
      </div>

      {paydayHint && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">💰 {t("dash.payday.ask", { day: paydayHint })}</p>
            <p className="text-xs text-muted-foreground">{t("dash.payday.why")}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => answerPayday(true)} className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">{t("dash.payday.use")}</button>
            <button onClick={() => answerPayday(false)} className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">{t("dash.payday.no")}</button>
          </div>
        </div>
      )}

      {/* Compact charts: a swipeable row on phones, three columns on wider screens */}
      <div data-tour="tiles" className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        <Tile title={t("dash.tile.cashflow")} onOpen={() => setDetail({ kind: "cashflow", title: t("dashboard.cashflow.title"), data: chartData })} t={t}>
          <CashflowMini data={chartData} t={t} />
        </Tile>
        <Tile title={t("dash.tile.spending")} onOpen={() => setDetail({ kind: "categories", title: t("dash.tile.spending"), data: expense, empty: t("dash.tile.no_spending") })} t={t}>
          <CategoryMini data={expense} empty={t("dash.tile.no_spending")} t={t} />
        </Tile>
        <Tile title={t("dash.tile.income")} onOpen={() => setDetail({ kind: "categories", title: t("dash.tile.income"), data: income, empty: t("dash.tile.no_income") })} t={t}>
          <CategoryMini data={income} empty={t("dash.tile.no_income")} t={t} />
        </Tile>
      </div>

      {questsToShow.length > 0 && (
        <button onClick={() => setQuestsOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-orange-200/60 bg-gradient-to-r from-orange-50 to-amber-50/60 px-4 py-3 text-left text-sm shadow-sm transition-shadow hover:shadow-md dark:from-orange-950/20 dark:to-orange-900/10">
          <span className="font-semibold text-orange-700 dark:text-orange-300">🎯 {t("dash.quests.count", { n: questsToShow.length })}</span>
          <span className="flex items-center text-xs font-medium text-orange-700 dark:text-orange-300">{t("dash.view_all")}<ChevronRight className="h-3.5 w-3.5" /></span>
        </button>
      )}

      <DetailDialog detail={detail} onClose={() => setDetail(null)} t={t} />

      <Dialog open={questsOpen} onOpenChange={setQuestsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>🎯 {t("dashboard.quests.title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {questsToShow.map(q => (
              <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl border border-orange-200/60 bg-orange-50/50 p-3 dark:bg-orange-950/10">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight text-foreground">{questText(q, language).title}</p>
                  <p className="text-xs text-muted-foreground">{questText(q, language).description}</p>
                  {q.condition === "LOG_TRANSACTION_TODAY" && <span className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{t("dashboard.quests.log_today")}</span>}
                </div>
                <Button size="sm" disabled={claimingId !== null} onClick={() => handleClaimDynamicQuest(q.id)}
                  className="shrink-0 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 font-bold text-white hover:from-orange-600 hover:to-amber-600">
                  {claimingId === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.quests.claim", { points: q.points })}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
