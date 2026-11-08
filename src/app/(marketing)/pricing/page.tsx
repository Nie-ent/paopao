import type { Metadata } from "next"
import Link from "next/link"

import { COMPARISON, FAQS, FREE_FEATURES, PRO_FEATURES } from "@/features/marketing/content"
import { breadcrumbLd, faqLd, softwareApplicationLd } from "@/features/marketing/structured-data"
import { PRO_PLANS, TRIAL_DAYS } from "@/lib/subscription"
import { JsonLd } from "@/components/marketing/JsonLd"
import { PricingCards } from "@/components/marketing/PricingCards"
import { FaqList } from "@/components/marketing/FaqList"

const { MONTHLY, YEARLY } = PRO_PLANS

export const metadata: Metadata = {
  title: "ราคาแพ็กเกจ Free และ Pro",
  description: `เป๋าเป๋าใช้ฟรีได้ตลอด Pro ฿${MONTHLY.priceThb}/${MONTHLY.days} วัน หรือ ฿${YEARLY.priceThb}/ปี ส่งรูปสลิป บิลประจำที่ถามให้ทาง LINE สรุปทุกเช้า นำเข้า Statement จ่ายผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ ทดลองใช้ฟรี ${TRIAL_DAYS} วัน`,
  alternates: { canonical: "/pricing" },
}

// Payment and plan questions only; the full list is on the home page
const PRICING_FAQS = FAQS.filter(f => /ฟรี|ราคา|จ่าย|ตัดเงิน|หมดอายุ/.test(f.q))

export default function PricingPage() {
  return (
    <>
      <JsonLd data={[softwareApplicationLd(), faqLd(PRICING_FAQS), breadcrumbLd([{ name: "หน้าแรก", path: "/" }, { name: "ราคา", path: "/pricing" }])]} />

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-14 text-center">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">ราคาแพ็กเกจเป๋าเป๋า</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          ใช้ฟรีได้ตลอด อัปเกรดเป็น Pro ฿{MONTHLY.priceThb} ต่อ {MONTHLY.days} วัน หรือ ฿{YEARLY.priceThb} ต่อปี จ่ายผ่านพร้อมเพย์ ไม่มีการตัดเงินอัตโนมัติ และทดลอง Pro ได้ฟรี {TRIAL_DAYS} วัน
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <PricingCards plans={PRO_PLANS} freeFeatures={FREE_FEATURES} proFeatures={PRO_FEATURES} trialDays={TRIAL_DAYS} headingLevel="h2" />
      </section>

      <section aria-labelledby="compare" className="mx-auto max-w-4xl px-4 py-12">
        <h2 id="compare" className="mb-6 text-center font-heading text-2xl font-semibold text-foreground">เปรียบเทียบแพ็กเกจ</h2>
        <div className="overflow-x-auto rounded-3xl border border-border/60 bg-card shadow-sm">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">เปรียบเทียบฟีเจอร์ของแพ็กเกจ Free และ Pro</caption>
            <thead>
              <tr className="border-b border-border/60 text-left">
                <th scope="col" className="px-5 py-4 font-medium text-muted-foreground">ฟีเจอร์</th>
                <th scope="col" className="px-5 py-4 text-center font-semibold text-foreground">Free</th>
                <th scope="col" className="px-5 py-4 text-center font-semibold text-primary">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([feature, free, pro]) => (
                <tr key={feature} className="border-b border-border/40 last:border-0">
                  <th scope="row" className="px-5 py-3.5 text-left font-normal text-foreground">{feature}</th>
                  <td className="px-5 py-3.5 text-center text-muted-foreground">{free}</td>
                  <td className="px-5 py-3.5 text-center font-medium text-foreground">{pro}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-5 py-3.5 text-left font-semibold text-foreground">ราคา</th>
                <td className="px-5 py-3.5 text-center font-semibold text-foreground">฿0</td>
                <td className="px-5 py-3.5 text-center font-semibold text-foreground">฿{MONTHLY.priceThb}/{MONTHLY.days} วัน · ฿{YEARLY.priceThb}/ปี</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="how-pay" className="mx-auto max-w-3xl px-4 py-12">
        <h2 id="how-pay" className="mb-6 text-center font-heading text-2xl font-semibold text-foreground">อัปเกรดเป็น Pro ยังไง</h2>
        <ol className="space-y-4">
          {[
            `เข้าสู่ระบบ แล้วเปิดหน้า "แพ็กเกจ" เลือกรายเดือน (฿${MONTHLY.priceThb}) หรือรายปี (฿${YEARLY.priceThb})`,
            "สแกน QR พร้อมเพย์ด้วยแอปธนาคารใดก็ได้",
            "ส่งรูปสลิปในแชท LINE ของเป๋าเป๋า ระบบตรวจกับธนาคารและเปิด Pro ให้ทันที",
          ].map((step, i) => (
            <li key={step} className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">{i + 1}</span>
              <span className="text-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pricing-faq" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="pricing-faq" className="mb-10 text-center font-heading text-2xl font-semibold text-foreground">คำถามเรื่องราคาและการชำระเงิน</h2>
        <FaqList faqs={PRICING_FAQS} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          มีคำถามอื่น? ดู<Link href="/#faq" className="text-primary hover:underline">คำถามที่พบบ่อยทั้งหมด</Link>
        </p>
      </section>
    </>
  )
}
