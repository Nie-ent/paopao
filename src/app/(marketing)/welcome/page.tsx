import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Sparkles, Zap } from "lucide-react"

import { signInAsDemo } from "@/features/auth/actions"
import { DESCRIPTION, FAQS, FEATURES, FREE_FEATURES, PRO_FEATURES, STEPS, TAGLINE } from "@/features/marketing/content"
import { faqLd, organizationLd, softwareApplicationLd, websiteLd } from "@/features/marketing/structured-data"
import { PRO_PLANS, TRIAL_DAYS } from "@/lib/subscription"
import { JsonLd } from "@/components/marketing/JsonLd"
import { PlainSubmitButton } from "@/components/ui/submit-button"
import { PricingCards } from "@/components/marketing/PricingCards"
import { FaqList } from "@/components/marketing/FaqList"

// Served at "/" for visitors who aren't signed in (the proxy rewrites to this page), so "/" is canonical
export const metadata: Metadata = {
  title: { absolute: `เป๋าเป๋า – ${TAGLINE} | แอปจดรายรับรายจ่ายใน LINE` },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
}

const SCREENS = [
  { src: "/marketing/dashboard-th.jpg", alt: "แดชบอร์ดของเป๋าเป๋า แสดงยอดคงเหลือ รายรับ รายจ่าย และกราฟกระแสเงินสด" },
  { src: "/marketing/goals.jpg", alt: "หน้าเป้าหมายการออมและสิ่งที่ต้องทำ" },
  { src: "/marketing/chat.jpg", alt: "แชทปรึกษาการเงินกับ AI ที่สร้างเป้าหมายให้ได้" },
]

function ChatBubble({ from, children }: { from: "me" | "bot"; children: React.ReactNode }) {
  return (
    <div className={`flex ${from === "me" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm shadow-sm ${from === "me" ? "rounded-br-sm bg-[#06C755] text-white" : "rounded-bl-sm bg-white text-slate-700"}`}>
        {children}
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd(), softwareApplicationLd(), faqLd()]} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full bg-primary/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-[-10%] h-[420px] w-[420px] rounded-full bg-secondary/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" aria-hidden /> ใช้ฟรี · ทดลอง Pro {TRIAL_DAYS} วัน
            </p>
            <h1 className="mt-5 text-balance font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              {TAGLINE}<br /><span className="text-primary">ที่เหลือเป๋าเป๋าจัดการให้</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{DESCRIPTION}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/api/auth/line" className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90">เริ่มใช้งานฟรี</a>
              <form action={signInAsDemo}>
                <PlainSubmitButton className="rounded-xl border border-border bg-card px-6 py-3 font-semibold text-foreground hover:bg-muted disabled:opacity-70">ลองเดโม ไม่ต้องสมัคร</PlainSubmitButton>
              </form>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Pro ฿{PRO_PLANS.MONTHLY.priceThb}/{PRO_PLANS.MONTHLY.days} วัน หรือ ฿{PRO_PLANS.YEARLY.priceThb}/ปี · จ่ายผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ</p>
          </div>

          {/* A LINE conversation, the way people actually use PaoPao */}
          <div aria-label="ตัวอย่างการใช้งานในแชท LINE" role="img" className="mx-auto w-full max-w-sm rounded-[2rem] border border-border/60 bg-[#8CABD9]/30 p-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700">
              <Image src="/paopao-logo.png" alt="" width={28} height={28} /> เป๋าเป๋า
            </div>
            <div className="space-y-3">
              <ChatBubble from="me">ข้าวมันไก่ 50 ชาไทย 35</ChatBubble>
              <ChatBubble from="bot">{"📝 บันทึกสำเร็จทั้งหมด 2 รายการ:\n1. ➖ ฿50 | อาหาร\n2. ➖ ฿35 | อาหาร"}</ChatBubble>
              <ChatBubble from="bot">{"🧾 วันนี้ถึงรอบรายการประจำ:\n• ค่าไฟ (ปกติ ฿850)"}</ChatBubble>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full border border-[#06C755] bg-white px-3 py-1 text-xs font-medium text-[#06C755]">ค่าไฟ ฿850</span>
              </div>
              <ChatBubble from="bot">บันทึกแล้ว ✅ ค่าไฟ ฿850</ChatBubble>
            </div>
          </div>
        </div>
      </section>

      {/* What it is: a direct, quotable answer for search and AI answer engines */}
      <section aria-labelledby="what" className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h2 id="what" className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">เป๋าเป๋าคืออะไร</h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{FAQS[0].a}</p>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="how" className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">เริ่มใช้ได้ใน 3 ขั้นตอน</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-heading text-lg font-bold text-primary">{i + 1}</span>
              <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="features" className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">ทุกอย่างที่ต้องใช้จัดการเงินส่วนตัว</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(f => (
            <article key={f.title} className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <h3 className="flex flex-wrap items-center gap-2 font-heading text-base font-semibold text-foreground">
                {f.title}
                {f.pro && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><Zap className="h-3 w-3" aria-hidden />Pro</span>}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Screens */}
      <section aria-labelledby="screens" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="screens" className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">ดูภาพรวมการเงินบนเว็บ</h2>
        <p className="mt-3 text-center text-sm text-muted-foreground">ภาพจากบัญชีเดโม ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่าง</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SCREENS.map(s => (
            <figure key={s.src} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-md">
              <Image src={s.src} alt={s.alt} width={1200} height={654} className="h-auto w-full" sizes="(min-width: 768px) 33vw, 100vw" />
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="pricing-title" className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">ราคาที่ตรงไปตรงมา</h2>
        <p className="mt-3 text-center text-muted-foreground">ใช้ฟรีได้ตลอด อัปเกรดเมื่อพร้อม <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">เปรียบเทียบแพ็กเกจทั้งหมด</Link></p>
        <div className="mt-10">
          <PricingCards plans={PRO_PLANS} freeFeatures={FREE_FEATURES} proFeatures={PRO_FEATURES} trialDays={TRIAL_DAYS} />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <h2 id="faq-title" className="mb-10 text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">คำถามที่พบบ่อย</h2>
        <FaqList faqs={FAQS} />
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-[2rem] bg-gradient-to-br from-primary to-[#f6a88f] px-6 py-12 text-center text-primary-foreground shadow-xl">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">เริ่มจดวันนี้ ใช้เวลาไม่ถึงนาที</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">ใช้ฟรี ไม่ต้องโหลดแอป และลอง Pro ได้ฟรี {TRIAL_DAYS} วัน</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/api/auth/line" className="rounded-xl bg-white px-6 py-3 font-semibold text-primary shadow hover:bg-white/90">เริ่มใช้งานฟรี</a>
            <form action={signInAsDemo}>
              <PlainSubmitButton className="rounded-xl border border-white/60 px-6 py-3 font-semibold text-white hover:bg-white/10 disabled:opacity-70">ลองเดโม</PlainSubmitButton>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}
