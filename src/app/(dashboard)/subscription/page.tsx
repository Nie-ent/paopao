"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Check, Sparkles, Zap, AlertCircle, QrCode, X, Gift } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import generatePayload from "promptpay-qr"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { getSubscriptionData, startTrial } from "@/features/subscription/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { cacheKeys } from "@/lib/cache-keys"
import { invalidateAll, load as loadCached, peek } from "@/lib/data-cache"

type SubscriptionData = NonNullable<Awaited<ReturnType<typeof getSubscriptionData>>>
type Billing = "MONTHLY" | "YEARLY"

export default function SubscriptionPage() {
  const { t, language } = useLanguage()
  const [data, setData] = useState<SubscriptionData | null>(() => peek<SubscriptionData>(cacheKeys.subscription) ?? null)
  const [billing, setBilling] = useState<Billing>("MONTHLY")
  const [showQR, setShowQR] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)

  const load = (force = false) => loadCached(cacheKeys.subscription, getSubscriptionData, { force }).then(res => { if (res) setData(res) })
  useEffect(() => { load() }, [])

  const plans = data?.plans ?? { MONTHLY: { priceThb: 59, days: 30 }, YEARLY: { priceThb: 590, days: 365 } }
  const selected = plans[billing]
  const qrPayload = generatePayload("0614451929", { amount: selected.priceThb })
  const isPro = data?.plan === "PRO"
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })
  const expiry = data?.proExpiresAt ? formatDate(data.proExpiresAt) : ""
  const limits = data?.limits

  const freeFeatures = [t('sub.free.f1'), t('sub.free.f2'), t('sub.free.f3'), t('sub.free.f4', { chat: limits?.chatFree ?? 30 })]
  const proFeatures = [
    t('sub.pro.f1', { slips: limits?.proSlipsPerMonth ?? 300 }),
    t('sub.pro.f5', { bills: limits?.proRecurringBills ?? 20 }),
    t('sub.pro.f2'),
    t('sub.pro.f3', { imports: limits?.statementImportsPerDay ?? 5 }),
    t('sub.pro.f4', { chat: limits?.chatPro ?? 300 }),
  ]

  const trialLock = useRef(false)
  const handleStartTrial = async () => {
    if (trialLock.current) return
    trialLock.current = true
    setStartingTrial(true)
    const res = await startTrial().finally(() => { setStartingTrial(false); trialLock.current = false })
    if ("expiresAt" in res && res.expiresAt) {
      toast.success(t('sub.trial_started', { date: formatDate(res.expiresAt) }))
      invalidateAll()
      load(true)
    } else {
      toast.error(t('sub.trial_not_eligible'))
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {t('sub.title')} <Sparkles className="w-6 h-6 text-primary" />
          </h1>
          <p className="text-muted-foreground mt-1">{t('sub.subtitle')}</p>
        </div>
      </div>

      {data && !isPro && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex gap-4 items-start">
            <AlertCircle className={`w-6 h-6 shrink-0 ${data.proExpired ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <h3 className="font-semibold text-lg text-foreground">{t(data.proExpired ? 'sub.status_expired' : 'sub.status_free')}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t(data.proExpired ? 'sub.status_expired_desc' : 'sub.status_free_desc')}</p>
            </div>
          </div>
          {data.trialEligible && (
            <Button onClick={handleStartTrial} loading={startingTrial} className="rounded-xl gap-2 shrink-0">
              {!startingTrial && <Gift className="w-4 h-4" />} {t('sub.trial_cta', { days: data.trialDays })}
            </Button>
          )}
        </div>
      )}

      {data && isPro && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">{t('sub.pro_title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {data.onTrial ? t('sub.trial_until', { date: expiry }) : t('sub.pro_until', { date: expiry, days: selected.days })}
            </p>
            <p className="text-sm text-muted-foreground">{t('sub.pro_usage', { used: data.slipsUsedThisMonth, limit: data.limits.proSlipsPerMonth })}</p>
          </div>
        </div>
      )}

      {/* Monthly / yearly */}
      <div className="flex justify-center">
        <div role="radiogroup" aria-label={t('sub.billing.label')} className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
          {(["MONTHLY", "YEARLY"] as const).map(b => (
            <button
              key={b}
              role="radio"
              aria-checked={billing === b}
              onClick={() => setBilling(b)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${billing === b ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(b === "MONTHLY" ? 'sub.billing.monthly' : 'sub.billing.yearly')}
              {b === "YEARLY" && <span className={`ml-2 text-xs ${billing === b ? "opacity-90" : "text-primary"}`}>{t('sub.billing.save')}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FREE */}
        <div className={`relative bg-card rounded-3xl border p-8 flex flex-col ${data && !isPro ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "border-border/50"}`}>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground">Free</h3>
            <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">{t('sub.free.desc')}</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">฿0</div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            {freeFeatures.map((feature, i) => (
              <li key={i} className="flex items-start">
                <Check className="h-5 w-5 text-primary shrink-0 mr-3" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          <Button variant={data && !isPro ? "outline" : "secondary"} className="w-full rounded-xl" disabled>
            {data && !isPro ? t('sub.current_plan') : t('sub.starter_plan')}
          </Button>
        </div>

        {/* PRO */}
        <div className={`relative bg-card rounded-3xl border p-8 flex flex-col ${isPro ? "border-primary shadow-xl ring-2 ring-primary" : "border-primary/30 shadow-lg relative overflow-hidden"}`}>
          {!isPro && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl">
              {t('sub.popular')}
            </div>
          )}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
              Pro <Zap className="w-5 h-5 fill-current" />
            </h3>
            <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">{t('sub.pro.desc')}</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              ฿{selected.priceThb}
              <span className="ml-1 text-base font-medium text-muted-foreground">
                {billing === "YEARLY" ? t('sub.per_year') : t('sub.per_period', { days: selected.days })}
              </span>
            </div>
            <p className="text-xs text-primary mt-1">
              {t('sub.per_day_note', { thb: Math.ceil(selected.priceThb / selected.days) })}
              {billing === "YEARLY" && <> · {t('sub.yearly_note', { monthly: Math.round(selected.priceThb / 12) })}</>}
            </p>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            {proFeatures.map((feature, i) => (
              <li key={i} className="flex items-start">
                <Check className="h-5 w-5 text-primary shrink-0 mr-3" />
                <span className="text-sm text-foreground font-medium">{feature}</span>
              </li>
            ))}
          </ul>
          <Button className="w-full rounded-xl shadow-md gap-2" variant={isPro ? "outline" : "default"} onClick={() => setShowQR(true)}>
            <QrCode className="w-4 h-4" /> {isPro ? t('sub.renew', { days: selected.days }) : t('sub.pay_promptpay')}
          </Button>
        </div>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full relative"
          >
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full" onClick={() => setShowQR(false)}>
              <X className="w-5 h-5" />
            </Button>

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-foreground">{t('sub.qr.title')}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{t('sub.qr.desc')}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl flex items-center justify-center mb-6 shadow-inner border mx-auto w-fit">
              <QRCodeSVG value={qrPayload} size={200} />
            </div>

            <div className="space-y-4 text-center">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-1">{t('sub.qr.amount')}</p>
                <p className="text-3xl font-extrabold text-foreground tracking-tight">฿{selected.priceThb.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('sub.qr.period', { days: selected.days })}</p>
                <p className="text-xs text-muted-foreground mt-2">{t('sub.qr.account', { name: 'ณภัทร สุวรรณจินดา (061-445-1929)' })}</p>
              </div>

              <div className="bg-primary/10 text-primary p-4 rounded-xl text-sm font-medium border border-primary/20 flex flex-col gap-2">
                <div className="flex items-center gap-2 justify-center">
                  <Sparkles className="w-5 h-5" />
                  {t('sub.qr.last_step')}
                </div>
                <p className="text-xs">
                  {t('sub.qr.instructions_1')} <br/>
                  <strong className="text-primary font-bold text-sm">{t('sub.qr.instructions_2')}</strong><br/>
                  {t('sub.qr.instructions_3')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
