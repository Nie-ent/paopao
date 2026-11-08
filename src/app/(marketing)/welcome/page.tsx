import type { Metadata } from "next"
import { MARKETING_COPY } from "@/features/marketing/copy"
import { LandingView } from "@/components/marketing/LandingView"

const copy = MARKETING_COPY.th

// Served at "/" for visitors who aren't signed in (the proxy rewrites to this page), so "/" is canonical
export const metadata: Metadata = {
  title: { absolute: copy.metaTitle },
  description: copy.description,
  alternates: { canonical: "/", languages: { th: "/", en: "/en", "x-default": "/" } },
}

export default function LandingPage() {
  return <LandingView copy={copy} />
}
