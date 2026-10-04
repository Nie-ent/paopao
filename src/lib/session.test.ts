import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSessionToken, verifySessionToken, SESSION_MAX_AGE_SECONDS } from './session'

const LINE_ID = 'U0123456789abcdef0123456789abcdef'

describe('session tokens', () => {
  beforeEach(() => { vi.stubEnv('SESSION_SECRET', 'test-secret'); vi.stubEnv('LINE_CHANNEL_SECRET', '') })
  afterEach(() => vi.unstubAllEnvs())

  it('round-trips a LINE user id', async () => {
    const token = await createSessionToken(LINE_ID)
    expect(await verifySessionToken(token)).toBe(LINE_ID)
  })

  it('rejects the old unsigned cookie (a bare LINE user id)', async () => {
    expect(await verifySessionToken(LINE_ID)).toBeNull()
  })

  it('rejects a token whose user id was swapped', async () => {
    const [, exp, sig] = (await createSessionToken(LINE_ID))!.split('.')
    expect(await verifySessionToken(`Uattacker.${exp}.${sig}`)).toBeNull()
  })

  it('rejects a token whose expiry was extended', async () => {
    const [id, exp, sig] = (await createSessionToken(LINE_ID))!.split('.')
    expect(await verifySessionToken(`${id}.${Number(exp) + 999999}.${sig}`)).toBeNull()
  })

  it('rejects expired tokens', async () => {
    const now = Date.now()
    const token = await createSessionToken(LINE_ID, now)
    expect(await verifySessionToken(token, now + (SESSION_MAX_AGE_SECONDS + 1) * 1000)).toBeNull()
  })

  it('rejects tokens signed with another secret', async () => {
    const token = await createSessionToken(LINE_ID)
    vi.stubEnv('SESSION_SECRET', 'rotated')
    expect(await verifySessionToken(token)).toBeNull()
  })

  it('falls back to a key derived from LINE_CHANNEL_SECRET', async () => {
    vi.stubEnv('SESSION_SECRET', '')
    vi.stubEnv('LINE_CHANNEL_SECRET', 'line-secret')
    expect(await verifySessionToken(await createSessionToken(LINE_ID))).toBe(LINE_ID)
  })

  it('fails closed with no secret at all', async () => {
    vi.stubEnv('SESSION_SECRET', '')
    vi.stubEnv('LINE_CHANNEL_SECRET', '')
    expect(await createSessionToken(LINE_ID)).toBeNull()
    expect(await verifySessionToken('a.b.c')).toBeNull()
  })
})
