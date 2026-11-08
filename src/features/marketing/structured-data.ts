/** schema.org data for the marketing pages, built from the same content the pages render. */
import { PRO_PLANS } from "@/lib/subscription"
import { siteUrl, SITE_NAME } from "@/lib/site"
import { DESCRIPTION, FAQS, type Faq } from "./content"

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl(),
    logo: `${siteUrl()}/paopao-logo.png`,
  }
}

export function websiteLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: siteUrl(), inLanguage: "th-TH" }
}

export function softwareApplicationLd() {
  const offer = (name: string, price: number, description: string) => ({
    "@type": "Offer", name, price: price.toFixed(2), priceCurrency: "THB", description, url: `${siteUrl()}/pricing`,
  })
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: ["PaoPao", "เป๋าเป๋า"],
    applicationCategory: "FinanceApplication",
    operatingSystem: "LINE, Web",
    inLanguage: ["th", "en"],
    description: DESCRIPTION,
    url: siteUrl(),
    image: `${siteUrl()}/marketing/og.jpg`,
    offers: [
      offer("Free", 0, "บันทึกรายรับรายจ่ายด้วยการพิมพ์ใน LINE แดชบอร์ด เป้าหมาย และส่งออก Excel"),
      offer("Pro รายเดือน", PRO_PLANS.MONTHLY.priceThb, `Pro ${PRO_PLANS.MONTHLY.days} วัน ชำระผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ`),
      offer("Pro รายปี", PRO_PLANS.YEARLY.priceThb, `Pro ${PRO_PLANS.YEARLY.days} วัน ชำระผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ`),
    ],
  }
}

export function faqLd(faqs: Faq[] = FAQS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${siteUrl()}${it.path}` })),
  }
}
