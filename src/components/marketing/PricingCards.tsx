"use client"

import { useState } from "react"
import { Check, Zap } from "lucide-react"

type Plans = { MONTHLY: { priceThb: number; days: number }; YEARLY: { priceThb: number; days: number } }

/**
 * Free vs Pro with a monthly/yearly switch. Both prices are also in the server-rendered HTML
 * (the yearly one in the toggle and the note), so crawlers see them without running JS.
 */
export function PricingCards({ plans, freeFeatures, proFeatures, trialDays, headingLevel = "h3" }: {
  plans: Plans; freeFeatures: string[]; proFeatures: string[]; trialDays: number; headingLevel?: "h2" | "h3"
}) {
  const [yearly, setYearly] = useState(false)
  const plan = yearly ? plans.YEARLY : plans.MONTHLY
  const H = headingLevel

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="รอบการชำระ" className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
          {[false, true].map(isYearly => (
            <button
              key={String(isYearly)}
              role="radio"
              aria-checked={yearly === isYearly}
              onClick={() => setYearly(isYearly)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${yearly === isYearly ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {isYearly ? <>รายปี ฿{plans.YEARLY.priceThb} <span className={yearly ? "opacity-90" : "text-primary"}>· ฟรี 2 เดือน</span></> : `รายเดือน ฿${plans.MONTHLY.priceThb}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-border/60 bg-card p-8 shadow-sm">
          <H className="font-heading text-xl font-semibold text-foreground">Free</H>
          <p className="mt-2 text-sm text-muted-foreground">สำหรับคนที่อยากเริ่มจดเงินแบบง่ายที่สุด</p>
          <p className="mt-5 font-heading text-4xl font-bold text-foreground">฿0</p>
          <ul className="mt-6 flex-1 space-y-3">
            {freeFeatures.map(f => (
              <li key={f} className="flex gap-3 text-sm text-muted-foreground"><Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />{f}</li>
            ))}
          </ul>
          <a href="/api/auth/line" className="mt-8 rounded-xl border border-border px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-muted">เริ่มใช้งานฟรี</a>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-3xl border border-primary/40 bg-card p-8 shadow-lg ring-1 ring-primary/20">
          <span className="absolute right-0 top-0 rounded-bl-xl bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">แนะนำ</span>
          <H className="flex items-center gap-2 font-heading text-xl font-semibold text-primary">Pro <Zap className="h-5 w-5 fill-current" aria-hidden /></H>
          <p className="mt-2 text-sm text-muted-foreground">ทุกอย่างใน Free และเพิ่ม</p>
          <p className="mt-5 font-heading text-4xl font-bold text-foreground">
            ฿{plan.priceThb}<span className="ml-1 text-base font-normal text-muted-foreground">{yearly ? "/ปี" : `/${plan.days} วัน`}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {yearly ? `เฉลี่ยประมาณเดือนละ ฿${Math.round(plans.YEARLY.priceThb / 12)}` : `หรือ ฿${plans.YEARLY.priceThb}/ปี`} · จ่ายผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {proFeatures.map(f => (
              <li key={f} className="flex gap-3 text-sm font-medium text-foreground"><Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />{f}</li>
            ))}
          </ul>
          <a href="/api/auth/line" className="mt-8 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90">
            ทดลองใช้ Pro ฟรี {trialDays} วัน
          </a>
        </div>
      </div>
    </div>
  )
}
