"use client"

import { useEffect, useState } from "react"
import { Check, Circle, Loader2 } from "lucide-react"

import { useLanguage } from "@/contexts/LanguageContext"
import type { ImportProgress, ImportStep } from "@/lib/statement-runner"

type ItemState = "done" | "active" | "todo"
const ORDER: ImportStep[] = ["prepare", "read", "dedupe", "done"]

/** Checklist of the import's steps, ticking off as they finish, with the AI's progress through the file. */
export function StatementProgress({ progress, isImage, startedAt }: { progress: ImportProgress; isImage: boolean; startedAt: number }) {
  const { t } = useLanguage()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000))

  const at = ORDER.indexOf(progress.step)
  const state = (step: ImportStep): ItemState => (ORDER.indexOf(step) < at || progress.step === "done" ? "done" : step === progress.step ? "active" : "todo")
  const pct = progress.chunks ? Math.round((progress.chunksDone / progress.chunks) * 100) : 0

  const items: { key: string; state: ItemState; label: string; detail?: string }[] = isImage
    ? [
        { key: "prepare", state: state("prepare"), label: t("statement.step.read_image") },
        { key: "done", state: progress.step === "done" ? "done" : "todo", label: t("statement.step.ready") },
      ]
    : [
        { key: "prepare", state: state("prepare"), label: t("statement.step.open"), detail: progress.chunks ? t("statement.step.parts", { count: progress.chunks }) : undefined },
        {
          key: "read", state: state("read"), label: t("statement.step.read"),
          detail: progress.chunks ? t("statement.step.read_detail", { done: progress.chunksDone, total: progress.chunks, rows: progress.rowsFound }) : undefined,
        },
        { key: "dedupe", state: state("dedupe"), label: t("statement.step.dedupe") },
        { key: "done", state: progress.step === "done" ? "done" : "todo", label: t("statement.step.ready") },
      ]

  return (
    <div className="space-y-4 py-2" role="status" aria-live="polite">
      <ol className="space-y-3">
        {items.map(item => (
          <li key={item.key} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
              {item.state === "done" ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white animate-in zoom-in duration-300"><Check className="h-4 w-4" /></span>
              ) : item.state === "active" ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${item.state === "todo" ? "text-muted-foreground" : "font-medium text-foreground"}`}>{item.label}</p>
              {item.detail && item.state !== "todo" && <p className="text-xs text-muted-foreground">{item.detail}</p>}
              {item.key === "read" && item.state === "active" && progress.chunks > 0 && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {t("statement.step.elapsed", { seconds })}
        {progress.failedChunks > 0 && <> · <span className="text-amber-600">{t("statement.step.failed_parts", { count: progress.failedChunks })}</span></>}
      </p>
    </div>
  )
}
