import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateOtp, hashOtp, isWellFormedOtp, OTP_LIMITS, otpRateLimitReason } from './otp'

describe('generateOtp', () => {
  it('always returns 8 digits, including leading zeros', () => {
    for (let i = 0; i < 500; i++) expect(generateOtp()).toMatch(/^\d{8}$/)
  })

  it('is not repetitive', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateOtp))
    expect(codes.size).toBeGreaterThan(995)
  })
})

describe('hashOtp', () => {
  beforeEach(() => vi.stubEnv('SESSION_SECRET', 'secret-a'))
  afterEach(() => vi.unstubAllEnvs())

  it('is deterministic and never the code itself', () => {
    expect(hashOtp('12345678')).toBe(hashOtp('12345678'))
    expect(hashOtp('12345678')).not.toContain('12345678')
    expect(hashOtp('12345678')).not.toBe(hashOtp('12345679'))
  })

  it('depends on the server secret, so leaked hashes cannot be brute-forced offline', () => {
    const a = hashOtp('12345678')
    vi.stubEnv('SESSION_SECRET', 'secret-b')
    expect(hashOtp('12345678')).not.toBe(a)
  })

  it('refuses to work without a secret', () => {
    vi.stubEnv('SESSION_SECRET', '')
    vi.stubEnv('LINE_CHANNEL_SECRET', '')
    expect(() => hashOtp('12345678')).toThrow()
  })
})

describe('isWellFormedOtp', () => {
  it.each(['12345678', '00000001'])('accepts %s', c => expect(isWellFormedOtp(c)).toBe(true))
  it.each(['123456', '1234567890', 'abcdefgh', '1234 5678', ''])('rejects "%s"', c => expect(isWellFormedOtp(c)).toBe(false))
})

describe('otpRateLimitReason', () => {
  it('allows attempts under both limits', () => {
    expect(otpRateLimitReason({ ipFailures: OTP_LIMITS.perIp.maxFailures - 1, globalFailures: OTP_LIMITS.global.maxFailures - 1 })).toBeNull()
  })

  it('blocks an IP after too many failures', () => {
    expect(otpRateLimitReason({ ipFailures: OTP_LIMITS.perIp.maxFailures, globalFailures: 0 })).toBe('ip')
  })

  it('pauses code sign-in for everyone when failures spike system-wide (distributed guessing)', () => {
    expect(otpRateLimitReason({ ipFailures: 0, globalFailures: OTP_LIMITS.global.maxFailures })).toBe('global')
  })

  it('keeps worst-case guessing negligible against the 10^8 code space', () => {
    // Max guesses per 15 min system-wide, even with many IPs, against a few concurrently active codes
    const guessesPer15Min = OTP_LIMITS.global.maxFailures * (15 * 60 * 1000 / OTP_LIMITS.global.windowMs)
    const activeCodes = 10
    expect((guessesPer15Min * activeCodes) / 1e8).toBeLessThan(1e-4)
  })
})
