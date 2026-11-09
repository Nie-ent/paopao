import { describe, expect, it } from "vitest"
import { GUIDES, guideBySlug } from "./guides"
import { canonicalRedirect } from "@/lib/site"

describe("guides", () => {
  it("have unique URL-safe slugs and search-friendly titles and descriptions", () => {
    expect(new Set(GUIDES.map(g => g.slug)).size).toBe(GUIDES.length)
    for (const g of GUIDES) {
      expect(g.slug).toMatch(/^[a-z0-9-]+$/)
      expect(g.title.length, g.slug).toBeLessThanOrEqual(70)
      expect(g.description.length, g.slug).toBeGreaterThan(70)
      expect(g.description.length, g.slug).toBeLessThanOrEqual(200)
      expect(g.updated >= g.published, g.slug).toBe(true)
      expect(g.faqs.length, g.slug).toBeGreaterThan(0)
      expect(guideBySlug(g.slug)).toBe(g)
    }
  })

  it("never quote a price or limit other than the app's own", () => {
    const text = JSON.stringify(GUIDES)
    for (const price of text.match(/฿\s?[\d,]+/g) ?? []) expect(["฿59", "฿590"]).toContain(price.replace(/\s/g, ""))
  })
})

describe("canonicalRedirect", () => {
  it("sends production *.vercel.app pages to the real domain, but not API routes or previews", () => {
    expect(canonicalRedirect("paopao.vercel.app", "/pricing", "production")).toBe("https://www.paopao-wallet.com")
    expect(canonicalRedirect("paopao-abc123-team.vercel.app", "/", "production")).toBe("https://www.paopao-wallet.com")
    expect(canonicalRedirect("paopao.vercel.app", "/api/line", "production")).toBeNull()
    expect(canonicalRedirect("paopao-git-x-team.vercel.app", "/", "preview")).toBeNull()
    expect(canonicalRedirect("www.paopao-wallet.com", "/", "production")).toBeNull()
    expect(canonicalRedirect("localhost:3000", "/", undefined)).toBeNull()
  })
})
