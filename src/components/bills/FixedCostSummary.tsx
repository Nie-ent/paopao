"use client"

import { Lightbulb, PiggyBank, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/contexts/LanguageContext"
import type { FixedCostSummary, Suggestion } from "@/lib/fixed-costs"

const baht = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`

/** Monthly fixed costs vs. income: how much is already spoken for, and what could be cut. */
export function FixedCostSummaryCard({ summary }: { summary: FixedCostSummary }) {
  const { t } = useLanguage()
  if (summary.items.length === 0) return null
  const pct = summary.percentOfIncome
  const essentialShare = summary.total > 0 ? (summary.essential / summary.total) * 100 : 0
  const tone = pct === null ? "" : pct > 60 ? "text-destructive" : pct > 40 ? "text-amber-600" : "text-emerald-600"
  return (
    <Card className="border-primary/20">
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("fixed.total")}</p>
            <p className="text-3xl font-bold text-foreground">{baht(summary.total)}<span className="ml-1 text-base font-normal text-muted-foreground">{t("fixed.per_month")}</span></p>
          </div>
          {pct !== null && (
            <div className="text-right">
              <p className={`text-2xl font-bold ${tone}`}>{pct}%</p>
              <p className="text-xs text-muted-foreground">{t("fixed.of_income", { income: baht(summary.avgIncome!) })}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="bg-primary" style={{ width: `${essentialShare}%` }} />
            <div className="bg-amber-400" style={{ width: `${100 - essentialShare}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" />{t("fixed.essential")} {baht(summary.essential)}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{t("fixed.optional")} {baht(summary.optional)}</span>
          </div>
        </div>

        {summary.freeCash !== null && (
          <p className="rounded-xl bg-muted/50 p-3 text-sm text-foreground">
            <PiggyBank className="mr-1.5 inline h-4 w-4 text-primary" />
            {t("fixed.free_cash", { amount: baht(summary.freeCash) })}
            {summary.optional > 0 && <> {t("fixed.cut_hint", { amount: baht(summary.optional) })}</>}
          </p>
        )}
        {summary.avgIncome === null && <p className="text-xs text-muted-foreground">{t("fixed.no_income")}</p>}
        {summary.withoutAmount > 0 && <p className="text-xs text-muted-foreground">{t("fixed.without_amount", { count: summary.withoutAmount })}</p>}
      </CardContent>
    </Card>
  )
}

/** Payments that repeat monthly in the user's entries but aren't listed yet: forgotten subscriptions. */
export function FixedCostSuggestions({ suggestions, onAdd, adding }: { suggestions: Suggestion[]; onAdd: (s: Suggestion) => void; adding: string | null }) {
  const { t } = useLanguage()
  if (suggestions.length === 0) return null
  return (
    <Card className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/10">
      <CardContent className="p-5 space-y-3">
        <div className="flex gap-2">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-foreground">{t("fixed.suggest_title")}</p>
            <p className="text-sm text-muted-foreground">{t("fixed.suggest_desc")}</p>
          </div>
        </div>
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
          {suggestions.map(s => (
            <li key={s.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">{t("fixed.suggest_meta", { amount: baht(s.amount), months: s.months, category: t(`category.${s.category}`) })}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 gap-1" loading={adding === s.name} disabled={adding !== null} onClick={() => onAdd(s)}>
                {adding !== s.name && <Plus className="h-4 w-4" />} {t("fixed.suggest_add")}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
