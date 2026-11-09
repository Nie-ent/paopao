/** schema.org data for the marketing pages, built from the same content the pages render. */
import { PRO_PLANS } from "@/lib/subscription"
import { siteUrl, SITE_NAME } from "@/lib/site"
import { DESCRIPTION, FAQS, type Faq } from "./content"
import { MARKETING_COPY } from "./copy"

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl(),
    logo: `${siteUrl()}/paopao-logo.png`,
  }
}

export function websiteLd(locale: "th" | "en" = "th") {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${siteUrl()}${locale === "en" ? "/en" : ""}`, inLanguage: locale === "en" ? "en" : "th-TH" }
}

const EN_OFFERS = {
  free: "Log income and expenses by typing in LINE, dashboard, goals and Excel export",
  monthly: `Pro for ${PRO_PLANS.MONTHLY.days} days, paid by PromptPay, never auto-charged`,
  yearly: `Pro for ${PRO_PLANS.YEARLY.days} days, paid by PromptPay, never auto-charged`,
}

export function softwareApplicationLd(locale: "th" | "en" = "th") {
  const en = locale === "en"
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
    description: en ? MARKETING_COPY.en.description : DESCRIPTION,
    url: `${siteUrl()}${en ? "/en" : ""}`,
    image: `${siteUrl()}/marketing/og.jpg`,
    offers: [
      offer("Free", 0, en ? EN_OFFERS.free : "บันทึกรายรับรายจ่ายด้วยการพิมพ์ใน LINE แดชบอร์ด เป้าหมาย และส่งออก Excel"),
      offer(en ? "Pro monthly" : "Pro รายเดือน", PRO_PLANS.MONTHLY.priceThb, en ? EN_OFFERS.monthly : `Pro ${PRO_PLANS.MONTHLY.days} วัน ชำระผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ`),
      offer(en ? "Pro yearly" : "Pro รายปี", PRO_PLANS.YEARLY.priceThb, en ? EN_OFFERS.yearly : `Pro ${PRO_PLANS.YEARLY.days} วัน ชำระผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ`),
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
