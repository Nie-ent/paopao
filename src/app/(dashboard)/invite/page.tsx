"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, Copy, Gift, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"
import { getReferralInfo } from "@/features/referral/actions"
import { load as loadCached, peek } from "@/lib/data-cache"
import { cacheKeys } from "@/lib/cache-keys"

type Info = NonNullable<Awaited<ReturnType<typeof getReferralInfo>>>
type Liff = typeof import("@line/liff").default

/**
 * One-tap invite: https://liff.line.me/<id>/invite opens this page inside LINE, which opens LINE's
 * friend picker straight away with the invite card. Outside LINE (or where LINE can't share cards)
 * it falls back to LINE's text share and the copyable link.
 */
export default function InvitePage() {
  const { t } = useLanguage()
  const [info, setInfo] = useState<Info | null>(() => peek<Info>(cacheKeys.referral) ?? null)
  const [loaded, setLoaded] = useState(!!info)
  const liffRef = useRef<Liff | null>(null)
  const [canPick, setCanPick] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(0)
  const autoOpened = useRef(false)

  useEffect(() => {
    loadCached(cacheKeys.referral, getReferralInfo).then(res => setInfo(res ?? null)).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  // LINE's share target picker needs the LIFF SDK, signed in, inside LINE or after LIFF login
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) return
    let cancelled = false
    import("@line/liff").then(async ({ default: liff }) => {
      await liff.init({ liffId })
      if (cancelled || !liff.isLoggedIn() || !liff.isApiAvailable("shareTargetPicker")) return
      liffRef.current = liff
      setCanPick(true)
    }).catch(err => console.error("LIFF init failed", err))
    return () => { cancelled = true }
  }, [])

  const pick = useCallback(async () => {
    const liff = liffRef.current
    if (!liff || !info || sending) return
    setSending(true)
    try {
      const res = await liff.shareTargetPicker([info.message as never], { isMultiple: true })
      if (res?.status === "success") { setSent(n => n + 1); toast.success(t("invite.sent")) }
    } catch (err) {
      console.error("shareTargetPicker failed", err)
      toast.error(t("invite.share_failed"))
    } finally {
      setSending(false)
    }
  }, [info, sending, t])

  // Opened from the "invite" shortcut: go straight to choosing friends, once
  useEffect(() => {
    if (canPick && info && !autoOpened.current && info.rewardedCount < info.maxRewards) {
      autoOpened.current = true
      pick()
    }
  }, [canPick, info, pick])

  if (loaded && !info) {
    return <p className="text-muted-foreground">{t("invite.unavailable")}</p>
  }
  if (!info) return <div className="h-40 animate-pulse rounded-2xl bg-muted/50" />

  const shareText = t("invite.share_text", { trial: info.friendTrialDays, link: info.link })
  const copy = async () => {
    try { await navigator.clipboard.writeText(info.link); toast.success(t("invite.copied")) } catch { toast.error(info.link) }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15"><Gift className="h-7 w-7 text-primary" /></div>
        <h1 className="text-2xl font-bold text-foreground">{t("invite.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("invite.desc", { days: info.rewardDays, max: info.maxRewards, trial: info.friendTrialDays })}</p>
      </div>

      <div className="space-y-3">
        {canPick ? (
          <Button size="lg" className="w-full gap-2 bg-[#06C755] text-white hover:bg-[#05b34c]" loading={sending} onClick={pick}>
            {!sending && (sent ? <Check className="h-5 w-5" /> : <Send className="h-5 w-5" />)} {sent ? t("invite.send_more") : t("invite.pick_friends")}
          </Button>
        ) : (
          <a
            href={`https://line.me/R/share?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#05b34c]"
          >
            <Send className="h-5 w-5" /> {t("invite.share_line")}
          </a>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 pl-3">
          <span className="truncate text-sm text-muted-foreground">{info.link}</span>
          <Button type="button" variant="ghost" size="sm" onClick={copy} className="ml-auto shrink-0 gap-1.5"><Copy className="h-4 w-4" /> {t("invite.copy")}</Button>
        </div>
      </div>

      <p className="text-center text-sm">
        <Link href="/subscription#invite" className="text-primary underline-offset-4 hover:underline">{t("invite.progress", { n: info.rewardedCount, max: info.maxRewards })} · {t("invite.see_friends")}</Link>
      </p>
    </div>
  )
}
