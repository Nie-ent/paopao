import type { Metadata } from "next"
import { MARKETING_COPY } from "@/features/marketing/copy"
import { LandingView } from "@/components/marketing/LandingView"

const copy = MARKETING_COPY.en

export const metadata: Metadata = {
  title: { absolute: copy.metaTitle },
  description: copy.description,
  alternates: { canonical: "/en", languages: { th: "/", en: "/en", "x-default": "/" } },
  // Replaces the root layout's openGraph as a whole, so the image and site name are repeated here
  openGraph: {
    type: "website", locale: "en_US", alternateLocale: ["th_TH"], siteName: "PaoPao (เป๋าเป๋า)", url: "/en",
    title: copy.metaTitle, description: copy.description,
    images: [{ url: "/marketing/og.jpg", width: 1200, height: 630, alt: "PaoPao income and expense dashboard" }],
  },
}

/** English landing page (the root layout is lang="th", so this subtree declares its own language) */
export default function EnglishLandingPage() {
  return (
    <div lang="en">
      <LandingView copy={copy} />
    </div>
  )
}
