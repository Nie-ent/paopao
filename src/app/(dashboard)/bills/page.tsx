"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, ChevronRight, Plus, Receipt, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSingleFlight } from "@/hooks/use-single-flight"
import { getBills, getFixedCosts, saveBill, deleteBill, type BillInput } from "@/features/bills/actions"
import { FixedCostSuggestions, FixedCostSummaryCard } from "@/components/bills/FixedCostSummary"
import { monthlyAmount, type Suggestion } from "@/lib/fixed-costs"
import { EXPENSE_CATEGORIES } from "@/lib/categories"
import { useLanguage } from "@/contexts/LanguageContext"
import { cacheKeys } from "@/lib/cache-keys"
import { invalidateAll, load as loadCached, peek } from "@/lib/data-cache"
import { cn } from "@/lib/utils"

type Bill = Awaited<ReturnType<typeof getBills>>["bills"][number]
type Frequency = BillInput["frequency"]
type Form = { name: string; category: string; amount: string; frequency: Frequency; dayOfWeek: number; dayOfMonth: number; essential: boolean }

const EMPTY: Form = { name: "", category: "Utilities", amount: "", frequency: "MONTHLY", dayOfWeek: 1, dayOfMonth: 1, essential: true }
/** Suggested payments in these categories are usually things people could cut */
const LIKELY_OPTIONAL = ["Entertainment", "Shopping", "Personal Care", "Education"]
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`

/** The next Bangkok day (from today) the bill falls on; a month day past the month's end falls on its last day. */
function nextDue(b: Pick<Bill, "frequency" | "dayOfWeek" | "dayOfMonth">, now = new Date()) {
  const bkk = new Date(now.getTime() + 7 * 3600_000)
  for (let i = 0; i < 62; i++) {
    const d = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() + i))
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    const due = b.frequency === "DAILY" || (b.frequency === "WEEKLY" && d.getUTCDay() === b.dayOfWeek) || (b.frequency === "MONTHLY" && Math.min(b.dayOfMonth ?? 1, last) === d.getUTCDate())
    if (due) return { date: d, inDays: i }
  }
  return null
}

/**
 * Fixed costs and recurring bills: what's spoken for each month, each bill with when it's next
 * due, split into essentials and things that could be cut. Adding or editing opens a short form
 * with tappable days instead of long dropdowns.
 */
export default function BillsPage() {
  const { t, locale } = useLanguage()
  const cached = peek<Awaited<ReturnType<typeof getBills>>>(cacheKeys.bills)
  const [bills, setBills] = useState<Bill[]>(cached?.bills ?? [])
  const [isPro, setIsPro] = useState(cached?.isPro ?? false)
  const [limit, setLimit] = useState(cached?.limit ?? 20)
  const [loaded, setLoaded] = useState(!!cached)
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  type Fixed = Awaited<ReturnType<typeof getFixedCosts>>
  const [fixed, setFixed] = useState<Fixed | undefined>(() => peek<Fixed>(cacheKeys.fixedCosts))
  const [adding, setAdding] = useState<string | null>(null)

  const load = (force = false) =>
    Promise.all([loadCached(cacheKeys.bills, getBills, { force }), loadCached(cacheKeys.fixedCosts, getFixedCosts, { force })]).then(([res, fc]) => {
      setBills(res.bills); setIsPro(res.isPro); setLimit(res.limit); setLoaded(true); setFixed(fc)
    })
  useEffect(() => { void load() }, [])

  const addSuggestion = async (s: Suggestion) => {
    setAdding(s.name)
    const res = await saveBill(null, { name: s.name, category: s.category, amount: s.amount, frequency: "MONTHLY", dayOfWeek: null, dayOfMonth: s.dayOfMonth, essential: !LIKELY_OPTIONAL.includes(s.category) })
    setAdding(null)
    if ("success" in res) { toast.success(t("fixed.suggest_added", { name: s.name })); invalidateAll(); load(true) }
    else toast.error(t(`bills.error.${res.error}`))
  }

  const weekdays = [0, 1, 2, 3, 4, 5, 6].map(d => t(`bills.weekday.${d}`))
  const schedule = (b: Bill) => b.frequency === "DAILY" ? t("bills.freq.DAILY")
    : b.frequency === "WEEKLY" ? t("bills.every_weekday", { day: weekdays[b.dayOfWeek ?? 0] }) : t("bills.every_month_day", { day: b.dayOfMonth ?? 1 })
  const dueText = (b: Bill) => {
    const n = nextDue(b)
    if (!n) return ""
    if (n.inDays === 0) return t("bills2.due_today")
    if (n.inDays === 1) return t("bills2.due_tomorrow")
    return t("bills2.due_on", { date: n.date.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" }), n: n.inDays })
  }
  const openEdit = (b: Bill) => setEditing({ id: b.id, form: { name: b.name, category: b.category, amount: b.amount?.toString() ?? "", frequency: b.frequency, dayOfWeek: b.dayOfWeek ?? 1, dayOfMonth: b.dayOfMonth ?? 1, essential: b.essential } })

  const sorted = [...bills].sort((a, b) => (nextDue(a)?.inDays ?? 99) - (nextDue(b)?.inDays ?? 99))
  const groups = [
    { key: "essential", title: t("fixed.essential"), items: sorted.filter(b => b.essential) },
    { key: "optional", title: t("fixed.optional"), items: sorted.filter(b => !b.essential) },
  ].filter(g => g.items.length)

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 animate-in fade-in duration-500 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("bills.title")} <Receipt className="h-6 w-6 shrink-0 text-primary" /></h1>
          <p className="mt-1 text-muted-foreground">{t("bills.subtitle")}</p>
        </div>
        {loaded && (
          <Button data-tour="bills-add" onClick={() => setEditing({ id: null, form: EMPTY })} disabled={bills.length >= limit} className="shrink-0 gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t("bills.add")}</span><span className="sm:hidden">{t("bills2.add_short")}</span>
          </Button>
        )}
      </div>

      {fixed && <div data-tour="bills-summary"><FixedCostSummaryCard summary={fixed.summary} /></div>}

      {loaded && bills.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 py-12 text-center text-muted-foreground">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="font-medium text-foreground">{t("bills.empty_title")}</p>
          <p className="mt-1 px-6 text-sm">{t("bills.empty_desc")}</p>
          <Button className="mt-4 rounded-xl" onClick={() => setEditing({ id: null, form: EMPTY })}><Plus className="mr-1.5 h-4 w-4" /> {t("bills.add")}</Button>
        </div>
      )}

      {groups.map(g => (
        <section key={g.key} className="space-y-2">
          <h3 className="flex items-baseline justify-between text-sm font-semibold text-muted-foreground">
            <span>{g.title} · {g.items.length}</span>
            <span className="font-normal tabular-nums">{baht(g.items.reduce((s, b) => s + (b.amount ? monthlyAmount(b) : 0), 0))}{t("fixed.per_month")}</span>
          </h3>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {g.items.map(b => (
              <li key={b.id}>
                <button onClick={() => openEdit(b)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{b.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{schedule(b)} · {t(`category.${b.category}`)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-foreground">{b.amount ? `฿${b.amount.toLocaleString("th-TH")}` : "–"}</span>
                    <span className={cn("block text-xs", nextDue(b)?.inDays === 0 ? "font-medium text-primary" : "text-muted-foreground")}>{dueText(b)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {bills.length > 0 && <p className="text-center text-xs text-muted-foreground">{t("bills.count", { count: bills.length, limit })}</p>}

      {loaded && !isPro && bills.length > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <div className="flex gap-3">
            <Zap className="h-5 w-5 shrink-0 text-primary" />
            <div><p className="text-sm font-semibold text-foreground">{t("bills.pro_title")}</p><p className="text-xs text-muted-foreground">{t("bills.pro_desc")}</p></div>
          </div>
          <Link href="/subscription"><Button size="sm" className="shrink-0 rounded-xl">{t("bills.pro_cta")}</Button></Link>
        </div>
      )}

      {fixed && <FixedCostSuggestions suggestions={fixed.suggestions} onAdd={addSuggestion} adding={adding} />}

      <BillEditor editing={editing} isPro={isPro} weekdays={weekdays} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidateAll(); load(true) }} />
    </div>
  )
}

function BillEditor({ editing, isPro, weekdays, onClose, onSaved }: {
  editing: { id: string | null; form: Form } | null; isPro: boolean; weekdays: string[]; onClose: () => void; onSaved: () => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState<Form>(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { run, pendingKey } = useSingleFlight()
  // Load the bill (or an empty form) each time the dialog opens
  const key = editing ? (editing.id ?? "new") : null
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  if (key !== loadedKey) { setLoadedKey(key); setConfirmDelete(false); if (editing) setForm(editing.form) }
  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const res = await saveBill(editing?.id ?? null, {
        name: form.name, category: form.category, amount: form.amount ? Number(form.amount) : null, frequency: form.frequency,
        dayOfWeek: form.frequency === "WEEKLY" ? form.dayOfWeek : null, dayOfMonth: form.frequency === "MONTHLY" ? form.dayOfMonth : null, essential: form.essential,
      })
      if ("success" in res) { toast.success(t("bills.saved")); onSaved() } else toast.error(t(`bills.error.${res.error}`))
    }, "save")
  }
  const remove = () => run(async () => {
    if (!editing?.id) return
    const res = await deleteBill(editing.id)
    if ("success" in res) { toast.success(t("bills.deleted")); onSaved() } else toast.error(t(`bills.error.${res.error}`))
  }, "delete")

  const chip = (active: boolean) => cn("rounded-lg border text-sm transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")

  return (
    <Dialog open={!!editing} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{editing?.id ? t("bills.edit") : t("bills.add")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5"><span className="text-sm font-medium">{t("bills.form.name")}</span>
            <Input required maxLength={40} value={form.name} onChange={e => set({ name: e.target.value })} placeholder={t("bills.form.name_ph")} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm font-medium">{t("bills2.amount")}</span>
              <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder={t("bills.form.amount_ph")} />
            </label>
            <div className="space-y-1.5"><span className="block text-sm font-medium">{t("bills.form.category")}</span>
              <Select aria-label={t("bills.form.category")} value={form.category} onValueChange={v => set({ category: v })} options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: t(`category.${c}`) }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{t("bills2.when")}</span>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup">
              {(["MONTHLY", "WEEKLY", "DAILY"] as const).map(f => (
                <button key={f} type="button" role="radio" aria-checked={form.frequency === f} onClick={() => set({ frequency: f })}
                  className={cn("rounded-lg py-1.5 text-sm", form.frequency === f ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}>{t(`bills.freq.${f}`)}</button>
              ))}
            </div>
          </div>
          {form.frequency === "MONTHLY" && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">{t("bills.form.month_day")}</span>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <button key={d} type="button" onClick={() => set({ dayOfMonth: d })} aria-pressed={form.dayOfMonth === d} className={cn(chip(form.dayOfMonth === d), "h-9 tabular-nums")}>{d}</button>
                ))}
              </div>
              {form.dayOfMonth > 28 && <p className="text-xs text-muted-foreground">{t("bills2.month_end_hint")}</p>}
            </div>
          )}
          {form.frequency === "WEEKLY" && (
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
              {weekdays.map((d, i) => (
                <button key={i} type="button" onClick={() => set({ dayOfWeek: i })} aria-pressed={form.dayOfWeek === i} className={cn(chip(form.dayOfWeek === i), "px-1 py-2 text-xs")}>{d.replace(/^วัน/, "")}</button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{t("bills2.kind")}</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set({ essential: true })} className={cn("rounded-xl border p-2.5 text-left", form.essential ? "border-primary bg-primary/5" : "border-border")}>
                <span className="block text-sm font-semibold">{t("fixed.essential")}</span><span className="block text-xs text-muted-foreground">{t("bills2.essential_hint")}</span>
              </button>
              <button type="button" onClick={() => set({ essential: false })} className={cn("rounded-xl border p-2.5 text-left", !form.essential ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "border-border")}>
                <span className="block text-sm font-semibold">{t("fixed.optional")}</span><span className="block text-xs text-muted-foreground">{t("bills2.optional_hint")}</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t(isPro ? "bills.form.hint" : "fixed.form_hint_free")}</p>
          <Button type="submit" className="w-full rounded-xl" loading={pendingKey === "save"} disabled={pendingKey !== null}>{t("common.save")}</Button>
          {editing?.id && (confirmDelete ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
              <Button type="button" className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" loading={pendingKey === "delete"} onClick={remove}>{t("common.confirm_delete")}</Button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-center gap-1.5 py-1 text-sm text-destructive hover:underline"><Trash2 className="h-4 w-4" /> {t("bills.delete_title")}</button>
          ))}
        </form>
      </DialogContent>
    </Dialog>
  )
}
