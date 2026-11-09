"use client"

import { useState } from "react"
import { Check, Zap } from "lucide-react"
import { pricingLabels, type MarketingLocale } from "@/features/marketing/copy"

type Plans = { MONTHLY: { priceThb: number; days: number }; YEARLY: { priceThb: number; days: number } }

/**
 * Free vs Pro with a monthly/yearly switch. Both prices are also in the server-rendered HTML
 * (the yearly one in the toggle and the note), so crawlers see them without running JS.
 */
export function PricingCards({ plans, freeFeatures, proFeatures, trialDays, headingLevel = "h3", locale = "th" }: {
  plans: Plans; freeFeatures: string[]; proFeatures: string[]; trialDays: number; headingLevel?: "h2" | "h3"; locale?: MarketingLocale
}) {
  const L = pricingLabels(locale)
  const [yearly, setYearly] = useState(false)
  const plan = yearly ? plans.YEARLY : plans.MONTHLY
  const H = headingLevel

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div role="radiogroup" aria-label={L.cycle} className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
          {[false, true].map(isYearly => (
            <button
              key={String(isYearly)}
              role="radio"
              aria-checked={yearly === isYearly}
              onClick={() => setYearly(isYearly)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${yearly === isYearly ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {isYearly ? <>{L.yearly} ฿{plans.YEARLY.priceThb} <span className={yearly ? "opacity-90" : "text-primary"}>· {L.twoMonthsFree}</span></> : `${L.monthly} ฿${plans.MONTHLY.priceThb}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-border/60 bg-card p-8 shadow-sm">
          <H className="font-heading text-xl font-semibold text-foreground">Free</H>
          <p className="mt-2 text-sm text-muted-foreground">{L.freeLead}</p>
          <p className="mt-5 font-heading text-4xl font-bold text-foreground">฿0</p>
          <ul className="mt-6 flex-1 space-y-3">
            {freeFeatures.map(f => (
              <li key={f} className="flex gap-3 text-sm text-muted-foreground"><Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />{f}</li>
            ))}
          </ul>
          <a href="/api/auth/line" className="mt-8 rounded-xl border border-border px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-muted">{L.startFree}</a>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-3xl border border-primary/40 bg-card p-8 shadow-lg ring-1 ring-primary/20">
          <span className="absolute right-0 top-0 rounded-bl-xl bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{L.recommended}</span>
          <H className="flex items-center gap-2 font-heading text-xl font-semibold text-primary">Pro <Zap className="h-5 w-5 fill-current" aria-hidden /></H>
          <p className="mt-2 text-sm text-muted-foreground">{L.proLead}</p>
          <p className="mt-5 font-heading text-4xl font-bold text-foreground">
            ฿{plan.priceThb}<span className="ml-1 text-base font-normal text-muted-foreground">{yearly ? L.perYear : L.perDays(plan.days)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-primary">{L.perDayNote(plan.priceThb / plan.days)}</span> · {yearly ? L.averagePerMonth(Math.round(plans.YEARLY.priceThb / 12)) : L.orYearly(plans.YEARLY.priceThb)} · {L.promptPayNote}
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {proFeatures.map(f => (
              <li key={f} className="flex gap-3 text-sm font-medium text-foreground"><Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />{f}</li>
            ))}
          </ul>
          <a href="/api/auth/line" className="mt-8 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90">
            {L.tryPro(trialDays)}
          </a>
        </div>
      </div>
    </div>
  )
}
