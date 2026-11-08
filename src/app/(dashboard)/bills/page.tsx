"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Pencil, Plus, Receipt, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { getBills, saveBill, deleteBill, type BillInput } from "@/features/bills/actions"
import { EXPENSE_CATEGORIES } from "@/lib/categories"
import { useLanguage } from "@/contexts/LanguageContext"

type Bill = Awaited<ReturnType<typeof getBills>>["bills"][number]
type Frequency = BillInput["frequency"]

const EMPTY = { name: "", category: "Utilities", amount: "", frequency: "MONTHLY" as Frequency, dayOfWeek: "1", dayOfMonth: "1" }

export default function BillsPage() {
  const { t } = useLanguage()
  const [bills, setBills] = useState<Bill[]>([])
  const [isPro, setIsPro] = useState(false)
  const [limit, setLimit] = useState(20)
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await getBills()
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    const res = await saveBill(editingId, {
      name: form.name,
      category: form.category,
      amount: form.amount ? Number(form.amount) : null,
      frequency: form.frequency,
      dayOfWeek: form.frequency === "WEEKLY" ? Number(form.dayOfWeek) : null,
      dayOfMonth: form.frequency === "MONTHLY" ? Number(form.dayOfMonth) : null,
    })
    setSaving(false)
    if ("success" in res) { toast.success(t('bills.saved')); setForm(null); load() }
    else toast.error(t(`bills.error.${res.error}`))
  }

  const remove = async (id: string) => {
    const res = await deleteBill(id)
    if ("success" in res) { toast.success(t('bills.deleted')); load() }
  }

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
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t('bills.form.category')}</span>
                <select name="category" className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t('bills.form.amount')}</span>
                <Input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder={t('bills.form.amount_ph')} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t('bills.form.frequency')}</span>
                <select name="frequency" className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as Frequency })}>
                  {(["DAILY", "WEEKLY", "MONTHLY"] as const).map(f => <option key={f} value={f}>{t(`bills.freq.${f}`)}</option>)}
                </select>
              </label>
              {form.frequency === "WEEKLY" && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">{t('bills.form.weekday')}</span>
                  <select name="dayOfWeek" className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}>
                    {weekdays.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </label>
              )}
              {form.frequency === "MONTHLY" && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">{t('bills.form.month_day')}</span>
                  <select name="dayOfMonth" className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={form.dayOfMonth} onChange={e => setForm({ ...form, dayOfMonth: e.target.value })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              )}
              <p className="text-xs text-muted-foreground sm:col-span-2">{t('bills.form.hint')}</p>
              <div className="flex gap-2 sm:col-span-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={saving}>{t('common.save')}</Button>
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
                <Button variant="ghost" size="icon" aria-label={t('common.delete')} onClick={() => remove(b.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {isPro && bills.length > 0 && <p className="text-xs text-muted-foreground text-center">{t('bills.count', { count: bills.length, limit })}</p>}
    </div>
  )
}
