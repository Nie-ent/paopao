import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"
import { GUIDES } from "@/features/marketing/guides"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  // The Thai and English landing pages point at each other (hreflang)
  const languages = { th: `${base}/`, en: `${base}/en` }
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    { url: `${base}/en`, changeFrequency: "weekly", priority: 0.9, alternates: { languages } },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/guides`, changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map(g => ({ url: `${base}/guides/${g.slug}`, lastModified: g.updated, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ]
}
