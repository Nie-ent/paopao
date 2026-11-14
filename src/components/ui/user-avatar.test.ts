import { describe, expect, it } from "vitest"
import { initialsOf } from "./user-avatar"

describe("initialsOf", () => {
  it("takes the first letters of up to two words", () => {
    expect(initialsOf("Somchai Jaidee")).toBe("SJ")
    expect(initialsOf("nie")).toBe("N")
    expect(initialsOf("")).toBe("?")
    expect(initialsOf(null)).toBe("?")
  })
  it("skips Thai vowels and tone marks, and emoji", () => {
    expect(initialsOf("สมชาย ใจดี")).toBe("สจ")
    expect(initialsOf("🐱 Mint")).toBe("M")
  })
})
