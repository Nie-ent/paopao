"use client"

import React, { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, BrainCircuit, RefreshCw, ShieldCheck, Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { analyzeMonth, getMonthlyInsight, type MonthlyInsight } from "@/features/ai/insight"
import { INSIGHT_REDOS_PER_DAY } from "@/features/ai/insight-limits"
import { useLanguage } from "@/contexts/LanguageContext"

/**
 * This month's full analysis. Shows the saved one; the AI runs only when the user presses
 * "analyse" (first time) or "analyse again" (with the latest numbers, a few times a day).
 */
export default function AIInsightsPage() {
  const { t, language, locale, hydrated } = useLanguage()
  const [insight, setInsight] = useState<MonthlyInsight | null>(null)
  const [last, setLast] = useState<Extract<MonthlyInsight, { status: "ready" }> | null>(null)
  const [running, setRunning] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    if (!hydrated) return
    getMonthlyInsight(language).then(r => { setInsight(r); if (r.status === "ready") setLast(r) })
  }, [language, hydrated])

  const run = async (fresh: boolean) => {
    // Each run is a paid AI call: never two at once
    if (busy.current) return
    busy.current = true
    setRunning(true)
    const r = await analyzeMonth(language, fresh).catch(() => ({ status: "error", period: "", reason: "AI_ERROR" }) as MonthlyInsight)
    setInsight(r)
    if (r.status === "ready") setLast(r)
    setRunning(false)
    busy.current = false
  }

  const monthName = (period: string) => {
    const [y, m] = period.split("-").map(Number)
    return y ? new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }) : ""
  }
  const shown = insight?.status === "ready" ? insight : last
  const error = insight?.status === "error" ? insight.reason : null
  const errorText = error === "LIMIT" ? t("insight.limit", { n: INSIGHT_REDOS_PER_DAY })
    : error === "NO_DATA" ? t("ai.error.no_data") : error === "QUOTA" ? t("ai.error.quota") : error ? t("ai.error.failed") : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground/90"><Sparkles className="h-8 w-8 text-primary" /> {t("insight.title")}</h2>
        <p className="text-muted-foreground">{t("insight.subtitle")}</p>
      </div>

      <Card className="glass-panel overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl"><BrainCircuit className="h-6 w-6 text-primary" /> {t("insight.month", { month: monthName(insight?.period ?? "") })}</CardTitle>
          {shown && <CardDescription>{t("insight.as_of", { date: new Date(shown.generatedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) })}</CardDescription>}
        </CardHeader>

        <CardContent className="flex min-h-[260px] flex-col justify-center pt-2">
          {errorText && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {errorText}
            </div>
          )}
          {running ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="mb-4 h-10 w-10 animate-spin text-primary/50" />
              <p className="animate-pulse">{t("ai.loading")}</p>
            </motion.div>
          ) : shown ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="prose prose-sm max-w-none dark:prose-invert md:prose-base prose-h1:text-primary prose-h2:text-primary/80 prose-a:text-primary">
              <p className="lead font-medium text-foreground">{shown.headline}</p>
              <ReactMarkdown>{shown.report}</ReactMarkdown>
            </motion.div>
          ) : insight ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-muted-foreground">{t("insight.empty")}</p>
              <Button onClick={() => run(false)} className="rounded-xl"><Sparkles className="mr-2 h-4 w-4" /> {t("insight.run")}</Button>
            </div>
          ) : (
            <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-3 border-t border-primary/10 bg-primary/5 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> {t("ai.footer.anonymous")}</div>
          {shown && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button variant="outline" size="sm" onClick={() => run(true)} disabled={running} className="border-primary/20 text-primary hover:bg-primary/10">
                <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} /> {t("insight.redo")}
              </Button>
              <span>{t("insight.redo_hint", { n: INSIGHT_REDOS_PER_DAY })}</span>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
