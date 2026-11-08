"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Globe } from "lucide-react"
import { MARKETING_COPY } from "@/features/marketing/copy"

/** English under /en; every other marketing page is Thai */
function useMarketingCopy() {
  const pathname = usePathname() ?? "/"
  const en = pathname === "/en" || pathname.startsWith("/en/")
  return { c: MARKETING_COPY[en ? "en" : "th"], en }
}

export function MarketingHeader() {
  const { c, en } = useMarketingCopy()
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <nav aria-label={c.nav.main} className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={en ? "/en" : "/"} className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Image src="/paopao-logo.png" alt="" width={36} height={36} priority />
          {c.botName}
        </Link>
        <div className="flex items-center gap-1 text-sm sm:gap-3">
          <Link href={en ? "/en#pricing" : "/pricing"} className="rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground">{c.nav.pricing}</Link>
          <Link href={en ? "/en#faq" : "/#faq"} className="hidden rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground sm:inline">{c.nav.faq}</Link>
          <Link href={en ? "/" : "/en"} hrefLang={en ? "th" : "en"}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground">
            <Globe className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{c.nav.switchTo}</span><span className="sm:hidden">{en ? "TH" : "EN"}</span>
          </Link>
          <a href="/api/auth/line" className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90">{c.ctaStart}</a>
        </div>
      </nav>
    </header>
  )
}

export function MarketingFooter() {
  const { c, en } = useMarketingCopy()
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image src="/paopao-logo.png" alt="" width={28} height={28} />
          <span>{c.nav.footerTag}</span>
        </div>
        <nav aria-label={c.nav.footer} className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href={en ? "/en#pricing" : "/pricing"} className="hover:text-foreground">{c.nav.pricing}</Link>
          <Link href={en ? "/en#faq" : "/#faq"} className="hover:text-foreground">{c.nav.faq}</Link>
          <Link href="/privacy" className="hover:text-foreground">{c.nav.privacy}</Link>
          <Link href="/login" className="hover:text-foreground">{c.nav.login}</Link>
          <Link href={en ? "/" : "/en"} hrefLang={en ? "th" : "en"} className="hover:text-foreground">{c.nav.switchTo}</Link>
        </nav>
      </div>
    </footer>
  )
}
