"use client"

import Link from "next/link"
import { useState } from "react"
import { Gift, MessageSquare, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"
import { startTrial } from "@/features/subscription/actions"
import { invalidateAll } from "@/lib/data-cache"

/** Shown instead of the chat to Free accounts: AI chat is a Pro feature. */
export function ProChatUpsell({ trialEligible, trialDays, chatPerMonth, onUpgraded }: { trialEligible: boolean; trialDays: number; chatPerMonth: number; onUpgraded: () => void }) {
  const { t } = useLanguage()
  const [starting, setStarting] = useState(false)

  const tryPro = async () => {
    setStarting(true)
    const res = await startTrial()
    setStarting(false)
    if (res?.success) {
      invalidateAll()
      toast.success(t("chat.pro.trial_started"))
      onUpgraded()
    } else {
      toast.error(t("sub.trial_not_eligible"))
    }
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-3xl border border-primary/20 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <MessageSquare className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t("chat.pro.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("chat.pro.desc", { chat: chatPerMonth })}</p>
        <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-foreground">
          {[t("chat.pro.f1"), t("chat.pro.f2"), t("chat.pro.f3")].map(f => (
            <li key={f} className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {trialEligible && (
            <Button onClick={tryPro} loading={starting} className="rounded-xl gap-2">
              {!starting && <Gift className="h-4 w-4" />} {t("sub.trial_cta", { days: trialDays })}
            </Button>
          )}
          <Link href="/subscription" className={`inline-flex items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold ${trialEligible ? "border border-border bg-card text-foreground hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
            {t("chat.pro.see_plans")}
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t("chat.pro.note")}</p>
      </div>
    </div>
  )
}
