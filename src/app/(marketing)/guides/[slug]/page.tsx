import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { GUIDES, guideBySlug } from "@/features/marketing/guides"
import { breadcrumbLd, faqLd } from "@/features/marketing/structured-data"
import { JsonLd } from "@/components/marketing/JsonLd"
import { FaqList } from "@/components/marketing/FaqList"
import { siteUrl, SITE_NAME } from "@/lib/site"

export const dynamicParams = false

export function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = guideBySlug((await params).slug)
  if (!g) return {}
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: {
      type: "article", locale: "th_TH", siteName: "เป๋าเป๋า (PaoPao)", url: `/guides/${g.slug}`,
      title: g.title, description: g.description, publishedTime: g.published, modifiedTime: g.updated,
      images: [{ url: "/marketing/og.jpg", width: 1200, height: 630, alt: g.h1 }],
    },
  }
}

const thaiDate = (iso: string) => new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })

export default async function GuidePage({ params }: Props) {
  const g = guideBySlug((await params).slug)
  if (!g) notFound()
  const url = `${siteUrl()}/guides/${g.slug}`
  const others = GUIDES.filter(o => o.slug !== g.slug)

  const ld: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.h1,
      description: g.description,
      inLanguage: "th-TH",
      datePublished: g.published,
      dateModified: g.updated,
      mainEntityOfPage: url,
      image: `${siteUrl()}/marketing/og.jpg`,
      author: { "@type": "Organization", name: SITE_NAME, url: siteUrl() },
      publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${siteUrl()}/paopao-logo.png` } },
    },
    breadcrumbLd([{ name: "หน้าแรก", path: "/" }, { name: "คู่มือ", path: "/guides" }, { name: g.h1, path: `/guides/${g.slug}` }]),
    faqLd(g.faqs),
  ]
  if (g.steps) {
    ld.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: g.h1,
      description: g.answer,
      inLanguage: "th-TH",
      step: g.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text, url: `${url}#step-${i + 1}` })),
    })
  }

  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-10">
      <JsonLd data={ld} />
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">หน้าแรก</Link>
        <span aria-hidden className="mx-2">/</span>
        <Link href="/guides" className="hover:text-foreground">คู่มือ</Link>
      </nav>
      <h1 className="mt-4 font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">{g.h1}</h1>
      <p className="mt-3 text-sm text-muted-foreground">อัปเดต <time dateTime={g.updated}>{thaiDate(g.updated)}</time></p>

      {/* The short answer first: what search snippets and AI assistants quote */}
      <p className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-base leading-relaxed text-foreground">{g.answer}</p>

      {g.steps && (
        <section className="mt-10" aria-labelledby="steps">
          <h2 id="steps" className="font-heading text-2xl font-semibold text-foreground">ขั้นตอน</h2>
          <ol className="mt-4 space-y-4">
            {g.steps.map((s, i) => (
              <li key={s.name} id={`step-${i + 1}`} className="flex gap-4">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{i + 1}</span>
                <div>
                  <h3 className="font-medium text-foreground">{s.name}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {g.sections.map(s => (
        <section key={s.heading} className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-foreground">{s.heading}</h2>
          {s.paragraphs.map(p => <p key={p} className="mt-4 leading-relaxed text-muted-foreground">{p}</p>)}
          {s.list && (s.ordered
            ? <ol className="mt-4 list-decimal space-y-2 pl-6 leading-relaxed text-muted-foreground">{s.list.map(li => <li key={li}>{li}</li>)}</ol>
            : <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">{s.list.map(li => <li key={li}>{li}</li>)}</ul>)}
        </section>
      ))}

      <section className="mt-12" aria-labelledby="faq">
        <h2 id="faq" className="mb-4 font-heading text-2xl font-semibold text-foreground">คำถามที่พบบ่อย</h2>
        <FaqList faqs={g.faqs} />
      </section>

      <section className="mt-12 rounded-3xl bg-primary/10 p-6 text-center">
        <p className="font-heading text-xl font-semibold text-foreground">ลองจดรายรับรายจ่ายใน LINE ฟรี</p>
        <p className="mt-2 text-sm text-muted-foreground">พิมพ์ &quot;กาแฟ 65&quot; ก็บันทึกให้ ไม่ต้องโหลดแอป</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a href="/api/auth/line" className="rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground shadow-sm hover:bg-primary/90">เริ่มใช้งานฟรี</a>
          <Link href="/pricing" className="rounded-xl border border-border bg-card px-5 py-2.5 font-medium text-foreground hover:bg-muted">ดูราคา</Link>
        </div>
      </section>

      <nav aria-labelledby="more" className="mt-12">
        <h2 id="more" className="font-heading text-xl font-semibold text-foreground">อ่านต่อ</h2>
        <ul className="mt-3 space-y-2">
          {others.map(o => <li key={o.slug}><Link href={`/guides/${o.slug}`} className="text-primary hover:underline">{o.h1}</Link></li>)}
        </ul>
      </nav>
    </article>
  )
}
