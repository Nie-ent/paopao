import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  // The Thai and English landing pages point at each other (hreflang)
  const languages = { th: `${base}/`, en: `${base}/en` }
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    { url: `${base}/en`, changeFrequency: "weekly", priority: 0.9, alternates: { languages } },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ]
}
