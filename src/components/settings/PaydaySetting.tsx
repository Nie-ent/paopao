"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Select } from "@/components/ui/select"
import { useLanguage } from "@/contexts/LanguageContext"
import { getPaydaySetting, setPayday } from "@/features/settings/actions"
import { invalidateAll } from "@/lib/data-cache"

/** Settings row: the day the user is paid, so months run payday to payday (src/lib/pay-cycle.ts). */
export function PaydaySetting() {
  const { t } = useLanguage()
  const [value, setValue] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<number | null>(null)

  useEffect(() => {
    getPaydaySetting().then(s => { if (s) { setValue(String(s.payday ?? 0)); setSuggested(s.suggested) } }).catch(() => {})
  }, [])

  const change = async (next: string) => {
    const prev = value
    setValue(next)
    const res = await setPayday(Number(next) || null)
    if (res?.success) { invalidateAll(); toast.success(t("settings.payday_saved")) }
    else { setValue(prev); toast.error(t("common.something_wrong")) }
  }

  return (
    <div data-tour="payday" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h4 className="font-medium text-foreground">{t("settings.payday_title")}</h4>
        <p className="text-sm text-muted-foreground">{t("settings.payday_desc")}</p>
        {value === "0" && suggested && <p className="mt-1 text-xs font-medium text-primary">{t("settings.payday_suggest", { day: suggested })}</p>}
      </div>
      {value !== null && (
        <Select aria-label={t("settings.payday_title")} className="w-full shrink-0 sm:w-56" value={value} onValueChange={change}
          options={[{ value: "0", label: t("settings.payday_none") }, ...Array.from({ length: 30 }, (_, i) => ({ value: String(i + 2), label: t("settings.payday_day", { day: i + 2 }) }))]} />
      )}
    </div>
  )
}
