"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Select } from "@/components/ui/select"
import { useLanguage } from "@/contexts/LanguageContext"
import { setBriefFrequency } from "@/features/settings/actions"
import { fetchProfileDataCached } from "@/lib/clientCache"
import { invalidateAll } from "@/lib/data-cache"

type Frequency = "WEEKLY" | "DAILY" | "OFF"

/** Settings row: weekly (default), daily or no LINE summary. A Pro feature; shown to everyone. */
export function BriefFrequencySetting() {
  const { t } = useLanguage()
  const [value, setValue] = useState<Frequency | null>(null)

  useEffect(() => {
    fetchProfileDataCached().then(u => { if (u) setValue((u as { briefFrequency?: Frequency }).briefFrequency ?? "WEEKLY") }).catch(() => {})
  }, [])

  const change = async (next: string) => {
    const prev = value
    setValue(next as Frequency)
    const res = await setBriefFrequency(next)
    if (res?.success) {
      invalidateAll()
      toast.success(t("settings.brief_saved"))
    } else {
      setValue(prev)
      toast.error(t("common.something_wrong"))
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h4 className="font-medium text-foreground">{t("settings.brief_title")} <span className="ml-1 text-xs font-semibold text-primary">Pro</span></h4>
        <p className="text-sm text-muted-foreground">{t("settings.brief_desc")}</p>
      </div>
      {value && (
        <Select
          aria-label={t("settings.brief_title")}
          className="w-full sm:w-48 shrink-0"
          value={value}
          onValueChange={change}
          options={[
            { value: "WEEKLY", label: t("settings.brief_weekly") },
            { value: "DAILY", label: t("settings.brief_daily") },
            { value: "OFF", label: t("settings.brief_off") },
          ]}
        />
      )}
    </div>
  )
}
