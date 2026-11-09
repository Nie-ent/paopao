import type { Metadata } from "next"
import Link from "next/link"

import { GUIDES } from "@/features/marketing/guides"
import { breadcrumbLd } from "@/features/marketing/structured-data"
import { JsonLd } from "@/components/marketing/JsonLd"
import { siteUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "คู่มือจดรายรับรายจ่ายและจัดการเงินส่วนตัว",
  description: "บทความสั้น ๆ เรื่องจดรายรับรายจ่าย วิธีจดใน LINE การเริ่มต้นสำหรับมือใหม่ สูตรแบ่งเงิน 50/30/20 และการจดจากสลิปโอนเงิน",
  alternates: { canonical: "/guides" },
}

export default function GuidesPage() {
  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: "หน้าแรก", path: "/" }, { name: "คู่มือ", path: "/guides" }]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl()}/guides/${g.slug}`, name: g.h1 })),
        },
      ]} />
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-14">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">คู่มือจดรายรับรายจ่าย</h1>
        <p className="mt-4 text-lg text-muted-foreground">วิธีจดเงินให้ทำได้ทุกวัน และใช้ตัวเลขที่จดไปวางแผนการเงิน</p>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <ul className="divide-y divide-border/70 rounded-3xl border border-border/60 bg-card shadow-sm">
          {GUIDES.map(g => (
            <li key={g.slug} className="px-6 py-5">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                <Link href={`/guides/${g.slug}`} className="hover:text-primary">{g.h1}</Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
