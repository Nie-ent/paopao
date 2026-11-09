"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Pencil, Plus, Receipt, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useSingleFlight } from "@/hooks/use-single-flight"
import { Card, CardContent } from "@/components/ui/card"
import { getBills, saveBill, deleteBill, type BillInput } from "@/features/bills/actions"
import { EXPENSE_CATEGORIES } from "@/lib/categories"
import { useLanguage } from "@/contexts/LanguageContext"
import { cacheKeys } from "@/lib/cache-keys"
import { invalidateAll, load as loadCached, peek } from "@/lib/data-cache"

type Bill = Awaited<ReturnType<typeof getBills>>["bills"][number]
type Frequency = BillInput["frequency"]

const EMPTY = { name: "", category: "Utilities", amount: "", frequency: "MONTHLY" as Frequency, dayOfWeek: "1", dayOfMonth: "1" }

export default function BillsPage() {
  const { t } = useLanguage()
  // Cached data from another page or the app snapshot shows at once, then refreshes
  const cached = peek<Awaited<ReturnType<typeof getBills>>>(cacheKeys.bills)
  const [bills, setBills] = useState<Bill[]>(cached?.bills ?? [])
  const [isPro, setIsPro] = useState(cached?.isPro ?? false)
  const [limit, setLimit] = useState(cached?.limit ?? 20)
  const [loaded, setLoaded] = useState(!!cached)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const { run: runSave, pending: saving } = useSingleFlight()
  const { run: runDelete, pending: deleting } = useSingleFlight()
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null)

  const load = async (force = false) => {
    const res = await loadCached(cacheKeys.bills, getBills, { force })
    setBills(res.bills); setIsPro(res.isPro); setLimit(res.limit); setLoaded(true)
  }
  useEffect(() => { load() }, [])

  const weekdays = [0, 1, 2, 3, 4, 5, 6].map(d => t(`bills.weekday.${d}`))
  const schedule = (b: Bill) =>
    b.frequency === "DAILY" ? t('bills.freq.DAILY')
      : b.frequency === "WEEKLY" ? t('bills.every_weekday', { day: weekdays[b.dayOfWeek ?? 0] })
        : t('bills.every_month_day', { day: b.dayOfMonth ?? 1 })

  const openNew = () => { setEditingId(null); setForm(EMPTY) }
  const openEdit = (b: Bill) => {
    setEditingId(b.id)
    setForm({ name: b.name, category: b.category, amount: b.amount?.toString() ?? "", frequency: b.frequency, dayOfWeek: String(b.dayOfWeek ?? 1), dayOfMonth: String(b.dayOfMonth ?? 1) })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    void runSave(async () => {
    const res = await saveBill(editingId, {
      name: form.name,
      category: form.category,
      amount: form.amount ? Number(form.amount) : null,
      frequency: form.frequency,
      dayOfWeek: form.frequency === "WEEKLY" ? Number(form.dayOfWeek) : null,
      dayOfMonth: form.frequency === "MONTHLY" ? Number(form.dayOfMonth) : null,
    })
    if ("success" in res) { toast.success(t('bills.saved')); setForm(null); invalidateAll(); load(true) }
    else toast.error(t(`bills.error.${res.error}`))
    })
  }

  const confirmDelete = () => runDelete(async () => {
    if (!billToDelete) return
    const res = await deleteBill(billToDelete.id)
    if ("success" in res) { toast.success(t('bills.deleted')); invalidateAll(); load(true) }
    else toast.error(t(`bills.error.${res.error}`))
    setBillToDelete(null)
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {t('bills.title')} <Receipt className="w-6 h-6 text-primary" />
          </h1>
          <p className="text-muted-foreground mt-1">{t('bills.subtitle')}</p>
        </div>
        {isPro && !form && (
          <Button onClick={openNew} disabled={bills.length >= limit} className="rounded-xl gap-2 shrink-0">
            <Plus className="w-4 h-4" /> {t('bills.add')}
          </Button>
        )}
      </div>

      {loaded && !isPro && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
            <div className="flex gap-3">
              <Zap className="w-6 h-6 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{t('bills.pro_title')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('bills.pro_desc')}</p>
              </div>
            </div>
            <Link href="/subscription"><Button className="rounded-xl shrink-0">{t('bills.pro_cta')}</Button></Link>
          </CardContent>
        </Card>
      )}

      {form && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">{t('bills.form.name')}</span>
                <Input name="name" required maxLength={40} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('bills.form.name_ph')} />
              </label>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t('bills.form.category')}</span>
                <Select aria-label={t('bills.form.category')} value={form.category} onValueChange={v => setForm({ ...form, category: v })}
                  options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: t(`category.${c}`) }))} />
              </div>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t('bills.form.amount')}</span>
                <Input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder={t('bills.form.amount_ph')} />
              </label>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t('bills.form.frequency')}</span>
                <Select aria-label={t('bills.form.frequency')} value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v as Frequency })}
                  options={(["DAILY", "WEEKLY", "MONTHLY"] as const).map(f => ({ value: f, label: t(`bills.freq.${f}`) }))} />
              </div>
              {form.frequency === "WEEKLY" && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">{t('bills.form.weekday')}</span>
                  <Select aria-label={t('bills.form.weekday')} value={form.dayOfWeek} onValueChange={v => setForm({ ...form, dayOfWeek: v })}
                    options={weekdays.map((d, i) => ({ value: String(i), label: d }))} />
                </div>
              )}
              {form.frequency === "MONTHLY" && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">{t('bills.form.month_day')}</span>
                  <Select aria-label={t('bills.form.month_day')} value={form.dayOfMonth} onValueChange={v => setForm({ ...form, dayOfMonth: v })}
                    options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
                </div>
              )}
              <p className="text-xs text-muted-foreground sm:col-span-2">{t('bills.form.hint')}</p>
              <div className="flex gap-2 sm:col-span-2 justify-end">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setForm(null)}>{t('common.cancel')}</Button>
                <Button type="submit" loading={saving}>{t('common.save')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loaded && bills.length === 0 && !form && (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium text-foreground">{t('bills.empty_title')}</p>
          <p className="text-sm mt-1">{t('bills.empty_desc')}</p>
        </div>
      )}

      <div className="space-y-3">
        {bills.map(b => (
          <Card key={b.id} className="glass-panel">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{b.name}</p>
                <p className="text-sm text-muted-foreground">
                  {schedule(b)} · {t(`category.${b.category}`)}{b.amount ? ` · ฿${b.amount.toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {isPro && <Button variant="ghost" size="icon" aria-label={t('bills.edit')} onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>}
                <Button variant="ghost" size="icon" aria-label={t('common.delete')} onClick={() => setBillToDelete(b)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {isPro && bills.length > 0 && <p className="text-xs text-muted-foreground text-center">{t('bills.count', { count: bills.length, limit })}</p>}

      <AlertDialog open={!!billToDelete} onOpenChange={open => { if (!open && !deleting) setBillToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="w-5 h-5" />{t('bills.delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('bills.delete_desc', { name: billToDelete?.name ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <Button onClick={confirmDelete} loading={deleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{t('common.confirm_delete')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
