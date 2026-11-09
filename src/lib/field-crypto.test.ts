import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import crypto from "node:crypto"
import { decryptDeep, decryptValue, encryptArgs, encryptValue, isEncrypted, resetKeyCache } from "./field-crypto"

const KEY = crypto.randomBytes(32).toString("base64")
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely shaped Prisma args
type Args = Record<string, any>

describe("field encryption", () => {
  beforeEach(() => { vi.stubEnv("DATA_ENCRYPTION_KEY", KEY); resetKeyCache() })
  afterEach(() => { vi.unstubAllEnvs(); resetKeyCache() })

  it("round-trips strings and JSON, with a fresh IV each time", () => {
    const a = encryptValue("ค่ากาแฟ")
    const b = encryptValue("ค่ากาแฟ")
    expect(isEncrypted(a)).toBe(true)
    expect(a).not.toBe(b)
    expect(String(a)).not.toContain("กาแฟ")
    expect(decryptValue(a)).toBe("ค่ากาแฟ")
    const msgs = [{ role: "user", content: "hi", at: "2026-11-09T00:00:00Z" }]
    expect(decryptValue(encryptValue(msgs))).toEqual(msgs)
  })

  it("encrypts only the configured columns of create, update, upsert and createMany", () => {
    const create = encryptArgs("Transaction", { data: { note: "secret", amount: 120 } }) as Args
    expect(isEncrypted(create.data.note)).toBe(true)
    expect(create.data.amount).toBe(120)

    const many = encryptArgs("Transaction", { data: [{ note: "a" }, { note: null }] }) as Args
    expect(isEncrypted(many.data[0].note)).toBe(true)
    expect(many.data[1].note).toBeNull()

    const set = encryptArgs("Transaction", { where: { id: "1" }, data: { note: { set: "b" } } }) as Args
    expect(isEncrypted(set.data.note.set)).toBe(true)
    expect(set.where).toEqual({ id: "1" })

    const upsert = encryptArgs("PendingEntry", { where: { userId: "u" }, create: { items: [{ note: "x" }] }, update: { items: [] } }) as Args
    expect(isEncrypted(upsert.create.items)).toBe(true)
    expect(isEncrypted(upsert.update.items)).toBe(true)

    const other = { data: { name: "Food" } }
    expect(encryptArgs("Category", other)).toBe(other)
  })

  it("decrypts nested results and leaves other values alone", () => {
    const when = new Date()
    const row = { id: "u", when, transactions: [{ note: encryptValue("lunch"), amount: 1 }], chat: { messages: encryptValue([{ role: "user" }]) } }
    const out = decryptDeep(row)
    expect(out.transactions[0].note).toBe("lunch")
    expect(out.chat.messages).toEqual([{ role: "user" }])
    expect(out.when).toBe(when)
  })

  it("reads old plain rows and look-alike text as they are", () => {
    expect(decryptValue("plain note")).toBe("plain note")
    expect(decryptValue("enc:v1:not-really")).toBe("enc:v1:not-really")
  })

  it("writes plain text without a key, and refuses a malformed key", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", ""); resetKeyCache()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(encryptValue("x")).toBe("x")
    expect(warn).toHaveBeenCalledTimes(1)
    vi.stubEnv("DATA_ENCRYPTION_KEY", "c2hvcnQ="); resetKeyCache()
    expect(() => encryptValue("x")).toThrow(/32 bytes/)
  })

  it("can't be read with another key", () => {
    const enc = encryptValue("x")
    vi.stubEnv("DATA_ENCRYPTION_KEY", crypto.randomBytes(32).toString("base64")); resetKeyCache()
    expect(decryptValue(enc)).toBe(enc)
  })
})
