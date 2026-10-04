import { createHash } from "crypto"

/** SHA-256 of an image, so re-sending the exact same file is caught even without a readable reference. */
export function hashImage(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

/**
 * Normalizes a bank reference read by the AI ("Ref: 0160 6209 2532") into a comparable key.
 * Short or missing values return null: they are too likely to collide to be used for duplicates.
 */
export function normalizeReference(raw: string | null | undefined) {
  if (!raw) return null
  const ref = raw.replace(/^(ref(erence)?\.?\s*(no\.?)?|เลขที่รายการ|รหัสอ้างอิง)\s*[:#]?\s*/i, "").replace(/[\s-]/g, "").toUpperCase()
  return ref.length >= 8 ? ref : null
}
