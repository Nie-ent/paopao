"use client"

import React, { useEffect, useRef, useState } from "react"
import confetti from "canvas-confetti"
import { CalendarClock, Check, ChevronDown, ChevronLeft, Circle, CheckCircle2, Link as LinkIcon, Plus, Target, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { addGoalProgress, createGoal, deleteGoal, getGoals, toggleGoalCompletion, updateGoal } from "@/features/goals/actions"
import { getCategoryColors } from "@/features/settings/actions"
import { goalSyncCategories } from "@/lib/goal-sync-options"
import { toBangkokDateTimeInput } from "@/lib/dates"
import { useLanguage } from "@/contexts/LanguageContext"
import { cacheKeys } from "@/lib/cache-keys"
import { invalidateAll, load as loadCached, peek } from "@/lib/data-cache"
import { cn } from "@/lib/utils"

type Goal = NonNullable<Awaited<ReturnType<typeof getGoals>>["data"]>[number]
/** What the person wants to do; decides the form and the default way progress is counted */
type Kind = "SAVE" | "DEBT" | "DAILY" | "TODO"
type Source = "CATEGORY" | "MANUAL"

const KINDS: { kind: Kind; icon: string; category?: string }[] = [
  { kind: "SAVE", icon: "🐷", category: "Saving" },
  { kind: "DEBT", icon: "💳", category: "Debt Payment" },
  { kind: "DAILY", icon: "📅" },
  { kind: "TODO", icon: "✅" },
]
const DAY_MS = 86_400_000
const baht = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`

function kindOf(g: Goal): Kind {
  if (g.type === "TODO") return "TODO"
  if (g.trackCategory === "DAILY_BALANCE") return "DAILY"
  return g.trackCategory === "Debt Payment" ? "DEBT" : "SAVE"
}

/**
 * Goals: money goals with how much is left and what it takes per month, a checklist of to-dos,
 * and finished ones tucked away. New goals start from what the person wants to do (save, pay off
 * a debt, save daily, a to-do) and get a sensible way of counting progress by default.
 */
export default function GoalsPage() {
  const { t, tc, locale } = useLanguage()
  const [goals, setGoals] = useState<Goal[]>(() => peek<Awaited<ReturnType<typeof getGoals>>>(cacheKeys.goals)?.data ?? [])
  const [loading, setLoading] = useState(() => !peek(cacheKeys.goals))
  const [categoryNames, setCategoryNames] = useState<string[]>(() => Object.keys(peek<Awaited<ReturnType<typeof getCategoryColors>>>(cacheKeys.categoryColors)?.categoryColors ?? {}))
  const [editor, setEditor] = useState<{ goal: Goal | null; kind: Kind | null } | null>(null)
  const [adding, setAdding] = useState<Goal | null>(null)
  const [showDone, setShowDone] = useState(false)
  const celebrated = useRef(new Set<string>())
  // "Now" for days-left labels, fixed for the visit
  const [now] = useState(() => Date.now())
  const toggling = useRef(new Set<string>())

  const fetchGoals = (force = false) =>
    loadCached(cacheKeys.goals, getGoals, { force })
      .then(res => { if (res?.data) setGoals(res.data); else toast.error(t("goals.load_failed")) })
      .catch(() => toast.error(t("goals.load_failed")))
      .finally(() => setLoading(false))
  useEffect(() => {
    fetchGoals()
    loadCached(cacheKeys.categoryColors, getCategoryColors).then(r => setCategoryNames(Object.keys(r.categoryColors ?? {}))).catch(() => {})
  }, [])

  // A goal that reaches its target: celebrate once and mark it done
  useEffect(() => {
    for (const g of goals) {
      if (celebrated.current.has(g.id) || g.type !== "FINANCIAL" || g.isCompleted || !(g.targetAmount > 0) || g.currentAmount < g.targetAmount) continue
      celebrated.current.add(g.id)
      setTimeout(() => {
        confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } })
        toast.success(t("goals.achieved_toast", { title: g.title }), { duration: 8000 })
      }, 600)
      toggleGoalCompletion(g.id, true).then(invalidateAll)
    }
    // Links from LINE reminders point at a to-do: scroll to it
    if (goals.length && window.location.hash) setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" }), 300)
  }, [goals, t])

  const toggleTodo = async (g: Goal) => {
    if (toggling.current.has(g.id)) return
    toggling.current.add(g.id)
    setGoals(prev => prev.map(x => (x.id === g.id ? { ...x, isCompleted: !g.isCompleted } : x)))
    try {
      const res = await toggleGoalCompletion(g.id, !g.isCompleted)
      invalidateAll()
      if (!res.success) { toast.error(t("goals.toast.status_failed")); fetchGoals(true) }
    } finally {
      toggling.current.delete(g.id)
    }
  }

  const money = goals.filter(g => g.type !== "TODO" && !g.isCompleted)
  const todos = goals.filter(g => g.type === "TODO" && !g.isCompleted)
  const done = goals.filter(g => g.isCompleted)
  const daysTo = (d: Date | string | null) => (d ? Math.ceil((new Date(d).getTime() - now) / DAY_MS) : null)
  const shortDate = (d: Date | string, time = false) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } : { year: "2-digit" }), timeZone: "Asia/Bangkok" })

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground/90 sm:text-3xl"><Target className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" /> {t("goals.title")}</h2>
          <p className="text-muted-foreground">{t("goals2.lead")}</p>
        </div>
        <Button data-tour="goals-add" className="shrink-0 rounded-xl shadow-lg shadow-primary/20" onClick={() => setEditor({ goal: null, kind: null })}>
          <Plus className="mr-1.5 h-4 w-4" /> {t("goals2.add")}
        </Button>
      </div>

      {!loading && goals.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
          <p className="text-lg font-semibold text-foreground">{t("goals2.empty_title")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("goals2.empty_desc")}</p>
          <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.map(k => (
              <button key={k.kind} onClick={() => setEditor({ goal: null, kind: k.kind })} className="rounded-2xl border border-border bg-card p-3 text-sm font-medium hover:border-primary/50 hover:bg-primary/5">
                <span className="block text-2xl">{k.icon}</span>{t(`goals2.kind.${k.kind}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {money.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("goals2.money_title")} · {money.length}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {money.map(g => {
              const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
              const left = Math.max(0, g.targetAmount - g.currentAmount)
              const days = daysTo(g.deadline)
              const months = days != null && days > 0 ? Math.max(1, days / 30.4) : null
              const kind = kindOf(g)
              const manual = !g.trackCategory
              return (
                <div key={g.id} className="flex flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <button onClick={() => setEditor({ goal: g, kind })} className="text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-tight text-foreground">{KINDS.find(k => k.kind === kind)?.icon} {g.title}</p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{Math.floor(pct)}%</span>
                    </div>
                    <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{baht(g.currentAmount)} <span className="text-sm font-normal text-muted-foreground">/ {baht(g.targetAmount)}</span></p>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {kind !== "DAILY" && <span>{t("goals2.left", { amount: baht(left) })}</span>}
                      {days != null && <span className={cn(days < 0 && "text-destructive")}>{days < 0 ? t("goals2.overdue") : t("goals2.days_left", { n: days })}</span>}
                      {months && left > 0 && kind !== "DAILY" && <span className="font-medium text-foreground/80">{t("goals2.per_month", { amount: baht(Math.ceil(left / months)) })}</span>}
                    </div>
                  </button>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs">
                    <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                      {manual ? t("goals2.source_manual_short") : <><LinkIcon className="h-3 w-3 shrink-0" /><span className="truncate">{g.trackCategory === "DAILY_BALANCE" ? t("goals2.source_daily_short") : t("goals2.source_category_short", { category: tc(g.trackCategory!) })}</span></>}
                    </span>
                    {manual && <button onClick={() => setAdding(g)} className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 font-semibold text-primary hover:bg-primary/20">+ {t("goals2.add_amount")}</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {todos.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("goals2.todo_title")} · {todos.length}</h3>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {todos.map(g => {
              const days = daysTo(g.deadline)
              return (
                <li key={g.id} id={g.id} className="flex items-center gap-3 px-4 py-3 target:bg-primary/5">
                  <button onClick={() => toggleTodo(g)} aria-label={t("goals2.mark_done")} className="shrink-0 text-muted-foreground hover:text-primary"><Circle className="h-6 w-6" /></button>
                  <button onClick={() => setEditor({ goal: g, kind: "TODO" })} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium text-foreground">{g.title}</p>
                    {g.description && <p className="truncate text-xs text-muted-foreground">{g.description}</p>}
                  </button>
                  {g.deadline && (
                    <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs", days != null && days < 0 ? "bg-destructive/10 text-destructive" : days != null && days <= 1 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground")}>
                      <CalendarClock className="h-3 w-3" /> {shortDate(g.deadline, true)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <button onClick={() => setShowDone(v => !v)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("h-4 w-4 transition-transform", !showDone && "-rotate-90")} /> {t("goals2.done_title")} · {done.length}
          </button>
          {showDone && (
            <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card/60">
              {done.map(g => (
                <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                  {g.type === "TODO"
                    ? <button onClick={() => toggleTodo(g)} aria-label={t("goals2.mark_undone")} className="shrink-0 text-primary"><CheckCircle2 className="h-5 w-5" /></button>
                    : <span className="shrink-0 text-primary"><Check className="h-5 w-5" /></span>}
                  <button onClick={() => setEditor({ goal: g, kind: kindOf(g) })} className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground line-through">{g.title}</button>
                  {g.type !== "TODO" && <span className="text-xs tabular-nums text-muted-foreground">{baht(g.targetAmount)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <GoalEditor state={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); invalidateAll(); fetchGoals(true) }} categoryNames={categoryNames} />
      <AddAmountDialog goal={adding} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); invalidateAll(); fetchGoals(true) }} />
    </div>
  )
}

/** New goal (pick what you want to do first) or edit; delete lives here, behind a confirm */
function GoalEditor({ state, onClose, onSaved, categoryNames }: { state: { goal: Goal | null; kind: Kind | null } | null; onClose: () => void; onSaved: () => void; categoryNames: string[] }) {
  const { t, tc } = useLanguage()
  const [kind, setKind] = useState<Kind | null>(null)
  const [title, setTitle] = useState("")
  const [target, setTarget] = useState("")
  const [source, setSource] = useState<Source>("CATEGORY")
  const [category, setCategory] = useState("Saving")
  const [deadline, setDeadline] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const goal = state?.goal ?? null

  // Load the goal (or a fresh form) each time the dialog opens
  const openKey = state ? (goal?.id ?? `new-${state.kind ?? ""}`) : null
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  if (openKey !== loadedKey) {
    setLoadedKey(openKey)
    setConfirmDelete(false)
    const k = state?.kind ?? null
    setKind(k)
    setTitle(goal?.title ?? "")
    setTarget(goal?.targetAmount ? String(goal.targetAmount) : "")
    const tracked = goal?.trackCategory && goal.trackCategory !== "DAILY_BALANCE" ? goal.trackCategory : null
    setSource(goal ? (tracked ? "CATEGORY" : "MANUAL") : "CATEGORY")
    setCategory(tracked ?? KINDS.find(x => x.kind === k)?.category ?? "Saving")
    setDeadline(goal?.deadline ? toBangkokDateTimeInput(new Date(goal.deadline)) : "")
    setNotes(goal?.description ?? "")
  }

  const pickKind = (k: Kind) => { setKind(k); setCategory(KINDS.find(x => x.kind === k)?.category ?? "Saving"); setSource("CATEGORY") }
  const sync = goalSyncCategories(categoryNames)
  const categoryOptions = [
    ...sync.expense.map(c => ({ value: c, label: `${t("goals.form.sync_group_expense")} · ${tc(c)}` })),
    ...sync.custom.map(c => ({ value: c, label: c })),
    ...sync.income.map(c => ({ value: c, label: `${t("goals.form.sync_group_income")} · ${tc(c)}` })),
    { value: "Income", label: t("goals.form.sync_income") },
    ...(category && ![...sync.expense, ...sync.custom, ...sync.income, "Income"].includes(category) ? [{ value: category, label: category }] : []),
  ]

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kind || saving) return
    setSaving(true)
    const fd = new FormData()
    fd.set("title", title.trim())
    fd.set("type", kind === "TODO" ? "TODO" : "FINANCIAL")
    if (kind !== "TODO") fd.set("targetAmount", target)
    fd.set("trackCategory", kind === "DAILY" ? "DAILY_BALANCE" : kind === "TODO" || source === "MANUAL" ? "" : category)
    fd.set("description", kind === "TODO" ? notes : "")
    fd.set("deadline", kind === "TODO" ? deadline.slice(0, 16) : deadline.slice(0, 10))
    const res = goal ? await updateGoal(goal.id, fd) : await createGoal(fd)
    setSaving(false)
    if (res.success) { toast.success(goal ? t("goals.toast.updated") : t("goals.toast.created")); onSaved() }
    else toast.error(res.error || t("common.something_wrong"))
  }

  const remove = async () => {
    if (!goal) return
    setSaving(true)
    const res = await deleteGoal(goal.id)
    setSaving(false)
    if (res.success) { toast.success(t("goals.toast.deleted")); onSaved() }
    else toast.error(t("goals.toast.delete_failed"))
  }

  return (
    <Dialog open={!!state} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!goal && kind && <button onClick={() => setKind(null)} aria-label={t("goals2.back")} className="-ml-1 rounded-full p-1 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>}
            {goal ? t("goals2.edit_title") : kind ? `${KINDS.find(k => k.kind === kind)?.icon} ${t(`goals2.kind.${kind}`)}` : t("goals2.new_title")}
          </DialogTitle>
          {!kind && <DialogDescription>{t("goals2.pick_kind")}</DialogDescription>}
        </DialogHeader>

        {!kind ? (
          <div className="grid gap-2">
            {KINDS.map(k => (
              <button key={k.kind} onClick={() => pickKind(k.kind)} className="flex items-center gap-3 rounded-2xl border border-border p-3 text-left hover:border-primary/50 hover:bg-primary/5">
                <span className="text-2xl">{k.icon}</span>
                <span><span className="block font-semibold text-foreground">{t(`goals2.kind.${k.kind}`)}</span><span className="block text-xs text-muted-foreground">{t(`goals2.kind_desc.${k.kind}`)}</span></span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <Field label={t("goals.form.title")}>
              <Input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder={t(`goals2.title_ph.${kind}`)} />
            </Field>
            {kind !== "TODO" && (
              <Field label={kind === "DAILY" ? t("goals2.target_daily") : kind === "DEBT" ? t("goals2.target_debt") : t("goals2.target_save")}>
                <Input required type="number" inputMode="decimal" min="1" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder={kind === "DAILY" ? "100" : "10000"} />
              </Field>
            )}
            {(kind === "SAVE" || kind === "DEBT") && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("goals2.source_title")}</p>
                <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", source === "CATEGORY" ? "border-primary bg-primary/5" : "border-border")}>
                  <input type="radio" className="mt-1 accent-[var(--primary)]" checked={source === "CATEGORY"} onChange={() => setSource("CATEGORY")} />
                  <span className="min-w-0 flex-1 space-y-2">
                    <span className="block text-sm font-medium">{t("goals2.source_category", { category: tc(category) })}</span>
                    <span className="block text-xs text-muted-foreground">{t(kind === "DEBT" ? "goals2.source_category_hint_debt" : "goals2.source_category_hint_save")}</span>
                    {source === "CATEGORY" && <Select aria-label={t("goals.form.sync")} value={category} onValueChange={setCategory} options={categoryOptions} />}
                  </span>
                </label>
                <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", source === "MANUAL" ? "border-primary bg-primary/5" : "border-border")}>
                  <input type="radio" className="mt-1 accent-[var(--primary)]" checked={source === "MANUAL"} onChange={() => setSource("MANUAL")} />
                  <span><span className="block text-sm font-medium">{t("goals2.source_manual")}</span><span className="block text-xs text-muted-foreground">{t("goals2.source_manual_hint")}</span></span>
                </label>
              </div>
            )}
            {kind === "DAILY" && <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">{t("goals2.daily_hint")}</p>}
            {kind === "TODO" && (
              <Field label={t("goals.form.details")}>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("goals.form.details_ph")} className="flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring" />
              </Field>
            )}
            <Field label={kind === "TODO" ? t("goals2.deadline_todo") : t("goals2.deadline_money")}>
              <Input type={kind === "TODO" ? "datetime-local" : "date"} value={deadline.slice(0, kind === "TODO" ? 16 : 10)} onChange={e => setDeadline(e.target.value)} />
            </Field>

            <Button type="submit" loading={saving} className="w-full rounded-xl">{goal ? t("common.save") : t("goals2.create")}</Button>
            {goal && (confirmDelete ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
                <Button type="button" className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" loading={saving} onClick={remove}>{t("common.confirm_delete")}</Button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-center gap-1.5 py-1 text-sm text-destructive hover:underline"><Trash2 className="h-4 w-4" /> {t("goals2.delete")}</button>
            ))}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** "+ add amount" for goals tracked by hand (taking some back is allowed too) */
function AddAmountDialog({ goal, onClose, onSaved }: { goal: Goal | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage()
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const submit = async (sign: 1 | -1) => {
    if (!goal || !Number(amount)) return
    setSaving(true)
    const res = await addGoalProgress(goal.id, sign * Number(amount))
    setSaving(false)
    if (res.success) { setAmount(""); onSaved() } else toast.error(t("common.something_wrong"))
  }
  return (
    <Dialog open={!!goal} onOpenChange={o => { if (!o) { setAmount(""); onClose() } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{goal?.title}</DialogTitle><DialogDescription>{goal && t("goals2.add_amount_desc", { current: baht(goal.currentAmount), target: baht(goal.targetAmount) })}</DialogDescription></DialogHeader>
        <Input autoFocus type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={!Number(amount) || saving} onClick={() => submit(-1)}>− {t("goals2.take_back")}</Button>
          <Button className="flex-1" disabled={!Number(amount)} loading={saving} onClick={() => submit(1)}>+ {t("goals2.add_amount")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}</label>
}
