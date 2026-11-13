"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/LanguageContext"
import { getReleaseNotes, markReleasesSeen } from "@/features/releases/actions"
import type { ReleaseNote } from "@/features/releases/notes"
import { ReleaseMedia } from "@/components/releases/ReleaseMedia"
import { cacheKeys } from "@/lib/cache-keys"
import { load as loadCached, prime } from "@/lib/data-cache"

/** Shows what changed since the user last looked, once per release, on any device. */
export function WhatsNewDialog() {
  const { t, language, hydrated } = useLanguage()
  const [releases, setReleases] = useState<ReleaseNote[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    loadCached(cacheKeys.releases, getReleaseNotes).then(list => {
      if (list?.length) { setReleases(list); setOpen(true) }
    }).catch(() => {})
  }, [])

  const dismiss = () => {
    setOpen(false)
    prime(cacheKeys.releases, [])
    window.dispatchEvent(new Event("releases_seen"))
    markReleasesSeen().catch(() => {})
  }

  if (!hydrated || releases.length === 0) return null
  const lang = language === "en" ? "en" : "th"
  const dateOf = (id: string) => new Date(`${id.slice(0, 10)}T00:00:00+07:00`).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) dismiss() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> {t("whatsnew.title")}</DialogTitle>
          <DialogDescription>{t("whatsnew.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {releases.map(r => (
            <section key={r.id}>
              <h3 className="font-semibold text-foreground">{r.title[lang]}{r.version && <span className="ml-1.5 text-xs font-normal text-muted-foreground">v{r.version}</span>}</h3>
              <p className="text-xs text-muted-foreground"><time dateTime={r.id.slice(0, 10)}>{dateOf(r.id)}</time></p>
              {r.media && <ReleaseMedia media={r.media} lang={lang} />}
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {r.items.map(i => <li key={i.en}>{i[lang]}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("whatsnew.reread")}</p>
        <DialogFooter>
          <Button onClick={dismiss} className="w-full sm:w-auto rounded-xl">{t("whatsnew.ok")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
