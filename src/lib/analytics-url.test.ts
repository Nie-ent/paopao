import { describe, expect, it } from "vitest"
import { analyticsUrl } from "./analytics-url"

describe("analyticsUrl", () => {
  it("drops codes, tokens and hashes but keeps campaign tags", () => {
    expect(analyticsUrl("https://x.com/api/auth/line/callback?code=abc&state=xyz")).toBe("https://x.com/api/auth/line/callback")
    expect(analyticsUrl("https://x.com/?liff.state=%2Fbills#access_token=t")).toBe("https://x.com/")
    expect(analyticsUrl("https://x.com/en?utm_source=fb&utm_campaign=launch&ref=1")).toBe("https://x.com/en?utm_source=fb&utm_campaign=launch")
    expect(analyticsUrl("https://x.com/goals#g1")).toBe("https://x.com/goals")
  })
  it("skips admin pages and bad URLs", () => {
    expect(analyticsUrl("https://x.com/admin")).toBeNull()
    expect(analyticsUrl("https://x.com/admin/users?id=1")).toBeNull()
    expect(analyticsUrl("not a url")).toBeNull()
    expect(analyticsUrl("https://x.com/administrator")).toBe("https://x.com/administrator")
  })
})
