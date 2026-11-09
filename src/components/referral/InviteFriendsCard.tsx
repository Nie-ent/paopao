"use client"

import { useEffect, useState } from "react"
import { Copy, Gift, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"
import { getReferralInfo } from "@/features/referral/actions"
import { load as loadCached, peek } from "@/lib/data-cache"
import { cacheKeys } from "@/lib/cache-keys"

type Info = NonNullable<Awaited<ReturnType<typeof getReferralInfo>>>

/** "Invite friends, get Pro free": the user's link, a LINE share button and how each friend is doing. */
export function InviteFriendsCard() {
  const { t } = useLanguage()
  const [info, setInfo] = useState<Info | null>(() => peek<Info>(cacheKeys.referral) ?? null)

  useEffect(() => {
    loadCached(cacheKeys.referral, getReferralInfo).then(res => setInfo(res ?? null)).catch(() => {})
  }, [])

  if (!info) return null

  const shareText = t("invite.share_text", { trial: info.friendTrialDays, link: info.link })
  const maxed = info.rewardedCount >= info.maxRewards
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.link)
      toast.success(t("invite.copied"))
    } catch {
      toast.error(info.link)
    }
  }

  return (
    <section aria-labelledby="invite-title" className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex gap-4 items-start">
        <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 id="invite-title" className="font-semibold text-lg text-foreground">{t("invite.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("invite.desc", { days: info.rewardDays, max: info.maxRewards, trial: info.friendTrialDays })}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("invite.rule", { qualify: info.qualifyDays, window: info.qualifyWindowDays })}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-foreground font-medium">{t("invite.progress", { n: info.rewardedCount, max: info.maxRewards })}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={info.maxRewards} aria-valuenow={info.rewardedCount}>
          <div className="h-full bg-primary transition-all" style={{ width: `${(info.rewardedCount / info.maxRewards) * 100}%` }} />
        </div>
      </div>

      {maxed ? (
        <p className="text-sm text-primary font-medium">{t("invite.maxed")}</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={`https://line.me/R/share?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#05b34c]"
          >
            {t("invite.share_line")}
          </a>
          <div className="flex flex-1 min-w-0 items-center gap-2 rounded-xl border border-border bg-muted/40 pl-3">
            <span className="truncate text-sm text-muted-foreground" data-testid="invite-link">{info.link}</span>
            <Button type="button" variant="ghost" size="sm" onClick={copy} className="ml-auto shrink-0 gap-1.5">
              <Copy className="w-4 h-4" /> {t("invite.copy")}
            </Button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2"><Users className="w-4 h-4" /> {t("invite.friends")}</h3>
        {info.friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("invite.none")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {info.friends.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium text-foreground truncate">{f.name}</span>
                <span className={`text-right ${f.status === "QUALIFIED" ? "text-primary" : "text-muted-foreground"}`}>
                  {f.status === "PENDING"
                    ? t("invite.status.pending", { days: f.daysLogged ?? 0, qualify: info.qualifyDays, left: f.daysLeft ?? 0 })
                    : f.status === "EXPIRED"
                      ? t("invite.status.expired")
                      : f.rewarded ? t("invite.status.rewarded", { days: info.rewardDays }) : t("invite.status.qualified")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
