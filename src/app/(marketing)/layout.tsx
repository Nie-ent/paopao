import type { Metadata } from "next"
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome"

// Public pages are indexable (the root layout defaults the private app to noindex)
export const metadata: Metadata = { robots: { index: true, follow: true } }

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
