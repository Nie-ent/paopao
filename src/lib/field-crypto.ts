/**
 * Encryption of free-text columns at rest (AES-256-GCM, key in DATA_ENCRYPTION_KEY).
 *
 * The columns in ENCRYPTED_FIELDS are encrypted when written and decrypted when read by the
 * Prisma extension in src/lib/db.ts, so the rest of the code sees plain values. A database dump
 * or backup alone then doesn't reveal what users wrote; amounts, categories and dates stay plain
 * so dashboards, crons and limits keep working in SQL.
 *
 * - Stored form: "enc:v1:" + base64url(iv | tag | ciphertext) of JSON.stringify(value). Json
 *   columns hold it as a JSON string.
 * - Rows written before encryption (no prefix) are read as they are; scripts/encrypt-existing.ts
 *   converts them.
 * - Encrypted columns can't be filtered or searched in SQL (`where: { note: … }`).
 * - Without DATA_ENCRYPTION_KEY values are written in plain text (and a warning is logged), so a
 *   deploy without the key keeps working; values already encrypted then can't be read.
 */
import crypto from "node:crypto"

export const ENCRYPTED_FIELDS: Record<string, { strings?: string[]; json?: string[] }> = {
  Transaction: { strings: ["note"] },
  ChatSession: { strings: ["title"], json: ["messages"] },
  PendingEntry: { json: ["items"] },
  LinePayee: { strings: ["promptPayId"] },
}

export const PREFIX = "enc:v1:"
const b64url = (b: Buffer) => b.toString("base64url")

let cachedKey: { raw: string | undefined; key: Buffer | null } | null = null
let warned = false

function key(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY
  if (cachedKey && cachedKey.raw === raw) return cachedKey.key
  let k: Buffer | null = null
  if (raw) {
    k = Buffer.from(raw, "base64")
    // A key that is set but wrong is a configuration mistake: fail loudly rather than write plain text
    if (k.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)")
  }
  cachedKey = { raw, key: k }
  return k
}

export function isEncrypted(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(PREFIX)
}

/** Encrypts any JSON value; returns it unchanged when no key is configured or it is already encrypted. */
export function encryptValue<T>(value: T): T | string {
  if (value === null || value === undefined || isEncrypted(value)) return value
  const k = key()
  if (!k) {
    if (!warned) { warned = true; console.warn("[field-crypto] DATA_ENCRYPTION_KEY is not set: writing free text unencrypted") }
    return value
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return PREFIX + b64url(Buffer.concat([iv, cipher.getAuthTag(), ct]))
}

/** Decrypts a stored value; anything that isn't ours (or can't be decrypted) is returned as it is. */
export function decryptValue(value: unknown): unknown {
  if (!isEncrypted(value)) return value
  const k = key()
  if (!k) return value
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64url")
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, buf.subarray(0, 12))
    decipher.setAuthTag(buf.subarray(12, 28))
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8"))
  } catch {
    // E.g. a note a user typed that happens to start with the prefix, or a different key
    return value
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/** Decrypts every encrypted string in a query result (any nesting: includes, arrays). */
export function decryptDeep<T>(value: T): T {
  if (isEncrypted(value)) return decryptValue(value) as T
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = decryptDeep(value[i])
    return value
  }
  if (isPlainObject(value)) {
    const obj = value as Record<string, unknown>
    for (const k of Object.keys(obj)) obj[k] = decryptDeep(obj[k])
  }
  return value
}

function encryptRecord(model: string, data: unknown) {
  const spec = ENCRYPTED_FIELDS[model]
  if (!spec || !isPlainObject(data)) return data
  const out: Record<string, unknown> = { ...data }
  for (const f of spec.strings ?? []) {
    const v = out[f]
    if (typeof v === "string") out[f] = encryptValue(v)
    else if (isPlainObject(v) && typeof v.set === "string") out[f] = { ...v, set: encryptValue(v.set) }
  }
  for (const f of spec.json ?? []) {
    const v = out[f]
    // Prisma's JsonNull/DbNull sentinels are class instances, not plain values: leave them
    if (typeof v === "string" || Array.isArray(v) || isPlainObject(v) || typeof v === "number" || typeof v === "boolean") out[f] = encryptValue(v)
  }
  return out
}

/** The query args with the model's encrypted columns encrypted in `data` / `create` / `update`. */
export function encryptArgs(model: string, args: unknown) {
  if (!ENCRYPTED_FIELDS[model] || !isPlainObject(args)) return args
  const out: Record<string, unknown> = { ...args }
  const enc = (d: unknown) => (Array.isArray(d) ? d.map(x => encryptRecord(model, x)) : encryptRecord(model, d))
  if ("data" in out) out.data = enc(out.data)
  if ("create" in out) out.create = enc(out.create)
  if ("update" in out) out.update = enc(out.update)
  return out
}

/** For tests: forget the cached key so a changed env var takes effect. */
export function resetKeyCache() {
  cachedKey = null
  warned = false
}
