import { describe, expect, it } from "vitest"
import { normalizePage } from "./feature-events"
import { featureGroup, featureLabel } from "./feature-catalog"

describe("feature events", () => {
  it("keeps only the first path segment and drops ids and queries", () => {
    expect(normalizePage("/")).toBe("/")
    expect(normalizePage("/transactions?month=3")).toBe("/transactions")
    expect(normalizePage("/split/123e4567-e89b")).toBe("/split")
    expect(normalizePage("/123e4567")).toBeNull()
  })

  it("labels known features and page views", () => {
    expect(featureLabel("line_slip")).toBe("ส่งสลิป")
    expect(featureLabel("page:/bills")).toBe("เปิดหน้า ค่าใช้จ่ายคงที่")
    expect(featureGroup("page:/bills")).toBe("หน้าเว็บ")
    expect(featureGroup("group_close")).toBe("กลุ่ม")
  })
})
