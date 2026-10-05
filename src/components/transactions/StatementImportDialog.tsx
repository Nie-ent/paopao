"use client"

import React, { useState } from "react"
import { FileUp, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/LanguageContext"
import { importStatementRows } from "@/features/transactions/actions"
import type { StatementPreviewRow } from "@/lib/statement"

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void }

const ACCEPT = ".pdf,.csv,.xlsx,.xls,image/png,image/jpeg,image/webp"
const KNOWN_ERRORS = ["TOO_LARGE", "UNSUPPORTED", "PASSWORD_REQUIRED", "WRONG_PASSWORD", "NO_ROWS", "AI_BUSY"]

export function StatementImportDialog({ open, onOpenChange, onImported }: Props) {
  const { t, tc, locale } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [needsPassword, setNeedsPassword] = useState(false)
  const [rows, setRows] = useState<StatementPreviewRow[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null)

  const reset = () => {
    setFile(null); setPassword(""); setNeedsPassword(false); setRows(null); setSelected(new Set()); setBusy(null)
  }

  const close = (next: boolean) => {
    if (busy) return
    if (!next) reset()
    onOpenChange(next)
  }

  const readStatement = async () => {
    if (!file) return
    setBusy("reading")
    try {
      const body = new FormData()
      body.append("file", file)
      if (password) body.append("password", password)
      const res = await fetch("/api/statements/preview", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "PASSWORD_REQUIRED" || data.error === "WRONG_PASSWORD") setNeedsPassword(true)
        toast.error(t(KNOWN_ERRORS.includes(data.error) ? `statement.error.${data.error}` : "statement.error.FAILED"))
        return
      }
      const preview = data.rows as StatementPreviewRow[]
      setRows(preview)
      // Rows that look already recorded start unticked
      setSelected(new Set(preview.flatMap((r, i) => (r.duplicateOf ? [] : [i]))))
    } catch {
      toast.error(t("statement.error.FAILED"))
    } finally {
      setBusy(null)
    }
  }

  const importSelected = async () => {
    if (!rows) return
    setBusy("importing")
    const chosen = rows.filter((_, i) => selected.has(i)).map(({ date, time, type, amount, category, note, reference }) => ({ date, time, type, amount, category, note, reference }))
    const res = await importStatementRows(chosen)
    setBusy(null)
    if (!res.success) {
      toast.error(t("statement.error.FAILED"))
      return
    }
    toast.success(t("statement.imported", { count: res.imported }), res.skipped ? { description: t("statement.skipped", { count: res.skipped }) } : undefined)
    reset()
    onOpenChange(false)
    onImported()
  }

  const toggle = (i: number) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  })

  const duplicateCount = rows?.filter(r => r.duplicateOf).length ?? 0
  const allSelected = !!rows && selected.size === rows.length

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("statement.title")}</DialogTitle>
          <DialogDescription>{rows ? t("statement.preview_desc") : t("statement.desc")}</DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="space-y-4 py-2">
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors">
              <FileUp className="h-8 w-8 text-primary" />
              <span className="font-medium">{file ? file.name : t("statement.choose_file")}</span>
              <span className="text-xs text-muted-foreground">{t("statement.formats")}</span>
              <input type="file" accept={ACCEPT} className="sr-only" onChange={e => { setFile(e.target.files?.[0] ?? null); setNeedsPassword(false) }} />
            </label>
            {(needsPassword || file?.name.toLowerCase().endsWith(".pdf")) && (
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("statement.password")}</label>
                <Input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("statement.password_ph")} />
                <p className="text-xs text-muted-foreground">{t("statement.password_hint")}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {t("statement.found", { count: rows.length })}
                {duplicateCount > 0 && <span className="text-amber-600 dark:text-amber-400"> · {t("statement.duplicates", { count: duplicateCount })}</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((_, i) => i)))}>
                {allSelected ? t("statement.select_none") : t("statement.select_all")}
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {rows.map((row, i) => (
                <label key={i} className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/40 ${selected.has(i) ? "" : "opacity-60"}`}>
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={selected.has(i)} onChange={() => toggle(i)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(`${row.date}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}{row.time ? ` ${row.time}` : ""}</span>
                      <Badge variant="outline" className="font-normal">{tc(row.category)}</Badge>
                      {row.duplicateOf && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> {t(row.duplicateOf.reason === "reference" ? "statement.dup_reference" : "statement.dup_amount")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{row.note}</p>
                  </div>
                  <span className={`shrink-0 font-semibold ${row.type === "INCOME" ? "text-[#00B900]" : ""}`}>
                    {row.type === "INCOME" ? "+" : "-"}฿{row.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {rows ? (
            <>
              <Button variant="outline" onClick={() => { setRows(null); setSelected(new Set()) }} disabled={!!busy}>{t("statement.back")}</Button>
              <Button onClick={importSelected} disabled={!!busy || selected.size === 0}>
                {busy === "importing" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("statement.import", { count: selected.size })}
              </Button>
            </>
          ) : (
            <Button onClick={readStatement} disabled={!file || !!busy} className="w-full sm:w-auto">
              {busy === "reading" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("statement.reading")}</> : t("statement.read")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
