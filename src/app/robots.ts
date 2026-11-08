import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/privacy", "/llms.txt"],
      // Signed-in app, admin and APIs are private
      disallow: ["/api/", "/admin", "/login", "/pdpa", "/transactions", "/goals", "/bills", "/chat", "/ai-insights", "/rewards", "/subscription", "/settings", "/welcome"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
