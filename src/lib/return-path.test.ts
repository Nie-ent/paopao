import { describe, expect, it } from "vitest"
import { safeReturnPath } from "./return-path"

describe("safeReturnPath", () => {
  it("keeps app pages, with query and hash", () => {
    expect(safeReturnPath("/bills")).toBe("/bills")
    expect(safeReturnPath("/goals#abc")).toBe("/goals#abc")
    expect(safeReturnPath("/transactions?month=10")).toBe("/transactions?month=10")
    expect(safeReturnPath("%2Fsubscription")).toBe("/subscription")
  })
  it("rejects other hosts, auth pages and junk", () => {
    for (const p of [null, "", "/", "bills", "//evil.com", "/\\evil.com", "https://evil.com", "/login", "/pdpa", "/api/line", "/admin/users", "/a\nb", "%2F%2Fevil.com", "/_vercel/speed-insights/script.js", "/_vercel/insights/view", "/sw.js"]) {
      expect(safeReturnPath(p), String(p)).toBeNull()
    }
  })
})
