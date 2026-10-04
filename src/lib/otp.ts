import { createHmac, randomInt } from "crypto"

export const OTP_LENGTH = 8
export const OTP_TTL_MS = 5 * 60 * 1000

/** A cryptographically random numeric sign-in code. */
export function generateOtp() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0")
}

/**
 * What is stored for a code: an HMAC with a server secret, so a database leak doesn't reveal usable
 * codes and the 10^8 space can't be brute-forced offline without the secret.
 */
export function hashOtp(code: string) {
  const secret = process.env.SESSION_SECRET || process.env.LINE_CHANNEL_SECRET
  if (!secret) throw new Error("No secret configured for sign-in codes")
  return createHmac("sha256", `paopao-otp:${secret}`).update(code).digest("hex")
}

export const isWellFormedOtp = (code: string) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)

/**
 * Guessing limits. Per IP stops a single client; the global cap bounds a distributed attack, since
 * a guess is checked against every user's active code. When the global cap trips, OTP sign-in
 * pauses briefly for everyone (LIFF sign-in keeps working).
 */
export const OTP_LIMITS = {
  perIp: { maxFailures: 5, windowMs: 15 * 60 * 1000 },
  global: { maxFailures: 30, windowMs: 5 * 60 * 1000 },
}

export function otpRateLimitReason(counts: { ipFailures: number; globalFailures: number }) {
  if (counts.ipFailures >= OTP_LIMITS.perIp.maxFailures) return "ip" as const
  if (counts.globalFailures >= OTP_LIMITS.global.maxFailures) return "global" as const
  return null
}
