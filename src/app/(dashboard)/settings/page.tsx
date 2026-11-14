"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useFormStatus } from "react-dom"
import { BadgeCheck, Bell, ChevronRight, Crown, FileText, Globe, GraduationCap, LogOut, Palette, Sparkles } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserAvatar } from "@/components/ui/user-avatar"
import { CategorySettingsCard } from "@/components/settings/CategorySettingsCard"
import { BriefFrequencySetting } from "@/components/settings/BriefFrequencySetting"
import { PaydaySetting } from "@/components/settings/PaydaySetting"
import { LanguageToggle } from "@/components/layouts/LanguageToggle"
import { useTour } from "@/components/tour/TourProvider"
import { signOut } from "@/features/auth/actions"
import { getSubscriptionData } from "@/features/subscription/actions"
import { fetchProfileDataCached } from "@/lib/clientCache"
import { cacheKeys } from "@/lib/cache-keys"
import { load as loadCached } from "@/lib/data-cache"
import { useLanguage } from "@/contexts/LanguageContext"

/** Shows a spinner while signing out (the pending state comes from the form itself). */
function SignOutButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-card py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60">
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive/30 border-t-destructive" /> : <LogOut className="h-4 w-4" />} {label}
    </button>
  )
}

/** A titled group of rows, like a phone's settings screen */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card [&>*]:px-4 [&>*]:py-3.5">{children}</div>
    </section>
  )
}

/** One row: icon, label and hint on the left, a control or a chevron on the right */
function Row({ icon: Icon, title, desc, right, onClick, href }: { icon: React.ElementType; title: string; desc?: string; right?: React.ReactNode; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{title}</span>
        {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
      </span>
      {right ?? ((onClick || href) && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />)}
    </>
  )
  const cls = "flex w-full items-center gap-3 text-left"
  if (href) return <Link href={href} className={`${cls} hover:bg-muted/40`}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} hover:bg-muted/40`}>{body}</button>
  return <div className={cls}>{body}</div>
}

/**
 * Settings, grouped the way people look for them: their account and plan, money (payday,
 * categories), LINE notifications, app preferences and help, then sign out.
 */
export default function SettingsPage() {
  const { t, locale } = useLanguage()
  const { openMenu } = useTour()
  const [profile, setProfile] = useState<{ name: string | null; avatarUrl: string | null } | null>(null)
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof getSubscriptionData>>>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  useEffect(() => {
    fetchProfileDataCached().then(u => u && setProfile({ name: u.name ?? null, avatarUrl: u.avatarUrl ?? null })).catch(() => {})
    loadCached(cacheKeys.subscription, getSubscriptionData).then(setPlan).catch(() => {})
  }, [])

  const planText = !plan ? "" : plan.plan === "PRO"
    ? t(plan.onTrial ? "settings2.plan_trial" : "settings2.plan_pro", { date: plan.proExpiresAt ? new Date(plan.proExpiresAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "" })
    : t("settings2.plan_free")

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <h2 className="text-3xl font-bold tracking-tight text-foreground/90">{t("settings2.title")}</h2>

      {/* Who's signed in and their plan */}
      <Link href="/subscription" className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 hover:bg-muted/40">
        <UserAvatar name={profile?.name} src={profile?.avatarUrl} size={52} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold text-foreground">{profile?.name ?? " "}</span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            {plan?.plan === "PRO" && <Crown className="h-3.5 w-3.5 text-primary" />} {planText}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">{t("settings2.plans")} <ChevronRight className="h-4 w-4" /></span>
      </Link>

      <Group title={t("settings2.group_money")}>
        <PaydaySetting />
        <Row icon={Palette} title={t("settings2.categories")} desc={t("settings2.categories_desc")} onClick={() => setCategoriesOpen(true)} />
      </Group>

      <Group title={t("settings2.group_line")}>
        <BriefFrequencySetting />
        <Row icon={Bell} title={t("settings.budget_title")} desc={t("settings.budget_desc")}
          right={<span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">{t("settings.enabled")}</span>} />
        <Row icon={BadgeCheck} title="LINE Official Account" desc={t("settings.line_desc")}
          right={<span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">{t("settings.connected")}</span>} />
      </Group>

      <Group title={t("settings2.group_app")}>
        <Row icon={Globe} title={t("settings2.language")} right={<LanguageToggle />} />
        <Row icon={GraduationCap} title={t("settings2.guides")} desc={t("settings2.guides_desc")} onClick={openMenu} />
        <Row icon={Sparkles} title={t("updates.title")} href="/updates" />
        <Row icon={FileText} title={t("settings2.privacy")} href="/privacy" />
      </Group>

      <form action={signOut}><SignOutButton label={t("settings.logout")} /></form>

      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="sr-only"><DialogTitle>{t("settings2.categories")}</DialogTitle></DialogHeader>
          <CategorySettingsCard />
        </DialogContent>
      </Dialog>
    </div>
  )
}
