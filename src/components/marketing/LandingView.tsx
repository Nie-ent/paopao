import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Sparkles, Zap } from "lucide-react"

import { signInAsDemo } from "@/features/auth/actions"
import type { MarketingCopy } from "@/features/marketing/copy"
import { faqLd, organizationLd, softwareApplicationLd, websiteLd } from "@/features/marketing/structured-data"
import { PRO_PLANS, TRIAL_DAYS } from "@/lib/subscription"
import { JsonLd } from "@/components/marketing/JsonLd"
import { PlainSubmitButton } from "@/components/ui/submit-button"
import { PricingCards } from "@/components/marketing/PricingCards"
import { FaqList } from "@/components/marketing/FaqList"
import { FloatingBlobs, HeroChat, HeroIntro, HeroLine, MotionRoot, Reveal, Stagger, StaggerItem } from "@/components/marketing/motion"

const sectionTitle = "text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl"

/** The landing page in Thai ("/") or English ("/en"); both render the same layout from their copy */
export function LandingView({ copy: c }: { copy: MarketingCopy }) {
  return (
    <MotionRoot>
      <JsonLd data={[organizationLd(), websiteLd(c.locale), softwareApplicationLd(c.locale), faqLd(c.faqs)]} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <FloatingBlobs />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
          <HeroIntro>
            <HeroLine>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" aria-hidden /> {c.badge}
              </p>
            </HeroLine>
            <HeroLine>
              <h1 className="mt-5 text-balance font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                {c.tagline}<br />
                <span className="bg-gradient-to-r from-primary via-[#f6a88f] to-amber-400 bg-clip-text text-transparent">{c.taglineAccent}</span>
              </h1>
            </HeroLine>
            <HeroLine><p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{c.description}</p></HeroLine>
            <HeroLine>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/api/auth/line" className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30">
                  {c.ctaStart} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </a>
                <form action={signInAsDemo}>
                  <PlainSubmitButton className="rounded-xl border border-border bg-card px-6 py-3 font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:bg-muted disabled:opacity-70">{c.ctaDemo}</PlainSubmitButton>
                </form>
              </div>
            </HeroLine>
            <HeroLine><p className="mt-4 text-sm text-muted-foreground">{c.priceNote}</p></HeroLine>
          </HeroIntro>

          {/* A LINE conversation that plays itself, the way people actually use PaoPao */}
          <HeroChat lines={c.chat} botName={c.botName} label={c.chatLabel} confirmTitle={c.confirmTitle} confirmButton={c.confirmButton} savedLabel={c.savedLabel} />
        </div>
      </section>

      {/* What it is: a direct, quotable answer for search and AI answer engines */}
      <section aria-labelledby="what" className="mx-auto max-w-3xl px-4 py-12 text-center">
        <Reveal>
          <h2 id="what" className={sectionTitle}>{c.whatTitle}</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{c.faqs[0].a}</p>
        </Reveal>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-12">
        <Reveal><h2 id="how" className={sectionTitle}>{c.stepsTitle}</h2></Reveal>
        <Stagger as="ol" className="relative mt-10 grid gap-6 md:grid-cols-3">
          <div aria-hidden className="absolute left-[16%] right-[16%] top-11 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
          {c.steps.map((s, i) => (
            <StaggerItem as="li" key={s.title} className="relative rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition-shadow hover:shadow-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground shadow-md shadow-primary/30">{i + 1}</span>
              <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Features */}
      <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 py-12">
        <Reveal><h2 id="features" className={sectionTitle}>{c.featuresTitle}</h2></Reveal>
        <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {c.features.map(f => (
            <StaggerItem as="article" key={f.title} className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition-shadow hover:border-primary/40 hover:shadow-lg">
              <div aria-hidden className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 transition-transform duration-500 group-hover:scale-[2.2]" />
              <h3 className="relative flex flex-wrap items-center gap-2 font-heading text-base font-semibold text-foreground">
                {f.title}
                {f.pro && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><Zap className="h-3 w-3" aria-hidden />Pro</span>}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Screens */}
      <section aria-labelledby="screens" className="mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <h2 id="screens" className={sectionTitle}>{c.screensTitle}</h2>
          <p className="mt-3 text-center text-sm text-muted-foreground">{c.screensNote}</p>
        </Reveal>
        <Stagger className="mt-10 grid gap-6 md:grid-cols-3">
          {c.screens.map(s => (
            <StaggerItem as="figure" key={s.src} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-md transition-shadow hover:shadow-xl">
              <Image src={s.src} alt={s.alt} width={1200} height={654} className="h-auto w-full transition-transform duration-700 hover:scale-105" sizes="(min-width: 768px) 33vw, 100vw" />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <Reveal>
          <h2 id="pricing-title" className={sectionTitle}>{c.pricingTitle}</h2>
          <p className="mt-3 text-center text-muted-foreground">
            {c.pricingLead}{c.locale === "th" && <> <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">{c.pricingCompare}</Link></>}
          </p>
        </Reveal>
        <Reveal className="mt-10" delay={0.1}>
          <PricingCards plans={PRO_PLANS} freeFeatures={c.freeFeatures} proFeatures={c.proFeatures} trialDays={TRIAL_DAYS} locale={c.locale} />
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <Reveal><h2 id="faq-title" className={`mb-10 ${sectionTitle}`}>{c.faqTitle}</h2></Reveal>
        <Reveal delay={0.1}><FaqList faqs={c.faqs} /></Reveal>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-[#f6a88f] px-6 py-12 text-center text-primary-foreground shadow-xl">
            <div aria-hidden className="cta-shine pointer-events-none absolute inset-0" />
            <h2 className="relative font-heading text-2xl font-bold sm:text-3xl">{c.finalTitle}</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/90">{c.finalBody}</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <a href="/api/auth/line" className="rounded-xl bg-white px-6 py-3 font-semibold text-primary shadow transition-transform hover:-translate-y-0.5 hover:bg-white/90">{c.ctaStart}</a>
              <form action={signInAsDemo}>
                <PlainSubmitButton className="rounded-xl border border-white/60 px-6 py-3 font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-white/10 disabled:opacity-70">{c.ctaDemoShort}</PlainSubmitButton>
              </form>
            </div>
          </div>
        </Reveal>
      </section>
    </MotionRoot>
  )
}
