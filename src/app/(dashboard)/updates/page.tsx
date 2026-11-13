"use client"

import { useEffect } from "react"
import { Sparkles } from "lucide-react"

import { useLanguage } from "@/contexts/LanguageContext"
import { markReleasesSeen } from "@/features/releases/actions"
import { RELEASES } from "@/features/releases/notes"
import { cacheKeys } from "@/lib/cache-keys"
import { prime } from "@/lib/data-cache"

/** Every release note, newest first: where people read again what the "what's new" dialog said. */
export default function UpdatesPage() {
  const { t, language } = useLanguage()
  const lang = language === "en" ? "en" : "th"

  // Reading this page counts as reading the updates: no dialog or bell dot for them afterwards
  useEffect(() => {
    prime(cacheKeys.releases, [])
    window.dispatchEvent(new Event("releases_seen"))
    markReleasesSeen().catch(() => {})
  }, [])

  const dateOf = (id: string) => new Date(`${id.slice(0, 10)}T00:00:00+07:00`).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          {t("updates.title")} <Sparkles className="w-6 h-6 text-primary" />
        </h1>
        <p className="text-muted-foreground mt-1">{t("updates.subtitle")}</p>
      </div>
      <ol className="space-y-4">
        {RELEASES.map(r => (
          <li key={r.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-foreground">{r.title[lang]}</h2>
            <p className="text-xs text-muted-foreground">{r.version && <span className="font-medium">v{r.version} · </span>}<time dateTime={r.id.slice(0, 10)}>{dateOf(r.id)}</time></p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              {r.items.map(i => <li key={i.en}>{i[lang]}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
